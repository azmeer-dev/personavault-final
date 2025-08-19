import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import prisma from "@/lib/prisma";
import {
  ConsentRequestStatus,
  AuditActorType,
  AuditLogOutcome,
} from "@prisma/client";
import { createAuditLog } from "@/lib/audit";
import { sendNotification } from "@/lib/notifications";

const SECRET = process.env.NEXTAUTH_SECRET;

export async function POST(
  req: NextRequest,
  { params }: { params: { requestId: string } }
): Promise<NextResponse> {
  const token = await getToken({ req, secret: SECRET });
  if (!token?.sub) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = token.sub;
  const { requestId } = params;

  if (!requestId) {
    return NextResponse.json(
      { error: "Bad Request: requestId is required" },
      { status: 400 }
    );
  }

  try {
    const consentRequest = await prisma.consentRequest.findUnique({
      where: { id: requestId },
      include: { app: { select: { name: true } } },
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

    // If previously approved, revoke the linked Consent
    if (consentRequest.status === ConsentRequestStatus.APPROVED) {
      if (consentRequest.appId) {
        await prisma.consent.updateMany({
          where: {
            userId,
            appId: consentRequest.appId,
            identityId: consentRequest.identityId!,
            revokedAt: null,
          },
          data: { revokedAt: now },
        });
      } else {
        await prisma.consent.updateMany({
          where: {
            userId,
            requestingUserId: consentRequest.requestingUserId!,
            identityId: consentRequest.identityId!,
            revokedAt: null,
          },
          data: { revokedAt: now },
        });
      }
    }

    // Update request to REJECTED regardless of previous state
    const updatedRequest = await prisma.consentRequest.update({
      where: { id: requestId },
      data: {
        status: ConsentRequestStatus.REJECTED,
        processedAt: now,
      },
    });

    await createAuditLog({
      actorType: AuditActorType.USER,
      actorUserId: userId,
      action: "REJECT_CONSENT_REQUEST",
      targetEntityType: "ConsentRequest",
      targetEntityId: requestId,
      outcome: AuditLogOutcome.SUCCESS,
      details: {
        fromStatus: consentRequest.status,
        appId: updatedRequest.appId,
        identityId: updatedRequest.identityId,
        scopes: updatedRequest.requestedScopes,
        appName: consentRequest.app?.name,
      },
    });

    const rejectedIdentity = await prisma.identity.findUnique({
      where: { id: updatedRequest.identityId! },
      select: { identityLabel: true },
    });
    const rejectedIdentityLabel =
      rejectedIdentity?.identityLabel || "an identity";

    await sendNotification({
      recipientId: updatedRequest.requestingUserId!,
      title: "Consent Rejected",
      message: `Your request for "${rejectedIdentityLabel}" has been rejected.`,
      link: "/dashboard",
      type: "consent-rejected",
      sendEmail: true,
    });

    return NextResponse.json(updatedRequest);
  } catch (error) {
    console.error(`Error rejecting consent request ${requestId}:`, error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
