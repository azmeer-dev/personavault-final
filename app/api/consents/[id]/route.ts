import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import prisma from '@/lib/prisma';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }   // params is a Promise in Next 15
) {
  const { id: consentId } = await params;            // await it once, then use

  const token = await getToken({ req: request });
  if (!token?.sub) {
    return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
  }
  const userId = token.sub;

  try {
    const consent = await prisma.consent.findUnique({
      where: { id: consentId },
      include: { identity: true },
    });
    if (!consent) {
      return NextResponse.json({ message: 'Consent not found' }, { status: 404 });
    }

    let isAuthorized = consent.userId === userId;
    if (!isAuthorized && consent.identity) {
      const identity = await prisma.identity.findUnique({ where: { id: consent.identityId! } });
      isAuthorized = !!identity && identity.userId === userId;
    }
    if (!isAuthorized) {
      return NextResponse.json(
        { message: 'User not authorized to delete this consent' },
        { status: 403 },
      );
    }

    await prisma.consent.update({
      where: { id: consentId },
      data: { revokedAt: new Date() },
    });

    return NextResponse.json({ message: 'Consent revoked successfully' }, { status: 200 });
  } catch (error) {
    console.error(`DELETE /consents/${consentId} error:`, error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
