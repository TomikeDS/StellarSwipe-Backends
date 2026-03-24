import { TaxReportResultDto } from '../dto/tax-report-result.dto';
import { TaxReportQueryDto } from '../dto/tax-report-query.dto';

export class IRSForm8949Formatter {
  format(report: TaxReportResultDto, query: TaxReportQueryDto): TaxReportResultDto {
    // Format the report for IRS Form 8949 (CSV or JSON)
    return report;
  }
}
