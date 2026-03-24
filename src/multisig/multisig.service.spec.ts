import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as StellarSdk from '@stellar/stellar-sdk';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { MultisigService } from './multisig.service';
import {
  PendingTransaction,
  PendingTransactionStatus,
} from './entities/pending-transaction.entity';

// ─── Test Keypairs ────────────────────────────────────────────────────────────
const KP1 = StellarSdk.Keypair.random();
const KP2 = StellarSdk.Keypair.random();
const KP3 = StellarSdk.Keypair.random();

const NETWORK = StellarSdk.Networks.TESTNET;

// ─── Helper: build a minimal Transaction XDR ─────────────────────────────────
function buildTestTransaction(sourceAccount: StellarSdk.Account): StellarSdk.Transaction {
  return new StellarSdk.TransactionBuilder(sourceAccount, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: NETWORK,
  })
    .addOperation(
      StellarSdk.Operation.payment({
        destination: KP2.publicKey(),
        asset: StellarSdk.Asset.native(),
        amount: '10',
      }),
    )
    .setTimeout(30)
    .build();
}

// ─── Mock Horizon Server ──────────────────────────────────────────────────────
const mockAccountResponse = (signers: Array<{ key: string; weight: number }>) => ({
  thresholds: { low_threshold: 0, med_threshold: 2, high_threshold: 3 },
  signers,
});

