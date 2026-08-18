import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { CartService } from './cart.service';
import { CartId } from '../common/decorators/cart-id.decorator';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';

@ApiTags('cart')
@ApiSecurity('cart-id')
@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @ApiOperation({ summary: '현재 장바구니 조회' })
  @Get()
  getCart(@CartId() cartId: string) {
    return this.cartService.getCart(cartId);
  }

  @ApiOperation({ summary: '장바구니에 상품 추가 (이미 있으면 수량 누적)' })
  @Post('items')
  addItem(@CartId() cartId: string, @Body() dto: AddCartItemDto) {
    return this.cartService.addItem(cartId, dto);
  }

  @ApiOperation({ summary: '장바구니 항목 수량 변경' })
  @Patch('items/:productOptionId')
  updateItem(
    @CartId() cartId: string,
    @Param('productOptionId', ParseIntPipe) productOptionId: number,
    @Body() dto: UpdateCartItemDto,
  ) {
    return this.cartService.updateItem(cartId, productOptionId, dto);
  }

  @ApiOperation({ summary: '장바구니 항목 제거' })
  @Delete('items/:productOptionId')
  removeItem(
    @CartId() cartId: string,
    @Param('productOptionId', ParseIntPipe) productOptionId: number,
  ) {
    return this.cartService.removeItem(cartId, productOptionId);
  }
}
