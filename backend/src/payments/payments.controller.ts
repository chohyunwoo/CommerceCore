import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { ConfirmPaymentDto } from './dto/confirm-payment.dto';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @ApiOperation({
    summary: 'TossPayments 결제 승인 (금액 검증 후 PG 승인 API 호출)',
  })
  @Post('confirm')
  confirm(@Body() dto: ConfirmPaymentDto) {
    return this.paymentsService.confirm(dto);
  }
}
