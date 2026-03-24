export class TaxReportResultDto {
  taxYear: number;
  method: 'FIFO' | 'LIFO';
  transactions: Array<{
    dateAcquired: Date;
    dateSold: Date;
    asset: string;
    quantity: number;
    costBasis: number;
    proceeds: number;
    gainLoss: number;
    term: 'short' | 'long';
  }>;
  summary: {
    totalGains: number;
    totalLosses: number;
    netPnL: number;
    shortTermGains: number;
    longTermGains: number;
  };
}
