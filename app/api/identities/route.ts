import { NextResponse, NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import prisma from "@/lib/prisma";

const SECRET = process.env.NEXTAUTH_SECRET;

async function getSessionUserId(req: NextRequest): Promise<string | null> {
  const token = await getToken({ req, secret: SECRET });
  return token?.sub || null;
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getSessionUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await req.json();

    if (!data.identityLabel) {
      return NextResponse.json(
        { error: "Missing Identity Label" },
        { status: 400 }
      );
    }

    const created = await prisma.identity.create({
      data: {
        userId,
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
        linkedExternalAccounts: {
          create: (data.linkedAccountIds || []).map((accountId: string) => ({
            account: { connect: { id: accountId } },
          })),
        },
      },
    });

    return NextResponse.json(created);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const userId = await getSessionUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await req.json();

    if (!data.identityLabel) {
      return NextResponse.json(
        { error: "Missing Identity Label" },
        { status: 400 }
      );
    }

    const existing = await prisma.identity.findFirst({
      where: { userId, identityLabel: data.identityLabel },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Identity not found or not owned by user" },
        { status: 404 }
      );
    }

    const updated = await prisma.identity.update({
      where: { id: existing.id },
      data: {
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
        linkedExternalAccounts: {
          deleteMany: {},
          create: (data.linkedAccountIds || []).map((accountId: string) => ({
            account: { connect: { id: accountId } },
          })),
        },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
