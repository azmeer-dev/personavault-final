// components/identity/FullIdentityView.tsx
"use client";

import Image from "next/image";

interface FullIdentityViewProps {
  data: {
    identityLabel: string;
    category: string;
    customCategoryName?: string | null;
    description?: string | null;
    genderIdentity?: string | null;
    pronouns?: string | null;
    location?: string | null;
    dateOfBirth?: string | null | Date;
    profilePictureUrl?: string | null;
    websiteUrls: string[];
    contextualNameDetails: {
      preferredName: string;
      usageContext: string;
    };
    linkedAccountEmails?: string[];
  };
}

export default function FullIdentityView({ data }: FullIdentityViewProps) {
  const {
    identityLabel,
    category,
    customCategoryName,
    description,
    genderIdentity,
    pronouns,
    location,
    dateOfBirth,
    profilePictureUrl,
    websiteUrls,
    contextualNameDetails,
    linkedAccountEmails,
  } = data;

  return (
    <div className="space-y-6 p-4 rounded-md border">
      <div className="flex flex-col items-center gap-4 sm:flex-row">
        {profilePictureUrl ? (
          <Image
            src={profilePictureUrl}
            alt="Profile"
            width={96}
            height={96}
            className="rounded-full object-cover"
          />
        ) : (
          <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center text-muted-foreground">
            No Image
          </div>
        )}
        <div>
          <h2 className="text-xl font-semibold">{identityLabel}</h2>
          <p className="text-sm text-muted-foreground">
            {category === "CUSTOM" ? customCategoryName : category}
          </p>
        </div>
      </div>

      {description && <p>{description}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {contextualNameDetails.preferredName && (
          <p>
            <strong>Preferred Name:</strong> {contextualNameDetails.preferredName}
          </p>
        )}
        {contextualNameDetails.usageContext && (
          <p>
            <strong>Usage Context:</strong> {contextualNameDetails.usageContext}
          </p>
        )}
        {pronouns && (
          <p>
            <strong>Pronouns:</strong> {pronouns}
          </p>
        )}
        {genderIdentity && (
          <p>
            <strong>Gender:</strong> {genderIdentity}
          </p>
        )}
        {location && (
          <p>
            <strong>Location:</strong> {location}
          </p>
        )}
        {dateOfBirth && (
          <p>
            <strong>Date of Birth:</strong> {String(dateOfBirth)}
          </p>
        )}
        {websiteUrls.length > 0 && (
          <p>
            <strong>Website:</strong>{" "}
            <a href={websiteUrls[0]} className="text-primary underline">
              {websiteUrls[0].replace(/^https?:\/\//, "")}
            </a>
          </p>
        )}
        {linkedAccountEmails && linkedAccountEmails.length > 0 && (
          <p>
            <strong>Linked Accounts:</strong>{" "}
            {linkedAccountEmails.map((email) => (
              <span
                key={email}
                className="inline-block px-2 py-1 bg-muted rounded text-xs mr-1"
              >
                {email}
              </span>
            ))}
          </p>
        )}
      </div>
    </div>
  );
}
