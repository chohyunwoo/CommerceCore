import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Product } from './product.entity';

@Entity('product_options')
export class ProductOption {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'product_id' })
  productId: number;

  @ManyToOne(() => Product, (product) => product.options)
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column({ length: 20 })
  size: string;

  @Column({ length: 30 })
  color: string;

  @Column({ type: 'int', default: 0 })
  stock: number;

  // 전역 UNIQUE가 아니라 활성 옵션에만 적용되는 부분 유니크 인덱스로 관리한다(이슈 #92).
  @Column({ length: 50 })
  sku: string;

  // 소프트 삭제 플래그(이슈 #92). 상품 소프트 삭제 시 옵션도 false가 되며,
  // false인 옵션의 SKU는 부분 유니크 인덱스에서 빠져 재사용 가능해진다.
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;
}
