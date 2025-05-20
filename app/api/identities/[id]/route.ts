import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import prisma from '@/lib/prisma';
import { identityFormSchema } from '@/schemas/identityFormSchema';

const SECRET = process.env.NEXTAUTH_SECRET;

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const identityId = params.id;
  const token = await getToken({ req, secret: SECRET });

  if (!token || !token.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const json = await req.json();
    const data = identityFormSchema.parse(json);

    // Verify the identity belongs to the session user
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

    // Transaction: update identity and reset linked accounts
    const updatedIdentity = await prisma.$transaction(async (prismaTx) => {
      await prismaTx.identityAccount.deleteMany({ where: { identityId } });

      const identityUpdate = await prismaTx.identity.update({
        where: { id: identityId },
        data: {
          identityLabel:            data.identityLabel,
          category:                 data.category,
          customCategoryName:       data.customCategoryName,
          description:              data.description,
          contextualNameDetails:    data.contextualNameDetails,
          identityNameHistory:      data.identityNameHistory,
          contextualReligiousNames: data.contextualReligiousNames,
          genderIdentity:           data.genderIdentity,
          customGenderDescription:  data.customGenderDescription,
          pronouns:                 data.pronouns,
          dateOfBirth:              data.dateOfBirth ? new Date(data.dateOfBirth) : null,
          location:                 data.location,
          profilePictureUrl:        data.profilePictureUrl,
          identityContacts:         data.identityContacts,
          onlinePresence:           data.onlinePresence,
          websiteUrls:              data.websiteUrls,
          additionalAttributes:     data.additionalAttributes,
          visibility:               data.visibility,
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
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 }
    );
  }
}
