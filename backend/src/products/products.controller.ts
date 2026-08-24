import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { SearchByImageDto } from './dto/search-by-image.dto';
import { ProductListQueryDto } from './dto/product-list-query.dto';

@ApiTags('products')
@UseInterceptors(CacheInterceptor)
@CacheTTL(30_000)
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @ApiOperation({ summary: '카테고리별 상품 목록 조회 (페이지네이션)' })
  @Get()
  findAll(@Query() query: ProductListQueryDto) {
    return this.productsService.findAll(
      query.category,
      query.page,
      query.limit,
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
  @HttpCode(200)
  searchByImage(@Body() dto: SearchByImageDto) {
    return this.productsService.searchByImage(dto.embedding);
  }
}
