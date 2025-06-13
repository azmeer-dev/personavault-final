import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import prisma from '@/lib/prisma';
import { IdentityVisibility } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { AuditActorType, AuditLogOutcome } from '@prisma/client';
import { createAuditLog } from '@/lib/audit';


const SECRET = process.env.NEXTAUTH_SECRET;

type BatchGrantRequest = {
  appId: string;
  identityIds: string[];
  scopes: string[];
};

export async function GET(req: NextRequest) {
  let token;
  try {
    token = await getToken({ req, secret: SECRET });
    if (!token?.sub) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = token.sub;
    const { searchParams } = new URL(req.url);

    const visibilityParam = searchParams.get('visibility');
    const appId = searchParams.get('appId');

    const whereClause: {
      userId: string;
      visibility?: IdentityVisibility;
    } = { userId };

    if (visibilityParam) {
      const vis = visibilityParam.toUpperCase();
      if (!Object.values(IdentityVisibility).includes(vis as IdentityVisibility)) {
        return NextResponse.json({
          error: `Invalid visibility value. Must be one of: ${Object.values(IdentityVisibility).join(', ')}`,
        }, { status: 400 });
      }
      whereClause.visibility = vis as IdentityVisibility;
    }

    // Step 1: Find all identities for the user
    let identities = await prisma.identity.findMany({
      where: whereClause,
      select: {
        id: true,
        identityLabel: true,
        profilePictureUrl: true,
        category: true,
        customCategoryName: true,
        visibility: true,
        description: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        identityLabel: 'asc',
      },
    });

    // Step 2: If appId is provided, filter out identities already consented to that app
    if (appId) {
      const existingConsents = await prisma.consent.findMany({
        where: {
          userId,
          appId,
          revokedAt: null,
        },
        select: { identityId: true },
      });

      const alreadyGrantedIds = new Set(existingConsents.map(c => c.identityId));
      identities = identities.filter(identity => !alreadyGrantedIds.has(identity.id));
    }

    return NextResponse.json(identities);
  } catch (error) {
    console.error('[GET /api/users/me/identities] Internal error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: SECRET });
  if (!token?.sub) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = token.sub;

  let body: BatchGrantRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { appId, identityIds, scopes } = body;

  if (
    typeof appId !== 'string' ||
    !Array.isArray(identityIds) || identityIds.some(id => typeof id !== 'string') ||
    !Array.isArray(scopes) || scopes.some(scope => typeof scope !== 'string')
  ) {
    return NextResponse.json({ error: 'Invalid request parameters' }, { status: 400 });
  }

  const now = new Date();

  try {
    await prisma.$transaction(
  identityIds.map(identityId =>
    prisma.consent.upsert({
      where: {
        UserAppIdentityConsent: {
          userId,
          appId,
          identityId
        }
      },
      update: {
        grantedScopes: scopes,
        grantedAt: now,
        revokedAt: null
      },
      create: {
        userId,
        appId,
        identityId,
        grantedScopes: scopes,
        grantedAt: now,
        revokedAt: null
      }
    })
  )
);
    await createAuditLog({
      actorType: AuditActorType.USER,
      actorUserId: userId,
      action: 'GRANT_CONSENT_BATCH',
      outcome: AuditLogOutcome.SUCCESS,
      targetEntityType: 'App',
      targetEntityId: appId,
      details: { identityIds, scopes, grantedAt: now },
    });

    return NextResponse.json({ message: 'Consents granted successfully' }, { status: 200 });

  } catch (error) {
    let message = 'Internal Server Error';
    if (error instanceof PrismaClientKnownRequestError && error.code === 'P2003') {
      message = 'Invalid App ID';
    }

    await createAuditLog({
      actorType: AuditActorType.USER,
      actorUserId: userId,
      action: 'GRANT_CONSENT_BATCH_DB_FAILURE',
      outcome: AuditLogOutcome.FAILURE,
      details: {
        error: error instanceof Error ? error.message : String(error),
      },
    });

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
