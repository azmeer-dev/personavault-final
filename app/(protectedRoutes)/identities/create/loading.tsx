// app/identities/create/loading.tsx
"use client";

import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

export default function CreateIdentityLoading() {
  return (
    <form className="space-y-8 max-w-xl p-8 bg-card text-card-foreground rounded-lg shadow">
      {/* Category */}
      <div className="space-y-1">
        <Label>Category</Label>
        <Skeleton className="h-10 w-full" />
      </div>

      {/* Custom Category */}
      <div className="space-y-1">
        <Label>Custom Category</Label>
        <Skeleton className="h-10 w-1/2" />
      </div>

      {/* Identity Name */}
      <div className="space-y-1">
        <Label>Identity Name</Label>
        <Skeleton className="h-10 w-full" />
      </div>

      {/* Previous & Religious Names */}
      <div className="space-y-1">
        <Label>Previous Names</Label>
        <Skeleton className="h-10 w-full" />
      </div>
      <div className="space-y-1">
        <Label>Religious Names</Label>
        <Skeleton className="h-10 w-full" />
      </div>

      {/* Description */}
      <div className="space-y-1">
        <Label>Description</Label>
        <Skeleton className="h-24 w-full" />
      </div>

      {/* Visibility */}
      <div className="space-y-1">
        <Label>Visibility</Label>
        <div className="flex space-x-4">
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-6 w-16" />
        </div>
      </div>

      {/* Linked Accounts */}
      <div className="space-y-1">
        <Label>Linked Accounts</Label>
        <Skeleton className="h-10 w-1/2" />
      </div>

      {/* Ad-hoc Accounts */}
      <div className="space-y-1">
        <Label>Ad-hoc Accounts</Label>
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-6 w-40" />
        </div>
      </div>

      {/* Submit */}
      <div className="pt-4">
        <Skeleton className="h-10 w-full" />
      </div>
    </form>
  );
}
