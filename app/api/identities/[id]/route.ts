import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import prisma from '@/lib/prisma';
import { identityFormSchema } from '@/schemas/identityFormSchema';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { authenticateApp } from '@/lib/app-auth';
import { createAuditLog } from '@/lib/audit';
import { AuditActorType, AuditLogOutcome } from '@prisma/client';

const SECRET = process.env.NEXTAUTH_SECRET;

/* ───────────────────────────── PUT /api/identities/[id] ───────────────────────────── */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: identityId } = await params;

  const token = await getToken({ req, secret: SECRET });
  if (!token || !token.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const json = await req.json();
    const data = identityFormSchema.parse(json);

    const existing = await prisma.identity.findUnique({
      where: { id: identityId },
      select: { userId: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Identity not found' }, { status: 404 });
    }
    if (existing.userId !== token.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const updatedIdentity = await prisma.$transaction(async (prismaTx) => {
      await prismaTx.identityAccount.deleteMany({ where: { identityId } });

      const identityUpdate = await prismaTx.identity.update({
        where: { id: identityId },
        data: {
          identityLabel: data.identityLabel,
          category: data.category,
          customCategoryName: data.customCategoryName,
          description: data.description,
          contextualNameDetails: data.contextualNameDetails,
          identityNameHistory: data.identityNameHistory,
          contextualReligiousNames: data.contextualReligiousNames,
          genderIdentity: data.genderIdentity,
          customGenderDescription: data.customGenderDescription,
          pronouns: data.pronouns,
          dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
          location: data.location,
          profilePictureUrl: data.profilePictureUrl,
          identityContacts: data.identityContacts,
          onlinePresence: data.onlinePresence,
          websiteUrls: data.websiteUrls,
          additionalAttributes: data.additionalAttributes,
          visibility: data.visibility,
        },
      });

      if (data.linkedAccountIds?.length) {
        await Promise.all(
          data.linkedAccountIds.map((accountId) =>
            prismaTx.identityAccount.create({ data: { identityId, accountId } })
          )
        );
      }

      return identityUpdate;
    });

    return NextResponse.json(updatedIdentity);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}

/* ───────────────────────────── GET /api/identities/[id] ───────────────────────────── */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: identityId } = await params;
  console.log(`[GET /api/identities/${identityId}] Received request`);

  const authHeader = req.headers.get('Authorization');
  const appIdHeader = req.headers.get('X-App-ID');
  const requiredScope = 'identity.read';

  /* ------------------------- API-key / App authentication ------------------------- */
  if (authHeader && authHeader.startsWith('Bearer ') && appIdHeader) {
    console.log(`[GET /api/identities/${identityId}] Attempting API Key Auth via App ID ${appIdHeader}`);
    const authResult = await authenticateApp(req);

    if (authResult.error) {
      console.warn(`[GET /api/identities/${identityId}] API Key Auth failed for App ID ${appIdHeader}: ${authResult.error.status}`);
      return authResult.error;
    }

    if (authResult.app) {
      const authenticatedApp = authResult.app;
      console.log(`[GET /api/identities/${identityId}] API Key validated for App: ${authenticatedApp.id}`);

      const identity = await prisma.identity.findUnique({
        where: { id: identityId },
        include: {
          linkedExternalAccounts: {
            include: { account: true },
          },
        },
      });

      if (!identity) {
        console.log(`[GET /api/identities/${identityId}] Identity not found for App ${authenticatedApp.id}`);
        return NextResponse.json({ error: 'Identity not found' }, { status: 404 });
      }

      /* ---------- PUBLIC identities: accessible without consent ---------- */
      if (identity.visibility === 'PUBLIC') {
        const sanitized = {
          id: identity.id,
          identityLabel: identity.identityLabel,
          category: identity.category,
          customCategoryName: identity.customCategoryName,
          description: identity.description,
          contextualNameDetails: identity.contextualNameDetails,
          genderIdentity: identity.genderIdentity,
          customGenderDescription: identity.customGenderDescription,
          pronouns: identity.pronouns,
          dateOfBirth: identity.dateOfBirth,
          location: identity.location,
          profilePictureUrl: identity.profilePictureUrl,
          identityContacts: identity.identityContacts,
          onlinePresence: identity.onlinePresence,
          websiteUrls: identity.websiteUrls,
          additionalAttributes: identity.additionalAttributes,
          visibility: identity.visibility,
          createdAt: identity.createdAt,
          updatedAt: identity.updatedAt,
        };
        await createAuditLog({
          actorType: AuditActorType.APP,
          actorAppId: authenticatedApp.id,
          action: 'READ_IDENTITY_API_SUCCESS',
          targetEntityType: 'Identity',
          targetEntityId: identity.id,
          outcome: AuditLogOutcome.SUCCESS,
          details: {
            appName: authenticatedApp.name,
            identityLabel: identity.identityLabel,
            visibility: identity.visibility,
            grantedVia: 'public_access',
          },
        });
        return NextResponse.json(sanitized);
      }

      /* ---------- Non-public identities: consent required ---------- */
      console.log(`[GET /api/identities/${identityId}] Checking consent for non-public identity`);

      /* 1. Identity-specific consent */
      const specificConsent = await prisma.consent.findFirst({
        where: {
          appId: authenticatedApp.id,
          userId: identity.userId,
          identityId: identity.id,
          revokedAt: null,
        },
      });

      if (specificConsent && specificConsent.grantedScopes.includes(requiredScope)) {
        const sanitized = {
          id: identity.id,
          identityLabel: identity.identityLabel,
          category: identity.category,
          customCategoryName: identity.customCategoryName,
          description: identity.description,
          contextualNameDetails: identity.contextualNameDetails,
          genderIdentity: identity.genderIdentity,
          customGenderDescription: identity.customGenderDescription,
          pronouns: identity.pronouns,
          dateOfBirth: identity.dateOfBirth,
          location: identity.location,
          profilePictureUrl: identity.profilePictureUrl,
          identityContacts: identity.identityContacts,
          onlinePresence: identity.onlinePresence,
          websiteUrls: identity.websiteUrls,
          additionalAttributes: identity.additionalAttributes,
          visibility: identity.visibility,
          createdAt: identity.createdAt,
          updatedAt: identity.updatedAt,
        };
        await createAuditLog({
          actorType: AuditActorType.APP,
          actorAppId: authenticatedApp.id,
          action: 'READ_IDENTITY_API_SUCCESS',
          targetEntityType: 'Identity',
          targetEntityId: identity.id,
          outcome: AuditLogOutcome.SUCCESS,
          details: {
            appName: authenticatedApp.name,
            identityLabel: identity.identityLabel,
            visibility: identity.visibility,
            grantedVia: `consent_specific_${specificConsent.id}`,
          },
        });
        return NextResponse.json(sanitized);
      }

      /* 2. User-level consent (identityId null) */
      const userLevelConsent = await prisma.consent.findFirst({
        where: {
          appId: authenticatedApp.id,
          userId: identity.userId,
          identityId: null,
          revokedAt: null,
        },
      });

      if (userLevelConsent && userLevelConsent.grantedScopes.includes(requiredScope)) {
        const sanitized = {
          id: identity.id,
          identityLabel: identity.identityLabel,
          category: identity.category,
          customCategoryName: identity.customCategoryName,
          description: identity.description,
          contextualNameDetails: identity.contextualNameDetails,
          genderIdentity: identity.genderIdentity,
          customGenderDescription: identity.customGenderDescription,
          pronouns: identity.pronouns,
          dateOfBirth: identity.dateOfBirth,
          location: identity.location,
          profilePictureUrl: identity.profilePictureUrl,
          identityContacts: identity.identityContacts,
          onlinePresence: identity.onlinePresence,
          websiteUrls: identity.websiteUrls,
          additionalAttributes: identity.additionalAttributes,
          visibility: identity.visibility,
          createdAt: identity.createdAt,
          updatedAt: identity.updatedAt,
        };
        await createAuditLog({
          actorType: AuditActorType.APP,
          actorAppId: authenticatedApp.id,
          action: 'READ_IDENTITY_API_SUCCESS',
          targetEntityType: 'Identity',
          targetEntityId: identity.id,
          outcome: AuditLogOutcome.SUCCESS,
          details: {
            appName: authenticatedApp.name,
            identityLabel: identity.identityLabel,
            visibility: identity.visibility,
            grantedVia: `consent_user_${userLevelConsent.id}`,
          },
        });
        return NextResponse.json(sanitized);
      }

      /* Denied: no valid consent */
      await createAuditLog({
        actorType: AuditActorType.APP,
        actorAppId: authenticatedApp.id,
        action: 'READ_IDENTITY_API_DENIED',
        targetEntityType: 'Identity',
        targetEntityId: identity.id,
        outcome: AuditLogOutcome.FAILURE,
        details: {
          appName: authenticatedApp.name,
          identityLabel: identity.identityLabel,
          errorReason: 'consent_required',
          specificReason: 'No valid consent with required scope',
          requiredScopes: [requiredScope],
        },
      });
      return NextResponse.json(
        {
          error: 'consent_required',
          message:
            'Specific consent is required for this application to access the requested resource with the necessary permissions.',
          details: {
            appId: authenticatedApp.id,
            resourceType: 'identity',
            resourceId: identity.id,
            requiredScopes: [requiredScope],
          },
        },
        { status: 403 }
      );
    }
  }

  /* ------------------------- Session-based authentication ------------------------- */
  console.log(`[GET /api/identities/${identityId}] Falling back to session auth`);

  try {
    const identity = await prisma.identity.findUnique({
      where: { id: identityId },
      include: {
        linkedExternalAccounts: { include: { account: true } },
      },
    });

    if (!identity) {
      return NextResponse.json({ error: 'Identity not found' }, { status: 404 });
    }

    const token = await getToken({ req, secret: SECRET });

    if (identity.visibility === 'PUBLIC') {
      return NextResponse.json(identity);
    }

    if (token && token.sub && identity.userId === token.sub) {
      return NextResponse.json(identity);
    }

    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  } catch (err) {
    console.error(`[GET /api/identities/${identityId}]`, err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/* ─────────────────────────── DELETE /api/identities/[id] ─────────────────────────── */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: identityId } = await params;
  let token;

  try {
    token = await getToken({ req, secret: SECRET });
    if (!token?.sub) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = token.sub;

    const identity = await prisma.identity.findUnique({
      where: { id: identityId },
      select: { userId: true },
    });
    if (!identity) {
      return NextResponse.json({ error: 'Identity not found' }, { status: 404 });
    }
    if (identity.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await prisma.identity.delete({ where: { id: identityId } });
    return NextResponse.json({ message: 'Identity deleted successfully' }, { status: 200 });
  } catch (error) {
    console.error(`[DELETE /api/identities/${identityId}]`, error);
    if (error instanceof PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Identity not found or already deleted' },
        { status: 404 }
      );
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
