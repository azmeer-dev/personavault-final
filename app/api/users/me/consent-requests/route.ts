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

    const consentRequests = await prisma.consentRequest.findMany({
      where: {
        targetUserId: userId,
        status: 'PENDING',
      },
      include: {
        app: {
          select: {
            id: true, // Include app ID for linking or other purposes
            name: true,
            logoUrl: true,
            description: true,
            websiteUrl: true, // Added websiteUrl for more context
          },
        },
        identity: { // This will be null if identityId is not set on the ConsentRequest
          select: {
            id: true,
            identityLabel: true,
            profilePictureUrl: true,
            category: true, // Added category for more context
          },
        },
        // requestedScopes are directly on the ConsentRequest model as a string[]
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json(consentRequests);
  } catch (error) {
    console.error('Error fetching consent requests:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
