import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';

export async function createTestApp(): Promise<INestApplication> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        envFilePath: '.env.test',
      }),
      TypeOrmModule.forRoot({
        type: 'postgres',
        host: process.env.TEST_DATABASE_HOST || 'localhost',
        port: parseInt(process.env.TEST_DATABASE_PORT || '5432'),
        username: process.env.TEST_DATABASE_USER || 'test',
        password: process.env.TEST_DATABASE_PASSWORD || 'test',
        database: process.env.TEST_DATABASE_NAME || 'stellarswipe_test',
        entities: ['src/**/*.entity.ts'],
        synchronize: true,
        dropSchema: true,
      }),
    ],
  }).compile();

  const app = moduleFixture.createNestApplication();
  app.setGlobalPrefix('api/v1');
  await app.init();
  return app;
}

export async function getTestJWT(): Promise<string> {
  return 'test-jwt-token';
}
