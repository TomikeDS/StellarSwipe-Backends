import { Controller, Get, Query, UseGuards, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { Response } from 'express';
import { AdminAnalyticsService } from './admin-analytics.service';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';

@ApiTags('Admin Analytics')
@ApiBearerAuth()
@Controller('admin/analytics')
export class AdminAnalyticsController {
    constructor(private readonly analyticsService: AdminAnalyticsService) { }

    @Get('overview')
    @ApiOperation({ summary: 'Get overall analytics' })
    async getOverview(@Query() query: AnalyticsQueryDto) {
        return this.analyticsService.getOverview(query);
    }

    @Get('users')
    @ApiOperation({ summary: 'Get user behavior metrics' })
    async getUserMetrics(@Query() query: AnalyticsQueryDto) {
        return this.analyticsService.getUserMetrics(query);
    }

    @Get('trading')
    @ApiOperation({ summary: 'Get trading metrics' })
    async getTradingMetrics(@Query() query: AnalyticsQueryDto) {
        return this.analyticsService.getTradingMetrics(query);
    }

    @Get('revenue')
    @ApiOperation({ summary: 'Get revenue metrics' })
    async getRevenueMetrics(@Query() query: AnalyticsQueryDto) {
        return this.analyticsService.getRevenueMetrics(query);
    }

    @Get('cohorts')
    @ApiOperation({ summary: 'Get cohort retention analysis' })
    async getCohorts(@Query() query: AnalyticsQueryDto) {
        return this.analyticsService.getCohorts(query);
    }

    @Get('funnels')
    @ApiOperation({ summary: 'Get conversion funnel analysis' })
    async getFunnels(@Query() query: AnalyticsQueryDto) {
        return this.analyticsService.getFunnels(query);
    }

    @Get('export')
    @ApiOperation({ summary: 'Export analytics data as CSV' })
    async exportData(@Query() query: AnalyticsQueryDto, @Res() res: Response) {
        const csv = await this.analyticsService.exportData(query);

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=analytics-export.csv');

        return res.status(200).send(csv);
    }
}
