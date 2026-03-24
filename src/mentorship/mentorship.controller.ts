import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { MentorshipService } from './mentorship.service';
import { RequestMentorDto } from './dto/request-mentor.dto';
import { ProvideFeedbackDto } from './dto/provide-feedback.dto';


@Controller('mentorship')
// @UseGuards(JwtAuthGuard) // Assuming authentication is required
export class MentorshipController {
  constructor(private readonly mentorshipService: MentorshipService) {}

  @Get('match')
  async matchMentors(
    @Query('userId') userId: string, // Fallback if no auth decorator
    @Query('specialization') specialization?: string,
  ) {
    return this.mentorshipService.matchMentors(userId, specialization);
  }

  @Post('request')
  async requestMentorship(
    @Body('userId') userId: string,
    @Body() dto: RequestMentorDto,
  ) {
    return this.mentorshipService.requestMentorship(userId, dto);
  }

  @Post(':id/accept')
  async acceptMentorship(
    @Param('id') id: string,
    @Body('mentorId') mentorId: string,
  ) {
    return this.mentorshipService.acceptMentorship(mentorId, id);
  }

  @Post('feedback')
  async provideFeedback(
    @Body('userId') userId: string,
    @Body() dto: ProvideFeedbackDto,
  ) {
    return this.mentorshipService.provideFeedback(userId, dto);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  async cancelMentorship(
    @Param('id') id: string,
    @Body('userId') userId: string,
  ) {
    return this.mentorshipService.cancelMentorship(userId, id);
  }

  @Get(':id')
  async getMentorship(@Param('id') id: string) {
    return this.mentorshipService.getMentorship(id);
  }

  @Post(':id/update-progress')
  async updateProgress(@Param('id') id: string) {
    return this.mentorshipService.updateProgress(id);
  }
}
