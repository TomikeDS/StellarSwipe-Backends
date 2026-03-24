import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseUUIDPipe,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ProviderRewardsService } from './services/provider-rewards.service';
import { PayoutService } from './services/payout.service';
import { PayoutRequestDto } from './dto/payout-request.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'; // adjust path

@ApiTags('Provider Rewards')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('providers')
export class ProviderRewardsController {
  constructor(
    private readonly rewardsService: ProviderRewardsService,
    private readonly payoutService: PayoutService,
  ) {}

  // ── Earnings ─────────────────────────────────────────────────────────────

  @Get(':providerId/earnings/summary')
  @ApiOperation({ summary: 'Get provider earnings dashboard summary' })
  getEarningsSummary(@Param('providerId', ParseUUIDPipe) providerId: string) {
    return this.rewardsService.getEarningsSummary(providerId);
  }

  @Get(':providerId/earnings')
  @ApiOperation({ summary: 'List earnings (paginated)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  getEarnings(
    @Param('providerId', ParseUUIDPipe) providerId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.rewardsService.getEarningsList(providerId, page, limit);
  }

  // ── Payouts ───────────────────────────────────────────────────────────────

  @Post(':providerId/payouts')
  @ApiOperation({ summary: 'Request a payout' })
  requestPayout(
    @Param('providerId', ParseUUIDPipe) providerId: string,
    @Body() dto: PayoutRequestDto,
  ) {
    return this.payoutService.requestPayout(providerId, dto);
  }

  @Get(':providerId/payouts')
  @ApiOperation({ summary: 'Get payout history (paginated)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  getPayoutHistory(
    @Param('providerId', ParseUUIDPipe) providerId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.payoutService.getPayoutHistory(providerId, page, limit);
  }

  @Get(':providerId/payouts/:payoutId')
  @ApiOperation({ summary: 'Get a specific payout' })
  getPayout(
    @Param('providerId', ParseUUIDPipe) providerId: string,
    @Param('payoutId', ParseUUIDPipe) payoutId: string,
  ) {
    return this.payoutService.getPayoutById(providerId, payoutId);
  }

  @Post(':providerId/payouts/:payoutId/retry')
  @ApiOperation({ summary: 'Retry a failed payout' })
  retryPayout(
    @Param('providerId', ParseUUIDPipe) providerId: string,
    @Param('payoutId', ParseUUIDPipe) payoutId: string,
  ) {
    return this.payoutService.retryPayout(providerId, payoutId);
  }
}
