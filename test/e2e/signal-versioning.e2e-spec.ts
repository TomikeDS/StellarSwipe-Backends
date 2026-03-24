import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { SignalsModule } from '../signals.module';
import { TypeOrmModule } from '@nestjs/typeorm';

describe('Signal Versioning Integration (e2e)', () => {
  let app: INestApplication;
  let providerToken: string;
  let copierToken: string;
  let signalId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: process.env.DATABASE_HOST || 'localhost',
          port: parseInt(process.env.DATABASE_PORT) || 5432,
          username: process.env.DATABASE_USER || 'test',
          password: process.env.DATABASE_PASSWORD || 'test',
          database: process.env.DATABASE_NAME || 'test_db',
          entities: ['src/**/*.entity.ts'],
          synchronize: true,
        }),
        SignalsModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    // Setup: Create provider and copier tokens (mock authentication)
    providerToken = 'provider-jwt-token';
    copierToken = 'copier-jwt-token';
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Complete Versioning Workflow', () => {
    it('should complete full signal versioning lifecycle', async () => {
      // Step 1: Provider creates signal (assume this exists)
      signalId = 'test-signal-uuid';

      // Step 2: Provider updates signal (version 1)
      const updateResponse1 = await request(app.getHttpServer())
        .patch(`/signals/${signalId}/update`)
        .set('Authorization', `Bearer ${providerToken}`)
        .send({
          targetPrice: '150.00',
          stopLossPrice: '85.00',
          rationale: 'Market conditions improved',
          requiresApproval: false,
        })
        .expect(200);

      expect(updateResponse1.body).toMatchObject({
        signalId,
        newVersion: 1,
        requiresApproval: false,
      });
      expect(updateResponse1.body.changeSummary).toContain('Target');

      // Step 3: Copier copies signal (assume this happens)
      // Copier should be notified of auto-applied update

      // Step 4: Provider updates again (version 2) - requires approval
      await new Promise(resolve => setTimeout(resolve, 3700000)); // Wait 1 hour + 1 minute

      const updateResponse2 = await request(app.getHttpServer())
        .patch(`/signals/${signalId}/update`)
        .set('Authorization', `Bearer ${providerToken}`)
        .send({
          targetPrice: '180.00',
          requiresApproval: true,
        })
        .expect(200);

      expect(updateResponse2.body.newVersion).toBe(2);
      expect(updateResponse2.body.requiresApproval).toBe(true);

      const versionId = updateResponse2.body.versionId;

      // Step 5: Copier checks pending approvals
      const pendingResponse = await request(app.getHttpServer())
        .get('/signals/pending-approvals')
        .set('Authorization', `Bearer ${copierToken}`)
        .expect(200);

      expect(pendingResponse.body).toHaveLength(1);
      expect(pendingResponse.body[0].signalId).toBe(signalId);

      // Step 6: Copier approves update with auto-adjust
      const approvalResponse = await request(app.getHttpServer())
        .post(`/signals/versions/${versionId}/respond`)
        .set('Authorization', `Bearer ${copierToken}`)
        .send({
          approved: true,
          autoAdjust: true,
        })
        .expect(200);

      expect(approvalResponse.body.status).toBe('approved');
      expect(approvalResponse.body.autoAdjust).toBe(true);

      // Step 7: View complete version history
      const historyResponse = await request(app.getHttpServer())
        .get(`/signals/${signalId}/versions`)
        .expect(200);

      expect(historyResponse.body.totalVersions).toBe(2);
      expect(historyResponse.body.versions).toHaveLength(2);
      expect(historyResponse.body.versions[0].versionNumber).toBe(2);
      expect(historyResponse.body.versions[1].versionNumber).toBe(1);

      // Step 8: Check which version copier copied
      const copiedVersionResponse = await request(app.getHttpServer())
        .get(`/signals/${signalId}/copied-version`)
        .set('Authorization', `Bearer ${copierToken}`)
        .expect(200);

      expect(copiedVersionResponse.body.copiedVersion).toBe(1);
    });

    it('should enforce maximum updates limit', async () => {
      // Attempt 6th update
      for (let i = 0; i < 5; i++) {
        await new Promise(resolve => setTimeout(resolve, 3700000)); // Wait cooldown
        await request(app.getHttpServer())
          .patch(`/signals/${signalId}/update`)
          .set('Authorization', `Bearer ${providerToken}`)
          .send({ targetPrice: `${200 + i * 10}.00` })
          .expect(200);
      }

      // 6th update should fail
      await new Promise(resolve => setTimeout(resolve, 3700000));
      const failResponse = await request(app.getHttpServer())
        .patch(`/signals/${signalId}/update`)
        .set('Authorization', `Bearer ${providerToken}`)
        .send({ targetPrice: '300.00' })
        .expect(400);

      expect(failResponse.body.message).toContain('Maximum 5 updates');
    });

    it('should enforce cooldown period', async () => {
      const newSignalId = 'test-signal-2';

      // First update
      await request(app.getHttpServer())
        .patch(`/signals/${newSignalId}/update`)
        .set('Authorization', `Bearer ${providerToken}`)
        .send({ targetPrice: '150.00' })
        .expect(200);

      // Immediate second update should fail
      const failResponse = await request(app.getHttpServer())
        .patch(`/signals/${newSignalId}/update`)
        .set('Authorization', `Bearer ${providerToken}`)
        .send({ targetPrice: '160.00' })
        .expect(400);

      expect(failResponse.body.message).toContain('Must wait');
      expect(failResponse.body.message).toContain('minutes');
    });

    it('should prevent duplicate approval responses', async () => {
      const newSignalId = 'test-signal-3';

      // Create update requiring approval
      const updateResponse = await request(app.getHttpServer())
        .patch(`/signals/${newSignalId}/update`)
        .set('Authorization', `Bearer ${providerToken}`)
        .send({
          targetPrice: '150.00',
          requiresApproval: true,
        })
        .expect(200);

      const versionId = updateResponse.body.versionId;

      // First approval
      await request(app.getHttpServer())
        .post(`/signals/versions/${versionId}/respond`)
        .set('Authorization', `Bearer ${copierToken}`)
        .send({ approved: true })
        .expect(200);

      // Second approval should fail
      const failResponse = await request(app.getHttpServer())
        .post(`/signals/versions/${versionId}/respond`)
        .set('Authorization', `Bearer ${copierToken}`)
        .send({ approved: false })
        .expect(400);

      expect(failResponse.body.message).toContain('already responded');
    });

    it('should prevent non-copiers from approving', async () => {
      const newSignalId = 'test-signal-4';
      const nonCopierToken = 'non-copier-jwt-token';

      const updateResponse = await request(app.getHttpServer())
        .patch(`/signals/${newSignalId}/update`)
        .set('Authorization', `Bearer ${providerToken}`)
        .send({
          targetPrice: '150.00',
          requiresApproval: true,
        })
        .expect(200);

      const versionId = updateResponse.body.versionId;

      // Non-copier tries to approve
      const failResponse = await request(app.getHttpServer())
        .post(`/signals/versions/${versionId}/respond`)
        .set('Authorization', `Bearer ${nonCopierToken}`)
        .send({ approved: true })
        .expect(403);

      expect(failResponse.body.message).toContain('not copying');
    });

    it('should validate update data types', async () => {
      // Invalid price format
      const failResponse1 = await request(app.getHttpServer())
        .patch(`/signals/${signalId}/update`)
        .set('Authorization', `Bearer ${providerToken}`)
        .send({ targetPrice: 'invalid' })
        .expect(400);

      expect(failResponse1.body.message).toContain('valid decimal');

      // Too many decimal places
      const failResponse2 = await request(app.getHttpServer())
        .patch(`/signals/${signalId}/update`)
        .set('Authorization', `Bearer ${providerToken}`)
        .send({ targetPrice: '150.123456789' })
        .expect(400);

      expect(failResponse2.body.message).toContain('8 decimal places');
    });
  });

  describe('Version History Immutability', () => {
    it('should maintain immutable version history', async () => {
      const testSignalId = 'immutable-test-signal';

      // Create 3 versions
      for (let i = 1; i <= 3; i++) {
        if (i > 1) await new Promise(resolve => setTimeout(resolve, 3700000));
        
        await request(app.getHttpServer())
          .patch(`/signals/${testSignalId}/update`)
          .set('Authorization', `Bearer ${providerToken}`)
          .send({ targetPrice: `${100 + i * 10}.00` })
          .expect(200);
      }

      // Get history
      const historyResponse = await request(app.getHttpServer())
        .get(`/signals/${testSignalId}/versions`)
        .expect(200);

      const versions = historyResponse.body.versions;

      // Verify all versions exist and are in correct order
      expect(versions).toHaveLength(3);
      expect(versions[0].versionNumber).toBe(3);
      expect(versions[0].targetPrice).toBe('130.00');
      expect(versions[1].versionNumber).toBe(2);
      expect(versions[1].targetPrice).toBe('120.00');
      expect(versions[2].versionNumber).toBe(1);
      expect(versions[2].targetPrice).toBe('110.00');

      // Verify timestamps are sequential
      const time1 = new Date(versions[2].createdAt).getTime();
      const time2 = new Date(versions[1].createdAt).getTime();
      const time3 = new Date(versions[0].createdAt).getTime();
      expect(time2).toBeGreaterThan(time1);
      expect(time3).toBeGreaterThan(time2);
    });
  });
});
