import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MentorshipService } from './mentorship.service';
import { MentorshipController } from './mentorship.controller';
import { Mentorship } from './entities/mentorship.entity';
import { MentorshipFeedback } from './entities/mentorship-feedback.entity';
import { User } from '../users/entities/user.entity';
import { Signal } from '../signals/entities/signal.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Mentorship,
      MentorshipFeedback,
      User,
      Signal,
    ]),
  ],
  controllers: [MentorshipController],
  providers: [MentorshipService],
  exports: [MentorshipService],
})
export class MentorshipModule {}
