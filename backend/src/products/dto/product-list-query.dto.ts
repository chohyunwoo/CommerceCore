import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

// 정렬 옵션 — 서버에서 화이트리스트 매핑으로만 처리(문자열 직접 삽입 금지).
export enum ProductSort {
  LATEST = 'latest',
  PRICE_ASC = 'price_asc',
  PRICE_DESC = 'price_desc',
  NAME = 'name',
}

export class ProductListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: '카테고리 이름 필터' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: '상품명 부분 검색' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: ProductSort, default: ProductSort.LATEST })
  @IsOptional()
  @IsEnum(ProductSort)
  sort?: ProductSort;
}
