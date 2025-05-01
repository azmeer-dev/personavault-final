"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface OverviewData {
  accounts: number;
  identities: number;
  apps: number;
  pendingConsents: number;
  auditLogs: number;
}

export default function DashboardPage() {
  const { status } = useSession();
  const router = useRouter();

  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* fetch overview only after session is ready */
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/signin");
      return;
    }
    if (status === "authenticated") {
      fetch("/api/dashboard/overview", { credentials: "include" })
        .then(async (res) => {
          if (!res.ok) throw new Error("Failed to fetch overview data");
          return res.json();
        })
        .then((json: OverviewData) => setData(json))
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));
    }
  }, [status, router]);

  /* reusable stat card */
  const StatCard = ({
    title,
    value,
    href,
  }: {
    title: string;
    value: number | string;
    href?: string;
  }) => (
    <Card className="shadow-sm transition-colors hover:ring-2 hover:ring-primary">
      <CardHeader className="pb-2">
        {href ? (
          <Link href={href} className="hover:underline">
            <CardTitle className="text-base font-medium">{title}</CardTitle>
          </Link>
        ) : (
          <CardTitle className="text-base font-medium">{title}</CardTitle>
        )}
      </CardHeader>
      <CardContent>
        <span className="text-4xl font-bold">{value}</span>
      </CardContent>
    </Card>
  );

  /* skeleton for smoother perceived loading */
  const SkeletonCard = () => (
    <Card>
      <CardHeader className="pb-2">
        <Skeleton className="h-5 w-1/2" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-10 w-24" />
      </CardContent>
    </Card>
  );

  /* error state */
  if (error) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertTitle>Error loading dashboard</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <section className="container mx-auto px-4 py-6 space-y-6">
      <h1 className="text-2xl font-semibold">Dashboard Overview</h1>

      {/* stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {loading ? (
          /* display 5 placeholders while fetching */
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          data && (
            <>
              <StatCard
                title="Connected Accounts"
                value={data.accounts}
                href="/connected-accounts"
              />
              <StatCard title="Identities" value={data.identities} />
              <StatCard title="API Apps" value={data.apps} />
              <StatCard title="Pending Consents" value={data.pendingConsents} />
              <StatCard
                title="Audit Logs"
                value={data.auditLogs}
                /* span full width on lg */
                href="/audit-logs"
                /* col-span handled via parent grid override */
                
              />
            </>
          )
        )}
      </div>

      {/* future sections */}
      {/* <section className="space-y-2">
        <h2 className="text-xl font-semibold">Recent Activity</h2>
        <p className="text-sm text-muted-foreground">Coming soon...</p>
      </section> */}
    </section>
  );
}
