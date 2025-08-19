'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Info, AlertTriangle, CheckCircle, Loader2, ShieldCheck } from 'lucide-react';

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
  description?: string | null;
}

interface GrantedConsent {
  id: string;
  identityId: string;
  identity: {
    id: string;
    identityLabel: string;
    profilePictureUrl?: string | null;
    category?: string | null;
  };
}

export default function UserAppConsentGranter() {
  const [connectableApps, setConnectableApps] = useState<ConnectableApp[]>([]);
  const [userPrivateIdentities, setUserPrivateIdentities] = useState<UserPrivateIdentity[]>([]);
  const [grantedConsents, setGrantedConsents] = useState<GrantedConsent[]>([]);

  const [selectedAppId, setSelectedAppId] = useState<string>('');
  const [selectedIdentityIds, setSelectedIdentityIds] = useState<string[]>([]);
  const selectedScopes = ['identity.read'];

  const [isLoadingApps, setIsLoadingApps] = useState(true);
  const [isLoadingIdentities, setIsLoadingIdentities] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Load apps on mount
  useEffect(() => {
    (async () => {
      setIsLoadingApps(true);
      try {
        const res = await fetch('/api/apps/connectable');
        if (!res.ok) throw new Error('Failed to fetch apps');
        const data: ConnectableApp[] = await res.json();
        setConnectableApps(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error fetching apps');
      } finally {
        setIsLoadingApps(false);
      }
    })();
  }, []);

  // Load identities + consents when app changes
  useEffect(() => {
    if (!selectedAppId) {
      setUserPrivateIdentities([]);
      setGrantedConsents([]);
      setSelectedIdentityIds([]);
      return;
    }

    (async () => {
      setIsLoadingIdentities(true);
      setError(null);
      setSuccessMessage(null);
      setSelectedIdentityIds([]);
      try {
        const [identitiesRes, consentsRes] = await Promise.all([
          fetch(`/api/users/me/identities?visibility=PRIVATE&appId=${selectedAppId}`),
          fetch(`/api/users/me/consents?appId=${selectedAppId}`),
        ]);
        if (!identitiesRes.ok) throw new Error('Failed to fetch identities');
        if (!consentsRes.ok) throw new Error('Failed to fetch consents');

        const identities: UserPrivateIdentity[] = await identitiesRes.json();
        const consents: GrantedConsent[] = await consentsRes.json();
        setUserPrivateIdentities(identities);
        setGrantedConsents(consents);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error loading identities/consents');
      } finally {
        setIsLoadingIdentities(false);
      }
    })();
  }, [selectedAppId]);

  const handleIdentitySelection = (identityId: string) => {
    setSelectedIdentityIds(prev =>
      prev.includes(identityId) ? prev.filter(id => id !== identityId) : [...prev, identityId]
    );
  };

  const handleGrant = async () => {
    if (!selectedAppId || selectedIdentityIds.length === 0) {
      setError('Please select an application and at least one identity.');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const res = await fetch('/api/users/me/consents/batch-grant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appId: selectedAppId,
          identityIds: selectedIdentityIds,
          scopes: selectedScopes,
        }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt);
      }
      setSuccessMessage(`${selectedIdentityIds.length} consent(s) granted successfully`);
      setSelectedIdentityIds([]);

      // Refresh both lists
      const [identities, consents] = await Promise.all([
        fetch(`/api/users/me/identities?visibility=PRIVATE&appId=${selectedAppId}`).then(r => r.json()),
        fetch(`/api/users/me/consents?appId=${selectedAppId}`).then(r => r.json()),
      ]);
      setUserPrivateIdentities(identities);
      setGrantedConsents(consents);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error granting consent');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevoke = async (consentId: string) => {
    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const res = await fetch(`/api/users/me/consents/${consentId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to revoke consent');
      setSuccessMessage('Consent revoked successfully');

      // Refresh both lists
      const [identities, consents] = await Promise.all([
        fetch(`/api/users/me/identities?visibility=PRIVATE&appId=${selectedAppId}`).then(r => r.json()),
        fetch(`/api/users/me/consents?appId=${selectedAppId}`).then(r => r.json()),
      ]);
      setUserPrivateIdentities(identities);
      setGrantedConsents(consents);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error revoking consent');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedAppDetails = connectableApps.find(app => app.id === selectedAppId);

  return (
    <div className="space-y-6">
      {/* App selection */}
      <div className="space-y-2">
        <Label className="text-lg font-medium">1. Select an Application</Label>
        <Select value={selectedAppId} onValueChange={setSelectedAppId} disabled={isLoadingApps}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder={isLoadingApps ? 'Loading apps...' : 'Choose an application'} />
          </SelectTrigger>
          <SelectContent>
            {connectableApps.map(app => (
              <SelectItem key={app.id} value={app.id}>
                <div className="flex items-center space-x-2">
                  <Avatar className="h-6 w-6 border">
                    <AvatarImage src={app.logoUrl ?? undefined} />
                    <AvatarFallback>{app.name[0]}</AvatarFallback>
                  </Avatar>
                  {app.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedAppDetails && (
          <Card className="mt-2 p-4 bg-muted/30 flex items-center space-x-3">
            <Avatar className="h-10 w-10 border">
              <AvatarImage src={selectedAppDetails.logoUrl ?? undefined} />
              <AvatarFallback>{selectedAppDetails.name.slice(0, 2)}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold text-sm">{selectedAppDetails.name}</p>
              {selectedAppDetails.description && (
                <p className="text-xs text-muted-foreground">{selectedAppDetails.description}</p>
              )}
            </div>
          </Card>
        )}
      </div>

      {/* Grant identities */}
      {selectedAppId && (
        <div className="space-y-2">
          <Label className="text-lg font-medium">2. Grant Access</Label>
          {isLoadingIdentities ? (
            <Skeleton className="h-10 w-full" />
          ) : userPrivateIdentities.length === 0 ? (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>No private identities</AlertTitle>
              <AlertDescription>All of your private identities are already connected to this app.</AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-2 border p-3 rounded-md max-h-60 overflow-y-auto">
              {userPrivateIdentities.map(identity => (
                <div key={identity.id} className="flex items-center space-x-3 p-2 hover:bg-muted rounded-md">
                  <Checkbox
                    id={`identity-${identity.id}`}
                    checked={selectedIdentityIds.includes(identity.id)}
                    onCheckedChange={() => handleIdentitySelection(identity.id)}
                  />
                  <Avatar className="h-8 w-8 border">
                    <AvatarImage src={identity.profilePictureUrl ?? undefined} />
                    <AvatarFallback>{identity.identityLabel[0]}</AvatarFallback>
                  </Avatar>
                  <Label htmlFor={`identity-${identity.id}`} className="flex-grow cursor-pointer">
                    <span className="font-medium">{identity.identityLabel}</span>
                    {identity.category && <span className="text-xs text-muted-foreground ml-2">({identity.category})</span>}
                    {identity.description && <p className="text-xs text-muted-foreground">{identity.description}</p>}
                  </Label>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Already granted */}
      {selectedAppId && grantedConsents.length > 0 && (
        <div className="space-y-2">
          <Label className="text-lg font-medium">3. Already Granted</Label>
          {grantedConsents.map(consent => (
            <div key={consent.id} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
              <div className="flex items-center space-x-3">
                <Avatar className="h-8 w-8 border">
                  <AvatarImage src={consent.identity.profilePictureUrl ?? undefined} />
                  <AvatarFallback>{consent.identity.identityLabel[0]}</AvatarFallback>
                </Avatar>
                <span>{consent.identity.identityLabel}</span>
              </div>
              <Button size="sm" variant="destructive" onClick={() => handleRevoke(consent.id)} disabled={isSubmitting}>
                Revoke
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Scopes */}
      {selectedAppId && (
        <Card className="p-4 bg-muted/30">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="h-5 w-5 text-green-600" />
            <p className="text-sm font-medium">Read access to profile</p>
          </div>
          <p className="text-xs text-muted-foreground ml-7">
            This app will be able to read selected identities’ profile info. (Scope: {selectedScopes.join(', ')})
          </p>
        </Card>
      )}

      {/* Alerts */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {successMessage && (
        <Alert >
          <CheckCircle className="h-4 w-4" />
          <AlertTitle>Success</AlertTitle>
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      )}

      {/* Grant button */}
      {selectedAppId && (
        <Button
          onClick={handleGrant}
          disabled={isSubmitting || selectedIdentityIds.length === 0}
          className="w-full sm:w-auto mt-4"
        >
          {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Working...</> : 'Grant Access to Selected Identities'}
        </Button>
      )}
    </div>
  );
}
