import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ProductListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: '카테고리 이름 필터' })
  @IsOptional()
  @IsString()
  category?: string;
}
