import { ApiProperty } from '@nestjs/swagger';

export class ExpectedPnL {
  @ApiProperty({ description: 'Lower bound of expected P&L' })
  low!: number;

  @ApiProperty({ description: 'Middle/Average expected P&L' })
  mid!: number;

  @ApiProperty({ description: 'Upper bound of expected P&L' })
  high!: number;
}

export class ForecastResultDto {
  @ApiProperty({ description: 'Signal ID' })
  signalId!: string;

  @ApiProperty({ description: 'Success probability (0-100%)' })
  successProbability!: number;

  @ApiProperty({ description: 'Expected P&L range' })
  expectedPnL!: ExpectedPnL;

  @ApiProperty({ description: 'Confidence in this prediction (0-100%)' })
  confidence!: number;

  @ApiProperty({ description: 'Number of samples this prediction is based on' })
  basedOnSamples!: number;
}
