import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, IsNull, Repository } from 'typeorm';
import { Product } from './entities/product.entity';
import { AppErrors } from '../common/errors/app-errors';
import { AppException } from '../common/errors/app-exception';
import { cosineSimilarity } from './utils/cosine-similarity';
import { ProductSearchResult } from './products.types';

export interface PaginatedProducts {
  items: Product[];
  total: number;
  page: number;
  totalPages: number;
}

const SEARCH_BY_IMAGE_LIMIT = 5;
// DINOv2 임베딩 기준 재보정(결정 32 개정). 스파이크 실측상 다른 카테고리 평균 유사도가
// 0.086, 같은 카테고리 평균이 0.232로 분포가 CLIP보다 훨씬 넓게 갈린다. 명백히 무관한
// 항목을 걸러내는 최소 안전장치로 0.15를 둔다(실사용 데이터로 재튜닝 여지).
const MIN_SIMILARITY = 0.15;

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
  ) {}

  async findAll(
    categoryName?: string,
    page = 1,
    limit = 12,
  ): Promise<PaginatedProducts> {
    // 소프트 삭제된(is_active=false) 상품은 고객 목록에서 제외한다(이슈 #88).
    const [items, total] = await this.productRepository.findAndCount({
      relations: { category: true },
      where: categoryName
        ? { isActive: true, category: { name: categoryName } }
        : { isActive: true },
      order: { id: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { items, total, page, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: number): Promise<Product> {
    const product = await this.productRepository.findOne({
      where: { id, isActive: true },
      relations: { category: true, options: true },
    });

    if (!product) {
      throw new AppException(
        AppErrors.PRODUCT_NOT_FOUND,
        `상품(id: ${id})을 찾을 수 없습니다.`,
      );
    }

    return product;
  }

  async searchByImage(embedding: number[]): Promise<ProductSearchResult[]> {
    const products = await this.productRepository.find({
      where: { imageEmbedding: Not(IsNull()), isActive: true },
    });

    return products
      .map((product) => ({
        id: product.id,
        categoryId: product.categoryId,
        name: product.name,
        description: product.description,
        basePrice: product.basePrice,
        imageUrl: product.imageUrl,
        similarity: cosineSimilarity(embedding, product.imageEmbedding!),
      }))
      .filter((result) => result.similarity >= MIN_SIMILARITY)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, SEARCH_BY_IMAGE_LIMIT);
  }
}
