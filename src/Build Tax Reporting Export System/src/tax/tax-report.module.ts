import { Module } from '@nestjs/common';
import { TaxReportService } from './tax-report.service';
import { TaxReportController } from './tax-report.controller';

@Module({
  controllers: [TaxReportController],
  providers: [TaxReportService],
})
export class TaxReportModule {}
