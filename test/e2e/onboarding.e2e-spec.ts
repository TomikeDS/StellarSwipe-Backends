import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp } from '../helpers/test-app';
import { createMockWallet } from '../support/wallet-mock';

describe('Onboarding Flow (E2E)', () => {
  let app: INestApplication;
  const walletAddress = 'GABC123DEF456GHI789JKL012MNO345PQR678STU901VWX234YZA567BCD';

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should complete full onboarding journey', async () => {
    // Step 1: Connect wallet
    const wallet = createMockWallet(walletAddress);
    const connection = await wallet.connect();
    expect(connection.address).toBe(walletAddress);

    // Step 2: Register user
    const registerResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        walletAddress: connection.address,
        username: 'testuser',
        email: 'test@example.com',
      })
      .expect(201);

    expect(registerResponse.body.user).toBeDefined();
    expect(registerResponse.body.token).toBeDefined();
    const token = registerResponse.body.token;

    // Step 3: View signal feed
    const feedResponse = await request(app.getHttpServer())
      .get('/api/v1/signals')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(feedResponse.body)).toBe(true);

    // Step 4: View portfolio
    const portfolioResponse = await request(app.getHttpServer())
      .get('/api/v1/portfolio')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(portfolioResponse.body).toBeDefined();
  });

  it('should handle wallet connection failure', async () => {
    const invalidResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        walletAddress: 'INVALID',
        username: 'testuser',
      })
      .expect(400);

    expect(invalidResponse.body.message).toBeDefined();
  });
});
