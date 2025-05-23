import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import prisma from '@/lib/prisma';
import { ConsentRequestStatus } from '@prisma/client'; // Import enum for status

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
      include: { // Include app to get appId for consent record
        app: { select: { id: true }}
      }
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
    
    if (!consentRequest.appId) {
        // This case should ideally not happen if data integrity is maintained
        console.error(`[ApproveConsentRequest] ConsentRequest ${requestId} is missing appId.`);
        return NextResponse.json({ error: 'Internal Server Error: App ID missing from consent request.' }, { status: 500 });
    }


    const now = new Date();

    const result = await prisma.$transaction(async (tx) => {
      const updatedRequest = await tx.consentRequest.update({
        where: { id: requestId },
        data: {
          status: ConsentRequestStatus.APPROVED,
          processedAt: now,
        },
      });

      const consentUpsertData = {
        userId: userId,
        appId: consentRequest.appId, // From the included app relation
        identityId: consentRequest.identityId, // Can be null
        grantedScopes: consentRequest.requestedScopes,
        grantedAt: now,
        expiresAt: null, // Or handle expiry logic
        revokedAt: null, // Ensure it's active
        lastUsedAt: null,
      };
      
      // Prisma's unique constraint for Consent is userId_appId_identityId
      // If identityId is null, we need a different where clause for the upsert.
      // However, Prisma's compound unique index handles nulls as distinct values usually.
      // Let's rely on the schema's unique constraint: @@unique([userId, appId, identityId])
      // Prisma should correctly find or create based on this.

      const createdOrUpdatedConsent = await tx.consent.upsert({
        where: {
          userId_appId_identityId: {
            userId: userId,
            appId: consentRequest.appId,
            identityId: consentRequest.identityId, // This works even if identityId is null
          }
        },
        create: consentUpsertData,
        update: {
          grantedScopes: consentRequest.requestedScopes,
          grantedAt: now, // Or keep existing based on requirements
          revokedAt: null, // Crucial: reactivate if previously revoked
          expiresAt: null, // Or handle expiry logic
          // lastUsedAt: should not be updated here generally
        },
      });

      return { updatedRequest, createdOrUpdatedConsent };
    });

    return NextResponse.json(result.createdOrUpdatedConsent);
  } catch (error) {
    console.error('Error approving consent request:', error);
    // Handle specific Prisma errors if necessary, e.g., transaction errors
    if (error instanceof prisma.PrismaClientKnownRequestError) {
        // Example: Foreign key constraint failed
        if (error.code === 'P2003') {
             return NextResponse.json({ error: 'Bad Request: Invalid data provided for consent.' }, { status: 400 });
        }
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
