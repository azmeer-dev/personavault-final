import { NextResponse, NextRequest } from "next/server";
//no space after // always in small letters for comments
import { getToken } from "next-auth/jwt";
import prisma from "@/lib/prisma";
import { IdentityCategoryType, IdentityVisibility } from "@prisma/client";
import { filterIdentityByScopes } from "@/lib/identityUtils";
import type { PublicIdentity, PrivateIdentityStub } from "@/types/identity";

type ContextualNameDetails = { preferredName: string; usageContext: string };
type IdentityContact = Record<string, string>;
type OnlinePresence = Record<string, string>;
type AdditionalAttributes = Record<string, string>;

interface PrismaIdentity {
  id: string;
  userId: string;
  identityLabel: string;
  category: IdentityCategoryType;
  customCategoryName: string | null;
  description: string | null;
  contextualNameDetails: ContextualNameDetails;
  identityNameHistory: {
    name: string;
    from: string;
    to: string;
    context: string;
  }[];
  contextualReligiousNames: string[];
  genderIdentity: string | null;
  customGenderDescription: string | null;
  pronouns: string | null;
  dateOfBirth: Date | null;
  location: string | null;
  profilePictureUrl: string | null;
  identityContacts: IdentityContact;
  onlinePresence: OnlinePresence;
  websiteUrls: string[];
  additionalAttributes: AdditionalAttributes;
  visibility: IdentityVisibility;
  createdAt: Date;
  updatedAt: Date;
  linkedExternalAccounts: { accountId: string }[];
}

function safeContextualNameDetails(details: unknown): ContextualNameDetails {
  if (
    details &&
    typeof details === "object" &&
    "preferredName" in details &&
    "usageContext" in details &&
    typeof (details as Record<string, unknown>).preferredName === "string" &&
    typeof (details as Record<string, unknown>).usageContext === "string"
  ) {
    return details as ContextualNameDetails;
  }
  return { preferredName: "", usageContext: "" };
}

function parseJsonField<T>(field: unknown, fallback: T): T {
  if (!field || typeof field !== "object") return fallback;
  return field as T;
}

