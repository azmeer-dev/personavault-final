"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import IdentityLiveCard, {
  type IdentityLiveCardProps,
} from "@/components/identity/IdentityLiveCard";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { PublicIdentity, PrivateIdentityStub } from "@/types/identity";
import { toast } from "sonner"; // For showing notifications

import { IdentityVisibility } from "@prisma/client"; // For direct enum usage

// Placeholder for a more complete Identity type, as would come from Prisma with includes
// This should ideally be imported or defined more globally if used elsewhere.
type FullPrismaIdentity = PublicIdentity & { // Start with PublicIdentity as a base
  // Add fields that are on Prisma's Identity but might not be in PublicIdentity or are different
  identityLabel: string; // Ensure it's not the stub's "Private Identity"
  profilePictureUrl: string | null;
  description: string | null;
  category: string; // Assuming IdentityCategoryType string values
  customCategoryName: string | null;
  contextualNameDetails: { preferredName: string; usageContext: string; }; // Already in PublicIdentity
  pronouns: string | null;
  genderIdentity: string | null;
  location: string | null;
  dateOfBirth: Date | null; // Prisma returns Date objects
  websiteUrls: string[]; // Already in PublicIdentity
  linkedAccountIds?: string[]; // Already in PublicIdentity
  visibility: IdentityVisibility; // Enum from Prisma
  // Include fields that might be specific to the full object and not in stubs/PublicIdentity
  identityContacts?: []; // Replace 'any' with actual IdentityContact[] type
  additionalAttributes?: []; // Replace 'any' with actual AdditionalAttribute[] type
  userId: string;
};


// Define the props for the RequestableIdentityCard
interface RequestableIdentityCardProps {
  // The identity prop can be one of these, plus it will always have userId
  identity: (PublicIdentity | PrivateIdentityStub | FullPrismaIdentity) & { userId: string };
  accounts: IdentityLiveCardProps["accounts"]; // Re-use from IdentityLiveCard
  isCurrentUserOwner: boolean;
  hasPendingRequest: boolean;
  classProp?: string;
}

