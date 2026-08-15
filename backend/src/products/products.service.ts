import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from './entities/product.entity';

export interface PaginatedProducts {
  items: Product[];
  total: number;
  page: number;
  totalPages: number;
}

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
    const [items, total] = await this.productRepository.findAndCount({
      relations: { category: true },
      where: categoryName ? { category: { name: categoryName } } : undefined,
      order: { id: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { items, total, page, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: number): Promise<Product> {
    const product = await this.productRepository.findOne({
      where: { id },
      relations: { category: true, options: true },
    });

    if (!product) {
      throw new NotFoundException(`상품(id: ${id})을 찾을 수 없습니다.`);
    }

    return product;
  }
}
