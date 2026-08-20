import { randomUUID } from 'crypto';
import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.constants';
import { User } from './entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponse, CurrentUser, SessionData } from './auth.types';
import { CartService } from '../cart/cart.service';
import { AppErrors } from '../common/errors/app-errors';
import { AppException } from '../common/errors/app-exception';

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14; // 14일, 장바구니 TTL과 동일 기준(결정 3)
const BCRYPT_SALT_ROUNDS = 10;

function sessionKey(token: string): string {
  return `session:${token}`;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
    private readonly cartService: CartService,
  ) {}

  async register(dto: RegisterDto, cartId?: string): Promise<AuthResponse> {
    const existing = await this.userRepository.findOne({
      where: { email: dto.email },
    });
    if (existing) {
      throw new AppException(AppErrors.EMAIL_ALREADY_EXISTS);
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);
    const user = await this.userRepository.save(
      this.userRepository.create({
        email: dto.email,
        passwordHash,
        name: dto.name,
      }),
    );

    if (cartId) {
      await this.cartService.mergeGuestCartIntoUser(cartId, user.id);
    }

    return this.createSession(user);
  }

  async login(dto: LoginDto, cartId?: string): Promise<AuthResponse> {
    const user = await this.userRepository.findOne({
      where: { email: dto.email },
    });
    if (!user) {
      throw new AppException(AppErrors.INVALID_CREDENTIALS);
    }

    const passwordMatches = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );
    if (!passwordMatches) {
      throw new AppException(AppErrors.INVALID_CREDENTIALS);
    }

    if (cartId) {
      await this.cartService.mergeGuestCartIntoUser(cartId, user.id);
    }

    return this.createSession(user);
  }

  /** 세션 삭제는 멱등적 — 이미 없거나 만료된 토큰이어도 에러 없이 조용히 끝난다. */
  async logout(token: string): Promise<void> {
    await this.redis.del(sessionKey(token));
  }

  async getCurrentUser(token: string): Promise<CurrentUser> {
    const session = await this.resolveSession(token);
    return { id: session.userId, email: session.email, name: session.name };
  }

  async resolveSession(token: string): Promise<SessionData> {
    const raw = await this.redis.get(sessionKey(token));
    if (!raw) {
      throw new AppException(AppErrors.SESSION_REQUIRED);
    }
    return JSON.parse(raw) as SessionData;
  }

  private async createSession(user: User): Promise<AuthResponse> {
    const token = randomUUID();
    const session: SessionData = {
      userId: user.id,
      email: user.email,
      name: user.name,
    };
    await this.redis.set(
      sessionKey(token),
      JSON.stringify(session),
      'EX',
      SESSION_TTL_SECONDS,
    );

    return {
      token,
      user: { id: user.id, email: user.email, name: user.name },
    };
  }
}
