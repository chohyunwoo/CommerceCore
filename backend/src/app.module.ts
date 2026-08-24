import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ProductsModule } from './products/products.module';
import { RedisModule } from './redis/redis.module';
import { CartModule } from './cart/cart.module';
import { OrdersModule } from './orders/orders.module';
import { EventsModule } from './common/events/events.module';
import { AdminModule } from './admin/admin.module';
import { PaymentsModule } from './payments/payments.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => [
        {
          name: 'default',
          ttl: configService.get<number>('THROTTLE_TTL_MS', 60_000),
          limit: configService.get<number>('THROTTLE_LIMIT', 100),
        },
      ],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const databaseUrl = configService.get<string>('DATABASE_URL');
        const poolMax = configService.get<number>('DB_POOL_MAX', 10);
        // 결정 29 → 배포 시 마이그레이션 자동 적용으로 전환(migrationsRun). 마이그레이션은
        // 전부 멱등적이라 이미 적용된 환경에선 no-op이고, 매 PR CI에서 migration:run으로
        // 사전 검증된다(실패 시 부팅이 크래시하므로 검증되지 않은 마이그레이션은 배포되지 않음).
        // 글롭은 app.module 위치 기준(__dirname): 컴파일 시 dist/migrations/*.js, dev는 src/*.ts.
        const migrations = [__dirname + '/migrations/*{.ts,.js}'];
        if (databaseUrl) {
          // 프로덕션: Supabase 등 URL 기반 연결 (SSL 필수)
          return {
            type: 'postgres',
            url: databaseUrl,
            ssl: { rejectUnauthorized: false },
            extra: { max: poolMax },
            autoLoadEntities: true,
            synchronize: false,
            migrations,
            migrationsRun: true,
          };
        }
        // 로컬 개발: host/port 방식
        return {
          type: 'postgres',
          host: configService.get<string>('DB_HOST'),
          port: configService.get<number>('DB_PORT'),
          username: configService.get<string>('DB_USERNAME'),
          password: configService.get<string>('DB_PASSWORD'),
          database: configService.get<string>('DB_DATABASE'),
          extra: { max: poolMax },
          autoLoadEntities: true,
          synchronize: false,
          migrations,
          migrationsRun: true,
        };
      },
    }),
    RedisModule,
    EventsModule,
    ProductsModule,
    CartModule,
    OrdersModule,
    AdminModule,
    PaymentsModule,
    HealthModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
