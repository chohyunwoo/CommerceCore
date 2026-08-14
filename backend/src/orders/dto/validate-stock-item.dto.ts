import { IsInt, Min } from 'class-validator';

export class ValidateStockItemDto {
  @IsInt()
  productOptionId: number;

  @IsInt()
  @Min(1)
  quantity: number;
}
