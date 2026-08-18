import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayNotEmpty, ValidateNested } from 'class-validator';
import { ValidateStockItemDto } from './validate-stock-item.dto';

export class ValidateStockDto {
  @ApiProperty({ type: [ValidateStockItemDto] })
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => ValidateStockItemDto)
  items: ValidateStockItemDto[];
}
