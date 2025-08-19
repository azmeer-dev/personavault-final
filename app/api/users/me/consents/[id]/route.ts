import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import prisma from '@/lib/prisma';
import { AuditActorType, AuditLogOutcome } from '@prisma/client';
import { createAuditLog } from '@/lib/audit';

const SECRET = process.env.NEXTAUTH_SECRET;

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const token = await getToken({ req, secret: SECRET });
  if (!token?.sub) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = token.sub;
  const consentId = params.id;

  const consent = await prisma.consent.findUnique({
    where: { id: consentId },
    select: { userId: true, appId: true, identityId: true },
  });

  if (!consent || consent.userId !== userId) {
    return NextResponse.json({ error: 'Consent not found' }, { status: 404 });
  }

  const now = new Date();
  await prisma.consent.update({
    where: { id: consentId },
    data: { revokedAt: now },
  });

  await createAuditLog({
    actorType: AuditActorType.USER,
    actorUserId: userId,
    action: 'REVOKE_CONSENT',
    outcome: AuditLogOutcome.SUCCESS,
    targetEntityType: 'App',
    targetEntityId: consent.appId,
    details: { identityId: consent.identityId, revokedAt: now },
  });

  return NextResponse.json({ message: 'Consent revoked successfully' });
}
