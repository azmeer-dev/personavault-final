"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, CheckCircle2 } from "lucide-react";

interface IdentityAppConsentsManagerProps {
  identityId: string;
  userId: string;
  identityVisibility: string;
}

interface GrantedAppInfo {
  id: string;
  name: string;
  logoUrl?: string | null;
  description?: string | null;
  consentId: string;
  grantedScopes: string[];
  grantedAt: string;
}

interface AvailableAppInfo {
  id: string;
  name: string;
  logoUrl?: string | null;
  description?: string | null;
}

const DEFAULT_SCOPES = ["identity.read"];

export default function IdentityAppConsentsManager({
  identityId,
  identityVisibility,
}: IdentityAppConsentsManagerProps) {
  const [grantedApps, setGrantedApps] = useState<GrantedAppInfo[]>([]);
  const [availableApps, setAvailableApps] = useState<AvailableAppInfo[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isGranting, setIsGranting] = useState<string | null>(null);
  const [isRevoking, setIsRevoking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (identityVisibility !== "PRIVATE" || !identityId) {
      setGrantedApps([]);
      setAvailableApps([]);
      setError(null);
      return;
    }

    setIsLoadingData(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(`/api/identities/${identityId}/consents`);
      if (!response.ok) {
        const text = await response.text();
        throw new Error(
          text || `Failed to fetch consents: ${response.statusText}`
        );
      }
      const data = await response.json();
      setGrantedApps(data.grantedApps || []);
      setAvailableApps(data.availableApps || []);
    } catch (err) {
      if (err instanceof Error) {
        setError(
          err.message ||
            "An unexpected error occurred while fetching app consents."
        );
        setGrantedApps([]);
        setAvailableApps([]);
      }
    } finally {
      setIsLoadingData(false);
    }
  }, [identityId, identityVisibility]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* ----- Grant ------------------------------------------------- */
  const handleGrantConsent = async (app: AvailableAppInfo) => {
    if (!identityId) return;
    setIsGranting(app.id);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(`/api/identities/${identityId}/consents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appId: app.id, grantedScopes: DEFAULT_SCOPES }), // ■ changed here
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(
          text || `Failed to grant consent: ${response.statusText}`
        );
      }
      setSuccessMessage(`Access granted to ${app.name}.`);
      await fetchData();
    } catch (err) {
      if (err instanceof Error)
        setError(
          err.message ||
            `An unexpected error occurred while granting access to ${app.name}.`
        );
    } finally {
      setIsGranting(null);
    }
  };

  /* ----- Revoke ------------------------------------------------ */
  const handleRevokeConsent = async (app: GrantedAppInfo) => {
    if (!app.consentId) return;
    setIsRevoking(app.consentId);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(`/api/consents/${app.consentId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(
          text || `Failed to revoke consent: ${response.statusText}`
        );
      }
      setSuccessMessage(`Access revoked from ${app.name}.`);
      await fetchData();
    } catch (err) {
      if (err instanceof Error)
        setError(
          err.message ||
            `An unexpected error occurred while revoking access from ${app.name}.`
        );
    } finally {
      setIsRevoking(null);
    }
  };

  /* ----- Timed messages --------------------------------------- */
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (successMessage) timer = setTimeout(() => setSuccessMessage(null), 5000);
    if (error) timer = setTimeout(() => setError(null), 7000);
    return () => clearTimeout(timer);
  }, [successMessage, error]);

  /* ----- UI helpers ------------------------------------------- */
  if (identityVisibility !== "PRIVATE") return null;

  const renderAppCard = (
    app: GrantedAppInfo | AvailableAppInfo,
    type: "granted" | "available"
  ) => {
    const isGranted = type === "granted" && (app as GrantedAppInfo).consentId;
    const appName = app.name || "Unnamed App";
    const description =
      "description" in app && app.description
        ? app.description
        : isGranted
        ? `Granted scopes: ${(app as GrantedAppInfo).grantedScopes.join(", ")}`
        : "Connect this application to your identity.";

    return (
      <Card key={app.id} className="w-full">
        <CardHeader className="flex flex-row items-start gap-4 space-y-0">
          <Avatar className="h-12 w-12">
            <AvatarImage
              src={app.logoUrl || undefined}
              alt={`${appName} logo`}
            />
            <AvatarFallback>
              {appName.substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <CardTitle>{appName}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </CardHeader>
        <CardFooter className="flex justify-end">
          {isGranted ? (
            <Button
              variant="destructive"
              onClick={() => handleRevokeConsent(app as GrantedAppInfo)}
              disabled={
                isRevoking === (app as GrantedAppInfo).consentId || !!isGranting
              }
            >
              {isRevoking === (app as GrantedAppInfo).consentId
                ? "Revoking…"
                : "Revoke Access"}
            </Button>
          ) : (
            <Button
              onClick={() => handleGrantConsent(app as AvailableAppInfo)}
              disabled={isGranting === app.id || !!isRevoking}
            >
              {isGranting === app.id ? "Granting…" : "Grant Access"}
            </Button>
          )}
        </CardFooter>
      </Card>
    );
  };

  const renderSkeletonCard = (key: number) => (
    <Card key={key} className="w-full">
      <CardHeader className="flex flex-row items-start gap-4 space-y-0">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </CardHeader>
      <CardFooter className="flex justify-end">
        <Skeleton className="h-10 w-24" />
      </CardFooter>
    </Card>
  );

  return (
    <div className="space-y-8">
      {successMessage && (
        <Alert className="bg-green-50 border-green-300 text-green-700 dark:bg-green-900/30 dark:border-green-700 dark:text-green-400">
          <CheckCircle2 className="h-4 w-4 text-green-500" />
          <AlertTitle>Success</AlertTitle>
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      )}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div>
        <h2 className="text-xl font-semibold mb-4">
          Applications with Existing Access
        </h2>
        {isLoadingData ? (
          <div className="space-y-4">
            {Array.from({ length: grantedApps.length || 1 }).map((_, i) =>
              renderSkeletonCard(i)
            )}
          </div>
        ) : grantedApps.length ? (
          <div className="space-y-4">
            {grantedApps.map((a) => renderAppCard(a, "granted"))}
          </div>
        ) : (
          <p className="text-muted-foreground">
            No applications currently have access to this identity.
          </p>
        )}
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4">Available Applications</h2>
        {isLoadingData ? (
          <div className="space-y-4">
            {Array.from({ length: availableApps.length || 2 }).map((_, i) =>
              renderSkeletonCard(i)
            )}
          </div>
        ) : availableApps.length ? (
          <div className="space-y-4">
            {availableApps.map((a) => renderAppCard(a, "available"))}
          </div>
        ) : (
          <p className="text-muted-foreground">
            No new applications available to connect at this time.
          </p>
        )}
      </div>
    </div>
  );
}
