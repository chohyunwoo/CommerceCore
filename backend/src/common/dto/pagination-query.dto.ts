import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * 목록 조회 공용 페이지네이션 쿼리. page/limit을 선택으로 두어 생략 시 각 서비스의
 * 기본값(예: products 12, my 10, admin 20)이 그대로 적용되고, 값이 오면 정수·최소 1·
 * 최대 100으로 강제한다 — `?limit=1000000`(대량 로드)·`?limit=abc`(NaN 전파)를 차단.
 */
export class PaginationQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
