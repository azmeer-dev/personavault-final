import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const data = await req.json();

    if (!data.userId || !data.identityLabel) {
      return NextResponse.json(
        { error: "Missing userId or identityLabel" },
        { status: 400 }
      );
    }

    const created = await prisma.identity.create({
      data: {
        userId: data.userId,
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

export async function PUT(req: Request) {
  try {
    const data = await req.json();

    if (!data.userId || !data.identityLabel) {
      return NextResponse.json(
        { error: "Missing userId or identityLabel" },
        { status: 400 }
      );
    }

    // Update many returns count only, so use findFirst to get id
    const existing = await prisma.identity.findFirst({
      where: { userId: data.userId, identityLabel: data.identityLabel },
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
          deleteMany: {}, // remove existing links
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
