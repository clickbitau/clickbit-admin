import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

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
    origin: process.env.FRONTEND_URL || true,
    credentials: true,
  });

  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 5001;
  await app.listen(port);
  console.log(`API listening on http://localhost:${port}/api`);
}
bootstrap();
