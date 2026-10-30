import 'reflect-metadata';
import { Logger, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ZodValidationPipe } from 'nestjs-zod';
import { patchNestJsSwagger } from 'nestjs-zod';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/http-exception.filter';

async function bootstrap(): Promise<void> {
  patchNestJsSwagger();
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  const config = app.get(ConfigService);

  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(new ZodValidationPipe());
  app.useGlobalFilters(new AllExceptionsFilter());

  const origins = config.get<string[]>('corsOrigins') ?? ['*'];
  app.enableCors({ origin: origins.includes('*') ? true : origins, credentials: true });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('M3 Malaria Surveillance API')
    .setDescription('Worker-complete REST API: auth, workers, sites, screening, records, transfers, stakeholders.')
    .setVersion('2.0.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = config.get<number>('port') ?? 8003;
  await app.listen(port, '0.0.0.0');
  new Logger('Bootstrap').log(`M3 API listening on :${port} (docs at /api/docs)`);
}

void bootstrap();
