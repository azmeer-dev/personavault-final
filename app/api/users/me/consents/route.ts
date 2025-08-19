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

  const { searchParams } = new URL(req.url);
  const appId = searchParams.get('appId') || null;

  const consents = await prisma.consent.findMany({
    where: {
      userId,
      revokedAt: null, // only active consents
      ...(appId ? { appId } : {}), // filter by app if provided
    },
    include: {
      app: {
        select: {
          id: true,
          name: true,
          description: true,
          logoUrl: true,
          websiteUrl: true,
        },
      },
      requestingUser: {
        select: { id: true, globalDisplayName: true },
      },
      identity: {
        select: {
          id: true,
          identityLabel: true,
          profilePictureUrl: true,
          category: true,
        },
      },
    },
    orderBy: { grantedAt: 'desc' },
  });

  const result = consents.map((c) => {
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
