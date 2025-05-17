import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { identityFormSchema } from "@/schemas/identityFormSchema";

export async function PUT(
  req: NextRequest,
  context: Promise<{ params: { id: string } }>
) {
  const { params } = await context;
  const identityId = params.id;

  try {
    const json = await req.json();
    const data = identityFormSchema.parse(json);

    // check if identity exists before update
    const existing = await prisma.identity.findUnique({ where: { id: identityId } });
    if (!existing) {
      return NextResponse.json({ error: "Identity not found" }, { status: 404 });
    }

    // transaction: update identity and reset linked accounts
    const updatedIdentity = await prisma.$transaction(async (prisma) => {
      await prisma.identityAccount.deleteMany({ where: { identityId } });

      const identityUpdate = await prisma.identity.update({
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

      if (data.linkedAccountIds?.length > 0) {
        await Promise.all(
          data.linkedAccountIds.map((accountId) =>
            prisma.identityAccount.create({
              data: { identityId, accountId },
            })
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
