import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, Min } from 'class-validator';

export class CreateProductOptionDto {
  @ApiProperty({ example: '270' })
  @IsString()
  size: string;

  @ApiProperty({ example: '블랙' })
  @IsString()
  color: string;

  @ApiProperty({ example: 10 })
  @IsInt()
  @Min(0)
  stock: number;

  @ApiProperty({ example: 'SHOE-AIRMAX90-270-BLK' })
  @IsString()
  sku: string;
}
