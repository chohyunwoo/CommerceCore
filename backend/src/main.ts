import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Render는 리버스 프록시 뒤에서 앱을 구동한다 — 이게 없으면 req.ip가 항상
  // 프록시 IP로 고정돼 ThrottlerGuard(결정 30)의 IP별 rate limit이 사실상
  // 전체 사용자가 하나의 버킷을 공유하는 것과 같아진다.
  app.set('trust proxy', 1);
  app.use(helmet());
  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  });
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Commerce Core API')
    .setDescription(
      '이커머스 포트폴리오 프로젝트 API 명세. 장바구니/주문 요청은 X-Cart-Id, 로그인/관리자 요청은 X-Session-Token 헤더가 필요합니다(관리자는 role=admin 계정의 세션).',
    )
    .setVersion('1.0')
    .addApiKey({ type: 'apiKey', in: 'header', name: 'X-Cart-Id' }, 'cart-id')
    .addApiKey(
      { type: 'apiKey', in: 'header', name: 'X-Session-Token' },
      'session-token',
    )
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, swaggerDocument);

  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
