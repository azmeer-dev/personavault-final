// page.tsx
import { getIdentityById } from "@/lib/identity"; // logAuditEntry removed
import { createAuditLog } from "@/lib/audit"; // createAuditLog added
import FullIdentityProfile from "@/components/identity/FullIdentityView";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { notFound } from "next/navigation";
import { AuditActorType, AuditLogOutcome } from "@prisma/client";
//export const dynamic = "force-dynamic";

export default async function IdentityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = await params;
  const identity = await getIdentityById(resolvedParams.id);

  // --- MODIFICATION START ---
  if (identity && identity.visibility !== 'PUBLIC') {
    // Consider if a specific "forbidden" page is better, but notFound is fine for now
    // as this URL path implies public exploration.
    return notFound(); 
  }
  // --- MODIFICATION END ---

  if (!identity) return notFound(); // This existing check is still good

  const session = await getServerSession(authOptions);
  const viewerId = session?.user?.id ?? "anonymous";
  const viewerType = session ? AuditActorType.USER : AuditActorType.SYSTEM;

  await createAuditLog({ // Changed to createAuditLog
    actorType: viewerType,
    actorUserId: viewerType === AuditActorType.USER ? viewerId : undefined,
    actorAppId: undefined, 
    action: "VIEW_PUBLIC_IDENTITY",
    targetEntityType: "Identity",
    targetEntityId: identity.id,
    outcome: AuditLogOutcome.SUCCESS,
    details: { source: "page" }, // This is valid Prisma.InputJsonValue
  });

  const raw = identity.contextualNameDetails;
  const contextual =
    typeof raw === "object" &&
    raw !== null &&
    "preferredName" in raw &&
    "usageContext" in raw
      ? (raw as unknown as { preferredName: string; usageContext: string })
      : { preferredName: "", usageContext: "" };

  return (
    <div className="max-w-3xl mx-auto py-10 px-4">
      <h1 className="text-3xl font-bold mb-6">Identity Profile</h1>
      <FullIdentityProfile
        data={{
          identityLabel: identity.identityLabel,
          category: identity.category,
          customCategoryName: identity.customCategoryName,
          description: identity.description,
          genderIdentity: identity.genderIdentity,
          pronouns: identity.pronouns,
          location: identity.location,
          dateOfBirth: identity.dateOfBirth,
          profilePictureUrl: identity.profilePictureUrl,
          websiteUrls: identity.websiteUrls,
          contextualNameDetails: contextual,
          linkedAccountEmails: identity.linkedExternalAccounts
            .map((a) => a.account.emailFromProvider)
            .filter((email): email is string => email !== null),
          provider: identity.linkedExternalAccounts
            .map((a) => a.account.provider)
            .filter((provider): provider is string => provider !== null),
        }}
      />
    </div>
  );
}
