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
  minPrice?: number;
  maxPrice?: number;
  sort?: ProductSort;
}

// ILIKE 검색어의 LIKE 와일드카드(\ % _)를 리터럴로 이스케이프한다.
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (m) => `\\${m}`);
}

const SEARCH_BY_IMAGE_LIMIT = 5;
// DINOv2 임베딩 기준 임계값(결정 32 개정). top-1 유사도 실측(보정 스파이크): 무관 이미지
// (노트북/풍경/고양이 등)는 최대 0.382, 실제 상품 사진은 최소 0.417로 그 사이에 깨끗한
// 간격이 있어 0.40을 운영점으로 둔다. 0.40 미만은 무관으로 보고 결과에서 제외(오리 캐릭터가
// 운동화에 0.175로 오탐되던 문제 해소). 실사용 검색 로그가 쌓이면 재튜닝.
const MIN_SIMILARITY = 0.4;

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
  ) {}

  async findAll(options: FindProductsOptions = {}): Promise<PaginatedProducts> {
    const { category, search, minPrice, maxPrice, sort } = options;
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
    if (minPrice != null) {
      qb.andWhere('product.basePrice >= :minPrice', { minPrice });
    }
    if (maxPrice != null) {
      qb.andWhere('product.basePrice <= :maxPrice', { maxPrice });
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
      .filter((result) => result.similarity >= MIN_SIMILARITY)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, SEARCH_BY_IMAGE_LIMIT);
  }
}
