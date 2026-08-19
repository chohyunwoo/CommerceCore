import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { SearchByImageDto } from './dto/search-by-image.dto';

@ApiTags('products')
@UseInterceptors(CacheInterceptor)
@CacheTTL(30_000)
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @ApiOperation({ summary: '카테고리별 상품 목록 조회 (페이지네이션)' })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @Get()
  findAll(
    @Query('category') category?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.productsService.findAll(
      category,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 12,
    );
  }

  @ApiOperation({ summary: '상품 상세 + 옵션별 재고 조회' })
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.findOne(id);
  }

  @ApiOperation({
    summary:
      '이미지 기반 상품 시각적 유사도 검색 (임베딩은 클라이언트에서 계산해 전달)',
  })
  @Post('search-by-image')
  searchByImage(@Body() dto: SearchByImageDto) {
    return this.productsService.searchByImage(dto.embedding);
  }
}
