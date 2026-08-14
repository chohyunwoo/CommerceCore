import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsEmail,
  IsString,
  ValidateNested,
} from 'class-validator';
import { CreateOrderItemDto } from './create-order-item.dto';

export class CreateOrderDto {
  @IsEmail()
  buyerEmail: string;

  @IsString()
  buyerName: string;

  @IsString()
  buyerPhone: string;

  @IsString()
  buyerAddress: string;

  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];
}
