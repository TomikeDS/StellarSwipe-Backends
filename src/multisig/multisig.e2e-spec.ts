/**
 * multisig.e2e-spec.ts
 *
 * Integration test exercising the full HTTP stack via supertest.
 * Uses an in-memory SQLite database (via TypeORM) and a mocked Horizon server.
 *
 * Run with: jest --testPathPattern=multisig.e2e-spec
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as StellarSdk from '@stellar/stellar-sdk';
import { MultisigModule } from './multisig.module';
import { PendingTransaction, PendingTransactionStatus } from './entities/pending-transaction.entity';
import { MultisigService } from './multisig.service';

// ─── Keypairs ─────────────────────────────────────────────────────────────────
const KP1 = StellarSdk.Keypair.random();
const KP2 = StellarSdk.Keypair.random();
const ACCOUNT_ID = KP1.publicKey();
const NETWORK = StellarSdk.Networks.TESTNET;

function buildTx(): StellarSdk.Transaction {
  const source = new StellarSdk.Account(ACCOUNT_ID, '100');
  return new StellarSdk.TransactionBuilder(source, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: NETWORK,
  })
    .addOperation(
      StellarSdk.Operation.payment({
        destination: KP2.publicKey(),
        asset: StellarSdk.Asset.native(),
        amount: '5',
      }),
    )
    .setTimeout(30)
    .build();
}

describe('Multisig (e2e)', () => {
  let app: INestApplication;
  let mockHorizon: { loadAccount: jest.Mock; submitTransaction: jest.Mock };

  beforeAll(async () => {
    mockHorizon = {
      loadAccount: jest.fn().mockResolvedValue({
        thresholds: { low_threshold: 0, med_threshold: 2, high_threshold: 3 },
        signers: [
          { key: KP1.publicKey(), weight: 1 },
          { key: KP2.publicKey(), weight: 1 },
        ],
      }),
      submitTransaction: jest.fn().mockResolvedValue({ id: 'stellar-e2e-hash' }),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [PendingTransaction],
          synchronize: true,
        }),
        MultisigModule,
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    // Inject the mock horizon server
    const svc = app.get<MultisigService>(MultisigService);
    (svc as any).server = mockHorizon;
    (svc as any).networkPassphrase = NETWORK;
  });

  afterAll(async () => {
    await app.close();
  });

  let pendingTxId: string;
  let txXdr: string;

  it('GET /stellar/multisig/accounts/:id/status — returns multisig info', async () => {
    const res = await request(app.getHttpServer())
      .get(`/stellar/multisig/accounts/${ACCOUNT_ID}/status`)
      .expect(200);

    expect(res.body.isMultisig).toBe(true);
    expect(res.body.thresholdMedium).toBe(2);
    expect(res.body.signers).toHaveLength(2);
  });

  it('POST /stellar/multisig/transactions — creates a pending transaction', async () => {
    const tx = buildTx();
    txXdr = tx.toEnvelope().toXDR('base64');

    const res = await request(app.getHttpServer())
      .post('/stellar/multisig/transactions')
      .send({ accountId: ACCOUNT_ID, transactionXdr: txXdr, memo: 'e2e test' })
      .expect(201);

    expect(res.body.status).toBe(PendingTransactionStatus.PENDING);
    expect(res.body.requiredThreshold).toBe(2);
    pendingTxId = res.body.id;
  });

  it('GET /stellar/multisig/transactions/:id — retrieves it', async () => {
    const res = await request(app.getHttpServer())
      .get(`/stellar/multisig/transactions/${pendingTxId}`)
      .expect(200);

    expect(res.body.id).toBe(pendingTxId);
  });

  it('GET /stellar/multisig/accounts/:id/pending — lists the pending tx', async () => {
    const res = await request(app.getHttpServer())
      .get(`/stellar/multisig/accounts/${ACCOUNT_ID}/pending`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.some((t: any) => t.id === pendingTxId)).toBe(true);
  });

  it('POST /stellar/multisig/transactions/signatures — KP1 signature accepted', async () => {
    const tx = new StellarSdk.Transaction(txXdr, NETWORK);
    const txHash = tx.hash();
    const sig = KP1.sign(txHash).toString('base64');

    const res = await request(app.getHttpServer())
      .post('/stellar/multisig/transactions/signatures')
      .send({
        pendingTransactionId: pendingTxId,
        signerPublicKey: KP1.publicKey(),
        signature: sig,
      })
      .expect(200);

    expect(res.body.collectedWeight).toBe(1);
    expect(res.body.status).toBe(PendingTransactionStatus.PENDING);
  });

  it('POST /stellar/multisig/transactions/signatures — KP2 signature makes it READY', async () => {
    const tx = new StellarSdk.Transaction(txXdr, NETWORK);
    const txHash = tx.hash();
    const sig = KP2.sign(txHash).toString('base64');

    const res = await request(app.getHttpServer())
      .post('/stellar/multisig/transactions/signatures')
      .send({
        pendingTransactionId: pendingTxId,
        signerPublicKey: KP2.publicKey(),
        signature: sig,
      })
      .expect(200);

    expect(res.body.status).toBe(PendingTransactionStatus.READY);
    expect(res.body.isReady).toBe(true);
  });

  it('POST /stellar/multisig/transactions/:id/submit — submits to Stellar network', async () => {
    const res = await request(app.getHttpServer())
      .post(`/stellar/multisig/transactions/${pendingTxId}/submit`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.stellarTxId).toBe('stellar-e2e-hash');
  });

  it('POST /stellar/multisig/transactions/:id/submit — fails when already submitted', async () => {
    await request(app.getHttpServer())
      .post(`/stellar/multisig/transactions/${pendingTxId}/submit`)
      .expect(400);
  });

  it('POST /stellar/multisig/transactions/signatures — rejects duplicate signature', async () => {
    // Create a fresh pending tx for this test
    const tx2 = buildTx();
    const xdr2 = tx2.toEnvelope().toXDR('base64');

    const createRes = await request(app.getHttpServer())
      .post('/stellar/multisig/transactions')
      .send({ accountId: ACCOUNT_ID, transactionXdr: xdr2 })
      .expect(201);

    const id2 = createRes.body.id;
    const hash = tx2.hash();
    const sig = KP1.sign(hash).toString('base64');

    await request(app.getHttpServer())
      .post('/stellar/multisig/transactions/signatures')
      .send({ pendingTransactionId: id2, signerPublicKey: KP1.publicKey(), signature: sig })
      .expect(200);

    // Second attempt from same key → 409
    await request(app.getHttpServer())
      .post('/stellar/multisig/transactions/signatures')
      .send({ pendingTransactionId: id2, signerPublicKey: KP1.publicKey(), signature: sig })
      .expect(409);
  });

  it('POST /stellar/multisig/transactions — 400 on invalid XDR', async () => {
    await request(app.getHttpServer())
      .post('/stellar/multisig/transactions')
      .send({ accountId: ACCOUNT_ID, transactionXdr: 'bad-xdr' })
      .expect(400);
  });

  it('GET /stellar/multisig/accounts/INVALID/status — 400 on bad account ID', async () => {
    await request(app.getHttpServer())
      .get('/stellar/multisig/accounts/INVALID/status')
      .expect(400);
  });
});
