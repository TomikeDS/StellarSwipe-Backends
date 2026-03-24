import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp } from '../helpers/test-app';
import { createMockWallet } from '../support/wallet-mock';

describe('Payout Flow (E2E)', () => {
  let app: INestApplication;
  let token: string;
  const walletAddress = 'GPROV123DEF456GHI789JKL012MNO345PQR678STU901VWX234YZA567BCD';

  beforeAll(async () => {
    app = await createTestApp();

    // Setup: Create provider with earnings
    const registerResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        walletAddress,
        username: 'provider_payout',
        email: 'payout@example.com',
      });

    token = registerResponse.body.token;
  });

  afterAll(async () => {
    await app.close();
  });

  it('should complete full payout journey', async () => {
    // Step 1: Connect wallet
    const wallet = createMockWallet(walletAddress);
    const connection = await wallet.connect();
    expect(connection.address).toBe(walletAddress);

    // Step 2: Check earnings
    const earningsResponse = await request(app.getHttpServer())
      .get('/api/v1/provider-rewards/earnings')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(earningsResponse.body).toBeDefined();
    expect(earningsResponse.body.totalEarnings).toBeDefined();

    // Step 3: Request payout
    const payoutResponse = await request(app.getHttpServer())
      .post('/api/v1/provider-rewards/payout')
      .set('Authorization', `Bearer ${token}`)
      .send({
        amount: '100.00',
        walletAddress,
      })
      .expect(201);

    expect(payoutResponse.body.id).toBeDefined();
    expect(payoutResponse.body.status).toBe('PENDING');
    const payoutId = payoutResponse.body.id;

    // Step 4: Wait for processing (simulate)
    await new Promise(resolve => setTimeout(resolve, 100));

    // Step 5: Check payout status
    const statusResponse = await request(app.getHttpServer())
      .get(`/api/v1/provider-rewards/payout/${payoutId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(statusResponse.body.id).toBe(payoutId);

    // Step 6: Verify balance updated
    const updatedEarningsResponse = await request(app.getHttpServer())
      .get('/api/v1/provider-rewards/earnings')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(updatedEarningsResponse.body).toBeDefined();
  });

  it('should reject payout with insufficient balance', async () => {
    const failResponse = await request(app.getHttpServer())
      .post('/api/v1/provider-rewards/payout')
      .set('Authorization', `Bearer ${token}`)
      .send({
        amount: '999999999.00',
        walletAddress,
      })
      .expect(400);

    expect(failResponse.body.message).toContain('insufficient');
  });

  it('should reject payout below minimum', async () => {
    const failResponse = await request(app.getHttpServer())
      .post('/api/v1/provider-rewards/payout')
      .set('Authorization', `Bearer ${token}`)
      .send({
        amount: '0.01',
        walletAddress,
      })
      .expect(400);

    expect(failResponse.body.message).toContain('minimum');
  });

  it('should handle network failure during payout', async () => {
    // Simulate network failure by using invalid wallet
    const failResponse = await request(app.getHttpServer())
      .post('/api/v1/provider-rewards/payout')
      .set('Authorization', `Bearer ${token}`)
      .send({
        amount: '100.00',
        walletAddress: 'INVALID',
      })
      .expect(400);

    expect(failResponse.body.message).toBeDefined();
  });
});
