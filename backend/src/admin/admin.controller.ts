import { Controller, Get, MessageEvent, Sse } from '@nestjs/common';
import { map, Observable } from 'rxjs';
import { AdminService } from './admin.service';
import { DomainEventsService } from '../common/events/domain-events.service';

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

  @Sse('events')
  events(): Observable<MessageEvent> {
    return this.domainEvents.events$.pipe(
      map((event) => ({ type: event.type, data: event.data })),
    );
  }
}
