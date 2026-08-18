import { Controller, Get, HttpStatus, Inject, Res } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { Redis } from 'ioredis';
import type { Response } from 'express';
import { REDIS_CLIENT } from '../redis/redis.constants';

type DependencyStatus = 'up' | 'down';

@Controller('health')
export class HealthController {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  @Get()
  async check(@Res() res: Response) {
    const [dbResult, redisResult] = await Promise.allSettled([
      this.dataSource.query('SELECT 1'),
      this.redis.ping(),
    ]);

    const db: DependencyStatus =
      dbResult.status === 'fulfilled' ? 'up' : 'down';
    const redis: DependencyStatus =
      redisResult.status === 'fulfilled' ? 'up' : 'down';
    const healthy = db === 'up' && redis === 'up';

    res.status(healthy ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE).json({
      status: healthy ? 'ok' : 'degraded',
      db,
      redis,
      timestamp: new Date().toISOString(),
    });
  }
}
