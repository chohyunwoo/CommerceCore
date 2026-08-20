import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  });
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Commerce Core API')
    .setDescription(
      '이커머스 포트폴리오 프로젝트 API 명세. 장바구니/주문 요청은 X-Cart-Id, 관리자 요청은 X-Admin-Token, 로그인 사용자 요청은 X-Session-Token 헤더가 필요합니다.',
    )
    .setVersion('1.0')
    .addApiKey({ type: 'apiKey', in: 'header', name: 'X-Cart-Id' }, 'cart-id')
    .addApiKey(
      { type: 'apiKey', in: 'header', name: 'X-Admin-Token' },
      'admin-token',
    )
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
