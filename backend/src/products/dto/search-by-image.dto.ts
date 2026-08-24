import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayNotEmpty, IsNumber } from 'class-validator';

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
}
