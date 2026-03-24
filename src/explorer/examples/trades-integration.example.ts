/**
 * Example: Integrating Explorer Links into Trades Module
 * 
 * This file demonstrates how to add blockchain explorer links
 * to an existing trades module.
 */

import { Module, Controller, Get, Param, Injectable } from '@nestjs/common';
import { ExplorerModule } from '../explorer.module';
import { ExplorerService } from '../explorer.service';
import { AddExplorerLinks } from '../decorators/add-explorer-links.decorator';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ExplorerLinkInterceptor } from '../interceptors/explorer-link.interceptor';

// ============================================================================
// EXAMPLE 1: Using Decorator (Recommended)
// ============================================================================

@Controller('trades')
export class TradesControllerWithDecorator {
  constructor(private tradesService: any) {}

  /**
   * Automatically adds explorer links to response
   * No manual code needed!
   */
  @Get(':id')
  @AddExplorerLinks({
    txHashField: 'txHash',
    accountFields: ['fromAccount', 'toAccount'],
  })
  async getTrade(@Param('id') id: string) {
    // Your existing code - unchanged
    return this.tradesService.findOne(id);
  }

  /**
   * Works with arrays too
   */
  @Get()
  @AddExplorerLinks({
    txHashField: 'txHash',
    accountFields: ['fromAccount', 'toAccount'],
  })
  async getAllTrades() {
    return this.tradesService.findAll();
  }
}

// ============================================================================
// EXAMPLE 2: Manual Integration in Service
// ============================================================================

@Injectable()
export class TradesServiceWithExplorer {
  constructor(private explorerService: ExplorerService) {}

  async getTrade(id: string) {
    const trade = await this.findTradeById(id);
    
    // Manually add explorer links
    return {
      ...trade,
      explorerLink: this.explorerService.generateTransactionLink(trade.txHash),
      fromAccountLink: this.explorerService.generateAccountLink(trade.fromAccount),
      toAccountLink: this.explorerService.generateAccountLink(trade.toAccount),
    };
  }

  async getTradeHistory(accountId: string) {
    const trades = await this.findTradesByAccount(accountId);
    
    // Add links to array of trades
    return trades.map(trade => ({
      ...trade,
      explorerLink: this.explorerService.generateTransactionLink(trade.txHash),
    }));
  }

  private async findTradeById(id: string): Promise<any> {
    // Your database query
    return {};
  }

  private async findTradesByAccount(accountId: string): Promise<any[]> {
    // Your database query
    return [];
  }
}

// ============================================================================
// EXAMPLE 3: Module Setup
// ============================================================================

@Module({
  imports: [
    ExplorerModule, // Import the explorer module
  ],
  controllers: [TradesControllerWithDecorator],
  providers: [
    TradesServiceWithExplorer,
    // Add interceptor to enable decorator functionality
    {
      provide: APP_INTERCEPTOR,
      useClass: ExplorerLinkInterceptor,
    },
  ],
})
export class TradesModuleWithExplorer {}

// ============================================================================
// EXAMPLE 4: Response Transformation
// ============================================================================

@Controller('trades')
export class TradesControllerAdvanced {
  constructor(
    private tradesService: any,
    private explorerService: ExplorerService,
  ) {}

  @Get(':id/detailed')
  async getDetailedTrade(@Param('id') id: string) {
    const trade = await this.tradesService.findOne(id);
    
    // Generate all relevant links
    const links = this.explorerService.generateLinks({
      transaction: trade.txHash,
      account: trade.fromAccount,
      asset: `${trade.assetCode}-${trade.assetIssuer}`,
      network: 'public',
    });
    
    return {
      trade,
      explorer: links,
    };
  }

  @Get(':id/verify')
  async verifyTrade(@Param('id') id: string) {
    const trade = await this.tradesService.findOne(id);
    
    // Verify asset issuer
    const assetVerification = await this.explorerService.verifyAssetIssuer(
      trade.assetCode,
      trade.assetIssuer,
    );
    
    return {
      trade,
      assetVerification,
    };
  }
}

// ============================================================================
// EXAMPLE 5: WebSocket Integration
// ============================================================================

import { WebSocketGateway, SubscribeMessage, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway()
export class TradesGatewayWithExplorer {
  @WebSocketServer()
  server: Server;

  constructor(private explorerService: ExplorerService) {}

  @SubscribeMessage('trade-executed')
  handleTradeExecuted(client: any, payload: any) {
    // Add explorer link to real-time event
    const enhancedPayload = {
      ...payload,
      explorerLink: this.explorerService.generateTransactionLink(payload.txHash),
    };
    
    this.server.emit('trade-executed', enhancedPayload);
  }
}

// ============================================================================
// EXAMPLE 6: Custom Response DTO
// ============================================================================

export class TradeResponseDto {
  id: string;
  txHash: string;
  explorerLink?: string;
  fromAccount: string;
  fromAccountLink?: string;
  toAccount: string;
  toAccountLink?: string;
  amount: string;
  assetCode: string;
  assetIssuer: string;
  assetLink?: string;
  timestamp: Date;

  static fromEntity(trade: any, explorerService: ExplorerService): TradeResponseDto {
    const dto = new TradeResponseDto();
    dto.id = trade.id;
    dto.txHash = trade.txHash;
    dto.fromAccount = trade.fromAccount;
    dto.toAccount = trade.toAccount;
    dto.amount = trade.amount;
    dto.assetCode = trade.assetCode;
    dto.assetIssuer = trade.assetIssuer;
    dto.timestamp = trade.timestamp;

    // Add explorer links
    dto.explorerLink = explorerService.generateTransactionLink(trade.txHash);
    dto.fromAccountLink = explorerService.generateAccountLink(trade.fromAccount);
    dto.toAccountLink = explorerService.generateAccountLink(trade.toAccount);
    dto.assetLink = explorerService.generateAssetLink(trade.assetCode, trade.assetIssuer);

    return dto;
  }
}

@Controller('trades')
export class TradesControllerWithDto {
  constructor(
    private tradesService: any,
    private explorerService: ExplorerService,
  ) {}

  @Get(':id')
  async getTrade(@Param('id') id: string): Promise<TradeResponseDto> {
    const trade = await this.tradesService.findOne(id);
    return TradeResponseDto.fromEntity(trade, this.explorerService);
  }
}
