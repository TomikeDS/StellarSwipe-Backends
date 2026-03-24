import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  //   Patch,
  Param,
  Body,
  Query,
  Req,
  //   UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  //   ApiResponse,
} from '@nestjs/swagger';
import { Request } from 'express';

import { AccessControlService } from './access-control.service';
import { IpWhitelistService } from './ip-whitelist.service';
import { GeofencingService } from './geofencing.service';
import {
  AddIpDto,
  RemoveIpDto,
  UpdateWhitelistSettingsDto,
} from '../dto/add-ip.dto';
import {
  SetGeoRestrictionDto,
  CreateTempAccessCodeDto,
  UseTempAccessCodeDto,
} from '../dto/set-geo-restriction.dto';

@ApiTags('Security / Access Control')
@ApiBearerAuth()
// @UseGuards(JwtAuthGuard)   ← wire your existing JWT guard here
@Controller('security/access-control')
export class AccessControlController {
  constructor(
    private readonly accessControl: AccessControlService,
    private readonly ipWhitelist: IpWhitelistService,
    private readonly geofencing: GeofencingService,
  ) {}

  // ─── IP Whitelist ──────────────────────────────────────────────────────────

  @Get('whitelist/:userId')
  @ApiOperation({ summary: 'Get IP whitelist for a user' })
  getWhitelist(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.ipWhitelist.getWhitelist(userId);
  }

  @Post('whitelist/:userId/ip')
  @ApiOperation({ summary: 'Add an IP address or CIDR range to the whitelist' })
  addIp(@Param('userId', ParseUUIDPipe) userId: string, @Body() dto: AddIpDto) {
    return this.ipWhitelist.addIp(userId, dto);
  }

  @Delete('whitelist/:userId/ip')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove an IP address from the whitelist' })
  removeIp(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: RemoveIpDto,
  ) {
    return this.ipWhitelist.removeIp(userId, dto);
  }

  @Put('whitelist/:userId')
  @ApiOperation({
    summary: 'Update IP whitelist settings (enable/disable, bulk replace)',
  })
  updateWhitelistSettings(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: UpdateWhitelistSettingsDto,
  ) {
    return this.ipWhitelist.updateSettings(userId, dto);
  }

  // ─── Geofencing ───────────────────────────────────────────────────────────

  @Get('geo/:userId')
  @ApiOperation({ summary: 'Get geo-restriction settings for a user' })
  getGeoRestriction(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.geofencing.getRestriction(userId);
  }

  @Put('geo/:userId')
  @ApiOperation({ summary: 'Set/update geo-restriction rules for a user' })
  setGeoRestriction(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: SetGeoRestrictionDto,
  ) {
    return this.geofencing.setRestriction(userId, dto);
  }

  // ─── Temporary Access Codes ───────────────────────────────────────────────

  @Post('temp-codes/:userId')
  @ApiOperation({
    summary: 'Generate a temporary access code (e.g. for travel)',
  })
  createTempCode(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: CreateTempAccessCodeDto,
    @Req() req: any,
  ) {
    const createdBy: string | undefined = req.user?.id;
    return this.accessControl.createTempAccessCode(userId, dto, createdBy);
  }

  @Get('temp-codes/:userId')
  @ApiOperation({ summary: 'List active temporary access codes for a user' })
  listTempCodes(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.accessControl.listTempCodes(userId);
  }

  @Delete('temp-codes/:userId/:codeId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke a temporary access code' })
  revokeTempCode(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('codeId', ParseUUIDPipe) codeId: string,
  ) {
    return this.accessControl.revokeTempCode(codeId, userId);
  }

  @Post('temp-codes/:userId/validate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validate and consume a temporary access code' })
  validateTempCode(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: UseTempAccessCodeDto,
    @Req() req: Request,
  ) {
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0] ??
      req.ip ??
      '0.0.0.0';
    return this.accessControl.validateAndConsumeTempCode(userId, dto.code, ip);
  }

  // ─── Access Logs ──────────────────────────────────────────────────────────

  @Get('logs/:userId')
  @ApiOperation({ summary: 'Get access attempt logs for a user' })
  getLogs(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query('blockedOnly') blockedOnly?: boolean,
    @Query('limit') limit?: number,
  ) {
    return this.accessControl.getAccessLogs(userId, { blockedOnly, limit });
  }

  @Get('logs/:userId/summary')
  @ApiOperation({ summary: 'Get 7-day blocked attempt summary for a user' })
  getLogsSummary(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.accessControl.getBlockedAttemptsSummary(userId);
  }

  // ─── Geo Lookup (utility) ─────────────────────────────────────────────────

  @Get('geo-lookup')
  @ApiOperation({ summary: 'Look up geographic information for an IP address' })
  geoLookup(@Query('ip') ip: string) {
    return this.geofencing.getLocation(ip);
  }
}
