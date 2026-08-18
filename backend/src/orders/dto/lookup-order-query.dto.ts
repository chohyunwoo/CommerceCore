import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty } from 'class-validator';

export class LookupOrderQueryDto {
  @ApiProperty({ example: 'ORD-20260818-A1B2C3' })
  @IsNotEmpty()
  orderNumber: string;

  @ApiProperty({ example: 'buyer@example.com' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  email: string;
}
