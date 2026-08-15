import { IsEnum } from 'class-validator';
import { OrderStatus } from '../../orders/entities/order-status.enum';

export class UpdateOrderStatusDto {
  @IsEnum(OrderStatus)
  status: OrderStatus;
}