export async function GET(req: NextRequest) {
  try {
    const token = await getToken({ req });
    if (!token || !token.sub) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const requesterUserId = token.sub;

    const { searchParams } = new URL(req.url);
    const targetUserIdParam = searchParams.get("userId");
    const targetUserId = targetUserIdParam ?? requesterUserId;

    const requestingAppId = req.headers.get("X-App-ID") ?? undefined;

    const identities = await prisma.identity.findMany({
      where: { userId: targetUserId },
      include: { linkedExternalAccounts: true },
    });

    const typedIdentities: PrismaIdentity[] = identities.map((identity) => ({
      ...identity,
      category: identity.category as IdentityCategoryType,
      visibility: identity.visibility as IdentityVisibility,
      contextualNameDetails: safeContextualNameDetails(
        identity.contextualNameDetails
      ),
      identityNameHistory: parseJsonField<
        { name: string; from: string; to: string; context: string }[]
      >(identity.identityNameHistory, []),
      identityContacts: parseJsonField<IdentityContact>(
        identity.identityContacts,
        {}
      ),
      onlinePresence: parseJsonField<OnlinePresence>(
        identity.onlinePresence,
        {}
      ),
      additionalAttributes: parseJsonField<AdditionalAttributes>(
        identity.additionalAttributes,
        {}
      ),
      genderIdentity: identity.genderIdentity ?? null,
      customGenderDescription: identity.customGenderDescription ?? null,
      pronouns: identity.pronouns ?? null,
      location: identity.location ?? null,
      profilePictureUrl: identity.profilePictureUrl ?? null,
      websiteUrls: identity.websiteUrls ?? [],
    }));

    if (requesterUserId === targetUserId) {
      //user viewing their own identities, return all
      const result: PublicIdentity[] = typedIdentities.map((identity) => ({
        id: identity.id,
        identityLabel: identity.identityLabel,
        profilePictureUrl: identity.profilePictureUrl,
        description: identity.description,
        category: identity.category,
        customCategoryName: identity.customCategoryName,
        genderIdentity: identity.genderIdentity,
        pronouns: identity.pronouns,
        location: identity.location,
        dateOfBirth: identity.dateOfBirth,
        visibility: identity.visibility,
        contextualNameDetails: identity.contextualNameDetails,
        websiteUrls: identity.websiteUrls,
        linkedAccountIds: identity.linkedExternalAccounts.map(
          (a) => a.accountId
        ),
      }));
      return NextResponse.json(result);
    } else {
      const now = new Date();
      const consents = await prisma.consent.findMany({
        where: {
          userId: targetUserId,
          revokedAt: null,
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
      });

      const consentLookup = new Map<
        string,
        Map<string, (typeof consents)[0]>
      >();
      for (const consent of consents) {
        if (!consent.appId || !consent.identityId) continue;
        if (!consentLookup.has(consent.identityId)) {
          consentLookup.set(consent.identityId, new Map());
        }
        consentLookup.get(consent.identityId)!.set(consent.appId, consent);
      }

      const transformedIdentities = typedIdentities
        .map((identity): PublicIdentity | PrivateIdentityStub | null => {
          let relevantConsent = null;
          if (requestingAppId && identity.id) {
            relevantConsent = consentLookup
              .get(identity.id)
              ?.get(requestingAppId);
          }

          if (
            relevantConsent &&
            (identity.visibility === IdentityVisibility.PRIVATE ||
              identity.visibility === IdentityVisibility.APP_SPECIFIC)
          ) {
            //this returns a Partial, so fill all missing required fields for PublicIdentity
            //do not include linkedExternalAccounts in the object you pass in
            const { ...fullIdentity } = identity;
            const partial = filterIdentityByScopes(
              fullIdentity,
              relevantConsent.grantedScopes
            ) as Partial<PublicIdentity>;

            return {
              id: partial.id ?? identity.id,
              identityLabel: partial.identityLabel ?? "",
              profilePictureUrl: partial.profilePictureUrl ?? null,
              description: partial.description ?? null,
              category: partial.category ?? identity.category,
              customCategoryName:
                partial.customCategoryName ?? identity.customCategoryName,
              genderIdentity: partial.genderIdentity ?? null,
              pronouns: partial.pronouns ?? null,
              location: partial.location ?? null,
              dateOfBirth: partial.dateOfBirth ?? null,
              visibility: partial.visibility ?? identity.visibility,
              contextualNameDetails: partial.contextualNameDetails ?? {
                preferredName: "",
                usageContext: "",
              },
              websiteUrls: partial.websiteUrls ?? [],
              linkedAccountIds:
                partial.linkedAccountIds ??
                identity.linkedExternalAccounts.map((a) => a.accountId),
            };
          } else {
            switch (identity.visibility) {
              case IdentityVisibility.PUBLIC:
              case IdentityVisibility.AUTHENTICATED_USERS:
                return {
                  id: identity.id,
                  identityLabel: identity.identityLabel,
                  profilePictureUrl: identity.profilePictureUrl,
                  description: identity.description,
                  category: identity.category,
                  customCategoryName: identity.customCategoryName,
                  genderIdentity: identity.genderIdentity,
                  pronouns: identity.pronouns,
                  location: identity.location,
                  dateOfBirth: identity.dateOfBirth,
                  visibility: identity.visibility,
                  contextualNameDetails: identity.contextualNameDetails,
                  websiteUrls: identity.websiteUrls,
                  linkedAccountIds: identity.linkedExternalAccounts.map(
                    (a) => a.accountId
                  ),
                };
              case IdentityVisibility.PRIVATE:
                return {
                  id: identity.id,
                  visibility: "PRIVATE",
                  category: identity.category,
                  customCategoryName:
                    identity.category === IdentityCategoryType.CUSTOM
                      ? identity.customCategoryName
                      : null,
                  identityLabel: "Private Identity",
                  profilePictureUrl: "/img/private-icon.svg",
                };
              case IdentityVisibility.APP_SPECIFIC:
                return {
                  id: identity.id,
                  visibility: "APP_SPECIFIC",
                  category: identity.category,
                  customCategoryName:
                    identity.category === IdentityCategoryType.CUSTOM
                      ? identity.customCategoryName
                      : null,
                  identityLabel: "Restricted Identity",
                  profilePictureUrl: "/img/restricted-icon.svg",
                };
              default:
                return null;
            }
          }
        })
        .filter(Boolean);

      return NextResponse.json(transformedIdentities);
    }
  } catch (error) {
    //do not leak details to the client
    console.error("error fetching identities:", error);
    const errorMessage =
      error instanceof Error ? error.message : "internal server error";
    return NextResponse.json(
      { error: "internal server error", details: errorMessage },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = await getToken({ req });
    if (!token?.sub) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    const {
      identityLabel,
      category,
      customCategoryName,
      description,
      contextualNameDetails,
      identityNameHistory,
      contextualReligiousNames,
      genderIdentity,
      customGenderDescription,
      pronouns,
      dateOfBirth,
      location,
      profilePictureUrl,
      identityContacts,
      onlinePresence,
      websiteUrls,
      additionalAttributes,
      visibility,
    } = body;

    const identity = await prisma.identity.create({
      data: {
        userId: token.sub,
        identityLabel,
        category: category as IdentityCategoryType,
        customCategoryName: customCategoryName || null,
        description: description || null,
        contextualNameDetails,
        identityNameHistory: identityNameHistory ?? [],
        contextualReligiousNames: contextualReligiousNames ?? [],
        genderIdentity: genderIdentity || null,
        customGenderDescription: customGenderDescription || null,
        pronouns: pronouns || null,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        location: location || null,
        profilePictureUrl: profilePictureUrl || null,
        identityContacts: identityContacts ?? {},
        onlinePresence: onlinePresence ?? {},
        websiteUrls: websiteUrls ?? [],
        additionalAttributes: additionalAttributes ?? {},
        visibility: visibility as IdentityVisibility,
      },
    });

    return NextResponse.json(identity, { status: 201 });
  } catch (error) {
    console.error("❌ Error creating identity:", error);
    return NextResponse.json(
      { error: "Failed to create identity" },
      { status: 500 }
    );
  }
}
