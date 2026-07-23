import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';

function getCorsOrigin(): string | boolean | ((origin: string, callback: (err: Error | null, allow?: boolean) => void) => void) {
  const raw = process.env.ALLOWED_ORIGINS || process.env.FRONTEND_URL || '';
  const origins = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (origins.length === 0) return true;
  if (origins.length === 1) return origins[0];
  return (origin: string, callback: (err: Error | null, allow?: boolean) => void) => {
    if (!origin || origins.includes(origin)) return callback(null, true);
    callback(null, false);
  };
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      whitelist: true,
      forbidNonWhitelisted: false,
    }),
  );

  app.enableCors({
    origin: getCorsOrigin(),
    credentials: true,
  });

  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 5001;
  await app.listen(port);
  console.log(`API listening on http://localhost:${port}/api`);
}
bootstrap();
