import { Controller, Get, Query } from '@nestjs/common';
import { TaxReportService } from './tax-report.service';
import { TaxReportQueryDto } from './dto/tax-report-query.dto';
import { TaxReportResultDto } from './dto/tax-report-result.dto';

@Controller('portfolio/tax-report')
export class TaxReportController {
  constructor(private readonly taxReportService: TaxReportService) {}

  @Get()
  async getTaxReport(@Query() query: TaxReportQueryDto): Promise<TaxReportResultDto> {
    return this.taxReportService.generateReport(query);
  }
}
