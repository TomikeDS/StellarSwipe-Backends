import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  NotFoundException,
  BadRequestException,
  Req,
} from '@nestjs/common';
import { SignalsService } from './signals.service';
import { Signal } from './entities/signal.entity';
import { I18nAppService } from '../i18n/i18n.service';

@Controller('signals')
export class SignalsController {
  constructor(
    private readonly signalsService: SignalsService,
    private readonly i18n: I18nAppService,
  ) { }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createSignal(@Body() body: any, @Req() req: any): Promise<Signal> {
    try {
      return await this.signalsService.create(body);
    } catch (error) {
      const lang = req['language'] || 'en';
      let errorMessage = 'Trade execution failed';

      if (error instanceof Error) {
        if (error.message.includes('price')) {
          errorMessage = await this.i18n.translate('errors.INVALID_PRICE', lang);
        } else if (error.message.includes('balance')) {
          errorMessage = await this.i18n.translate('errors.INSUFFICIENT_BALANCE', lang);
        } else {
          errorMessage = await this.i18n.translate('errors.TRADE_FAILED', lang);
        }
      }

      throw new BadRequestException(errorMessage);
    }
  }

  @Get()
  async findAll(): Promise<Signal[]> {
    return this.signalsService.findAll();
  }

  @Get(':id')
  async getSignal(@Param('id', ParseUUIDPipe) id: string): Promise<Signal> {
    const signal = await this.signalsService.findOne(id);
    if (!signal) {
      throw new NotFoundException(`Signal with ID ${id} not found`);
    }
    return signal;
  }
}
