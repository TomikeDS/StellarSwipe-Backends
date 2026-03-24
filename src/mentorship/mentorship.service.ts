import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Mentorship, MentorshipStatus } from './entities/mentorship.entity';
import { MentorshipFeedback } from './entities/mentorship-feedback.entity';
import { User } from '../users/entities/user.entity';
import { Signal, SignalOutcome } from '../signals/entities/signal.entity';
import { RequestMentorDto } from './dto/request-mentor.dto';
import { ProvideFeedbackDto } from './dto/provide-feedback.dto';

@Injectable()
export class MentorshipService {
  private readonly logger = new Logger(MentorshipService.name);

  constructor(
    @InjectRepository(Mentorship)
    private readonly mentorshipRepository: Repository<Mentorship>,
    @InjectRepository(MentorshipFeedback)
    private readonly feedbackRepository: Repository<MentorshipFeedback>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Signal)
    private readonly signalRepository: Repository<Signal>,
  ) {}

  /**
   * Match based on: asset specialization, reputation, availability
   */
  async matchMentors(menteeId: string, specialization?: string): Promise<User[]> {
    const qb = this.userRepository.createQueryBuilder('user')
      .where('user.id != :menteeId', { menteeId })
      .andWhere('user.reputationScore > :minReputation', { minReputation: 100 })
      .andWhere('user.isActive = :isActive', { isActive: true });

    // Check availability (not already mentoring too many people, e.g. limit 5)
    // Subquery to count active mentorships
    qb.andWhere(qb => {
      const subQuery = qb.subQuery()
        .select('COUNT(m.id)')
        .from(Mentorship, 'm')
        .where('m.mentor_id = user.id')
        .andWhere('m.status = :status', { status: MentorshipStatus.ACTIVE })
        .getQuery();
      return `${subQuery} < 5`;
    });

    if (specialization) {
      // Basic specialization check: Mentor has at least one signal with the requested asset
      qb.andWhere(qb => {
        const subQuery = qb.subQuery()
          .select('1')
          .from(Signal, 's')
          .where('s.provider_id = user.id')
          .andWhere('s.base_asset = :specialization', { specialization })
          .getQuery();
        return `EXISTS (${subQuery})`;
      });
    }

    return qb.orderBy('user.reputationScore', 'DESC').take(10).getMany();
  }

  async requestMentorship(menteeId: string, dto: RequestMentorDto): Promise<Mentorship> {
    const mentor = await this.userRepository.findOneBy({ id: dto.mentorId });
    if (!mentor) throw new NotFoundException('Mentor not found');
    if (mentor.id === menteeId) throw new BadRequestException('Cannot mentor yourself');

    // Check if relationship already exists
    const existing = await this.mentorshipRepository.findOne({
      where: [
        { mentorId: dto.mentorId, menteeId, status: MentorshipStatus.ACTIVE },
        { mentorId: dto.mentorId, menteeId, status: MentorshipStatus.REQUESTED },
      ],
    });

    if (existing) throw new BadRequestException('Mentorship relationship already exists or requested');

    // Get initial win rate for mentee
    const metrics = await this.calculateMenteeMetrics(menteeId);

    const mentorship = this.mentorshipRepository.create({
      mentorId: dto.mentorId,
      menteeId,
      status: MentorshipStatus.REQUESTED,
      metrics: {
        signalsReviewed: 0,
        improvementRate: 0,
        initialWinRate: metrics.winRate,
        currentWinRate: metrics.winRate,
        successfulSignals: metrics.successfulSignals,
      },
    });

    return this.mentorshipRepository.save(mentorship);
  }

  async acceptMentorship(mentorId: string, mentorshipId: string): Promise<Mentorship> {
    const mentorship = await this.mentorshipRepository.findOneBy({ id: mentorshipId, mentorId });
    if (!mentorship) throw new NotFoundException('Mentorship request not found');
    if (mentorship.status !== MentorshipStatus.REQUESTED) throw new BadRequestException('Invalid status');

    mentorship.status = MentorshipStatus.ACTIVE;
    mentorship.startDate = new Date();
    
    return this.mentorshipRepository.save(mentorship);
  }

  async provideFeedback(reviewerId: string, dto: ProvideFeedbackDto): Promise<MentorshipFeedback> {
    const mentorship = await this.mentorshipRepository.findOneBy({ id: dto.mentorshipId });
    if (!mentorship) throw new NotFoundException('Mentorship not found');
    
    if (mentorship.mentorId !== reviewerId && mentorship.menteeId !== reviewerId) {
      throw new BadRequestException('Only participants can provide feedback');
    }

    const feedback = this.feedbackRepository.create({
      mentorshipId: dto.mentorshipId,
      reviewerId,
      content: dto.content,
      rating: dto.rating,
      metadata: dto.metadata || {},
    });

    await this.feedbackRepository.save(feedback);

    // If mentor provides feedback, update signals reviewed count
    if (reviewerId === mentorship.mentorId) {
      mentorship.metrics.signalsReviewed += 1;
      await this.updateProgress(mentorship.id);
    }

    return feedback;
  }

  async updateProgress(mentorshipId: string): Promise<Mentorship> {
    const mentorship = await this.mentorshipRepository.findOne({
      where: { id: mentorshipId },
      relations: ['mentee'],
    });

    if (!mentorship || mentorship.status !== MentorshipStatus.ACTIVE) return mentorship!;

    const metrics = await this.calculateMenteeMetrics(mentorship.menteeId);
    
    mentorship.metrics.currentWinRate = metrics.winRate;
    mentorship.metrics.successfulSignals = metrics.successfulSignals;
    mentorship.metrics.improvementRate = metrics.winRate - mentorship.metrics.initialWinRate;

    // Check graduation criteria: 30 successful signals or 70% win rate
    if (mentorship.metrics.successfulSignals >= 30 || mentorship.metrics.currentWinRate >= 70) {
      await this.graduateMentee(mentorship);
    }

    return this.mentorshipRepository.save(mentorship);
  }

  private async calculateMenteeMetrics(menteeId: string) {
    const signals = await this.signalRepository.find({
      where: { providerId: menteeId, outcome: In([SignalOutcome.TARGET_HIT, SignalOutcome.STOP_LOSS_HIT]) },
    });

    const total = signals.length;
    const successful = signals.filter(s => s.outcome === SignalOutcome.TARGET_HIT).length;
    const winRate = total > 0 ? (successful / total) * 100 : 0;

    return { winRate, totalSignals: total, successfulSignals: successful };
  }

  private async graduateMentee(mentorship: Mentorship) {
    mentorship.status = MentorshipStatus.COMPLETED;
    
    // Reward mentor
    const mentor = await this.userRepository.findOneBy({ id: mentorship.mentorId });
    if (mentor) {
      mentor.reputationScore += 50; // Reputation boost
      // In a real app, logic for "badge" would go here
      await this.userRepository.save(mentor);
    }

    this.logger.log(`Mentee ${mentorship.menteeId} graduated from mentorship ${mentorship.id}`);
  }

  async cancelMentorship(userId: string, mentorshipId: string): Promise<Mentorship> {
    const mentorship = await this.mentorshipRepository.findOneBy({ id: mentorshipId });
    if (!mentorship) throw new NotFoundException('Mentorship not found');
    
    if (mentorship.mentorId !== userId && mentorship.menteeId !== userId) {
      throw new BadRequestException('Only participants can cancel');
    }

    mentorship.status = MentorshipStatus.CANCELLED;
    return this.mentorshipRepository.save(mentorship);
  }

  async getMentorship(id: string): Promise<Mentorship> {
    const mentorship = await this.mentorshipRepository.findOne({
      where: { id },
      relations: ['mentor', 'mentee', 'feedbacks'],
    });
    if (!mentorship) throw new NotFoundException('Mentorship not found');
    return mentorship;
  }
}
