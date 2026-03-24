import { Module } from '@nestjs/common';
import { TaxReportModule } from './tax';

@Module({
  imports: [TaxReportModule],
})
export class AppModule {}