export default function RequestableIdentityCard({
  identity,
  accounts,
  isCurrentUserOwner,
  hasPendingRequest,
  classProp,
  children, // Added children prop
}: RequestableIdentityCardProps & { children?: React.ReactNode }) { // Added children prop
  console.log("[RequestableIdentityCard] Received identity:", JSON.stringify(identity, null, 2));
  console.log("[RequestableIdentityCard] isCurrentUserOwner:", isCurrentUserOwner);

  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [requestedScopes, setRequestedScopes] = useState("");
  const [contextDescription, setContextDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isPrivateOrAppSpecificStub =
    "visibility" in identity &&
    (identity.visibility === "PRIVATE" || identity.visibility === "APP_SPECIFIC") &&
    "identityLabel" in identity && // identityLabel is a good indicator of our stub types
    (identity.identityLabel === "Private Identity" || identity.identityLabel === "Restricted Identity");


  const handleRequestAccess = async () => {
    if (!session?.user?.id || !identity.userId) {
      toast.error("Authentication error or missing user ID.");
      return;
    }

    if (isCurrentUserOwner) {
        toast.error("Cannot request access to your own identity.");
        return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/consent-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identityId: identity.id,
          targetUserId: identity.userId, // userId from the extended identity prop
          requestedScopes: requestedScopes.split(",").map((s) => s.trim()).filter(s => s),
          contextDescription: contextDescription,
          // appId could be added here if relevant for the context
        }),
      });

      const result = await response.json();

      if (response.ok) {
        toast.success("Access request submitted successfully!");
        setOpen(false); // Close modal on success
        // Potentially, update `hasPendingRequest` state here or rely on parent re-fetch
        // For now, we assume parent component will handle re-fetching or state update if needed
        // to change the button state immediately. This component will reflect `hasPendingRequest` prop.
      } else {
        toast.error(`Error: ${result.error || "Failed to submit request."}`);
      }
    } catch (error) {
      console.error("Failed to submit consent request:", error);
      toast.error("An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Prepare props for IdentityLiveCard
  let liveCardData: IdentityLiveCardProps["data"];

  if (isCurrentUserOwner) {
    // Owner sees full details, even for private/app-specific.
    // Assume 'identity' is a FullPrismaIdentity in this case.
    const ownerIdentity = identity as FullPrismaIdentity; // Type assertion
    console.log("[RequestableIdentityCard] Owner's true identityLabel:", ownerIdentity.identityLabel);
    liveCardData = {
      identityId: ownerIdentity.id,
      identityLabel: ownerIdentity.identityLabel, // Actual label
      profilePictureUrl: ownerIdentity.profilePictureUrl, // Actual picture
      description: ownerIdentity.description,
      category: ownerIdentity.category,
      customCategoryName: ownerIdentity.customCategoryName,
      contextualNameDetails: ownerIdentity.contextualNameDetails || { preferredName: "", usageContext: "" },
      pronouns: ownerIdentity.pronouns,
      genderIdentity: ownerIdentity.genderIdentity,
      location: ownerIdentity.location,
      dateOfBirth: ownerIdentity.dateOfBirth ? new Date(ownerIdentity.dateOfBirth).toISOString().slice(0,10) : undefined,
      websiteUrls: ownerIdentity.websiteUrls || [], // Ensure array
      linkedAccountIds: ownerIdentity.linkedAccountIds || [], // Ensure array
      visibility: ownerIdentity.visibility, // Actual visibility
      // Potentially include identityContacts and additionalAttributes if IdentityLiveCard can display them
      // For now, sticking to fields already handled by IdentityLiveCard's 'Slice' type
    };
  } else {
    // Non-owner view: uses existing logic for stubs or public versions
    liveCardData = {
      identityId: identity.id,
      identityLabel: ("identityLabel" in identity ? identity.identityLabel : "User Identity") as string,
      profilePictureUrl: "profilePictureUrl" in identity ? identity.profilePictureUrl : undefined,
      description: "description" in identity ? identity.description : undefined,
      category: identity.category, // category is on PrivateIdentityStub
      customCategoryName: "customCategoryName" in identity ? identity.customCategoryName : undefined,
      contextualNameDetails: "contextualNameDetails" in identity && identity.contextualNameDetails ? identity.contextualNameDetails : { preferredName: "", usageContext: "" },
      pronouns: "pronouns" in identity ? identity.pronouns : undefined,
      genderIdentity: "genderIdentity" in identity ? identity.genderIdentity : undefined,
      location: "location" in identity ? identity.location : undefined,
      dateOfBirth: "dateOfBirth" in identity && identity.dateOfBirth ? new Date(identity.dateOfBirth).toISOString().slice(0,10) : undefined,
      websiteUrls: "websiteUrls" in identity && identity.websiteUrls ? identity.websiteUrls : [],
      linkedAccountIds: "linkedAccountIds" in identity && identity.linkedAccountIds ? identity.linkedAccountIds : [],
      visibility: "visibility" in identity ? identity.visibility : undefined,
    };
  }

  console.log("[RequestableIdentityCard] liveCardData being passed to IdentityLiveCard:", JSON.stringify(liveCardData, null, 2));

  return (
    <div className={`rounded-2xl shadow-sm border p-4 space-y-4 ${classProp ?? ""}`}>
      <IdentityLiveCard data={liveCardData} accounts={accounts} classProp="border-0" />

      {/* Render children (e.g., Edit/Delete buttons) if provided */}
      {children}

      {/* "Request Access" button and modal */}
      {!isCurrentUserOwner && isPrivateOrAppSpecificStub && (
        <div className="pt-2 flex justify-end"> {/* Adjusted padding if children are present */}
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" disabled={hasPendingRequest}>
                {hasPendingRequest ? "Request Pending" : "Request Access"}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Request Access to Identity</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label htmlFor="requestedScopes">Requested Scopes (comma-separated)</Label>
                  <Input
                    id="requestedScopes"
                    value={requestedScopes}
                    onChange={(e) => setRequestedScopes(e.target.value)}
                    placeholder="e.g., email, profile_details"
                  />
                </div>
                <div>
                  <Label htmlFor="contextDescription">Reason for Request</Label>
                  <Textarea
                    id="contextDescription"
                    value={contextDescription}
                    onChange={(e) => setContextDescription(e.target.value)}
                    placeholder="Please provide a brief explanation for your request."
                  />
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                    <Button variant="ghost">Cancel</Button>
                </DialogClose>
                <Button onClick={handleRequestAccess} disabled={isSubmitting || !requestedScopes.trim() || !contextDescription.trim()}>
                  {isSubmitting ? "Submitting..." : "Submit Request"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}
    </div>
  );
}
