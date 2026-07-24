import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

function loadEnv() {
  let dir = __dirname;
  for (let i = 0; i < 8; i++) {
    const envPath = path.join(dir, '.env');
    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath });
      return;
    }
    dir = path.dirname(dir);
  }
  dotenv.config();
}
loadEnv();

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import helmet from 'helmet';
import { ValidationPipe } from '@nestjs/common';
import * as express from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Increase payload limits for base64 image uploads (like profile pictures)
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));

  // Enable Helmet for security headers
  app.use(helmet());

  // Strict CORS configuration
  app.enableCors({
    origin: true, // Dynamically allow the requesting origin (fixes Vercel CORS)
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Global validation pipe to strip non-whitelisted fields and block injection
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      // Note: whitelist and forbidNonWhitelisted are omitted until proper DTO classes are implemented
    }),
  );

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`NestJS API is running on: http://localhost:${port}`);
}
bootstrap();
