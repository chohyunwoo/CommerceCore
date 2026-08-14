import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { ValidateStockDto } from './dto/validate-stock.dto';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post('validate-stock')
  @HttpCode(200)
  validateStock(@Body() dto: ValidateStockDto) {
    return this.ordersService.validateStock(dto);
  }
}
