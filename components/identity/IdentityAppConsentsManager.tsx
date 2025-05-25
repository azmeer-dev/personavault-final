'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton'; // For loading states
import { AlertCircle, CheckCircle2 } from 'lucide-react';

interface IdentityAppConsentsManagerProps {
  identityId: string;
  userId: string; // For potential client-side checks, though API is authoritative
  identityVisibility: string;
}

// Define types for the app objects based on what your API returns
interface GrantedAppInfo {
  id: string; // App ID
  name: string;
  logoUrl?: string | null;
  description?: string | null;
  consentId: string; // Consent ID
  grantedScopes: string[];
  grantedAt: string; // Assuming ISO string date
}

interface AvailableAppInfo {
  id: string; // App ID
  name: string;
  logoUrl?: string | null;
  description?: string | null;
}

const DEFAULT_SCOPES = ["identity.read"]; // Default scopes for granting consent

export default function IdentityAppConsentsManager({ identityId, userId, identityVisibility }: IdentityAppConsentsManagerProps) {
  const [grantedApps, setGrantedApps] = useState<GrantedAppInfo[]>([]);
  const [availableApps, setAvailableApps] = useState<AvailableAppInfo[]>([]);
  
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isGranting, setIsGranting] = useState<string | null>(null); // appId of app being granted
  const [isRevoking, setIsRevoking] = useState<string | null>(null); // consentId of app being revoked

  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (identityVisibility !== 'PRIVATE' || !identityId) {
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
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to fetch consents: ${response.statusText}`);
      }
      const data = await response.json();
      setGrantedApps(data.grantedApps || []);
      setAvailableApps(data.availableApps || []);
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred while fetching app consents.');
      setGrantedApps([]);
      setAvailableApps([]);
    } finally {
      setIsLoadingData(false);
    }
  }, [identityId, identityVisibility]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleGrantConsent = async (app: AvailableAppInfo) => {
    if (!identityId) return;
    setIsGranting(app.id);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(`/api/identities/${identityId}/consents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appId: app.id, scopes: DEFAULT_SCOPES }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to grant consent: ${response.statusText}`);
      }
      // const newConsent = await response.json();
      setSuccessMessage(`Access granted to ${app.name}.`);
      await fetchData(); // Refresh data
    } catch (err: any) {
      setError(err.message || `An unexpected error occurred while granting access to ${app.name}.`);
    } finally {
      setIsGranting(null);
    }
  };

  const handleRevokeConsent = async (app: GrantedAppInfo) => {
    if (!app.consentId) return;
    setIsRevoking(app.consentId);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(`/api/consents/${app.consentId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to revoke consent: ${response.statusText}`);
      }
      setSuccessMessage(`Access revoked from ${app.name}.`);
      await fetchData(); // Refresh data
    } catch (err: any) {
      setError(err.message || `An unexpected error occurred while revoking access from ${app.name}.`);
    } finally {
      setIsRevoking(null);
    }
  };

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (successMessage) {
      timer = setTimeout(() => setSuccessMessage(null), 5000);
    }
    if (error) {
        timer = setTimeout(() => setError(null), 7000);
    }
    return () => clearTimeout(timer);
  }, [successMessage, error]);


  if (identityVisibility !== 'PRIVATE') {
    return null;
  }

  const renderAppCard = (app: GrantedAppInfo | AvailableAppInfo, type: 'granted' | 'available') => {
    const isGrantedType = (a: any): a is GrantedAppInfo => type === 'granted' && a.consentId;
    const appDetails = isGrantedType(app) ? app : (app as AvailableAppInfo);
    
    const appName = appDetails.name || 'Unnamed App';
    const appDescription = (appDetails as any).description || (isGrantedType(app) ? `Granted scopes: ${app.grantedScopes.join(', ')}` : 'Connect this application to your identity.');


    return (
      <Card key={appDetails.id} className="w-full">
        <CardHeader className="flex flex-row items-start gap-4 space-y-0">
          <Avatar className="h-12 w-12">
            <AvatarImage src={appDetails.logoUrl || undefined} alt={`${appName} logo`} />
            <AvatarFallback>{appName.substring(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <CardTitle>{appName}</CardTitle>
            <CardDescription>{appDescription}</CardDescription>
          </div>
        </CardHeader>
        <CardFooter className="flex justify-end">
          {isGrantedType(app) ? (
            <Button
              variant="destructive"
              onClick={() => handleRevokeConsent(app)}
              disabled={isRevoking === app.consentId || !!isGranting}
              aria-label={`Revoke access from ${appName}`}
            >
              {isRevoking === app.consentId ? 'Revoking...' : 'Revoke Access'}
            </Button>
          ) : (
            <Button
              variant="default"
              onClick={() => handleGrantConsent(app as AvailableAppInfo)}
              disabled={isGranting === app.id || !!isRevoking}
              aria-label={`Grant access to ${appName}`}
            >
              {isGranting === app.id ? 'Granting...' : 'Grant Access'}
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
        <Alert variant="default" className="bg-green-50 border-green-300 text-green-700 dark:bg-green-900/30 dark:border-green-700 dark:text-green-400">
          <CheckCircle2 className="h-4 w-4 !text-green-500" />
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
        <h2 className="text-xl font-semibold mb-4">Applications with Existing Access</h2>
        {isLoadingData ? (
          <div className="space-y-4">
            {Array.from({ length: grantedApps.length || 1 }).map((_, i) => renderSkeletonCard(i))}
          </div>
        ) : grantedApps.length > 0 ? (
          <div className="space-y-4">
            {grantedApps.map(app => renderAppCard(app, 'granted'))}
          </div>
        ) : (
          <p className="text-muted-foreground">No applications currently have access to this identity.</p>
        )}
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4">Available Applications</h2>
        {isLoadingData ? (
          <div className="space-y-4">
             {Array.from({ length: availableApps.length || 2 }).map((_, i) => renderSkeletonCard(i))}
          </div>
        ) : availableApps.length > 0 ? (
          <div className="space-y-4">
            {availableApps.map(app => renderAppCard(app, 'available'))}
          </div>
        ) : (
          <p className="text-muted-foreground">No new applications available to connect at this time.</p>
        )}
      </div>
    </div>
  );
}
