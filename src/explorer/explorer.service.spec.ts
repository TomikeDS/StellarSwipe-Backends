import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ExplorerService } from './explorer.service';

describe('ExplorerService', () => {
  let service: ExplorerService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExplorerService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue: string) => {
              if (key === 'STELLAR_NETWORK') {
                return 'testnet';
              }
              return defaultValue;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<ExplorerService>(ExplorerService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateTransactionLink', () => {
    it('should generate correct testnet transaction link', () => {
      const txHash = 'abc123def456';
      const link = service.generateTransactionLink(txHash);
      expect(link).toBe('https://stellar.expert/explorer/testnet/tx/abc123def456');
    });

    it('should generate correct mainnet transaction link', () => {
      const txHash = 'abc123def456';
      const link = service.generateTransactionLink(txHash, 'public');
      expect(link).toBe('https://stellar.expert/explorer/public/tx/abc123def456');
    });

    it('should return empty string for invalid hash', () => {
      const link = service.generateTransactionLink('');
      expect(link).toBe('');
    });
  });

  describe('generateAccountLink', () => {
    it('should generate correct account link', () => {
      const publicKey = 'GBBM6BKZPEHWYO3E3YKREDPQXMS4VK35YLNU7NFBRI26RAN7GI5POFBB';
      const link = service.generateAccountLink(publicKey);
      expect(link).toBe(
        `https://stellar.expert/explorer/testnet/account/${publicKey}`,
      );
    });

    it('should return empty string for invalid public key', () => {
      const link = service.generateAccountLink('');
      expect(link).toBe('');
    });
  });

  describe('generateAssetLink', () => {
    it('should generate correct asset link', () => {
      const code = 'USDC';
      const issuer = 'GBBM6BKZPEHWYO3E3YKREDPQXMS4VK35YLNU7NFBRI26RAN7GI5POFBB';
      const link = service.generateAssetLink(code, issuer);
      expect(link).toBe(
        `https://stellar.expert/explorer/testnet/asset/${code}-${issuer}`,
      );
    });

    it('should return empty string for missing asset code', () => {
      const link = service.generateAssetLink('', 'GISSUER');
      expect(link).toBe('');
    });
  });

  describe('generateLinks', () => {
    it('should generate multiple links', () => {
      const dto = {
        transaction: 'txhash123',
        account: 'GBBM6BKZPEHWYO3E3YKREDPQXMS4VK35YLNU7NFBRI26RAN7GI5POFBB',
        asset: 'USDC-GBBM6BKZPEHWYO3E3YKREDPQXMS4VK35YLNU7NFBRI26RAN7GI5POFBB',
        network: 'testnet' as const,
      };

      const result = service.generateLinks(dto);

      expect(result.transactionLink).toContain('/tx/txhash123');
      expect(result.accountLink).toContain('/account/GBBM');
      expect(result.assetLink).toContain('/asset/USDC-GBBM');
      expect(result.network).toBe('testnet');
    });
  });

  describe('verifyAssetIssuer', () => {
    it('should verify valid asset issuer', async () => {
      const code = 'USDC';
      const issuer = 'GBBM6BKZPEHWYO3E3YKREDPQXMS4VK35YLNU7NFBRI26RAN7GI5POFBB';

      const result = await service.verifyAssetIssuer(code, issuer);

      expect(result.code).toBe(code);
      expect(result.issuer).toBe(issuer);
      expect(result.verified).toBe(true);
      expect(result.explorerLink).toContain(`/asset/${code}-${issuer}`);
    });

    it('should mark invalid issuer as unverified', async () => {
      const code = 'USDC';
      const issuer = 'INVALID';

      const result = await service.verifyAssetIssuer(code, issuer);

      expect(result.verified).toBe(false);
    });
  });

  describe('getBaseUrl', () => {
    it('should return testnet base URL', () => {
      const url = service.getBaseUrl('testnet');
      expect(url).toBe('https://stellar.expert/explorer/testnet');
    });

    it('should return mainnet base URL', () => {
      const url = service.getBaseUrl('public');
      expect(url).toBe('https://stellar.expert/explorer/public');
    });
  });
});
