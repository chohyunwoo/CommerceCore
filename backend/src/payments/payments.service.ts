import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../orders/entities/order.entity';
import { OrderStatus } from '../orders/entities/order-status.enum';
import { DomainEventsService } from '../common/events/domain-events.service';
import { ConfirmPaymentDto } from './dto/confirm-payment.dto';
import { AppErrors } from '../common/errors/app-errors';
import { AppException } from '../common/errors/app-exception';

const TOSS_CONFIRM_URL = 'https://api.tosspayments.com/v1/payments/confirm';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly configService: ConfigService,
    private readonly domainEvents: DomainEventsService,
  ) {}

  async confirm(
    dto: ConfirmPaymentDto,
  ): Promise<{ orderNumber: string; status: OrderStatus }> {
    const order = await this.orderRepository.findOne({
      where: { orderNumber: dto.orderId },
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

    const secretKey = this.configService.get<string>(
      'TOSSPAYMENTS_SECRET_KEY',
      '',
    );
    const credentials = Buffer.from(`${secretKey}:`).toString('base64');

    const response = await fetch(TOSS_CONFIRM_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        paymentKey: dto.paymentKey,
        orderId: dto.orderId,
        amount: dto.amount,
      }),
    });

    if (!response.ok) {
      const error = (await response.json()) as { message: string };
      throw new AppException(
        AppErrors.PAYMENT_PG_CONFIRM_FAILED,
        `TossPayments 승인 실패: ${error.message}`,
      );
    }

    order.status = OrderStatus.PAID;
    await this.orderRepository.save(order);

    this.domainEvents.emitOrderUpdate({
      orderNumber: order.orderNumber,
      status: order.status,
      buyerName: order.buyerName,
      totalAmount: order.totalAmount,
      createdAt: order.createdAt,
    });

    return { orderNumber: order.orderNumber, status: order.status };
  }
}
