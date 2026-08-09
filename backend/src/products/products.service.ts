import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from './entities/product.entity';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
  ) {}

  async findAll(categoryName?: string): Promise<Product[]> {
    return this.productRepository.find({
      relations: { category: true },
      where: categoryName ? { category: { name: categoryName } } : undefined,
      order: { id: 'ASC' },
    });
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
