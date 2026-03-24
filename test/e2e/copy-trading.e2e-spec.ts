import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp } from '../helpers/test-app';
import { createMockWallet } from '../support/wallet-mock';
import { createStellarMock } from '../support/stellar-mock';

describe('Copy Trading Flow (E2E)', () => {
  let app: INestApplication;
  let token: string;
  const walletAddress = 'GABC123DEF456GHI789JKL012MNO345PQR678STU901VWX234YZA567BCD';

  beforeAll(async () => {
    app = await createTestApp();

    // Setup: Create user and get token
    const registerResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        walletAddress,
        username: 'trader',
        email: 'trader@example.com',
      });

    token = registerResponse.body.token;
  });

  afterAll(async () => {
    await app.close();
  });

  it('should complete full copy trading journey', async () => {
    // Step 1: Connect wallet
    const wallet = createMockWallet(walletAddress);
    const connection = await wallet.connect();
    expect(connection.address).toBe(walletAddress);

    // Step 2: View signal feed
    const feedResponse = await request(app.getHttpServer())
      .get('/api/v1/signals')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(feedResponse.body)).toBe(true);
    const signals = feedResponse.body;
    expect(signals.length).toBeGreaterThan(0);

    // Step 3: Execute trade on first signal
    const signal = signals[0];
    const tradeResponse = await request(app.getHttpServer())
      .post('/api/v1/trades')
      .set('Authorization', `Bearer ${token}`)
      .send({
        signalId: signal.id,
        amount: 100,
        walletAddress,
      })
      .expect(201);

    expect(tradeResponse.body.id).toBeDefined();
    expect(tradeResponse.body.status).toBe('PENDING');
    const tradeId = tradeResponse.body.id;

    // Step 4: Wait for confirmation (simulate)
    await new Promise(resolve => setTimeout(resolve, 100));

    // Step 5: Check trade status
    const tradeStatusResponse = await request(app.getHttpServer())
      .get(`/api/v1/trades/${tradeId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(tradeStatusResponse.body.id).toBe(tradeId);

    // Step 6: Verify portfolio
    const portfolioResponse = await request(app.getHttpServer())
      .get('/api/v1/portfolio')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(portfolioResponse.body).toBeDefined();
  });

  it('should handle trade execution failure', async () => {
    const failResponse = await request(app.getHttpServer())
      .post('/api/v1/trades')
      .set('Authorization', `Bearer ${token}`)
      .send({
        signalId: 'invalid-signal-id',
        amount: 100,
      })
      .expect(400);

    expect(failResponse.body.message).toBeDefined();
  });

  it('should handle insufficient balance', async () => {
    const signals = await request(app.getHttpServer())
      .get('/api/v1/signals')
      .set('Authorization', `Bearer ${token}`);

    const signal = signals.body[0];

    const failResponse = await request(app.getHttpServer())
      .post('/api/v1/trades')
      .set('Authorization', `Bearer ${token}`)
      .send({
        signalId: signal.id,
        amount: 999999999,
        walletAddress,
      })
      .expect(400);

    expect(failResponse.body.message).toContain('balance');
  });
});
