import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { signalFixture } from '../fixtures/signals.fixture';
import { createTestApp, getTestJWT } from '../helpers/test-app';

describe('Signals API (Integration)', () => {
  let app: INestApplication;
  let jwtToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    jwtToken = await getTestJWT();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/v1/signals', () => {
    it('should create a signal', async () => {
      return request(app.getHttpServer())
        .post('/api/v1/signals')
        .set('Authorization', `Bearer ${jwtToken}`)
        .send(signalFixture())
        .expect(201)
        .expect((res) => {
          expect(res.body.id).toBeDefined();
        });
    });

    it('should reject invalid signal', async () => {
      return request(app.getHttpServer())
        .post('/api/v1/signals')
        .set('Authorization', `Bearer ${jwtToken}`)
        .send({ baseAsset: 'INVALID' })
        .expect(400);
    });
  });

  describe('GET /api/v1/signals', () => {
    it('should return signals list', async () => {
      return request(app.getHttpServer())
        .get('/api/v1/signals')
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
        });
    });
  });
});
