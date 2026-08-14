import { Type } from 'class-transformer';
import { ArrayNotEmpty, ValidateNested } from 'class-validator';
import { ValidateStockItemDto } from './validate-stock-item.dto';

export class ValidateStockDto {
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => ValidateStockItemDto)
  items: ValidateStockItemDto[];
}
