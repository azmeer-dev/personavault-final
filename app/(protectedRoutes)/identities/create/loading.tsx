/* app/(protectedRoutes)/identities/loading.tsx
   Shown while “create” or “edit” identity pages stream in.
*/
export default function IdentitiesLoading() {
  return (
    <main className="p-6 max-w-6xl mx-auto">
      {/* heading skeleton */}
      <div className="h-8 w-40 mb-6 rounded bg-muted animate-pulse" />

      {/* two-column skeleton that mirrors the final layout */}
      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-[1fr_400px]">
        {/* left column – form placeholder */}
        <div className="space-y-6 overflow-hidden">
          {/* accordion sections */}
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-4">
              <div className="h-6 w-1/3 rounded bg-muted animate-pulse" />
              {/* four input lines */}
              {Array.from({ length: 4 }).map((__, j) => (
                <div
                  key={j}
                  className="h-10 rounded bg-muted/60 animate-pulse"
                />
              ))}
            </div>
          ))}

          {/* submit button skeleton */}
          <div className="h-10 w-full rounded bg-muted animate-pulse" />
        </div>

        {/* right column – preview card placeholder */}
        <div className="hidden md:block sticky top-4 self-start">
          <div className="p-4 border rounded-xl space-y-4 w-[400px]">
            <div className="flex items-center gap-4">
              <div className="h-[60px] w-[60px] rounded-full bg-muted animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-1/2 rounded bg-muted animate-pulse" />
                <div className="h-3 w-1/3 rounded bg-muted/60 animate-pulse" />
              </div>
            </div>
            {/* body lines */}
            {Array.from({ length: 5 }).map((_, k) => (
              <div
                key={k}
                className="h-3 w-full rounded bg-muted/50 animate-pulse"
              />
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
