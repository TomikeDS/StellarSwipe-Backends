import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiKeyAuthGuard } from '../guards/api-key-auth.guard';
import { RequireScopes } from '../decorators/require-scopes.decorator';

/**
 * Example: Protecting endpoints with API key authentication
 * 
 * This demonstrates how to use the API key system to protect
 * your endpoints and enforce permission scopes.
 */

@Controller('example')
@UseGuards(ApiKeyAuthGuard)
export class ExampleController {
  /**
   * Public read endpoint - requires read:signals scope
   * 
   * Usage:
   * curl -H "Authorization: Bearer sk_live_..." \
   *   http://localhost:3000/api/v1/example/signals
   */
  @Get('signals')
  @RequireScopes('read:signals')
  async getSignals() {
    return {
      signals: [
        { id: '1', asset: 'XLM/USDC', action: 'BUY' },
        { id: '2', asset: 'BTC/USDC', action: 'SELL' },
      ],
    };
  }

  /**
   * Portfolio read endpoint - requires read:portfolio scope
   */
  @Get('portfolio')
  @RequireScopes('read:portfolio')
  async getPortfolio() {
    return {
      holdings: [
        { asset: 'XLM', amount: 1000 },
        { asset: 'USDC', amount: 500 },
      ],
    };
  }

  /**
   * Trade execution endpoint - requires write:trades scope
   */
  @Post('trades')
  @RequireScopes('write:trades')
  async executeTrade() {
    return {
      tradeId: 'trade-123',
      status: 'executed',
    };
  }

  /**
   * Signal creation endpoint - requires write:signals scope
   */
  @Post('signals')
  @RequireScopes('write:signals')
  async createSignal() {
    return {
      signalId: 'signal-456',
      status: 'created',
    };
  }

  /**
   * Multiple scopes - requires either read:signals OR read:portfolio
   * 
   * Note: Currently the guard checks if ANY of the required scopes match.
   * For AND logic, you would need to modify the guard.
   */
  @Get('dashboard')
  @RequireScopes('read:signals', 'read:portfolio')
  async getDashboard() {
    return {
      summary: 'Dashboard data',
    };
  }
}
