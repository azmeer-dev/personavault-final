// app/(protectedRoutes)/explore/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import IdentityLiveCard, { type IdentityLiveCardProps } from '@/components/identity/IdentityLiveCard';

export default function ExplorePage() {
  const [cards, setCards] = useState<IdentityLiveCardProps[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/explore', { credentials: 'include' })
      .then(async (r) => {
        if (!r.ok) {
          const { error } = await r.json();
          throw new Error(error ?? `HTTP ${r.status}`);
        }
        return r.json();
      })
      .then(setCards)
      .catch((e) => setError(e.message));
  }, []);

  return (
    <main className="space-y-8 p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-semibold">Explore Public Identities</h1>

      {error ? (
        <p className="text-red-500">Error loading identities: {error}</p>
      ) : cards.length === 0 ? (
        <p className="text-muted-foreground">
          there are no public identities available.
        </p>
      ) : (
        <div className="space-y-6">
          {cards.map((card) => (
            <Link
              href={`/explore/${card.data.identityId}`} // Assuming identityLabel is unique and can be used as a path
              key={card.data.identityId} // Use a unique key like identityLabel or an actual ID if available
              className="block" // link to profile view
            >
              <div className="rounded-2xl shadow-sm border p-4 space-y-4">
                <IdentityLiveCard {...card} classProp="border-0" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}