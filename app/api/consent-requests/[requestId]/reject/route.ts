import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import prisma from '@/lib/prisma';
import { ConsentRequestStatus } from '@prisma/client'; // Import enum for status
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

const SECRET = process.env.NEXTAUTH_SECRET;

export async function POST(
  req: NextRequest,
  { params }: { params: { requestId: string } }
) {
  try {
    const token = await getToken({ req, secret: SECRET });
    if (!token || !token.sub) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = token.sub;
    const { requestId } = params;

    if (!requestId) {
      return NextResponse.json({ error: 'Bad Request: requestId is required' }, { status: 400 });
    }

    const consentRequest = await prisma.consentRequest.findUnique({
      where: { id: requestId },
    });

    if (!consentRequest) {
      return NextResponse.json({ error: 'ConsentRequest not found' }, { status: 404 });
    }

    if (consentRequest.targetUserId !== userId) {
      return NextResponse.json({ error: 'Forbidden: You are not the target user for this request' }, { status: 403 });
    }

    if (consentRequest.status !== ConsentRequestStatus.PENDING) {
      return NextResponse.json({ error: `Bad Request: ConsentRequest is already ${consentRequest.status.toLowerCase()}` }, { status: 400 });
    }

    const updatedRequest = await prisma.consentRequest.update({
      where: { id: requestId },
      data: {
        status: ConsentRequestStatus.REJECTED,
        processedAt: new Date(),
      },
    });

    return NextResponse.json(updatedRequest);
  } catch (error) {
    console.error('Error rejecting consent request:', error);
    if (error instanceof PrismaClientKnownRequestError && error.code === 'P2025') {
        return NextResponse.json({ error: 'ConsentRequest not found during update' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
