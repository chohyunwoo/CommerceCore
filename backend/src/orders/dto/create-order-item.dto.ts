import { IsInt, Min } from 'class-validator';

export class CreateOrderItemDto {
  @IsInt()
  productOptionId: number;

  @IsInt()
  @Min(1)
  quantity: number;
}
