import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class SearchByImageDto {
  @ApiProperty({
    type: [Number],
    description:
      '브라우저에서 DINOv2(dinov2-small)로 계산한 업로드 이미지의 임베딩 벡터(384차원)',
  })
  @ArrayNotEmpty()
  // 남용 방지 상한 — dinov2-small은 384차원이라 여유롭게 잡되 과도한 페이로드는 차단.
  @ArrayMaxSize(1024)
  @IsNumber({}, { each: true })
  embedding: number[];

  @ApiPropertyOptional({
    description:
      '검색 대상 카테고리 이름(신발/상의/하의). 생략하면 전체 카테고리에서 검색. ' +
      '자동 카테고리 판정(특히 하의)이 신뢰도가 낮아, 사용자가 직접 카테고리를 좁혀 ' +
      '해당 카테고리 안에서만 시각 유사도로 랭킹하도록 함(결정 32).',
  })
  @IsOptional()
  @IsString()
  category?: string;
}
