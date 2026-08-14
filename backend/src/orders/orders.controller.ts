import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CartId } from '../common/decorators/cart-id.decorator';
import { ValidateStockDto } from './dto/validate-stock.dto';
import { CreateOrderDto } from './dto/create-order.dto';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post('validate-stock')
  @HttpCode(200)
  validateStock(@Body() dto: ValidateStockDto) {
    return this.ordersService.validateStock(dto);
  }

  @Post()
  createOrder(@CartId() cartId: string, @Body() dto: CreateOrderDto) {
    return this.ordersService.createOrder(cartId, dto);
  }
}
