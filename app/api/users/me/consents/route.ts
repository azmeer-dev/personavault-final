import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import prisma from '@/lib/prisma';

const SECRET = process.env.NEXTAUTH_SECRET;

export async function GET(req: NextRequest) {
  try {
    const token = await getToken({ req, secret: SECRET });
    if (!token || !token.sub) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = token.sub;

    const consents = await prisma.consent.findMany({
      where: {
        userId: userId,
        revokedAt: null, // Only fetch active consents
      },
      include: {
        app: {
          select: {
            id: true,
            name: true,
            logoUrl: true,
            websiteUrl: true,
            description: true, // Added description for more context
          },
        },
        identity: {
          select: {
            id: true,
            identityLabel: true,
            profilePictureUrl: true,
            category: true,
          },
        },
        // Include scopes if needed in the future, for now, just the basics
        // consentScopes: { include: { scope: true } }
      },
      orderBy: {
        createdAt: 'desc', // Show newest consents first
      },
    });

    return NextResponse.json(consents);
  } catch (error) {
    console.error('Error fetching consents:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
