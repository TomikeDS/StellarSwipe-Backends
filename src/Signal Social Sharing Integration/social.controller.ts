import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SocialService } from './social.service';
import { ReferralTrackerService } from './services/referral-tracker.service';
import { ShareSignalDto, ShareSignalResponseDto } from './dto/share-signal.dto';

@ApiTags('Social')
@ApiBearerAuth()
@Controller()
export class SocialController {
  constructor(
    private readonly socialService: SocialService,
    private readonly referralTracker: ReferralTrackerService,
  ) {}

  /**
   * POST /signals/:id/share
   * Generate sharing assets for a signal
   */
  @Post('signals/:id/share')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate share link, image, and Twitter intent URL for a signal' })
  @ApiResponse({ status: 200, type: ShareSignalResponseDto })
  @ApiResponse({ status: 404, description: 'Signal not found' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  async shareSignal(
    @Param('id') signalId: string,
    @Request() req: { user: { id: string } },
    @Body() dto: ShareSignalDto,
  ): Promise<ShareSignalResponseDto> {
    return this.socialService.shareSignal(signalId, req.user.id, dto);
  }

  /**
   * GET /signals/:id/share/stats
   * Get share analytics for a signal (per user)
   */
  @Get('signals/:id/share/stats')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get share stats for a signal' })
  async getShareStats(
    @Param('id') signalId: string,
    @Request() req: { user: { id: string } },
  ) {
    return this.socialService.getShareStats(signalId, req.user.id);
  }

  /**
   * GET /referral/click
   * Track when someone visits via a referral link
   * Called from the frontend when a visitor lands with ?ref=CODE
   */
  @Get('referral/click')
  @ApiOperation({ summary: 'Track a referral link click' })
  async trackReferralClick(
    @Query('ref') referralCode: string,
    @Request() req: any,
  ) {
    if (!referralCode) return { tracked: false };

    const result = await this.referralTracker.trackClick({
      referralCode,
      visitorIp: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return { tracked: !!result };
  }
}
