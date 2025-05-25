import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import prisma from '@/lib/prisma';
import { ConsentRequestStatus } from '@prisma/client';

const SECRET = process.env.NEXTAUTH_SECRET;

export async function GET(req: NextRequest) {
  try {
    const token = await getToken({ req, secret: SECRET });
    if (!token?.sub) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = token.sub;

    const { searchParams } = new URL(req.url);
    const statusParam = searchParams.get('status');

    const allowedStatuses: ConsentRequestStatus[] = [
      'PENDING',
      'APPROVED',
      'REJECTED',
    ];

    if (!statusParam || !allowedStatuses.includes(statusParam as ConsentRequestStatus)) {
      return NextResponse.json({ error: 'Invalid status filter' }, { status: 400 });
    }

    const status = statusParam as ConsentRequestStatus;

    const consentRequests = await prisma.consentRequest.findMany({
      where: {
        targetUserId: userId,
        status,
      },
      include: {
        app: {
          select: {
            id: true,
            name: true,
            logoUrl: true,
            description: true,
            websiteUrl: true,
          },
        },
        requestingUser: {
          select: {
            id: true,
            globalDisplayName: true,
            globalProfileImage: true,
            legalFullName: true,
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
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(consentRequests);
  } catch (error) {
    console.error('Error fetching consent requests:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
