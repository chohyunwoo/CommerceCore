import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductOption } from '../products/entities/product-option.entity';
import { Product } from '../products/entities/product.entity';
import { Category } from '../products/entities/category.entity';
import { Order } from '../orders/entities/order.entity';
import { DeliveryEvent } from '../orders/entities/delivery-event.entity';
import { User } from '../auth/entities/user.entity';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminGuard } from '../common/guards/admin.guard';
import { AdminSseGuard } from '../common/guards/admin-sse.guard';
import { PaymentsModule } from '../payments/payments.module';
import { OrdersModule } from '../orders/orders.module';
import { SupabaseStorageService } from './supabase-storage.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProductOption,
      Product,
      Category,
      Order,
      DeliveryEvent,
      User,
    ]),
    PaymentsModule,
    // 주문 취소 시 재고 복원 + 만료 회수 로직을 OrdersService에서 재사용(결정 45).
    OrdersModule,
  ],
  controllers: [AdminController],
  providers: [AdminService, AdminGuard, AdminSseGuard, SupabaseStorageService],
})
export class AdminModule {}
