import { TaxReportResultDto } from '../dto/tax-report-result.dto';
import { TaxReportQueryDto } from '../dto/tax-report-query.dto';

export class PdfReportFormatter {
  async format(report: TaxReportResultDto, query: TaxReportQueryDto): Promise<TaxReportResultDto> {
    // Generate PDF and return report with PDF buffer or link
    return report;
  }
}
