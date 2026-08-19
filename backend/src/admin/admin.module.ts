import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductOption } from '../products/entities/product-option.entity';
import { Product } from '../products/entities/product.entity';
import { Category } from '../products/entities/category.entity';
import { Order } from '../orders/entities/order.entity';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminGuard } from '../common/guards/admin.guard';
import { PaymentsModule } from '../payments/payments.module';
import { SupabaseStorageService } from './supabase-storage.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProductOption, Product, Category, Order]),
    PaymentsModule,
  ],
  controllers: [AdminController],
  providers: [AdminService, AdminGuard, SupabaseStorageService],
})
export class AdminModule {}
