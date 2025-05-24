'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { ExternalLink, ShieldAlert, ShieldCheck, Info, Trash2, Loader2 } from 'lucide-react'; // Icons

// Type definitions based on expected API response
interface AppInfo {
  id: string;
  name: string;
  logoUrl?: string | null;
  websiteUrl?: string | null;
  description?: string | null;
}

interface IdentityInfo {
  id: string;
  identityLabel: string;
  profilePictureUrl?: string | null;
  category?: string | null;
}

interface ConsentWithDetails {
  id: string;
  app: AppInfo;
  identity?: IdentityInfo | null;
  grantedScopes: string[];
  grantedAt: string; // ISO Date string
  expiresAt?: string | null; // ISO Date string
  lastUsedAt?: string | null; // ISO Date string
}

// Helper to format dates
const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return 'N/A';
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch (e) {
    return 'Invalid Date';
  }
};

export default function UserConsentsManager() {
  const [consents, setConsents] = useState<ConsentWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revokeStatus, setRevokeStatus] = useState<{ [key: string]: { loading: boolean; error: string | null } }>({});

  const fetchConsents = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/users/me/consents');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to fetch consents: ${response.statusText}`);
      }
      const data: ConsentWithDetails[] = await response.json();
      setConsents(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConsents();
  }, [fetchConsents]);

  const handleRevoke = async (consentId: string) => {
    setRevokeStatus(prev => ({ ...prev, [consentId]: { loading: true, error: null } }));
    try {
      const response = await fetch(`/api/users/me/consents/${consentId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to revoke consent: ${response.statusText}`);
      }
      // Optimistic update or refetch
      setConsents(prevConsents => prevConsents.filter(c => c.id !== consentId));
      // Optionally, show a success toast/alert here
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred while revoking';
      setRevokeStatus(prev => ({ ...prev, [consentId]: { loading: false, error: errorMessage } }));
    } 
    // No finally here, as we want to keep the error message until another action
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <div className="flex items-center space-x-3">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="space-y-1">
                  <Skeleton className="h-4 w-[200px]" />
                  <Skeleton className="h-3 w-[150px]" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </CardContent>
            <CardFooter>
              <Skeleton className="h-10 w-[120px]" />
            </CardFooter>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>Error Fetching Consents</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (consents.length === 0) {
    return (
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>No Active Consents</AlertTitle>
        <AlertDescription>You have not granted access to any applications or identities yet.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {consents.map(consent => (
        <Card key={consent.id} className="overflow-hidden">
          <CardHeader className="bg-muted/30 p-4">
            <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                    <Avatar className="h-12 w-12 border">
                    <AvatarImage src={consent.app.logoUrl ?? undefined} alt={consent.app.name} />
                    <AvatarFallback>{consent.app.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div>
                    <CardTitle className="text-lg">{consent.app.name}</CardTitle>
                    {consent.app.websiteUrl && (
                        <a
                        href={consent.app.websiteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center"
                        >
                        Visit Website <ExternalLink className="ml-1 h-3 w-3" />
                        </a>
                    )}
                    </div>
                </div>
                {consent.identity && (
                    <div className="flex items-center space-x-2 text-sm text-muted-foreground border p-2 rounded-md bg-background">
                        <Avatar className="h-6 w-6">
                            <AvatarImage src={consent.identity.profilePictureUrl ?? undefined} alt={consent.identity.identityLabel} />
                            <AvatarFallback>{consent.identity.identityLabel.substring(0,1)}</AvatarFallback>
                        </Avatar>
                        <span>{consent.identity.identityLabel} ({consent.identity.category})</span>
                    </div>
                )}
            </div>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            {consent.app.description && (
                <p className="text-sm text-muted-foreground">{consent.app.description}</p>
            )}
            <div>
              <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-1">Permissions Granted:</h4>
              <div className="flex flex-wrap gap-1">
                {consent.grantedScopes.length > 0 ? consent.grantedScopes.map(scope => (
                  <Badge key={scope} variant="secondary">{scope}</Badge>
                )) : <Badge variant="outline">No specific scopes</Badge>}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-muted-foreground">
                <div><strong className="text-foreground">Granted:</strong> {formatDate(consent.grantedAt)}</div>
                <div><strong className="text-foreground">Expires:</strong> {formatDate(consent.expiresAt)}</div>
                <div><strong className="text-foreground">Last Used:</strong> {formatDate(consent.lastUsedAt)}</div>
            </div>
          </CardContent>
          <CardFooter className="bg-muted/30 p-4 flex flex-col sm:flex-row items-center justify-between">
            <div className="w-full sm:w-auto mb-2 sm:mb-0">
              {revokeStatus[consent.id]?.error && (
                <Alert variant="destructive" className="p-2 text-xs">
                  <ShieldAlert className="h-3 w-3 mr-1 inline-block" />
                  <AlertDescription>{revokeStatus[consent.id]?.error}</AlertDescription>
                </Alert>
              )}
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => handleRevoke(consent.id)}
              disabled={revokeStatus[consent.id]?.loading}
              className="w-full sm:w-auto"
            >
              {revokeStatus[consent.id]?.loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Revoke Access
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
