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
// CLIP 이미지 임베딩끼리는 서로 무관한 사진도 코사인 유사도가 0.5~0.7대로 뭉치는 경향이 있어
// (예: 신발과 조거 팬츠가 0.6대로 나오는 경우) 이 값 하나로 카테고리를 깔끔하게 갈라내진 못한다.
// 다만 명백히 무관한 항목(0.5 미만)은 걸러내는 최소한의 안전장치로 둔다.
const MIN_SIMILARITY = 0.5;

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
