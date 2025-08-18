// app/(protectedRoutes)/audit-logs/page.tsx
"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type AuditLog = {
  id: string;
  timestamp: string;
  actorType: string;
  action: string;
  targetEntityType: string | null;
  targetEntityId: string | null;
  outcome: string;
  details: Record<string, unknown> | null;
};

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function AuditLogsPage() {
  const { data, error, isLoading } = useSWR("/api/audit-logs", fetcher);
  const [logs, setLogs] = useState<AuditLog[]>([]);

  useEffect(() => {
    if (data?.logs) {
      setLogs(data.logs);
    }
  }, [data]);

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        {Array.from({ length: 5 }).map((_, idx) => (
          <Skeleton key={idx} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-600 p-6">
        Failed to load audit logs.
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Audit Logs</h1>
      {logs.length === 0 ? (
        <p>No audit logs available.</p>
      ) : (
        logs.map((log) => (
          <Card key={log.id}>
            <CardHeader className="text-sm text-muted-foreground">
              {new Date(log.timestamp).toLocaleString()}
            </CardHeader>
            <CardContent className="space-y-1">
              <p>
                <strong>Action:</strong> {log.action}
              </p>
              <p>
                <strong>Outcome:</strong> {log.outcome}
              </p>
              {log.targetEntityType && (
                <p>
                  <strong>Target:</strong> {log.targetEntityType} ({log.targetEntityId})
                </p>
              )}
              {log.details && (
                <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                  {JSON.stringify(log.details, null, 2)}
                </pre>
              )}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
