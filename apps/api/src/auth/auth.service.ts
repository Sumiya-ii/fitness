import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma';
import type { DecodedIdToken } from 'firebase-admin/auth';

export interface AuthenticatedUser {
  id: string;
  firebaseUid: string;
  email: string | null;
  phone: string | null;
}

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async findOrCreateUser(decoded: DecodedIdToken): Promise<AuthenticatedUser> {
    const existing = await this.prisma.user.findUnique({
      where: { firebaseUid: decoded.uid },
    });

    if (existing) {
      return {
        id: existing.id,
        firebaseUid: existing.firebaseUid,
        email: existing.email,
        phone: existing.phone,
      };
    }

    const user = await this.prisma.user.create({
      data: {
        firebaseUid: decoded.uid,
        email: decoded.email ?? null,
        phone: decoded.phone_number ?? null,
        profile: {
          create: {
            locale: 'mn',
            unitSystem: 'metric',
          },
        },
        subscription: {
          create: {
            tier: 'free',
            status: 'active',
          },
        },
      },
    });

    return {
      id: user.id,
      firebaseUid: user.firebaseUid,
      email: user.email,
      phone: user.phone,
    };
  }
}
