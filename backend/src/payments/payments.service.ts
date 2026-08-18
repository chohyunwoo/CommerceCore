import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Order } from '../orders/entities/order.entity';
import { OrderStatus } from '../orders/entities/order-status.enum';
import { DomainEventsService } from '../common/events/domain-events.service';
import { ConfirmPaymentDto } from './dto/confirm-payment.dto';
import { AppErrors, AppErrorDefinition } from '../common/errors/app-errors';
import { AppException } from '../common/errors/app-exception';

const TOSS_CONFIRM_URL = 'https://api.tosspayments.com/v1/payments/confirm';
const TOSS_CANCEL_URL = (paymentKey: string) =>
  `https://api.tosspayments.com/v1/payments/${paymentKey}/cancel`;
const TOSS_TIMEOUT_MS = 10_000;
const RETRY_DELAYS_MS = [300, 900];
const ALREADY_PROCESSED_ERROR_CODE = 'ALREADY_PROCESSED_PAYMENT';

interface TossErrorBody {
  code?: string;
  message: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly domainEvents: DomainEventsService,
  ) {}

  async confirm(
    dto: ConfirmPaymentDto,
  ): Promise<{ orderNumber: string; status: OrderStatus }> {
    const order = await this.dataSource.transaction(async (manager) => {
      const order = await manager.findOne(Order, {
        where: { orderNumber: dto.orderId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!order) {
        throw new AppException(
          AppErrors.ORDER_NOT_FOUND,
          `주문(${dto.orderId})을 찾을 수 없습니다.`,
        );
      }
      if (order.status !== OrderStatus.PENDING) {
        throw new AppException(AppErrors.PAYMENT_ALREADY_PROCESSED);
      }
      if (order.totalAmount !== dto.amount) {
        throw new AppException(AppErrors.PAYMENT_AMOUNT_MISMATCH);
      }

      const alreadyProcessed = await this.confirmWithToss(dto);
      if (alreadyProcessed) {
        this.logger.log(
          `주문(${dto.orderId})은 TossPayments에서 이미 처리된 결제로 확인됨 — 주문 상태만 동기화합니다.`,
        );
      }

      order.status = OrderStatus.PAID;
      order.paymentKey = dto.paymentKey;
      return manager.save(order);
    });

    this.domainEvents.emitOrderUpdate({
      orderNumber: order.orderNumber,
      status: order.status,
      buyerName: order.buyerName,
      totalAmount: order.totalAmount,
      createdAt: order.createdAt,
    });

    return { orderNumber: order.orderNumber, status: order.status };
  }

  /** PAID 상태 주문의 결제를 TossPayments에서 취소한다. 실패하면 예외를 던진다(호출부에서 트랜잭션 롤백 처리). */
  async cancel(paymentKey: string, reason: string): Promise<void> {
    const response = await this.requestTossWithRetry(
      TOSS_CANCEL_URL(paymentKey),
      { cancelReason: reason },
      `cancel:${paymentKey}`,
      AppErrors.PAYMENT_CANCEL_FAILED,
    );

    if (response.ok) {
      return;
    }

    const error = (await response.json()) as TossErrorBody;
    throw new AppException(
      AppErrors.PAYMENT_CANCEL_FAILED,
      `TossPayments 취소 실패: ${error.message}`,
    );
  }

  /**
   * TossPayments 승인 API를 호출한다.
   * 이미 처리된 결제(`ALREADY_PROCESSED_PAYMENT`)로 확인되면 true(멱등 성공)를 반환한다.
   */
  private async confirmWithToss(dto: ConfirmPaymentDto): Promise<boolean> {
    const response = await this.requestTossWithRetry(
      TOSS_CONFIRM_URL,
      {
        paymentKey: dto.paymentKey,
        orderId: dto.orderId,
        amount: dto.amount,
      },
      `confirm:${dto.orderId}`,
      AppErrors.PAYMENT_PG_CONFIRM_FAILED,
    );

    if (response.ok) {
      return false;
    }

    const error = (await response.json()) as TossErrorBody;
    if (error.code === ALREADY_PROCESSED_ERROR_CODE) {
      return true;
    }

    throw new AppException(
      AppErrors.PAYMENT_PG_CONFIRM_FAILED,
      `TossPayments 승인 실패: ${error.message}`,
    );
  }

  /**
   * TossPayments POST API를 호출한다. 타임아웃(10초), 네트워크 오류/5xx 재시도(최대 2회, 백오프
   * 300ms/900ms), `Idempotency-Key` 헤더를 공통으로 적용한다. 4xx 응답이나 재시도가 소진된 5xx
   * 응답은 그대로 반환하므로 호출부에서 도메인별로 해석한다. 네트워크 자체가 끝까지 실패하면
   * `networkFailureError`로 던진다.
   */
  private async requestTossWithRetry(
    url: string,
    body: unknown,
    idempotencyKey: string,
    networkFailureError: AppErrorDefinition,
  ): Promise<Response> {
    const secretKey = this.configService.get<string>(
      'TOSSPAYMENTS_SECRET_KEY',
      '',
    );
    const credentials = Buffer.from(`${secretKey}:`).toString('base64');
    const attempts = RETRY_DELAYS_MS.length + 1;

    for (let attempt = 0; attempt < attempts; attempt++) {
      const isLastAttempt = attempt === attempts - 1;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TOSS_TIMEOUT_MS);

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Basic ${credentials}`,
            'Content-Type': 'application/json',
            'Idempotency-Key': idempotencyKey,
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        if (response.status >= 500 && !isLastAttempt) {
          await sleep(RETRY_DELAYS_MS[attempt]);
          continue;
        }

        return response;
      } catch {
        if (isLastAttempt) {
          throw new AppException(
            networkFailureError,
            'TossPayments 요청이 시간 초과되었거나 네트워크 오류가 발생했습니다.',
          );
        }
        await sleep(RETRY_DELAYS_MS[attempt]);
      } finally {
        clearTimeout(timer);
      }
    }

    throw new AppException(networkFailureError);
  }
}
