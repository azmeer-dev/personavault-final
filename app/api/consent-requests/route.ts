import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { sendNotification } from "@/lib/notifications";
import { ConsentRequestStatus } from "@prisma/client";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";

interface ConsentRequestBody {
  identityId: string;
  targetUserId: string;
  requestedScopes: string[];
  contextDescription: string;
  appId?: string;
}

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate
    const token = await getToken({ req });
    if (!token?.sub) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const requesterUserId = token.sub;

    // 2. Parse body
    const {
      identityId,
      targetUserId,
      requestedScopes,
      contextDescription,
      appId,
    }: ConsentRequestBody = await req.json();

    // 3. Validate body
    if (
      !identityId ||
      !targetUserId ||
      !Array.isArray(requestedScopes) ||
      requestedScopes.length === 0 ||
      !contextDescription.trim()
    ) {
      return NextResponse.json(
        { error: "Missing or invalid required fields" },
        { status: 400 }
      );
    }

    // 4. Determine flow type
    const useAppId = appId?.trim() || undefined;
    const isAppFlow = Boolean(useAppId);
    const isUserFlow = !useAppId;
    if (isAppFlow === isUserFlow) {
      return NextResponse.json(
        {
          error:
            "Must supply exactly one of appId (app flow) or omit it for user flow",
        },
        { status: 400 }
      );
    }
    if (!isAppFlow && requesterUserId === targetUserId) {
      return NextResponse.json(
        { error: "Cannot request consent from yourself" },
        { status: 400 }
      );
    }

    // 5. App existence validation (if app flow)
    if (isAppFlow) {
      const appExists = await prisma.app.findUnique({
        where: { id: useAppId },
        select: { id: true },
      });
      if (!appExists) {
        return NextResponse.json(
          { error: `App ${useAppId} not found` },
          { status: 400 }
        );
      }
    }

    // 6. Identity validation and ownership
    const identity = await prisma.identity.findUnique({
      where: { id: identityId },
      select: {
        userId: true,
        identityLabel: true,
        category: true,
        customCategoryName: true,
      },
    });
    if (!identity) {
      return NextResponse.json(
        { error: `Identity ${identityId} not found` },
        { status: 404 }
      );
    }
    if (identity.userId !== targetUserId) {
      return NextResponse.json(
        { error: `Identity does not belong to user ${targetUserId}` },
        { status: 400 }
      );
    }

    // 7. Prevent duplicate pending requests
    const existing = await prisma.consentRequest.findFirst({
      where: {
        identityId,
        targetUserId,
        requestingUserId: requesterUserId,
        status: ConsentRequestStatus.PENDING,
        ...(isAppFlow ? { appId: useAppId } : {}),
      },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json(
        {
          error: "A pending consent request already exists",
          requestId: existing.id,
        },
        { status: 409 }
      );
    }

    // 8. Create new consent request
    const newRequest = await prisma.consentRequest.create({
      data: {
        identityId,
        targetUserId,
        requestingUserId: requesterUserId,
        requestedScopes,
        contextDescription,
        status: ConsentRequestStatus.PENDING,
        ...(isAppFlow ? { appId: useAppId! } : {}),
      },
    });

    // 8b. Fetch requester display name
    const requestingUser = await prisma.user.findUnique({
      where: { id: requesterUserId },
      select: { globalDisplayName: true, legalFullName: true ,email: true },
    });
    const requesterDisplayName =
      requestingUser?.globalDisplayName ||requestingUser?.legalFullName || requestingUser?.email || "a user";

    // 9. Send notification to identity owner
    await sendNotification({
      recipientId: targetUserId,
      title: "New Consent Request",
      message: `Your identity "${identity.identityLabel}" has been requested${
        isAppFlow ? ` by an app` : ` by ${requesterDisplayName}`
      } for: ${contextDescription}`,
      link: `/consent-requests`,
      type: "consent-request",
      sendEmail: true,
    });

    // 10. Return success
    return NextResponse.json(newRequest, { status: 201 });
  } catch (err) {
    console.error("Error creating consent request:", err);
    if (err instanceof PrismaClientKnownRequestError) {
      return NextResponse.json(
        { error: "Database error", details: err.message },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
