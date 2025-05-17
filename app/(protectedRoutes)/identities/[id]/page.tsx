import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import IdentityForm from "@/components/IdentityForm";
import type { IdentityFormValues } from "@/types/types";

type Props = {
  params: Promise<{ id: string }>;
};

type ContextualNameDetails = {
  preferredName: unknown;
  usageContext: unknown;
};

function parseContextualNameDetails(
  val: unknown
): { preferredName: string; usageContext: string } {
  if (
    val &&
    typeof val === "object" &&
    !Array.isArray(val) &&
    "preferredName" in val &&
    "usageContext" in val
  ) {
    const obj = val as ContextualNameDetails;
    return {
      preferredName:
        typeof obj.preferredName === "string"
          ? obj.preferredName
          : String(obj.preferredName),
      usageContext:
        typeof obj.usageContext === "string"
          ? obj.usageContext
          : String(obj.usageContext),
    };
  }
  return { preferredName: "", usageContext: "" };
}

type IdentityNameHistoryEntry = {
  name: unknown;
  from: unknown;
  to: unknown;
  context: unknown;
};

function parseIdentityNameHistory(
  val: unknown
): { name: string; from: string; to: string; context: string }[] {
  if (!Array.isArray(val)) return [];
  return val
    .filter(
      (item): item is IdentityNameHistoryEntry =>
        item &&
        typeof item === "object" &&
        "name" in item &&
        "from" in item &&
        "to" in item &&
        "context" in item
    )
    .map((item) => ({
      name: typeof item.name === "string" ? item.name : String(item.name),
      from: typeof item.from === "string" ? item.from : String(item.from),
      to: typeof item.to === "string" ? item.to : String(item.to),
      context: typeof item.context === "string" ? item.context : String(item.context),
    }));
}

function parseRecordStringString(val: unknown): Record<string, string> {
  if (val && typeof val === "object" && !Array.isArray(val)) {
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(val)) {
      if (typeof value === "string") {
        result[key] = value;
      }
    }
    return result;
  }
  return {};
}

function parseVisibility(val: unknown): "PRIVATE" | "PUBLIC" {
  if (val === "PRIVATE" || val === "PUBLIC") return val;
  return "PRIVATE";
}

export default async function EditIdentityPage({ params }: Props) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/signin");
  const userId = session.user.id;

  const { id: identityId } = await params;

  const identity = await prisma.identity.findFirst({
    where: { id: identityId, userId },
    include: {
      linkedExternalAccounts: { select: { accountId: true } },
    },
  });

  if (!identity) redirect("/identities");

  const rawAccounts = await prisma.account.findMany({
    where: { userId },
    select: { id: true, provider: true, emailFromProvider: true },
    orderBy: { provider: "asc" },
  });

  const accountOptions = rawAccounts.map((a) => ({
    id: a.id,
    provider: a.provider,
    emailFromProvider: a.emailFromProvider,
  }));

  const contextualNameDetails = parseContextualNameDetails(identity.contextualNameDetails);
  const identityNameHistory = parseIdentityNameHistory(identity.identityNameHistory);
  const identityContacts = parseRecordStringString(identity.identityContacts);
  const onlinePresence = parseRecordStringString(identity.onlinePresence);
  const additionalAttributes = parseRecordStringString(identity.additionalAttributes);
  const visibility = parseVisibility(identity.visibility);

  const linkedAccountIds = identity.linkedExternalAccounts.map((la) => la.accountId);

  const initialValues: Partial<IdentityFormValues> = {
    identityLabel: identity.identityLabel,
    category: identity.category,
    customCategoryName: identity.customCategoryName ?? "",
    description: identity.description ?? "",
    contextualNameDetails,
    identityNameHistory,
    contextualReligiousNames: identity.contextualReligiousNames ?? [],
    genderIdentity: identity.genderIdentity ?? "",
    customGenderDescription: identity.customGenderDescription ?? "",
    pronouns: identity.pronouns ?? "",
    dateOfBirth: identity.dateOfBirth
      ? identity.dateOfBirth.toISOString().substring(0, 10)
      : "",
    location: identity.location ?? "",
    profilePictureUrl: identity.profilePictureUrl ?? "",
    identityContacts,
    onlinePresence,
    websiteUrls: identity.websiteUrls ?? [],
    additionalAttributes,
    visibility,
    linkedAccountIds,
  };

  return (
    <main className="p-6 max-w-4xl mx-auto overflow-hidden ">
      <h1 className="text-2xl font-semibold mb-6">Edit Identity</h1>
      <IdentityForm
        userId={userId}
        accounts={accountOptions}
        initialValues={initialValues}
        identityId={identityId}
      />
    </main>
  );
}
