import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { SessionToken } from './decorators/session-token.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { SessionGuard } from './guards/session.guard';
import type { CurrentUser as CurrentUserData } from './auth.types';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({
    summary:
      '회원가입 (성공 시 즉시 로그인 세션 발급). X-Cart-Id가 있으면 게스트 장바구니를 로그인 사용자 장바구니로 병합',
  })
  @Post('register')
  register(@Body() dto: RegisterDto, @Headers('x-cart-id') cartId?: string) {
    return this.authService.register(dto, cartId);
  }

  @ApiOperation({
    summary:
      '로그인. X-Cart-Id가 있으면 게스트 장바구니를 로그인 사용자 장바구니로 병합',
  })
  @Post('login')
  login(@Body() dto: LoginDto, @Headers('x-cart-id') cartId?: string) {
    return this.authService.login(dto, cartId);
  }

  @ApiOperation({ summary: '로그아웃 (해당 세션만 무효화)' })
  @ApiSecurity('session-token')
  @Post('logout')
  async logout(@SessionToken() token: string) {
    await this.authService.logout(token);
    return { success: true };
  }

  @ApiOperation({
    summary: '현재 로그인 사용자 조회 (새로고침 시 상태 복원용)',
  })
  @ApiSecurity('session-token')
  @UseGuards(SessionGuard)
  @Get('me')
  me(@CurrentUser() user: CurrentUserData) {
    return user;
  }
}
