import { INestApplication, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ZodValidationPipe } from 'nestjs-zod';
import request, { type Test as SupertestTest } from 'supertest';
import { AppModule } from '../../src/app.module';
import { AllExceptionsFilter } from '../../src/common/http-exception.filter';
import { PrismaService } from '../../src/prisma/prisma.service';

export interface TestContext {
  app: INestApplication;
  prisma: PrismaService;
  http: () => ReturnType<typeof request>;
  close: () => Promise<void>;
  reset: () => Promise<void>;
}

export async function createTestApp(): Promise<TestContext> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createApplication
    ? moduleRef.createNestApplication()
    : moduleRef.createNestApplication();
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(new ZodValidationPipe());
  app.useGlobalFilters(new AllExceptionsFilter());
  await app.init();

  const prisma = app.get(PrismaService);

  const reset = async (): Promise<void> => {
    const rows = await prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public' AND tablename NOT LIKE '\\_prisma%'`;
    const names = rows.map((r) => `"${r.tablename}"`).join(', ');
    if (names) {
      await prisma.$executeRawUnsafe(`TRUNCATE ${names} RESTART IDENTITY CASCADE`);
    }
  };

  return {
    app,
    prisma,
    http: () => request(app.getHttpServer()),
    close: async () => {
      await app.close();
    },
    reset,
  };
}

export function bearer(req: SupertestTest, token: string): SupertestTest {
  return req.set('Authorization', `Bearer ${token}`);
}
