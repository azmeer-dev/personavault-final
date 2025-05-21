// app/api/identity/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { AuditActorType, AuditLogOutcome } from "@prisma/client";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const identityId = params.id;
  const userId = session.user.id;
  const body = await request.json();

  if (typeof body.identityLabel !== "string") {
    return NextResponse.json({ error: "Invalid identityLabel" }, { status: 400 });
  }

  const updateData = {
    identityLabel: body.identityLabel,
    category: body.category,
    customCategoryName: body.customCategoryName,
    description: body.description,
    contextualNameDetails: body.contextualNameDetails,
    identityNameHistory: body.identityNameHistory,
    contextualReligiousNames: body.contextualReligiousNames,
    genderIdentity: body.genderIdentity,
    customGenderDescription: body.customGenderDescription,
    pronouns: body.pronouns,
    dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : null,
    location: body.location,
    profilePictureUrl: body.profilePictureUrl,
    identityContacts: body.identityContacts,
    onlinePresence: body.onlinePresence,
    websiteUrls: body.websiteUrls,
    additionalAttributes: body.additionalAttributes,
    visibility: body.visibility,
    updatedAt: new Date(),
  };

  const updatedIdentity = await prisma.identity.updateMany({
    where: { id: identityId, userId },
    data: updateData,
  });

  if (updatedIdentity.count === 0) {
    return NextResponse.json(
      { error: "Identity not found or not owned by user" },
      { status: 404 }
    );
  }

  await prisma.auditLog.create({
    data: {
      actorType: AuditActorType.USER,
      actorUser: { connect: { id: userId } },
      actorApp: undefined,
      action: "UPDATE_IDENTITY",
      targetEntityType: "Identity",
      targetEntityId: identityId,
      outcome: AuditLogOutcome.SUCCESS,
      details: { source: "api" },
    },
  });

  return NextResponse.json({ success: true });
}
