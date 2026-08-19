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

  // 하위호환/표시용 — 신규 주문은 base_address + detail_address를 합쳐 자동 채워진다 (이슈 #52).
  @Column({ name: 'buyer_address', length: 500 })
  buyerAddress: string;

  @Column({ name: 'postal_code', type: 'varchar', length: 10, nullable: true })
  postalCode: string | null;

  @Column({ name: 'base_address', type: 'varchar', length: 255, nullable: true })
  baseAddress: string | null;

  @Column({
    name: 'detail_address',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  detailAddress: string | null;

  @Column({ name: 'total_amount', type: 'int' })
  totalAmount: number;

  @Column({ name: 'payment_key', type: 'varchar', length: 200, nullable: true })
  paymentKey: string | null;

  @OneToMany(() => OrderItem, (item) => item.order)
  items: OrderItem[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
