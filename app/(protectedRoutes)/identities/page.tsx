import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import prisma from "@/lib/prisma";

import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import prisma from "@/lib/prisma";
import { ConsentRequestStatus } from "@prisma/client"; // Added for fetching pending requests

import RequestableIdentityCard from "@/components/identity/RequestableIdentityCard"; // Changed import
import { Button } from "@/components/ui/button";
import Link from "next/link";
import DeleteIdentityButton from "@/components/identity/DeleteIdentityButton";
// IdentityLiveCardProps might not be directly needed here anymore if RequestableIdentityCard defines its own
// For safeJson, it's used below, so keeping it for now.
function safeJson<T>(value: unknown, fallback: T): T {
  return value && typeof value === "object" ? (value as T) : fallback;
}

// Define a more specific type for the identity data passed to RequestableIdentityCard
// to ensure userId is available for the targetUserId in consent requests.
type IdentityForCard = Awaited<
  ReturnType<typeof prisma.identity.findMany>
>[0] & { userId: string };

export default async function IdentitiesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/signin");
  const currentUserId = session.user.id; // Renamed for clarity

  // NOTE: The current logic fetches identities ONLY for the logged-in user.
  // For "Request Access" to be fully meaningful on this page for OTHER users' identities,
  // this query would need to be modified to fetch identities for a target user (e.g., from a route param)
  // or a list of users. For now, the `isCurrentUserOwner` prop in RequestableIdentityCard
  // will correctly hide/disable the button for the user's own identities.

  const accounts = await prisma.account.findMany({
    where: { userId: currentUserId }, // Assuming accounts are for the current user viewing the page
    select: { id: true, provider: true, emailFromProvider: true },
  });

  // Fetch identities - assuming for the current user as per original logic
  const identities = (await prisma.identity.findMany({
    where: { userId: currentUserId }, // Fetches only the current user's identities
    orderBy: { updatedAt: "desc" },
    include: {
      linkedExternalAccounts: { select: { accountId: true } },
      // user: { select: { id: true } } // Ensure userId is fetched if not directly on identity
    },
  })) as IdentityForCard[]; // Cast to ensure userId is part of the type

  // Fetch pending consent requests initiated by the current user
  // This is useful if this page were to display other users' identities.
  // For now, it will likely be empty or not directly used if only own identities are shown.
  const pendingConsentRequests = await prisma.consentRequest.findMany({
    where: {
      requestingUserId: currentUserId,
      status: ConsentRequestStatus.PENDING,
    },
    select: {
      identityId: true, // Select only identityId for checking existence
    },
  });
  const pendingRequestIdentityIds = new Set(
    pendingConsentRequests.map((req) => req.identityId)
  );

  return (
    <main className="space-y-8 p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-semibold">Identities</h1>

      <Button asChild>
        <Link href="/identities/create">Create New Identity</Link>
      </Button>

      {cards.length === 0 && (
        <p className="text-muted-foreground">You do not have any identities.</p>
      )}

      <div className="space-y-6">
        {identities.map((identity) => {
          // The `identity` object from Prisma already includes `userId`.
          // If it didn't, you'd fetch it via include: { user: { select: { id: true } } }
          // and access it e.g., identity.user.id. For this setup, identity.userId is assumed.

          const isCurrentUserOwner = identity.userId === currentUserId;
          const hasPendingRequest = pendingRequestIdentityIds.has(identity.id);
          
          // Construct the identity object for RequestableIdentityCard, ensuring PublicIdentity/PrivateIdentityStub compatibility
          // This might require more detailed mapping if the prisma type isn't directly compatible,
          // but RequestableIdentityCard is designed to handle some of this.
          // The key part is `identity.userId` must be available.
          const cardIdentity = {
            ...identity,
            // Ensure fields expected by PublicIdentity or PrivateIdentityStub are present
            // Most fields are already on the `identity` object from Prisma.
            // `RequestableIdentityCard` handles transforming this into `IdentityLiveCardProps.data`
            // So we mainly need to pass the raw-ish identity and supporting props.
            // The `userId` property is crucial and assumed to be on the `identity` object.
          };

          return (
            <RequestableIdentityCard
              key={identity.id}
              identity={cardIdentity} // Pass the full identity object, including its own userId
              accounts={accounts} // Accounts for linking, assumed to be current user's accounts
              isCurrentUserOwner={isCurrentUserOwner}
              hasPendingRequest={hasPendingRequest}
              // classProp could be added if needed for styling the wrapper
            >
              {/* Children for Edit/Delete buttons if RequestableIdentityCard is designed to take them */}
              {/* For now, assuming Edit/Delete are still managed outside or alongside */}
              {isCurrentUserOwner && (
                 <div className="flex flex-col sm:flex-row sm:justify-end sm:gap-2 mt-2">
                    <Link href={`/identities/${identity.id}`}>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full sm:w-auto mb-2 sm:mb-0"
                      >
                        Edit
                      </Button>
                    </Link>
                    <DeleteIdentityButton id={identity.id} />
                  </div>
              )}
            </RequestableIdentityCard>
          );
        })}
      </div>
    </main>
  );
}
