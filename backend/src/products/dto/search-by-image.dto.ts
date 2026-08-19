import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsNumber } from 'class-validator';

export class SearchByImageDto {
  @ApiProperty({
    type: [Number],
    description: '브라우저에서 CLIP으로 계산한 업로드 이미지의 임베딩 벡터',
  })
  @ArrayNotEmpty()
  @IsNumber({}, { each: true })
  embedding: number[];
}
