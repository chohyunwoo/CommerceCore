import { IsInt, Min } from 'class-validator';

export class AddCartItemDto {
  @IsInt()
  productOptionId: number;

  @IsInt()
  @Min(1)
  quantity: number;
}
