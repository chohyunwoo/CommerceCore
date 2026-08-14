import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ProductOption } from '../products/entities/product-option.entity';
import { ValidateStockDto } from './dto/validate-stock.dto';
import { InsufficientStockItem, ValidateStockResponse } from './orders.types';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(ProductOption)
    private readonly productOptionRepository: Repository<ProductOption>,
  ) {}

  async validateStock(dto: ValidateStockDto): Promise<ValidateStockResponse> {
    const optionIds = dto.items.map((item) => item.productOptionId);
    const options = await this.productOptionRepository.find({
      where: { id: In(optionIds) },
      relations: { product: true },
    });
    const optionById = new Map(options.map((option) => [option.id, option]));

    const insufficientItems: InsufficientStockItem[] = [];

    for (const item of dto.items) {
      const option = optionById.get(item.productOptionId);

      if (!option) {
        insufficientItems.push({
          productOptionId: item.productOptionId,
          productName: '알 수 없는 상품',
          size: '-',
          color: '-',
          requestedQuantity: item.quantity,
          availableStock: 0,
        });
        continue;
      }

      if (option.stock < item.quantity) {
        insufficientItems.push({
          productOptionId: option.id,
          productName: option.product.name,
          size: option.size,
          color: option.color,
          requestedQuantity: item.quantity,
          availableStock: option.stock,
        });
      }
    }

    if (insufficientItems.length === 0) {
      return { valid: true };
    }

    return { valid: false, insufficientItems };
  }
}
