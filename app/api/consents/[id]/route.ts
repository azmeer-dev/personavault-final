import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import prisma from '@/lib/prisma'; // Assuming prisma client is in /lib/prisma

// DELETE /api/consents/[consentId]
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id: consentId } = params;
  const token = await getToken({ req: request });

  if (!token || !token.sub) {
    return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
  }
  const userId = token.sub;

  try {
    // 1. Find the consent by consentId
    const consent = await prisma.consent.findUnique({
      where: { id: consentId },
      include: {
        identity: true, // Include identity to check its ownership
      },
    });

    if (!consent) {
      return NextResponse.json({ message: 'Consent not found' }, { status: 404 });
    }

    // 2. Verify user authorization
    // User is authorized if they are the direct user of the consent,
    // OR if the consent is associated with an identity they own.
    let isAuthorized = consent.userId === userId;

    if (!isAuthorized && consent.identity) {
      // Check if the user owns the identity associated with the consent
      const identity = await prisma.identity.findUnique({
        where: { id: consent.identityId! }, // identityId is non-null if consent.identity is present
      });
      if (identity && identity.userId === userId) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      return NextResponse.json({ message: 'User not authorized to delete this consent' }, { status: 403 });
    }

    // 3. Soft delete the consent by setting revokedAt
    await prisma.consent.update({
      where: { id: consentId },
      data: { revokedAt: new Date() },
    });

    return NextResponse.json({ message: 'Consent revoked successfully' }, { status: 200 });
    // Or return NextResponse.json(null, { status: 204 });

  } catch (error) {
    console.error(`DELETE /consents/${consentId} error:`, error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
