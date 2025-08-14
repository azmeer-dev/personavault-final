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
import { toast } from "sonner";

import { IdentityVisibility } from "@prisma/client";

type FullPrismaIdentity = PublicIdentity & {
  identityLabel: string;
  profilePictureUrl: string | null;
  description: string | null;
  category: string;
  customCategoryName: string | null;
  contextualNameDetails: { preferredName: string; usageContext: string };
  pronouns: string | null;
  genderIdentity: string | null;
  location: string | null;
  dateOfBirth: Date | null;
  websiteUrls: string[];
  linkedAccountIds?: string[];
  visibility: IdentityVisibility;
  identityContacts?: [];
  additionalAttributes?: [];
  userId: string;
};

interface RequestableIdentityCardProps {
  identity: (PublicIdentity | PrivateIdentityStub | FullPrismaIdentity) & {
    userId: string;
  };
  accounts: IdentityLiveCardProps["accounts"];
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
  children,
}: RequestableIdentityCardProps & { children?: React.ReactNode }) {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [requestedScopes, setRequestedScopes] = useState("");
  const [contextDescription, setContextDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // local pending state so we can flip to pending after submit
  const [isPending, setIsPending] = useState(hasPendingRequest);

  const isPrivateOrAppSpecificStub =
    "visibility" in identity &&
    (identity.visibility === "PRIVATE" || identity.visibility === "APP_SPECIFIC") &&
    "identityLabel" in identity &&
    (identity.identityLabel === "Private Identity" ||
      identity.identityLabel === "Restricted Identity");

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
          targetUserId: identity.userId,
          requestedScopes: requestedScopes
            .split(",")
            .map((s) => s.trim())
            .filter((s) => s),
          contextDescription: contextDescription,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        toast.success("Access request submitted successfully!");
        setOpen(false);
        setIsPending(true); // flip to pending immediately
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

  let liveCardData: IdentityLiveCardProps["data"];

  if (isCurrentUserOwner) {
    const ownerIdentity = identity as FullPrismaIdentity;
    liveCardData = {
      identityId: ownerIdentity.id,
      identityLabel: ownerIdentity.identityLabel,
      profilePictureUrl: ownerIdentity.profilePictureUrl,
      description: ownerIdentity.description,
      category: ownerIdentity.category,
      customCategoryName: ownerIdentity.customCategoryName,
      contextualNameDetails:
        ownerIdentity.contextualNameDetails || { preferredName: "", usageContext: "" },
      pronouns: ownerIdentity.pronouns,
      genderIdentity: ownerIdentity.genderIdentity,
      location: ownerIdentity.location,
      dateOfBirth: ownerIdentity.dateOfBirth
        ? new Date(ownerIdentity.dateOfBirth).toISOString().slice(0, 10)
        : undefined,
      websiteUrls: ownerIdentity.websiteUrls || [],
      linkedAccountIds: ownerIdentity.linkedAccountIds || [],
      visibility: ownerIdentity.visibility,
    };
  } else {
    liveCardData = {
      identityId: identity.id,
      identityLabel: ("identityLabel" in identity
        ? identity.identityLabel
        : "User Identity") as string,
      profilePictureUrl:
        "profilePictureUrl" in identity ? identity.profilePictureUrl : undefined,
      description: "description" in identity ? identity.description : undefined,
      category: identity.category,
      customCategoryName:
        "customCategoryName" in identity ? identity.customCategoryName : undefined,
      contextualNameDetails:
        "contextualNameDetails" in identity && identity.contextualNameDetails
          ? identity.contextualNameDetails
          : { preferredName: "", usageContext: "" },
      pronouns: "pronouns" in identity ? identity.pronouns : undefined,
      genderIdentity: "genderIdentity" in identity ? identity.genderIdentity : undefined,
      location: "location" in identity ? identity.location : undefined,
      dateOfBirth:
        "dateOfBirth" in identity && identity.dateOfBirth
          ? new Date(identity.dateOfBirth).toISOString().slice(0, 10)
          : undefined,
      websiteUrls:
        "websiteUrls" in identity && identity.websiteUrls ? identity.websiteUrls : [],
      linkedAccountIds:
        "linkedAccountIds" in identity && identity.linkedAccountIds
          ? identity.linkedAccountIds
          : [],
      visibility: "visibility" in identity ? identity.visibility : undefined,
    };
  }

  return (
    <div className={`rounded-2xl shadow-sm border p-4 space-y-4 ${classProp ?? ""}`}>
      <IdentityLiveCard
        data={liveCardData}
        accounts={accounts}
        classProp="border-0"
      />

      {children}

      {!isCurrentUserOwner && isPrivateOrAppSpecificStub && (
        <div className="pt-2 flex justify-end">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" disabled={isPending}>
                {isPending ? "Request Pending" : "Request Access"}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Request Access to Identity</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label htmlFor="requestedScopes">
                    Requested Scopes (comma-separated)
                  </Label>
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
                <Button
                  onClick={handleRequestAccess}
                  disabled={
                    isSubmitting ||
                    !requestedScopes.trim() ||
                    !contextDescription.trim()
                  }
                >
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
