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

  @Column({ length: 50, unique: true })
  sku: string;
}
