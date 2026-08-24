import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

// 회원(users)·구매자(orders) 목록의 공용 검색 쿼리. 이름 또는 이메일 부분 검색.
export class MemberSearchQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: '이름 또는 이메일 일부 검색' })
  @IsOptional()
  @IsString()
  search?: string;
}
