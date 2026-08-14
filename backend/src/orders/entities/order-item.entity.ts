import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Order } from './order.entity';
import { ProductOption } from '../../products/entities/product-option.entity';

@Entity('order_items')
export class OrderItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'order_id' })
  orderId: number;

  @ManyToOne(() => Order, (order) => order.items)
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Column({ name: 'product_option_id' })
  productOptionId: number;

  @ManyToOne(() => ProductOption)
  @JoinColumn({ name: 'product_option_id' })
  productOption: ProductOption;

  @Column({ type: 'int' })
  quantity: number;

  @Column({ name: 'price_at_order', type: 'int' })
  priceAtOrder: number;
}
