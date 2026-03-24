import { Controller, Get, Put, Body, Param, UseGuards } from '@nestjs/common';
import { ProvidersService } from './providers.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { AuthGuard } from '../common/guards/auth.guard';

@Controller('providers')
export class ProvidersController {
  constructor(private readonly providersService: ProvidersService) {}

  @Get(':walletAddress')
  async getProviderProfile(@Param('walletAddress') walletAddress: string) {
    return this.providersService.getProfile(walletAddress);
  }

  @Put('profile')
  @UseGuards(AuthGuard)
  async updateProviderProfile(@Body() updateProfileDto: UpdateProfileDto) {
    return this.providersService.updateProfile(updateProfileDto);
  }
}