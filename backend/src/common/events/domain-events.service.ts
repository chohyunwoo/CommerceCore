import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';
import {
  DomainEvent,
  OrderUpdateEvent,
  StockUpdateEvent,
} from './domain-events.types';

@Injectable()
export class DomainEventsService {
  private readonly subject = new Subject<DomainEvent>();

  readonly events$ = this.subject.asObservable();

  emitStockUpdate(data: StockUpdateEvent): void {
    this.subject.next({ type: 'stock-update', data });
  }

  emitOrderUpdate(data: OrderUpdateEvent): void {
    this.subject.next({ type: 'order-update', data });
  }
}
