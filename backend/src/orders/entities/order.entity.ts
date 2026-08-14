import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { OrderStatus } from './order-status.enum';
import { OrderItem } from './order-item.entity';

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'order_number', length: 30, unique: true })
  orderNumber: string;

  @Column({
    type: 'enum',
    enumName: 'order_status',
    enum: OrderStatus,
    default: OrderStatus.PENDING,
  })
  status: OrderStatus;

  @Column({ name: 'buyer_email', length: 255 })
  buyerEmail: string;

  @Column({ name: 'buyer_name', length: 100 })
  buyerName: string;

  @Column({ name: 'buyer_phone', length: 30 })
  buyerPhone: string;

  @Column({ name: 'buyer_address', length: 500 })
  buyerAddress: string;

  @Column({ name: 'total_amount', type: 'int' })
  totalAmount: number;

  @OneToMany(() => OrderItem, (item) => item.order)
  items: OrderItem[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
