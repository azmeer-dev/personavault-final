import { NextResponse, NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import prisma from "@/lib/prisma";
import { ConsentRequest, ConsentRequestStatus, Identity } from "@prisma/client";

interface ConsentRequestBody {
  identityId: string;
  targetUserId: string;
  requestedScopes: string[];
  contextDescription: string;
  appId?: string;
}

export async function POST(req: NextRequest) {
  try {
    const token = await getToken({ req });
    if (!token || !token.sub) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const requesterUserId = token.sub;

    const body = (await req.json()) as ConsentRequestBody;
    const {
      identityId,
      targetUserId,
      requestedScopes,
      contextDescription,
      appId,
    } = body;

    // 4. Perform validation
    if (
      !identityId ||
      !targetUserId ||
      !requestedScopes ||
      !Array.isArray(requestedScopes) ||
      requestedScopes.length === 0 ||
      !contextDescription ||
      typeof contextDescription !== 'string' ||
      contextDescription.trim() === ''
    ) {
      return NextResponse.json(
        { error: "Missing or invalid required fields" },
        { status: 400 }
      );
    }

    if (requesterUserId === targetUserId) {
      return NextResponse.json(
        { error: "Cannot request consent from yourself" },
        { status: 400 }
      );
    }

    const identity = await prisma.identity.findUnique({
      where: { id: identityId },
    });

    if (!identity) {
      return NextResponse.json(
        { error: `Identity with ID ${identityId} not found` },
        { status: 404 }
      );
    }

    if (identity.userId !== targetUserId) {
      return NextResponse.json(
        { error: `Identity ${identityId} does not belong to targetUser ${targetUserId}` },
        { status: 400 } // Or 403 Forbidden if preferred
      );
    }

    // Check for existing PENDING consent request
    const existingRequest = await prisma.consentRequest.findFirst({
      where: {
        identityId: identityId,
        requestingUserId: requesterUserId,
        appId: appId, // If appId is undefined, Prisma will filter for records where appId is null
        status: ConsentRequestStatus.PENDING,
      },
    });

    if (existingRequest) {
      return NextResponse.json(
        {
          error: "A pending consent request for this identity and user/app already exists.",
          requestId: existingRequest.id,
        },
        { status: 409 } // Conflict
      );
    }

    // 5. If validation passes, create a new ConsentRequest record
    const newConsentRequest = await prisma.consentRequest.create({
      data: {
        targetUserId: targetUserId,
        identityId: identityId,
        requestingUserId: requesterUserId,
        appId: appId, // Will be null if not provided
        requestedScopes: requestedScopes,
        contextDescription: contextDescription,
        status: ConsentRequestStatus.PENDING,
      },
    });

    // 6. Return the created ConsentRequest object with a 201 status code
    return NextResponse.json(newConsentRequest, { status: 201 });

  } catch (error: any) {
    console.error("Error creating consent request:", error);
    if (error.name === 'JsonWebTokenError' || error.name === 'NotBeforeError' || error.name === 'TokenExpiredError') {
        return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }
    // Check for Prisma known request errors (e.g., unique constraint violation if not caught by the explicit check)
    if (error.code && error.meta) { // Prisma error signature
        return NextResponse.json({ error: "Database error", details: error.meta.target || "Unknown database error" }, { status: 400 });
    }
    // Generic error for anything else (e.g. req.json() parsing error)
    return NextResponse.json({ error: "Internal server error", details: error.message || "" }, { status: 500 });
  }
}
