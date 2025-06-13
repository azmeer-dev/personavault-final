'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card'; // Re-added Card for potential inner structure
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Info, AlertTriangle, CheckCircle, Loader2, ShieldCheck } from 'lucide-react';

// Types based on API responses
interface ConnectableApp {
  id: string;
  name: string;
  logoUrl?: string | null;
  description?: string | null;
}

interface UserPrivateIdentity {
  id: string;
  identityLabel: string;
  profilePictureUrl?: string | null;
  category?: string | null;
  description?: string | null; // Added for more context
}

export default function UserAppConsentGranter() {
  const [connectableApps, setConnectableApps] = useState<ConnectableApp[]>([]);
  const [userPrivateIdentities, setUserPrivateIdentities] = useState<UserPrivateIdentity[]>([]);
  
  const [selectedAppId, setSelectedAppId] = useState<string>('');
  const [selectedIdentityIds, setSelectedIdentityIds] = useState<string[]>([]);
  const selectedScopes = ["identity.read"]; // Hardcoded for now

  const [isLoadingApps, setIsLoadingApps] = useState(true);
  const [isLoadingIdentities, setIsLoadingIdentities] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Fetch connectable apps on mount
  useEffect(() => {
    const fetchApps = async () => {
      setIsLoadingApps(true);
      setError(null);
      try {
        const response = await fetch('/api/apps/connectable');
        if (!response.ok) throw new Error(`Failed to fetch apps: ${response.statusText}`);
        const data: ConnectableApp[] = await response.json();
        setConnectableApps(data);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error fetching apps.";
        setError(msg);
        console.error(msg);
      } finally {
        setIsLoadingApps(false);
      }
    };
    fetchApps();
  }, []);

  // Fetch user's private identities when an app is selected
  useEffect(() => {
    if (!selectedAppId) {
      setUserPrivateIdentities([]); // Clear identities if no app is selected
      setSelectedIdentityIds([]); // Clear selected identities
      return;
    }

    const fetchIdentities = async () => {
      setIsLoadingIdentities(true);
      setError(null); // Clear previous errors
      setSuccessMessage(null); // Clear previous success messages
      setSelectedIdentityIds([]); // Clear selected identities when app changes
      try {
        const response = await fetch(`/api/users/me/identities?visibility=PRIVATE&appId=${selectedAppId}`);
        if (!response.ok) throw new Error(`Failed to fetch identities: ${response.statusText}`);
        const data: UserPrivateIdentity[] = await response.json();
        setUserPrivateIdentities(data);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error fetching identities.";
        setError(msg);
        console.error(msg);
      } finally {
        setIsLoadingIdentities(false);
      }
    };
    fetchIdentities();
  }, [selectedAppId]);

  const handleIdentitySelection = (identityId: string) => {
    setSelectedIdentityIds(prev =>
      prev.includes(identityId) ? prev.filter(id => id !== identityId) : [...prev, identityId]
    );
  };

  const handleSubmit = async () => {
    if (!selectedAppId || selectedIdentityIds.length === 0 || selectedScopes.length === 0) {
      setError("Please select an application, at least one identity, and ensure scopes are defined.");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);

  try {
    const response = await fetch('/api/users/me/consents/batch-grant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appId: selectedAppId,
        identityIds: selectedIdentityIds,
        scopes: selectedScopes,
      }),
    });

    const text = await response.text();
    let responseData;
    try {
      responseData = text ? JSON.parse(text) : {}; // safe fallback
    } catch (err) {
      throw new Error("Invalid JSON response from server." + err);
    }

    if (!response.ok) {
      throw new Error(responseData?.error || `Server error: ${response.status}`);
    }

    setSuccessMessage(responseData?.message || `${selectedIdentityIds.length} consent(s) granted successfully!`);
    setSelectedIdentityIds([]);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error during submission.";
    setError(msg);
    console.error(msg);
  } finally {
    setIsSubmitting(false);
  }
};
  
  const selectedAppDetails = connectableApps.find(app => app.id === selectedAppId);

  return (
    <div className="space-y-6">
      {/* App Selection */}
      <div className="space-y-2">
        <Label htmlFor="app-select" className="text-lg font-medium">1. Select an Application</Label>
        <Select onValueChange={setSelectedAppId} value={selectedAppId} disabled={isLoadingApps}>
          <SelectTrigger id="app-select" className="w-full">
            <SelectValue placeholder={isLoadingApps ? "Loading apps..." : "Choose an application"} />
          </SelectTrigger>
          <SelectContent>
            {connectableApps.map(app => (
              <SelectItem key={app.id} value={app.id}>
                <div className="flex items-center space-x-2 py-1">
                  <Avatar className="h-6 w-6 border">
                    <AvatarImage src={app.logoUrl ?? undefined} alt={app.name} />
                    <AvatarFallback>{app.name.substring(0, 1)}</AvatarFallback>
                  </Avatar>
                  <span>{app.name}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedAppDetails && (
            <Card className="mt-2 p-4 bg-muted/30">
                <div className="flex items-center space-x-3">
                    <Avatar className="h-10 w-10 border">
                        <AvatarImage src={selectedAppDetails.logoUrl ?? undefined} alt={selectedAppDetails.name} />
                        <AvatarFallback>{selectedAppDetails.name.substring(0,2)}</AvatarFallback>
                    </Avatar>
                    <div>
                        <p className="font-semibold text-sm">{selectedAppDetails.name}</p>
                        {selectedAppDetails.description && <p className="text-xs text-muted-foreground">{selectedAppDetails.description}</p>}
                    </div>
                </div>
            </Card>
        )}
      </div>

      {/* Identity Selection (Conditional) */}
      {selectedAppId && (
        <div className="space-y-2">
          <Label className="text-lg font-medium">2. Select Private Identities to Connect</Label>
          {isLoadingIdentities ? (
            <div className="space-y-2">
              {[1, 2].map(i => <Skeleton key={i} className="h-10 w-full rounded-md" />)}
            </div>
          ) : userPrivateIdentities.length === 0 ? (
            <Alert variant="default">
              <Info className="h-4 w-4" />
              <AlertTitle>No Private Identities</AlertTitle>
              <AlertDescription>You do not have any private identities to connect with this application.</AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto border p-3 rounded-md bg-background">
              {userPrivateIdentities.map(identity => (
                <div
                  key={identity.id}
                  className="flex items-center space-x-3 p-2 rounded-md hover:bg-muted transition-colors"
                >
                  <Checkbox
                    id={`identity-${identity.id}`}
                    checked={selectedIdentityIds.includes(identity.id)}
                    onCheckedChange={() => handleIdentitySelection(identity.id)}
                  />
                  <Avatar className="h-8 w-8 border">
                    <AvatarImage src={identity.profilePictureUrl ?? undefined} alt={identity.identityLabel} />
                    <AvatarFallback>{identity.identityLabel.substring(0, 1)}</AvatarFallback>
                  </Avatar>
                  <Label htmlFor={`identity-${identity.id}`} className="flex-grow cursor-pointer">
                    <span className="font-medium">{identity.identityLabel}</span>
                    {identity.category && <span className="text-xs text-muted-foreground ml-2">({identity.category})</span>}
                    {identity.description && <p className="text-xs text-muted-foreground line-clamp-1">{identity.description}</p>}
                  </Label>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Scope Selection (Conditional) */}
      {selectedAppId && (
        <div className="space-y-2">
          <Label className="text-lg font-medium">3. Permissions to be Granted</Label>
          <Card className="p-4 bg-muted/30">
             <div className="flex items-center space-x-2">
                <ShieldCheck className="h-5 w-5 text-green-600" />
                <p className="text-sm font-medium">Read Access to Profile</p>
             </div>
            <p className="text-xs text-muted-foreground ml-7">
              The application will be able to read the profile information of the selected identities.
              (Scope: <code>{selectedScopes.join(', ')}</code>)
            </p>
          </Card>
        </div>
      )}

      {/* Feedback Messages */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {successMessage && (
        <Alert variant="default" className="bg-green-50 border-green-300 text-green-700 dark:bg-green-900/30 dark:border-green-700 dark:text-green-400">
          <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-500" />
          <AlertTitle>Success</AlertTitle>
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      )}

      {/* Grant Button */}
      {selectedAppId && (
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting || selectedIdentityIds.length === 0 || isLoadingApps || isLoadingIdentities}
          className="w-full sm:w-auto mt-4"
        >
          {isSubmitting ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Granting Access...</>
          ) : (
            'Grant Access to Selected Identities'
          )}
        </Button>
      )}
    </div>
  );
}
