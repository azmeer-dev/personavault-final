// app/identities/[id]/loading.tsx
"use client";

import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

export default function EditIdentityLoading() {
  return (
    <form className="space-y-8 max-w-xl p-8 bg-card text-card-foreground rounded-lg shadow">
      {/* same skeleton fields as CreateIdentityLoading */}
      {["Category","Custom Category","Identity Name","Previous Names","Religious Names"].map((label) => (
        <div key={label} className="space-y-1">
          <Label>{label}</Label>
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
      <div className="space-y-1">
        <Label>Description</Label>
        <Skeleton className="h-24 w-full" />
      </div>
      <div className="space-y-1">
        <Label>Visibility</Label>
        <div className="flex space-x-4">
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-6 w-16" />
        </div>
      </div>
      <div className="space-y-1">
        <Label>Linked Accounts</Label>
        <Skeleton className="h-10 w-1/2" />
      </div>
      <div className="space-y-1">
        <Label>Ad-hoc Accounts</Label>
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-6 w-40" />
        </div>
      </div>
      <div className="pt-4">
        <Skeleton className="h-10 w-full" />
      </div>
    </form>
  );
}
