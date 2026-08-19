import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';
import { CreateOrderItemDto } from './create-order-item.dto';

export class CreateOrderDto {
  @ApiProperty({ example: 'buyer@example.com' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  buyerEmail: string;

  @ApiProperty({ example: '홍길동' })
  @IsString()
  buyerName: string;

  @ApiProperty({ example: '010-1234-5678' })
  @IsString()
  buyerPhone: string;

  @ApiProperty({ example: '06236', description: '우편번호 (5자리 숫자)' })
  @Matches(/^\d{5}$/, { message: '우편번호는 5자리 숫자여야 합니다.' })
  postalCode: string;

  @ApiProperty({ example: '서울시 강남구 테헤란로 123' })
  @IsString()
  baseAddress: string;

  @ApiProperty({ example: '101동 202호', required: false })
  @IsOptional()
  @IsString()
  detailAddress?: string;

  @ApiProperty({ type: [CreateOrderItemDto] })
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];
}