describe('MultisigService', () => {
  let service: MultisigService;
  let repo: jest.Mocked<Repository<PendingTransaction>>;
  let mockServer: { loadAccount: jest.Mock; submitTransaction: jest.Mock };

  const ACCOUNT_ID = KP1.publicKey();

  const makeSourceAccount = () => new StellarSdk.Account(ACCOUNT_ID, '100');

  beforeEach(async () => {
    mockServer = {
      loadAccount: jest.fn(),
      submitTransaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: getRepositoryToken(PendingTransaction),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: MultisigService,
          useFactory: (r: Repository<PendingTransaction>) => {
            const svc = new MultisigService(r, 'https://horizon.testnet.stellar.org', NETWORK);
            // Override internal server with mock
            (svc as any).server = mockServer;
            return svc;
          },
          inject: [getRepositoryToken(PendingTransaction)],
        },
      ],
    }).compile();

    service = module.get<MultisigService>(MultisigService);
    repo = module.get(getRepositoryToken(PendingTransaction));
  });

  // ─── getAccountMultisigStatus ─────────────────────────────────────────────

  describe('getAccountMultisigStatus', () => {
    it('should return multisig status when account has multiple signers', async () => {
      mockServer.loadAccount.mockResolvedValue(
        mockAccountResponse([
          { key: KP1.publicKey(), weight: 1 },
          { key: KP2.publicKey(), weight: 1 },
        ]),
      );

      const result = await service.getAccountMultisigStatus(ACCOUNT_ID);

      expect(result.isMultisig).toBe(true);
      expect(result.signers).toHaveLength(2);
      expect(result.thresholdMedium).toBe(2);
      expect(result.totalWeight).toBe(2);
    });

    it('should return isMultisig=false for a single-signer account with weight=1 threshold=1', async () => {
      mockServer.loadAccount.mockResolvedValue({
        thresholds: { low_threshold: 0, med_threshold: 1, high_threshold: 1 },
        signers: [{ key: KP1.publicKey(), weight: 1 }],
      });

      const result = await service.getAccountMultisigStatus(ACCOUNT_ID);
      expect(result.isMultisig).toBe(false);
    });

    it('should throw NotFoundException when account does not exist', async () => {
      mockServer.loadAccount.mockRejectedValue(new Error('Not found'));
      await expect(service.getAccountMultisigStatus(ACCOUNT_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException for invalid public key', async () => {
      await expect(service.getAccountMultisigStatus('INVALID')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ─── createPendingTransaction ─────────────────────────────────────────────

  describe('createPendingTransaction', () => {
    const sourceAccount = () => new StellarSdk.Account(ACCOUNT_ID, '100');

    beforeEach(() => {
      mockServer.loadAccount.mockResolvedValue(
        mockAccountResponse([
          { key: KP1.publicKey(), weight: 1 },
          { key: KP2.publicKey(), weight: 1 },
        ]),
      );
      (repo.findOne as jest.Mock).mockResolvedValue(null);
      (repo.create as jest.Mock).mockImplementation((data) => data as PendingTransaction);
      (repo.save as jest.Mock).mockImplementation((data) =>
        Promise.resolve({ ...data, id: 'uuid-1', createdAt: new Date(), updatedAt: new Date() }),
      );
    });

    it('should create a pending transaction with correct initial state', async () => {
      const tx = buildTestTransaction(sourceAccount());
      const xdr = tx.toEnvelope().toXDR('base64');

      const result = await service.createPendingTransaction({
        accountId: ACCOUNT_ID,
        transactionXdr: xdr,
      });

      expect(result.status).toBe(PendingTransactionStatus.PENDING);
      expect(result.collectedWeight).toBe(0);
      expect(result.isReady).toBe(false);
      expect(repo.save).toHaveBeenCalledTimes(1);
    });

    it('should mark transaction as READY when pre-signed enough', async () => {
      const tx = buildTestTransaction(sourceAccount());
      tx.sign(KP1);
      tx.sign(KP2);
      const xdr = tx.toEnvelope().toXDR('base64');

      const result = await service.createPendingTransaction({
        accountId: ACCOUNT_ID,
        transactionXdr: xdr,
      });

      expect(result.status).toBe(PendingTransactionStatus.READY);
    });

    it('should throw BadRequestException for invalid XDR', async () => {
      await expect(
        service.createPendingTransaction({
          accountId: ACCOUNT_ID,
          transactionXdr: 'not-valid-xdr',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException for duplicate transaction hash', async () => {
      const tx = buildTestTransaction(sourceAccount());
      const xdr = tx.toEnvelope().toXDR('base64');

      (repo.findOne as jest.Mock).mockResolvedValue({ id: 'existing-id' });

      await expect(
        service.createPendingTransaction({ accountId: ACCOUNT_ID, transactionXdr: xdr }),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ─── submitSignature ──────────────────────────────────────────────────────

  describe('submitSignature', () => {
    let tx: StellarSdk.Transaction;
    let txHash: Buffer;
    let pendingEntity: PendingTransaction;

    beforeEach(() => {
      tx = buildTestTransaction(new StellarSdk.Account(ACCOUNT_ID, '100'));
      txHash = tx.hash();

      pendingEntity = {
        id: 'pending-uuid',
        accountId: ACCOUNT_ID,
        transactionXdr: tx.toEnvelope().toXDR('base64'),
        transactionHash: txHash.toString('hex'),
        status: PendingTransactionStatus.PENDING,
        requiredThreshold: 2,
        collectedWeight: 0,
        signatures: [],
        pendingSigners: [KP1.publicKey(), KP2.publicKey()],
        memo: null,
        expiresAtLedger: null,
        submittedAt: null,
        stellarTxId: null,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as PendingTransaction;

      (repo.findOne as jest.Mock).mockResolvedValue(pendingEntity);
      (repo.save as jest.Mock).mockImplementation((data) => Promise.resolve(data));
      mockServer.loadAccount.mockResolvedValue(
        mockAccountResponse([
          { key: KP1.publicKey(), weight: 1 },
          { key: KP2.publicKey(), weight: 1 },
        ]),
      );
    });

    it('should successfully add a valid signature', async () => {
      const sig = KP1.sign(txHash).toString('base64');

      const result = await service.submitSignature({
        pendingTransactionId: 'pending-uuid',
        signerPublicKey: KP1.publicKey(),
        signature: sig,
      });

      expect(result.collectedWeight).toBe(1);
      expect(result.status).toBe(PendingTransactionStatus.PENDING); // still need KP2
      expect(result.signatures).toHaveLength(1);
    });

    it('should transition to READY when threshold is met', async () => {
      // Pre-fill KP1 signature
      pendingEntity.signatures = [
        { publicKey: KP1.publicKey(), signature: 'x', weight: 1 },
      ];
      pendingEntity.pendingSigners = [KP2.publicKey()];
      pendingEntity.collectedWeight = 1;

      const sig = KP2.sign(txHash).toString('base64');

      const result = await service.submitSignature({
        pendingTransactionId: 'pending-uuid',
        signerPublicKey: KP2.publicKey(),
        signature: sig,
      });

      expect(result.status).toBe(PendingTransactionStatus.READY);
      expect(result.isReady).toBe(true);
      expect(result.collectedWeight).toBe(2);
    });

    it('should throw ConflictException if signer already signed', async () => {
      pendingEntity.signatures = [
        { publicKey: KP1.publicKey(), signature: 'x', weight: 1 },
      ];

      const sig = KP1.sign(txHash).toString('base64');

      await expect(
        service.submitSignature({
          pendingTransactionId: 'pending-uuid',
          signerPublicKey: KP1.publicKey(),
          signature: sig,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException for invalid signature bytes', async () => {
      // Sign with KP2 but claim it's from KP1 — verification must fail
      const wrongSig = KP2.sign(txHash).toString('base64');

      await expect(
        service.submitSignature({
          pendingTransactionId: 'pending-uuid',
          signerPublicKey: KP1.publicKey(),
          signature: wrongSig,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for a signer not on the account', async () => {
      const stranger = StellarSdk.Keypair.random();
      mockServer.loadAccount.mockResolvedValue(
        mockAccountResponse([
          { key: KP1.publicKey(), weight: 1 },
          { key: KP2.publicKey(), weight: 1 },
        ]),
      );

      const sig = stranger.sign(txHash).toString('base64');

      await expect(
        service.submitSignature({
          pendingTransactionId: 'pending-uuid',
          signerPublicKey: stranger.publicKey(),
          signature: sig,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when transaction is already submitted', async () => {
      pendingEntity.status = PendingTransactionStatus.SUBMITTED;
      const sig = KP1.sign(txHash).toString('base64');

      await expect(
        service.submitSignature({
          pendingTransactionId: 'pending-uuid',
          signerPublicKey: KP1.publicKey(),
          signature: sig,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException for unknown transaction ID', async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(null);
      const sig = KP1.sign(txHash).toString('base64');

      await expect(
        service.submitSignature({
          pendingTransactionId: 'non-existent',
          signerPublicKey: KP1.publicKey(),
          signature: sig,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── submitToNetwork ──────────────────────────────────────────────────────

  describe('submitToNetwork', () => {
    let readyEntity: PendingTransaction;

    beforeEach(() => {
      const tx = buildTestTransaction(new StellarSdk.Account(ACCOUNT_ID, '100'));
      tx.sign(KP1);
      tx.sign(KP2);

      readyEntity = {
        id: 'ready-uuid',
        accountId: ACCOUNT_ID,
        transactionXdr: tx.toEnvelope().toXDR('base64'),
        transactionHash: tx.hash().toString('hex'),
        status: PendingTransactionStatus.READY,
        requiredThreshold: 2,
        collectedWeight: 2,
        signatures: [
          { publicKey: KP1.publicKey(), signature: 'x', weight: 1 },
          { publicKey: KP2.publicKey(), signature: 'y', weight: 1 },
        ],
        pendingSigners: [],
        memo: null,
        expiresAtLedger: null,
        submittedAt: null,
        stellarTxId: null,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as PendingTransaction;

      (repo.findOne as jest.Mock).mockResolvedValue(readyEntity);
      (repo.save as jest.Mock).mockImplementation((data) => Promise.resolve(data));
    });

    it('should submit successfully and update status', async () => {
      mockServer.submitTransaction.mockResolvedValue({ id: 'stellar-tx-hash-abc' });

      const result = await service.submitToNetwork('ready-uuid');

      expect(result.success).toBe(true);
      expect(result.stellarTxId).toBe('stellar-tx-hash-abc');
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: PendingTransactionStatus.SUBMITTED }),
      );
    });

    it('should return failure result and set FAILED status on horizon error', async () => {
      mockServer.submitTransaction.mockRejectedValue({
        response: {
          data: { extras: { result_codes: { transaction: 'tx_bad_auth' } } },
        },
      });

      const result = await service.submitToNetwork('ready-uuid');

      expect(result.success).toBe(false);
      expect(result.message).toBe('tx_bad_auth');
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: PendingTransactionStatus.FAILED }),
      );
    });

    it('should throw BadRequestException when status is not READY', async () => {
      readyEntity.status = PendingTransactionStatus.PENDING;
      await expect(service.submitToNetwork('ready-uuid')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException for unknown ID', async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(null);
      await expect(service.submitToNetwork('ghost-uuid')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── getPendingTransactions ───────────────────────────────────────────────

  describe('getPendingTransactions', () => {
    it('should return list of pending transactions for an account', async () => {
      (repo.find as jest.Mock).mockResolvedValue([
        {
          id: 'tx-1',
          accountId: ACCOUNT_ID,
          status: PendingTransactionStatus.PENDING,
          requiredThreshold: 2,
          collectedWeight: 1,
          signatures: [],
          pendingSigners: [KP2.publicKey()],
          memo: null,
          expiresAtLedger: null,
          submittedAt: null,
          stellarTxId: null,
          metadata: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as unknown as PendingTransaction,
      ]);

      const result = await service.getPendingTransactions(ACCOUNT_ID);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('tx-1');
    });
  });

  // ─── expireStaleTransactions ──────────────────────────────────────────────

  describe('expireStaleTransactions', () => {
    it('should call update query and return affected count', async () => {
      const qb = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 3 }),
      };
      (repo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

      const count = await service.expireStaleTransactions(1000000);
      expect(count).toBe(3);
      expect(qb.execute).toHaveBeenCalled();
    });
  });
});
