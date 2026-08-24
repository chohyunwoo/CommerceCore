import {
  Body,
  Controller,
  Get,
  HttpCode,
  MessageEvent,
  Param,
  Patch,
  Post,
  Query,
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
import { RecentOrdersQueryDto } from './dto/recent-orders-query.dto';
import { AdminGuard } from '../common/guards/admin.guard';
import { AdminSseGuard } from '../common/guards/admin-sse.guard';
import { SupabaseStorageService } from './supabase-storage.service';
import { AppErrors } from '../common/errors/app-errors';
import { AppException } from '../common/errors/app-exception';

// SSE(events)는 EventSource가 커스텀 헤더를 못 보내 AdminGuard(세션 헤더 필요)를 쓸 수
// 없다 — 그래서 클래스 레벨이 아니라 라우트마다 개별적으로 가드를 건다(결정 38).
@ApiTags('admin')
@ApiSecurity('session-token')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly domainEvents: DomainEventsService,
    private readonly supabaseStorageService: SupabaseStorageService,
  ) {}

  @ApiOperation({ summary: '카테고리 목록 (상품 등록 폼용)' })
  @UseGuards(AdminGuard)
  @Get('categories')
  getCategories() {
    return this.adminService.getCategories();
  }

  @ApiOperation({ summary: '상품 등록 (카테고리 + 최소 1개 옵션 포함)' })
  @UseGuards(AdminGuard)
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
  @UseGuards(AdminGuard)
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
  @UseGuards(AdminGuard)
  @Get('stock-overview')
  getStockOverview() {
    return this.adminService.getStockOverview();
  }

  @ApiOperation({
    summary:
      '대시보드 통계 (매출 요약/추이·카테고리별·인기 상품·주문 상태 분포). 매출은 PAID·SHIPPED·DELIVERED만 집계',
  })
  @UseGuards(AdminGuard)
  @Get('stats')
  getStats() {
    return this.adminService.getStats();
  }

  @ApiOperation({
    summary: '주문 목록 (상태 필터 + 페이지네이션 + 구매자 검색)',
  })
  @UseGuards(AdminGuard)
  @Get('orders/recent')
  getRecentOrders(@Query() query: RecentOrdersQueryDto) {
    return this.adminService.getRecentOrders(
      query.status,
      query.page,
      query.limit,
      query.search,
    );
  }

  @ApiOperation({
    summary:
      '주문 상태 전이 (PAID→CANCELLED는 TossPayments 결제취소 API 호출 후 전이, ' +
      'PAID→SHIPPED는 trackingNumber/carrier 필수. SHIPPED→DELIVERED는 이 API로 ' +
      '직접 전이할 수 없음 — POST .../delivery-events로 배송 단계를 기록해야 함)',
  })
  @UseGuards(AdminGuard)
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
  @UseGuards(AdminGuard)
  @Post('orders/:orderNumber/delivery-events')
  addDeliveryEvent(
    @Param('orderNumber') orderNumber: string,
    @Body() dto: CreateDeliveryEventDto,
  ) {
    return this.adminService.addDeliveryEvent(orderNumber, dto);
  }

  @ApiOperation({
    summary:
      'SSE 연결용 1회용 단기 티켓 발급 (TTL 30초). EventSource가 커스텀 헤더를 ' +
      '보낼 수 없어, 세션 토큰 대신 이 티켓을 GET /admin/events?ticket=으로 전달한다.',
  })
  @UseGuards(AdminGuard)
  @Post('events/ticket')
  issueSseTicket() {
    return this.adminService.issueSseTicket();
  }

  @ApiOperation({
    summary:
      'SSE 스트림 (stock-update/order-update). POST /admin/events/ticket으로 발급받은 ' +
      '1회용 티켓을 ?ticket= 쿼리 파라미터로 전달해 인증 (Swagger UI로는 테스트 불가)',
  })
  @UseGuards(AdminSseGuard)
  @Sse('events')
  events(): Observable<MessageEvent> {
    return this.domainEvents.events$.pipe(
      map((event) => ({ type: event.type, data: event.data })),
    );
  }
}
