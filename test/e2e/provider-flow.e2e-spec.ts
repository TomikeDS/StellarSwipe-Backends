import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp } from '../helpers/test-app';
import { createMockWallet } from '../support/wallet-mock';

describe('Provider Flow (E2E)', () => {
  let app: INestApplication;
  let token: string;
  const walletAddress = 'GPROV123DEF456GHI789JKL012MNO345PQR678STU901VWX234YZA567BCD';

  beforeAll(async () => {
    app = await createTestApp();

    // Setup: Create provider user
    const registerResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        walletAddress,
        username: 'provider',
        email: 'provider@example.com',
      });

    token = registerResponse.body.token;
  });

  afterAll(async () => {
    await app.close();
  });

  it('should complete full provider signal creation journey', async () => {
    // Step 1: Connect wallet
    const wallet = createMockWallet(walletAddress);
    const connection = await wallet.connect();
    expect(connection.address).toBe(walletAddress);

    // Step 2: Create signal
    const signalResponse = await request(app.getHttpServer())
      .post('/api/v1/signals')
      .set('Authorization', `Bearer ${token}`)
      .send({
        baseAsset: 'USDC',
        counterAsset: 'XLM',
        type: 'BUY',
        entryPrice: '0.095',
        targetPrice: '0.105',
        stopLossPrice: '0.090',
        confidenceScore: 85,
        rationale: 'Strong bullish momentum',
      })
      .expect(201);

    expect(signalResponse.body.id).toBeDefined();
    expect(signalResponse.body.status).toBe('ACTIVE');
    const signalId = signalResponse.body.id;

    // Step 3: Verify signal appears in feed
    const feedResponse = await request(app.getHttpServer())
      .get('/api/v1/signals')
      .expect(200);

    const signalInFeed = feedResponse.body.find(s => s.id === signalId);
    expect(signalInFeed).toBeDefined();

    // Step 4: Check provider stats
    const statsResponse = await request(app.getHttpServer())
      .get('/api/v1/providers/stats')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(statsResponse.body.totalSignals).toBeGreaterThan(0);

    // Step 5: Update signal
    const updateResponse = await request(app.getHttpServer())
      .patch(`/api/v1/signals/${signalId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        status: 'CLOSED',
      })
      .expect(200);

    expect(updateResponse.body.status).toBe('CLOSED');
  });

  it('should reject invalid signal data', async () => {
    const failResponse = await request(app.getHttpServer())
      .post('/api/v1/signals')
      .set('Authorization', `Bearer ${token}`)
      .send({
        baseAsset: 'INVALID',
        type: 'BUY',
      })
      .expect(400);

    expect(failResponse.body.message).toBeDefined();
  });

  it('should handle AI validation failure', async () => {
    const lowConfidenceResponse = await request(app.getHttpServer())
      .post('/api/v1/signals')
      .set('Authorization', `Bearer ${token}`)
      .send({
        baseAsset: 'USDC',
        counterAsset: 'XLM',
        type: 'BUY',
        entryPrice: '0.095',
        targetPrice: '0.096',
        stopLossPrice: '0.094',
        confidenceScore: 10,
        rationale: 'Low confidence',
      })
      .expect(400);

    expect(lowConfidenceResponse.body.message).toContain('confidence');
  });
});
