import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { SignalForecastingService } from '../forecasting/signal-forecasting.service';
import { ForecastResultDto } from '../dto/forecast-result.dto';

@ApiTags('ML Analysis')
@Controller('ml/forecasting')
export class SignalForecastingController {
  constructor(private readonly forecastingService: SignalForecastingService) {}

  @Get(':signalId')
  @ApiOperation({ summary: 'Get performance forecast for a signal' })
  @ApiParam({ name: 'signalId', description: 'Signal UUID' })
  @ApiResponse({ status: 200, type: ForecastResultDto })
  async getForecast(
    @Param('signalId') signalId: string,
  ): Promise<ForecastResultDto> {
    return this.forecastingService.getForecast(signalId);
  }
}
