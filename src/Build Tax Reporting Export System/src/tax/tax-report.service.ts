import { Injectable } from '@nestjs/common';
import { TaxReportQueryDto } from './dto/tax-report-query.dto';
import { TaxReportResultDto } from './dto/tax-report-result.dto';
import { CapitalGainsCalculator } from './calculators/capital-gains.calculator';
import { IRSForm8949Formatter } from './formatters/irs-form-8949.formatter';
import { PdfReportFormatter } from './formatters/pdf-report.formatter';

@Injectable()
export class TaxReportService {
  async generateReport(query: TaxReportQueryDto): Promise<TaxReportResultDto> {
    // 1. Calculate capital gains/losses
    const calculator = new CapitalGainsCalculator();
    const report = calculator.calculate(query);

    // 2. Format report for jurisdiction (example: US IRS Form 8949)
    let formattedReport;
    if (query.format === 'PDF') {
      formattedReport = await new PdfReportFormatter().format(report, query);
    } else {
      formattedReport = new IRSForm8949Formatter().format(report, query);
    }

    return formattedReport;
  }
}
