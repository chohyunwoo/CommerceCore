import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';

export class ConfirmPaymentDto {
  @ApiProperty({ description: 'TossPayments 결제창에서 발급된 결제 키' })
  @IsString()
  @IsNotEmpty()
  paymentKey: string;

  @ApiProperty({ example: 'ORD-20260818-A1B2C3', description: '주문번호' })
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @ApiProperty({ example: 10000, minimum: 1, description: '결제 금액(원)' })
  @IsNumber()
  @Min(1)
  amount: number;
}
