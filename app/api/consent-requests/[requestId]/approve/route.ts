import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import prisma from "@/lib/prisma";
import {
  ConsentRequestStatus,
  AuditActorType,
  AuditLogOutcome,
} from "@prisma/client";
import { createAuditLog } from "@/lib/audit";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { sendNotification } from "@/lib/notifications";

const SECRET = process.env.NEXTAUTH_SECRET;

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ requestId: string }> }
): Promise<NextResponse> {
  const { requestId } = await context.params;

  const token = await getToken({ req, secret: SECRET });
  if (!token?.sub) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = token.sub;

  const consentRequest = await prisma.consentRequest.findUnique({
    where: { id: requestId },
  });
  if (!consentRequest) {
    return NextResponse.json(
      { error: "ConsentRequest not found" },
      { status: 404 }
    );
  }
  if (consentRequest.targetUserId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const now = new Date();

  try {
    // Create or restore consent when approving
    let upsertedConsent: unknown;

    if (consentRequest.appId) {
      upsertedConsent = await prisma.consent.upsert({
        where: {
          UserAppIdentityConsent: {
            userId,
            appId: consentRequest.appId,
            identityId: consentRequest.identityId!,
          },
        },
        update: {
          grantedScopes: consentRequest.requestedScopes,
          grantedAt: now,
          revokedAt: null,
        },
        create: {
          userId,
          appId: consentRequest.appId,
          identityId: consentRequest.identityId!,
          grantedScopes: consentRequest.requestedScopes,
          grantedAt: now,
        },
      });
    } else {
      upsertedConsent = await prisma.consent.upsert({
        where: {
          UserUserIdentityConsent: {
            userId,
            requestingUserId: consentRequest.requestingUserId!,
            identityId: consentRequest.identityId!,
          },
        },
        update: {
          grantedScopes: consentRequest.requestedScopes,
          grantedAt: now,
          revokedAt: null,
        },
        create: {
          userId,
          requestingUserId: consentRequest.requestingUserId!,
          identityId: consentRequest.identityId!,
          grantedScopes: consentRequest.requestedScopes,
          grantedAt: now,
        },
      });
    }

    // Update request status (allow toggling)
    await prisma.consentRequest.update({
      where: { id: requestId },
      data: { status: ConsentRequestStatus.APPROVED, processedAt: now },
    });

    await createAuditLog({
      actorType: AuditActorType.USER,
      actorUserId: userId,
      action: "APPROVE_CONSENT_REQUEST",
      targetEntityType: "ConsentRequest",
      targetEntityId: requestId,
      outcome: AuditLogOutcome.SUCCESS,
      details: {
        via: consentRequest.appId ? "app" : "user",
        consumer: consentRequest.appId ?? consentRequest.requestingUserId,
      },
    });

    const targetIdentity = await prisma.identity.findUnique({
      where: { id: consentRequest.identityId! },
      select: { identityLabel: true },
    });

    const approvedIdentityLabel =
      targetIdentity?.identityLabel || "an identity";

    await sendNotification({
      recipientId: consentRequest.requestingUserId!,
      title: "Consent Approved",
      message: `Your request for "${approvedIdentityLabel}" has been approved.`,
      link: "/dashboard",
      type: "consent-approved",
      sendEmail: true,
    });

    return NextResponse.json(upsertedConsent);
  } catch (err) {
    console.error("Error approving consent request:", err);
    if (err instanceof PrismaClientKnownRequestError) {
      const status = err.code === "P2003" ? 400 : 500;
      return NextResponse.json({ error: err.message }, { status });
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
