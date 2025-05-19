'use client';

import Image from 'next/image';
import type { IdentityFormValues } from '@/types/types';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type Slice = Pick<
  IdentityFormValues,
  | 'identityLabel'
  | 'profilePictureUrl'
  | 'description'
  | 'category'
  | 'customCategoryName'
  | 'contextualNameDetails'
  | 'pronouns'
  | 'genderIdentity'
  | 'location'
  | 'dateOfBirth'
  | 'websiteUrls'
  | 'linkedAccountIds'
>;

interface AccountOption {
  id: string;
  provider: string;
  emailFromProvider: string | null;
}

export interface IdentityLiveCardProps {
  data: Slice;
  accounts: AccountOption[];
}

/* utility right above the component body */
function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function IdentityLiveCard({
  data,
  accounts,
}: IdentityLiveCardProps) {
  /* derive values */
  const category =
    data.category === 'CUSTOM'
      ? data.customCategoryName || 'Custom'
      : data.category;

  const prefName   = data.contextualNameDetails?.preferredName?.trim();
  const usageCtx   = data.contextualNameDetails?.usageContext?.trim();
  const site       = data.websiteUrls?.[0];
  const linked     = accounts.filter((a) => data.linkedAccountIds?.includes(a.id));

  /* styles */
  const cardClass =
    'flex items-center gap-6 p-6 rounded-2xl shadow-sm border bg-background w-full';
  const infoLabel = 'text-xs font-medium text-muted-foreground';

  return (
    <div className={cardClass}>
      {/* Avatar */}
      {data.profilePictureUrl ? (
        <Image
          src={data.profilePictureUrl}
          alt="avatar"
          width={80}
          height={80}
          className="rounded-full object-cover"
          priority
        />
      ) : (
        <div className="h-[80px] w-[80px] rounded-full bg-muted flex items-center justify-center">
          <span className="text-sm text-muted-foreground">No Img</span>
        </div>
      )}

      {/* Text block */}
      <div className="flex-1 space-y-2">
        {/* headline */}
        <div>
          <h2 className="text-lg font-semibold leading-snug">
            {data.identityLabel || 'Untitled identity'}
          </h2>
          <p className="text-sm text-muted-foreground">{category}</p>
          {prefName && (
            <p className="text-sm">
              {prefName}
              {usageCtx && (
                <span className="text-muted-foreground"> ({usageCtx})</span>
              )}
            </p>
          )}
        </div>

        {/* description */}
        {data.description && (
          <p className="text-sm line-clamp-2">{data.description}</p>
        )}

        {/* info grid */}
        <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-sm">
          {data.pronouns?.trim() && (
            <>
              <span className={infoLabel}>Pronouns</span>
              <span>{data.pronouns}</span>
            </>
          )}
          {data.genderIdentity?.trim() && (
            <>
              <span className={infoLabel}>Gender</span>
              <span>{data.genderIdentity}</span>
            </>
          )}
          {data.location?.trim() && (
            <>
              <span className={infoLabel}>Location</span>
              <span>{data.location}</span>
            </>
          )}
          {data.dateOfBirth?.trim() && (
            <>
              <span className={infoLabel}>DOB</span>
              <span>{data.dateOfBirth}</span>
            </>
          )}
          {site && (
            <>
              <span className={infoLabel}>Website</span>
              <span>
                <a
                  href={site}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline text-primary"
                >
                  {site.replace(/^https?:\/\//, '')}
                </a>
              </span>
            </>
          )}
          {linked.length > 0 && (
            <>
              <span className={infoLabel}>Accounts</span>
              <span className="space-x-2">
                {linked.map((a) => (
                  <span
                    key={a.id}
                    className="inline-flex items-center rounded bg-muted px-2 py-0.5 text-xs"
                  >
                    {capitalize(a.provider)}
                  </span>
                ))}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
