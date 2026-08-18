import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class UpdateCartItemDto {
  @ApiProperty({ example: 2, minimum: 1, description: '변경할 수량' })
  @IsInt()
  @Min(1)
  quantity: number;
}
