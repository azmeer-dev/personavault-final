// app/identities/loading.tsx
import { Card, CardHeader, CardContent } from "@/components/ui/card";

export default function LoadingIdentities() {
  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold mb-4">New Identity</h1>
      <h1 className="text-3xl font-semibold">
        <div className="h-8 w-1/3 rounded animate-pulse" />
      </h1>
      {/* Button skeleton */}
      <div className="h-10 w-40 rounded animate-pulse my-4" />

      {/* Render 3 skeleton cards */}
      {[1, 2, 3].map((i) => (
        <Card key={i} className="border border-gray-200">
          <CardHeader>
            <div className="h-6 w-1/2 rounded animate-pulse" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="h-4 w-full rounded animate-pulse" />
              <div className="h-4 w-3/4 rounded animate-pulse" />
            </div>
          </CardContent>
        </Card>
      ))}
    </main>
  );
}
