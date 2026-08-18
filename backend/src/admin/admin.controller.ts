import {
  Body,
  Controller,
  Get,
  MessageEvent,
  Param,
  Patch,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { map, Observable } from 'rxjs';
import { AdminService } from './admin.service';
import { DomainEventsService } from '../common/events/domain-events.service';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { AdminGuard } from '../common/guards/admin.guard';

@ApiTags('admin')
@ApiSecurity('admin-token')
@UseGuards(AdminGuard)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly domainEvents: DomainEventsService,
  ) {}

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
      '주문 상태 전이 (PAID→CANCELLED는 TossPayments 결제취소 API 호출 후 전이)',
  })
  @Patch('orders/:orderNumber/status')
  updateOrderStatus(
    @Param('orderNumber') orderNumber: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.adminService.updateOrderStatus(orderNumber, dto.status);
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
