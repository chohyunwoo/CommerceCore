import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductOption } from '../products/entities/product-option.entity';
import { Product } from '../products/entities/product.entity';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { DeliveryEvent } from './entities/delivery-event.entity';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProductOption,
      Product,
      Order,
      OrderItem,
      DeliveryEvent,
    ]),
    AuthModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
