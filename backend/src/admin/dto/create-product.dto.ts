import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayNotEmpty,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Min,
  ValidateNested,
} from 'class-validator';
import { CreateProductOptionDto } from './create-product-option.dto';

export class CreateProductDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  categoryId: number;

  @ApiProperty({ example: '에어맥스 90' })
  @IsString()
  name: string;

  @ApiProperty({ example: '클래식 러닝화', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 139000 })
  @IsInt()
  @Min(0)
  basePrice: number;

  @ApiProperty({
    example:
      'https://xxxx.supabase.co/storage/v1/object/public/product-images/products/xxx.jpg',
    description: 'POST /admin/products/upload-image 응답으로 받은 public URL',
  })
  @IsUrl()
  imageUrl: string;

  @ApiProperty({
    type: [Number],
    description:
      '프론트엔드(브라우저)에서 CLIP으로 계산한 이미지 임베딩. 서버는 재계산하지 않고 그대로 저장(결정 32).',
  })
  @ArrayNotEmpty()
  @IsNumber({}, { each: true })
  imageEmbedding: number[];

  @ApiProperty({ type: [CreateProductOptionDto] })
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateProductOptionDto)
  options: CreateProductOptionDto[];
}
