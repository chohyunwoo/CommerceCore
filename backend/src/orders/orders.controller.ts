import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { CartId } from '../common/decorators/cart-id.decorator';
import { ValidateStockDto } from './dto/validate-stock.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { LookupOrderQueryDto } from './dto/lookup-order-query.dto';

@ApiTags('orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @ApiOperation({ summary: '주문 전 재고 확인 (항상 200, valid 필드로 구분)' })
  @Post('validate-stock')
  @HttpCode(200)
  validateStock(@Body() dto: ValidateStockDto) {
    return this.ordersService.validateStock(dto);
  }

  @ApiOperation({ summary: '주문 생성 (비관적 락으로 재고 재검증 후 차감)' })
  @ApiSecurity('cart-id')
  @Post()
  createOrder(@CartId() cartId: string, @Body() dto: CreateOrderDto) {
    return this.ordersService.createOrder(cartId, dto);
  }

  @ApiOperation({ summary: '주문번호 + 이메일 조합으로 주문 조회' })
  @Get('lookup')
  lookupOrder(@Query() query: LookupOrderQueryDto) {
    return this.ordersService.lookupOrder(query);
  }
}
