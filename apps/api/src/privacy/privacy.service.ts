import { createHmac } from 'crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma';
import type { CreateConsentDto, PaginationDto } from './privacy.dto';

@Injectable()
export class PrivacyService {
  constructor(private readonly prisma: PrismaService) {}

  private hashIp(ip: string): string {
    const secret = process.env.IP_HASH_SECRET;
    if (!secret) throw new Error('IP_HASH_SECRET environment variable is required');
    return createHmac('sha256', secret).update(ip).digest('hex');
  }

  async createConsent(userId: string, dto: CreateConsentDto) {
    const consent = await this.prisma.consent.create({
      data: {
        userId,
        consentType: dto.consentType,
        version: dto.version,
        accepted: dto.accepted,
        ipAddress: dto.ipAddress ? this.hashIp(dto.ipAddress) : null,
        userAgent: dto.userAgent ?? null,
      },
    });
    return {
      id: consent.id,
      consentType: consent.consentType,
      version: consent.version,
      accepted: consent.accepted,
      createdAt: consent.createdAt.toISOString(),
    };
  }

  async requestDataExport(userId: string) {
    const request = await this.prisma.privacyRequest.create({
      data: {
        userId,
        requestType: 'export',
        status: 'pending',
      },
    });
    return this.formatRequest(request);
  }

  async requestAccountDeletion(userId: string) {
    const request = await this.prisma.privacyRequest.create({
      data: {
        userId,
        requestType: 'deletion',
        status: 'pending',
      },
    });
    return this.formatRequest(request);
  }

  async getRequests(userId: string, query: PaginationDto) {
    const [requests, total] = await Promise.all([
      this.prisma.privacyRequest.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.privacyRequest.count({ where: { userId } }),
    ]);

    return {
      data: requests.map((r) => this.formatRequest(r)),
      meta: {
        total,
        page: query.page,
        limit: query.limit,
      },
    };
  }

  async transitionStatus(
    requestId: string,
    status: 'processing' | 'completed' | 'failed',
    resultUrl?: string,
  ) {
    return this.prisma.privacyRequest.update({
      where: { id: requestId },
      data: {
        status,
        completedAt: status === 'completed' || status === 'failed' ? new Date() : undefined,
        resultUrl: resultUrl ?? undefined,
      },
    });
  }

  private formatRequest(request: {
    id: string;
    requestType: string;
    status: string;
    completedAt: Date | null;
    resultUrl: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: request.id,
      requestType: request.requestType,
      status: request.status,
      completedAt: request.completedAt?.toISOString() ?? null,
      resultUrl: request.resultUrl,
      createdAt: request.createdAt.toISOString(),
      updatedAt: request.updatedAt.toISOString(),
    };
  }
}
