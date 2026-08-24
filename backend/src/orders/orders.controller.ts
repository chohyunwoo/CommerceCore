import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { CartId } from '../common/decorators/cart-id.decorator';
import { ValidateStockDto } from './dto/validate-stock.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { LookupOrderQueryDto } from './dto/lookup-order-query.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { SessionGuard } from '../auth/guards/session.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUser as CurrentUserData } from '../auth/auth.types';

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

  @ApiOperation({
    summary:
      '주문 생성 (비관적 락으로 재고 재검증 후 차감). X-Session-Token이 유효하면 로그인 사용자 계정에 주문을 연결',
  })
  @ApiSecurity('cart-id')
  @Post()
  createOrder(
    @CartId() cartId: string,
    @Body() dto: CreateOrderDto,
    @Headers('x-session-token') sessionToken?: string,
  ) {
    return this.ordersService.createOrder(cartId, dto, sessionToken);
  }

  @ApiOperation({ summary: '주문번호 + 이메일 조합으로 주문 조회' })
  @Get('lookup')
  lookupOrder(@Query() query: LookupOrderQueryDto) {
    return this.ordersService.lookupOrder(query);
  }

  @ApiOperation({ summary: '내 주문 목록 (로그인 필요, 페이지네이션)' })
  @ApiSecurity('session-token')
  @UseGuards(SessionGuard)
  @Get('my')
  getMyOrders(
    @CurrentUser() user: CurrentUserData,
    @Query() query: PaginationQueryDto,
  ) {
    return this.ordersService.getMyOrders(user.id, query.page, query.limit);
  }

  @ApiOperation({
    summary:
      '내 주문 상세 (로그인 필요). 다른 사용자의 주문이면 404로 존재 여부를 숨김',
  })
  @ApiSecurity('session-token')
  @UseGuards(SessionGuard)
  @Get('my/:orderNumber')
  getMyOrderDetail(
    @CurrentUser() user: CurrentUserData,
    @Param('orderNumber') orderNumber: string,
  ) {
    return this.ordersService.getMyOrderDetail(user.id, orderNumber);
  }
}
