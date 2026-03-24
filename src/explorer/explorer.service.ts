import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ExplorerLinkDto,
  ExplorerLinksResponseDto,
  AssetVerificationDto,
} from './dto/explorer-link.dto';

@Injectable()
export class ExplorerService {
  private readonly logger = new Logger(ExplorerService.name);
  private readonly baseUrls = {
    public: 'https://stellar.expert/explorer/public',
    testnet: 'https://stellar.expert/explorer/testnet',
  };

  constructor(private configService: ConfigService) {}

  /**
   * Get the current network from configuration
   */
  private getCurrentNetwork(): 'public' | 'testnet' {
    const network = this.configService.get<string>('STELLAR_NETWORK', 'testnet');
    return network.toLowerCase() === 'public' ? 'public' : 'testnet';
  }

  /**
   * Generate explorer URL for a transaction
   */
  generateTransactionLink(txHash: string, network?: 'public' | 'testnet'): string {
    const net = network || this.getCurrentNetwork();
    
    if (!txHash || typeof txHash !== 'string') {
      this.logger.warn('Invalid transaction hash provided');
      return '';
    }

    return `${this.baseUrls[net]}/tx/${txHash}`;
  }

  /**
   * Generate explorer URL for an account
   */
  generateAccountLink(publicKey: string, network?: 'public' | 'testnet'): string {
    const net = network || this.getCurrentNetwork();
    
    if (!publicKey || typeof publicKey !== 'string') {
      this.logger.warn('Invalid public key provided');
      return '';
    }

    return `${this.baseUrls[net]}/account/${publicKey}`;
  }

  /**
   * Generate explorer URL for an asset
   */
  generateAssetLink(
    assetCode: string,
    issuer: string,
    network?: 'public' | 'testnet',
  ): string {
    const net = network || this.getCurrentNetwork();
    
    if (!assetCode || !issuer) {
      this.logger.warn('Invalid asset code or issuer provided');
      return '';
    }

    return `${this.baseUrls[net]}/asset/${assetCode}-${issuer}`;
  }

  /**
   * Generate multiple explorer links at once
   */
  generateLinks(dto: ExplorerLinkDto): ExplorerLinksResponseDto {
    const network = dto.network || this.getCurrentNetwork();
    const response: ExplorerLinksResponseDto = {
      network,
    };

    if (dto.transaction) {
      response.transactionLink = this.generateTransactionLink(dto.transaction, network);
    }

    if (dto.account) {
      response.accountLink = this.generateAccountLink(dto.account, network);
    }

    if (dto.asset) {
      const [code, issuer] = dto.asset.split('-');
      if (code && issuer) {
        response.assetLink = this.generateAssetLink(code, issuer, network);
      }
    }

    return response;
  }

  /**
   * Verify asset issuer information
   */
  async verifyAssetIssuer(
    assetCode: string,
    issuer: string,
    network?: 'public' | 'testnet',
  ): Promise<AssetVerificationDto> {
    const net = network || this.getCurrentNetwork();
    const explorerLink = this.generateAssetLink(assetCode, issuer, net);

    try {
      // Basic validation
      const isValidIssuer = this.isValidStellarAddress(issuer);
      
      return {
        code: assetCode,
        issuer,
        verified: isValidIssuer,
        explorerLink,
      };
    } catch (error) {
      this.logger.error(`Error verifying asset issuer: ${error.message}`);
      return {
        code: assetCode,
        issuer,
        verified: false,
        explorerLink,
      };
    }
  }

  /**
   * Validate Stellar address format
   */
  private isValidStellarAddress(address: string): boolean {
    if (!address || typeof address !== 'string') {
      return false;
    }

    // Stellar addresses start with 'G' and are 56 characters long
    return address.length === 56 && address.startsWith('G');
  }

  /**
   * Check if explorer service is available
   */
  async checkExplorerAvailability(network?: 'public' | 'testnet'): Promise<boolean> {
    const net = network || this.getCurrentNetwork();
    const url = this.baseUrls[net];

    try {
      // Simple check - in production, you might want to make an actual HTTP request
      return !!url;
    } catch (error) {
      this.logger.error(`Explorer availability check failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Detect network from transaction hash or account
   */
  detectNetwork(identifier: string): 'public' | 'testnet' | null {
    // This is a simplified detection - in reality, you'd need to query both networks
    // or maintain a cache of known addresses/transactions
    const currentNetwork = this.getCurrentNetwork();
    this.logger.debug(`Using current network configuration: ${currentNetwork}`);
    return currentNetwork;
  }

  /**
   * Get base URL for current network
   */
  getBaseUrl(network?: 'public' | 'testnet'): string {
    const net = network || this.getCurrentNetwork();
    return this.baseUrls[net];
  }
}
