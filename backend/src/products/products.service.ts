import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, IsNull, Repository } from 'typeorm';
import { Product } from './entities/product.entity';
import { AppErrors } from '../common/errors/app-errors';
import { AppException } from '../common/errors/app-exception';
import { cosineSimilarity } from './utils/cosine-similarity';
import { ProductSearchResult } from './products.types';
import { ProductSort } from './dto/product-list-query.dto';

export interface PaginatedProducts {
  items: Product[];
  total: number;
  page: number;
  totalPages: number;
}

export interface FindProductsOptions {
  category?: string;
  page?: number;
  limit?: number;
  search?: string;
  sort?: ProductSort;
}

// ILIKE 검색어의 LIKE 와일드카드(\ % _)를 리터럴로 이스케이프한다.
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (m) => `\\${m}`);
}

const SEARCH_BY_IMAGE_LIMIT = 5;
// 하이브리드 방식(결정 32 재개정, 2026-08-25). 프로덕션 카탈로그(DINOv2 384차원 50개)
// 실측: 같은 카테고리끼리도 유사도 중앙값 0.18~0.30(신발↔신발 중앙값 0.30, 0.40 이상은 35%뿐).
// 즉 0.40 하드 컷오프는 실제 업로드 사진의 진짜 유사 상품까지 전부 걸러 결과가 비는 문제가 있었음.
// → 하드 컷오프 대신 "명백히 무관한 것만 거르는 낮은 바닥값"만 두고 항상 가장 비슷한 상위 N개를 반환.
// 무관 이미지는 최대 ~0.38까지 나올 수 있어 단일 임계값으로 정밀히 못 가르므로(정밀도↔재현율 트레이드오프),
// "확신" 여부(SIMILARITY_CONFIDENT 미만이면 '정확히 일치하는 상품 없음' 안내)는 프론트가 similarity로 판단.
const SIMILARITY_FLOOR = 0.15;

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
  ) {}

  async findAll(options: FindProductsOptions = {}): Promise<PaginatedProducts> {
    const { category, search, sort } = options;
    const page = options.page ?? 1;
    const limit = options.limit ?? 12;

    const qb = this.productRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.category', 'category')
      // 소프트 삭제된(is_active=false) 상품은 고객 목록에서 제외한다(이슈 #88).
      .where('product.isActive = :active', { active: true });

    if (category) {
      qb.andWhere('category.name = :category', { category });
    }
    const trimmedSearch = search?.trim();
    if (trimmedSearch) {
      qb.andWhere("product.name ILIKE :search ESCAPE '\\'", {
        search: `%${escapeLike(trimmedSearch)}%`,
      });
    }
    // 정렬은 화이트리스트로만 매핑(사용자 입력을 컬럼/방향에 직접 넣지 않음).
    switch (sort) {
      case ProductSort.PRICE_ASC:
        qb.orderBy('product.basePrice', 'ASC').addOrderBy('product.id', 'DESC');
        break;
      case ProductSort.PRICE_DESC:
        qb.orderBy('product.basePrice', 'DESC').addOrderBy(
          'product.id',
          'DESC',
        );
        break;
      case ProductSort.NAME:
        qb.orderBy('product.name', 'ASC').addOrderBy('product.id', 'DESC');
        break;
      case ProductSort.LATEST:
      default:
        qb.orderBy('product.id', 'DESC');
        break;
    }

    qb.skip((page - 1) * limit).take(limit);

    const [items, total] = await qb.getManyAndCount();
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
      .filter((result) => result.similarity >= SIMILARITY_FLOOR)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, SEARCH_BY_IMAGE_LIMIT);
  }
}
