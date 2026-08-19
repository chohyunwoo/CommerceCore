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

/**
 * 하이픈 유무·공백 등 입력 형식과 무관하게 숫자만 추출해 010-1234-5678 형식으로
 * 정규화한다 (이슈 #53). 010은 항상 11자리(3-4-4), 011/016/017/018/019 등 구 번호대는
 * 10자리(3-3-4)일 수 있어 마지막 4자리를 기준으로 나머지를 가운데 그룹에 채운다.
 */
function normalizePhone(value: unknown): unknown {
  if (typeof value !== 'string') return value;

  const digits = value.replace(/\D/g, '');
  if (digits.length < 9 || digits.length > 11) return digits;

  const prefix = digits.slice(0, 3);
  const rest = digits.slice(3);
  const last4 = rest.slice(-4);
  const middle = rest.slice(0, -4);

  return middle ? `${prefix}-${middle}-${last4}` : `${prefix}-${last4}`;
}

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

  @ApiProperty({
    example: '010-1234-5678',
    description:
      '하이픈 유무 무관하게 입력 가능 — 010-1234-5678 형식으로 정규화되어 저장됨',
  })
  @Transform(({ value }: { value: unknown }) => normalizePhone(value))
  @Matches(/^01[016789]-\d{3,4}-\d{4}$/, {
    message: '올바른 국내 휴대폰 번호 형식이 아닙니다.',
  })
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
