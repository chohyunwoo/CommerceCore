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
import { CartService } from './cart.service';
import { CartId } from './decorators/cart-id.decorator';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';

@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  getCart(@CartId() cartId: string) {
    return this.cartService.getCart(cartId);
  }

  @Post('items')
  addItem(@CartId() cartId: string, @Body() dto: AddCartItemDto) {
    return this.cartService.addItem(cartId, dto);
  }

  @Patch('items/:productOptionId')
  updateItem(
    @CartId() cartId: string,
    @Param('productOptionId', ParseIntPipe) productOptionId: number,
    @Body() dto: UpdateCartItemDto,
  ) {
    return this.cartService.updateItem(cartId, productOptionId, dto);
  }

  @Delete('items/:productOptionId')
  removeItem(
    @CartId() cartId: string,
    @Param('productOptionId', ParseIntPipe) productOptionId: number,
  ) {
    return this.cartService.removeItem(cartId, productOptionId);
  }
}
