import { Test, TestingModule } from '@nestjs/testing';
import * as StellarSdk from '@stellar/stellar-sdk';
import { MultisigController } from './multisig.controller';
import { MultisigService } from './multisig.service';
import { PendingTransactionStatus } from './entities/pending-transaction.entity';
import { PendingTransactionStatusDto } from './dto/multisig-status.dto';

const KP1 = StellarSdk.Keypair.random();
const KP2 = StellarSdk.Keypair.random();
const ACCOUNT_ID = KP1.publicKey();

const mockPendingDto = (overrides: Partial<PendingTransactionStatusDto> = {}): PendingTransactionStatusDto => ({
  id: 'uuid-1',
  accountId: ACCOUNT_ID,
  status: PendingTransactionStatus.PENDING,
  requiredThreshold: 2,
  collectedWeight: 1,
  remainingWeight: 1,
  isReady: false,
  pendingSigners: [KP2.publicKey()],
  signatures: [{ publicKey: KP1.publicKey(), weight: 1 }],
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('MultisigController', () => {
  let controller: MultisigController;
  let service: jest.Mocked<MultisigService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MultisigController],
      providers: [
        {
          provide: MultisigService,
          useValue: {
            getAccountMultisigStatus: jest.fn(),
            getPendingTransactions: jest.fn(),
            getPendingTransactionById: jest.fn(),
            createPendingTransaction: jest.fn(),
            submitSignature: jest.fn(),
            submitToNetwork: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<MultisigController>(MultisigController);
    service = module.get(MultisigService);
  });

  describe('getAccountStatus', () => {
    it('should delegate to service.getAccountMultisigStatus', async () => {
      const expected = {
        accountId: ACCOUNT_ID,
        isMultisig: true,
        thresholdLow: 0,
        thresholdMedium: 2,
        thresholdHigh: 3,
        signers: [
          { publicKey: KP1.publicKey(), weight: 1, hasSigned: false },
          { publicKey: KP2.publicKey(), weight: 1, hasSigned: false },
        ],
        totalWeight: 2,
      };
      service.getAccountMultisigStatus.mockResolvedValue(expected);

      const result = await controller.getAccountStatus(ACCOUNT_ID);
      expect(result).toBe(expected);
      expect(service.getAccountMultisigStatus).toHaveBeenCalledWith(ACCOUNT_ID);
    });
  });

  describe('getPendingTransactions', () => {
    it('should return list from service', async () => {
      const list = [mockPendingDto()];
      service.getPendingTransactions.mockResolvedValue(list);

      const result = await controller.getPendingTransactions(ACCOUNT_ID);
      expect(result).toBe(list);
      expect(service.getPendingTransactions).toHaveBeenCalledWith(ACCOUNT_ID, undefined);
    });

    it('should pass status filters through to service', async () => {
      service.getPendingTransactions.mockResolvedValue([]);
      const statuses = [PendingTransactionStatus.READY];

      await controller.getPendingTransactions(ACCOUNT_ID, statuses);
      expect(service.getPendingTransactions).toHaveBeenCalledWith(ACCOUNT_ID, statuses);
    });
  });

  describe('getTransaction', () => {
    it('should return a single pending transaction', async () => {
      const dto = mockPendingDto();
      service.getPendingTransactionById.mockResolvedValue(dto);

      const result = await controller.getTransaction('uuid-1');
      expect(result).toBe(dto);
      expect(service.getPendingTransactionById).toHaveBeenCalledWith('uuid-1');
    });
  });

  describe('createPendingTransaction', () => {
    it('should create and return a pending transaction', async () => {
      const dto = mockPendingDto();
      service.createPendingTransaction.mockResolvedValue(dto);

      const result = await controller.createPendingTransaction({
        accountId: ACCOUNT_ID,
        transactionXdr: 'AAAA...',
      });
      expect(result).toBe(dto);
    });
  });

  describe('submitSignature', () => {
    it('should submit a signature and return updated status', async () => {
      const updated = mockPendingDto({ status: PendingTransactionStatus.READY, collectedWeight: 2, isReady: true });
      service.submitSignature.mockResolvedValue(updated);

      const result = await controller.submitSignature({
        pendingTransactionId: 'uuid-1',
        signerPublicKey: KP2.publicKey(),
        signature: 'base64sig==',
      });

      expect(result).toBe(updated);
      expect(service.submitSignature).toHaveBeenCalled();
    });
  });

  describe('submitToNetwork', () => {
    it('should submit to network and return result', async () => {
      const submitResult = { success: true, stellarTxId: 'abc123', pendingTransactionId: 'uuid-1' };
      service.submitToNetwork.mockResolvedValue(submitResult);

      const result = await controller.submitToNetwork('uuid-1');
      expect(result).toBe(submitResult);
      expect(service.submitToNetwork).toHaveBeenCalledWith('uuid-1');
    });
  });
});
