import {
  Body,
  Controller,
  Get,
  HttpCode,
  MessageEvent,
  Param,
  Patch,
  Post,
  Sse,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { map, Observable } from 'rxjs';
import { AdminService } from './admin.service';
import { DomainEventsService } from '../common/events/domain-events.service';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { CreateDeliveryEventDto } from './dto/create-delivery-event.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { AdminGuard } from '../common/guards/admin.guard';
import { SupabaseStorageService } from './supabase-storage.service';
import { AppErrors } from '../common/errors/app-errors';
import { AppException } from '../common/errors/app-exception';

@ApiTags('admin')
@ApiSecurity('admin-token')
@UseGuards(AdminGuard)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly domainEvents: DomainEventsService,
    private readonly supabaseStorageService: SupabaseStorageService,
  ) {}

  @ApiOperation({ summary: '카테고리 목록 (상품 등록 폼용)' })
  @Get('categories')
  getCategories() {
    return this.adminService.getCategories();
  }

  @ApiOperation({ summary: '상품 등록 (카테고리 + 최소 1개 옵션 포함)' })
  @Post('products')
  createProduct(@Body() dto: CreateProductDto) {
    return this.adminService.createProduct(dto);
  }

  @ApiOperation({
    summary:
      '상품 이미지 업로드 (Supabase Storage) — 업로드된 public URL을 상품 등록 시 imageUrl로 사용',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @Post('products/upload-image')
  @HttpCode(200)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  async uploadProductImage(@UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new AppException(AppErrors.INVALID_IMAGE_FILE);
    }
    const url = await this.supabaseStorageService.uploadImage(file);
    return { url };
  }

  @ApiOperation({ summary: '전체 상품 옵션의 현재 재고 목록' })
  @Get('stock-overview')
  getStockOverview() {
    return this.adminService.getStockOverview();
  }

  @ApiOperation({ summary: '최근 주문 목록 (최대 20건)' })
  @Get('orders/recent')
  getRecentOrders() {
    return this.adminService.getRecentOrders();
  }

  @ApiOperation({
    summary:
      '주문 상태 전이 (PAID→CANCELLED는 TossPayments 결제취소 API 호출 후 전이, ' +
      'PAID→SHIPPED는 trackingNumber/carrier 필수. SHIPPED→DELIVERED는 이 API로 ' +
      '직접 전이할 수 없음 — POST .../delivery-events로 배송 단계를 기록해야 함)',
  })
  @Patch('orders/:orderNumber/status')
  updateOrderStatus(
    @Param('orderNumber') orderNumber: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.adminService.updateOrderStatus(
      orderNumber,
      dto.status,
      dto.trackingNumber,
      dto.carrier,
    );
  }

  @ApiOperation({
    summary:
      '배송 단계 기록 (COLLECTED → IN_TRANSIT → OUT_FOR_DELIVERY → DELIVERED 순서로만 ' +
      '가능, SHIPPED 상태의 주문에만 가능. DELIVERED 기록 시 주문 status도 자동 전이)',
  })
  @Post('orders/:orderNumber/delivery-events')
  addDeliveryEvent(
    @Param('orderNumber') orderNumber: string,
    @Body() dto: CreateDeliveryEventDto,
  ) {
    return this.adminService.addDeliveryEvent(orderNumber, dto);
  }

  @ApiOperation({
    summary:
      'SSE 스트림 (stock-update/order-update). Swagger UI로는 테스트 불가 — ?token= 쿼리 파라미터로 인증',
  })
  @Sse('events')
  events(): Observable<MessageEvent> {
    return this.domainEvents.events$.pipe(
      map((event) => ({ type: event.type, data: event.data })),
    );
  }
}
