import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString, ValidateIf } from 'class-validator';
import { OrderStatus } from '../../orders/entities/order-status.enum';
import { Carrier } from '../../orders/entities/carrier.enum';

export class UpdateOrderStatusDto {
  @ApiProperty({ enum: OrderStatus, example: OrderStatus.PAID })
  @IsEnum(OrderStatus)
  status: OrderStatus;

  @ApiProperty({
    example: '1234567890123',
    required: false,
    description: 'status가 SHIPPED일 때 필수',
  })
  @ValidateIf((dto: UpdateOrderStatusDto) => dto.status === OrderStatus.SHIPPED)
  @IsString()
  @IsNotEmpty()
  trackingNumber?: string;

  @ApiProperty({
    enum: Carrier,
    example: Carrier.CJ_LOGISTICS,
    required: false,
    description: 'status가 SHIPPED일 때 필수',
  })
  @ValidateIf((dto: UpdateOrderStatusDto) => dto.status === OrderStatus.SHIPPED)
  @IsEnum(Carrier)
  carrier?: Carrier;
}
