import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

// 재입고(옵션 재고 수정)용 DTO. 절대값으로 재고를 덮어쓴다(증감이 아님).
export class UpdateOptionStockDto {
  @ApiProperty({ example: 20, description: '변경할 재고 수량(0 이상)' })
  @IsInt()
  @Min(0)
  stock: number;
}
