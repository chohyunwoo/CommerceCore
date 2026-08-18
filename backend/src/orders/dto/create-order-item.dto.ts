import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class CreateOrderItemDto {
  @ApiProperty({ example: 3, description: '상품 옵션 ID' })
  @IsInt()
  productOptionId: number;

  @ApiProperty({ example: 1, minimum: 1, description: '수량' })
  @IsInt()
  @Min(1)
  quantity: number;
}
