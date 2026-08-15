import { Body, Controller, Get, MessageEvent, Param, Patch, Sse } from '@nestjs/common';
import { map, Observable } from 'rxjs';
import { AdminService } from './admin.service';
import { DomainEventsService } from '../common/events/domain-events.service';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';

@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly domainEvents: DomainEventsService,
  ) {}

  @Get('stock-overview')
  getStockOverview() {
    return this.adminService.getStockOverview();
  }

  @Get('orders/recent')
  getRecentOrders() {
    return this.adminService.getRecentOrders();
  }

  @Patch('orders/:orderNumber/status')
  updateOrderStatus(
    @Param('orderNumber') orderNumber: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.adminService.updateOrderStatus(orderNumber, dto.status);
  }

  @Sse('events')
  events(): Observable<MessageEvent> {
    return this.domainEvents.events$.pipe(
      map((event) => ({ type: event.type, data: event.data })),
    );
  }
}
