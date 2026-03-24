import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  ParseUUIDPipe,
  UseGuards,
  Request,
} from '@nestjs/common';
import { BillingService } from './billing.service';
import { UsageTrackerService } from './usage-tracker.service';
import { UsageReportDto } from './dto/usage-report.dto';
import { PricingPlanDto } from './dto/pricing-plan.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('billing')
@UseGuards(JwtAuthGuard)
export class BillingController {
  constructor(
    private readonly billingService: BillingService,
    private readonly usageTracker: UsageTrackerService,
  ) {}

  @Get('summary')
  async getSummary(@Request() req: any, @Query('apiKeyId') apiKeyId: string) {
    return this.billingService.getBillingSummary(req.user.id, apiKeyId);
  }

  @Get('invoices')
  async getInvoices(@Request() req: any) {
    return this.billingService.getInvoices(req.user.id);
  }

  @Post('invoices/:cycleId/generate')
  async generateInvoice(
    @Request() req: any,
    @Param('cycleId', ParseUUIDPipe) cycleId: string,
  ) {
    return this.billingService.generateInvoice(req.user.id, cycleId);
  }

  @Post('invoices/:invoiceId/pay')
  async markPaid(@Param('invoiceId', ParseUUIDPipe) invoiceId: string) {
    return this.billingService.markInvoicePaid(invoiceId);
  }

  @Get('tiers')
  async getTiers() {
    return this.billingService.getPricingTiers();
  }

  @Post('tiers/assign')
  async assignTier(@Request() req: any, @Body() body: PricingPlanDto & { apiKeyId: string }) {
    return this.billingService.assignTier(req.user.id, body.apiKeyId, body.name);
  }

  @Get('usage')
  async getUsage(@Request() req: any, @Query() query: UsageReportDto) {
    const end = query.endDate ? new Date(query.endDate) : new Date();
    const start = query.startDate
      ? new Date(query.startDate)
      : new Date(end.getFullYear(), end.getMonth(), 1);

    return this.usageTracker.getUsageReport(query.apiKeyId, start, end);
  }

  @Get('usage/top-endpoints')
  async getTopEndpoints(@Request() req: any, @Query('apiKeyId') apiKeyId: string) {
    const since = new Date();
    since.setDate(since.getDate() - 30);
    return this.usageTracker.getTopEndpoints(apiKeyId, since);
  }
}
