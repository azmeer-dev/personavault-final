import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import prisma from '@/lib/prisma';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';


const SECRET = process.env.NEXTAUTH_SECRET;

export async function DELETE(
  req: NextRequest,
  { params }: { params: { consentId: string } }
) {
  try {
    const token = await getToken({ req, secret: SECRET });
    if (!token || !token.sub) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = token.sub;
    const { consentId } = params;

    if (!consentId) {
      return NextResponse.json({ error: 'Bad Request: consentId is required' }, { status: 400 });
    }

    const consent = await prisma.consent.findUnique({
      where: { id: consentId },
    });

    if (!consent) {
      return NextResponse.json({ error: 'Consent not found' }, { status: 404 });
    }

    if (consent.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check if already revoked
    if (consent.revokedAt) {
      // Optionally, return a specific message or just success
      return NextResponse.json({ message: 'Consent already revoked' }, { status: 200 });
    }

    await prisma.consent.update({
      where: { id: consentId },
      data: { revokedAt: new Date() },
    });

    return NextResponse.json({ message: 'Consent revoked successfully' }, { status: 200 });
  } catch (error) {
    console.error('Error revoking consent:', error);
    // Check if it's a Prisma known error (e.g., record not found during update, though findUnique should catch it first)
    if (error instanceof PrismaClientKnownRequestError && error.code === 'P2025') {
        return NextResponse.json({ error: 'Consent not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
