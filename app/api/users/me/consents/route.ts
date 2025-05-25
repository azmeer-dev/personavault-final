// app/api/users/me/consents/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import prisma from '@/lib/prisma';

const SECRET = process.env.NEXTAUTH_SECRET;

export async function GET(req: NextRequest) {
  const token = await getToken({ req, secret: SECRET });
  if (!token?.sub) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = token.sub;

  const consents = await prisma.consent.findMany({
    where: { userId },
    include: {
      app: {
        select: { id: true, name: true, description: true, logoUrl: true, websiteUrl: true },
      },
      requestingUser: {
        select: { id: true, globalDisplayName: true },
      },
      identity: {
        select: { id: true, identityLabel: true, profilePictureUrl: true, category: true },
      },
    },
    orderBy: { grantedAt: 'desc' },
  });

  // Map to a shape where `app` may be null
  const result = consents.map((c) => {
    // If this consent was granted to an app:
    if (c.app) {
      return {
        id: c.id,
        identity: c.identity,
        grantedAt: c.grantedAt,
        via: 'app',
        consumer: {
          id: c.app.id,
          name: c.app.name,
          description: c.app.description,
          logoUrl: c.app.logoUrl,
          websiteUrl: c.app.websiteUrl,
        },
      };
    }

    // Otherwise it was granted to a user:
    if (c.requestingUser) {
      return {
        id: c.id,
        identity: c.identity,
        grantedAt: c.grantedAt,
        via: 'user',
        consumer: {
          id: c.requestingUser.id,
          name: c.requestingUser.globalDisplayName,
        },
      };
    }

    // Fallback (shouldn’t happen)
    return {
      id: c.id,
      identity: c.identity,
      grantedAt: c.grantedAt,
      via: 'unknown' as const,
      consumer: null,
    };
  });

  return NextResponse.json(result);
}
