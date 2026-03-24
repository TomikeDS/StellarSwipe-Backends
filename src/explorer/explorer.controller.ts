import { Controller, Get, Query, Param } from '@nestjs/common';
import { ExplorerService } from './explorer.service';
import {
  ExplorerLinkDto,
  ExplorerLinksResponseDto,
  AssetVerificationDto,
} from './dto/explorer-link.dto';

@Controller('explorer')
export class ExplorerController {
  constructor(private readonly explorerService: ExplorerService) {}

  @Get('transaction/:hash')
  getTransactionLink(
    @Param('hash') hash: string,
    @Query('network') network?: 'public' | 'testnet',
  ): { link: string } {
    return {
      link: this.explorerService.generateTransactionLink(hash, network),
    };
  }

  @Get('account/:publicKey')
  getAccountLink(
    @Param('publicKey') publicKey: string,
    @Query('network') network?: 'public' | 'testnet',
  ): { link: string } {
    return {
      link: this.explorerService.generateAccountLink(publicKey, network),
    };
  }

  @Get('asset/:code/:issuer')
  getAssetLink(
    @Param('code') code: string,
    @Param('issuer') issuer: string,
    @Query('network') network?: 'public' | 'testnet',
  ): { link: string } {
    return {
      link: this.explorerService.generateAssetLink(code, issuer, network),
    };
  }

  @Get('links')
  generateLinks(@Query() dto: ExplorerLinkDto): ExplorerLinksResponseDto {
    return this.explorerService.generateLinks(dto);
  }

  @Get('verify-asset/:code/:issuer')
  async verifyAsset(
    @Param('code') code: string,
    @Param('issuer') issuer: string,
    @Query('network') network?: 'public' | 'testnet',
  ): Promise<AssetVerificationDto> {
    return this.explorerService.verifyAssetIssuer(code, issuer, network);
  }

  @Get('health')
  async checkHealth(
    @Query('network') network?: 'public' | 'testnet',
  ): Promise<{ available: boolean; baseUrl: string }> {
    const available = await this.explorerService.checkExplorerAvailability(network);
    const baseUrl = this.explorerService.getBaseUrl(network);
    return { available, baseUrl };
  }
}
