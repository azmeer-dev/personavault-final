'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ExternalLink,
  ShieldAlert,
  Info,
  CheckCircle2,
  XCircle,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface AppInfo {
  id: string;
  name: string;
  logoUrl?: string | null;
  description?: string | null;
  websiteUrl?: string | null;
}

interface UserInfo {
  id: string;
  globalDisplayName?: string | null;
  globalProfileImage?: string | null;
  legalFullName?: string | null;
}

interface IdentityInfo {
  id: string;
  identityLabel: string;
  profilePictureUrl?: string | null;
  category?: string | null;
}

interface ConsentRequestWithDetails {
  id: string;
  app: AppInfo | null;
  requestingUser: UserInfo | null;
  identity?: IdentityInfo | null;
  requestedScopes: string[];
  contextDescription?: string | null;
  createdAt: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
}

interface ProcessingState {
  action: 'approving' | 'rejecting' | null;
  error: string | null;
}

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
  } catch {
    return 'Invalid Date';
  }
};

export default function ConsentRequestProcessor() {
  const [requests, setRequests] = useState<ConsentRequestWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingStates, setProcessingStates] = useState<
    Record<string, ProcessingState>
  >({});
  const [activeTab, setActiveTab] = useState<'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');

  const fetchRequests = useCallback(
    async (status: 'PENDING' | 'APPROVED' | 'REJECTED') => {
      setIsLoading(true);
      setError(null);
      setRequests([]);
      try {
        const response = await fetch(`/api/users/me/consent-requests?status=${status}`);
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Failed to fetch: ${response.statusText}`);
        }
        const data: ConsentRequestWithDetails[] = await response.json();
        setRequests(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchRequests(activeTab);
  }, [fetchRequests, activeTab]);

  const processRequest = async (
    requestId: string,
    action: 'approve' | 'reject'
  ) => {
    setProcessingStates((prev) => ({
      ...prev,
      [requestId]: {
        action: action === 'approve' ? 'approving' : 'rejecting',
        error: null,
      },
    }));

    try {
      const response = await fetch(`/api/consent-requests/${requestId}/${action}`, {
        method: 'POST',
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || response.statusText);
      setRequests((prev) => prev.filter((r) => r.id !== requestId));
      setProcessingStates((prev) => {
        const next = { ...prev };
        delete next[requestId];
        return next;
      });
      toast.success(`Request ${action}ed.`);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : `Error during ${action}`;
      toast.error(message);
      setProcessingStates((prev) => ({
        ...prev,
        [requestId]: { action: null, error: message },
      }));
    }
  };

  const renderRequestList = (items: ConsentRequestWithDetails[]) => {
    if (items.length === 0) {
      return (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>No Requests</AlertTitle>
          <AlertDescription>
            There are no {activeTab.toLowerCase()} consent requests.
          </AlertDescription>
        </Alert>
      );
    }

    return (
      <div className="space-y-4">
        {items.map((request) => {
          const state = processingStates[request.id];
          const working =
            state?.action === 'approving' || state?.action === 'rejecting';

          const displayName = request.app?.name ?? request.requestingUser?.globalDisplayName ?? request.requestingUser?.legalFullName ??'Unknown';
          const displayImage = request.app?.logoUrl ?? request.requestingUser?.globalProfileImage ?? undefined;

          return (
            <Card key={request.id} className="overflow-hidden">
              <CardHeader className="bg-muted/30 p-4">
                <div className="flex items-start justify-between">
                  {(request.app || request.requestingUser) && (
                    <div className="flex items-center space-x-3">
                      <Avatar className="h-12 w-12 border">
                        <AvatarImage
                          src={displayImage}
                          alt={displayName}
                        />
                        <AvatarFallback>
                          {displayName.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <CardTitle className="text-lg">{displayName}</CardTitle>
                        {request.app?.websiteUrl && (
                          <a
                            href={request.app.websiteUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-muted-foreground hover:text-primary inline-flex items-center"
                          >
                            Visit Website <ExternalLink className="ml-1 h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                  {request.identity && (
                    <div className="flex items-center space-x-2 text-sm text-muted-foreground border p-2 rounded-md bg-background">
                      <Avatar className="h-6 w-6">
                        <AvatarImage
                          src={request.identity.profilePictureUrl ?? undefined}
                          alt={request.identity.identityLabel}
                        />
                        <AvatarFallback>
                          {request.identity.identityLabel[0]}
                        </AvatarFallback>
                      </Avatar>
                      <span>
                        For: {request.identity.identityLabel} ({request.identity.category})
                      </span>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                {request.app?.description && (
                  <p className="text-sm text-muted-foreground italic">
                    &quot;{request.app.description}&quot;
                  </p>
                )}
                {request.contextDescription && (
                  <p className="text-sm">
                    <strong className="font-medium">Reason:</strong> {request.contextDescription}
                  </p>
                )}
                <div>
                  <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-1">
                    Requested Permissions:
                  </h4>
                  <div className="flex flex-wrap gap-1">
                    {request.requestedScopes.length > 0 ? (
                      request.requestedScopes.map((scope) => (
                        <Badge key={scope} variant="secondary">
                          {scope}
                        </Badge>
                      ))
                    ) : (
                      <Badge variant="outline">None</Badge>
                    )}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Requested on: {formatDate(request.createdAt)}
                </p>
                {activeTab !== 'PENDING' && (
                  <p
                    className={`text-xs font-semibold ${
                      request.status === 'APPROVED'
                        ? 'text-green-600'
                        : 'text-red-600'
                    }`}
                  >
                    Status: {request.status}
                  </p>
                )}
              </CardContent>
              {activeTab === 'PENDING' && (
                <CardFooter className="bg-muted/30 p-4 flex flex-col space-y-2">
                  {state?.error && (
                    <Alert variant="destructive" className="p-2 text-xs mb-2">
                      <ShieldAlert className="h-3 w-3 mr-1 inline-block" />
                      <AlertDescription>{state.error}</AlertDescription>
                    </Alert>
                  )}
                  <div className="flex flex-col sm:flex-row sm:justify-end sm:space-x-2 space-y-2 sm:space-y-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => processRequest(request.id, 'reject')}
                      disabled={working}
                      className="w-full sm:w-auto"
                    >
                      {state?.action === 'rejecting' ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <XCircle className="mr-2 h-4 w-4" />
                      )}
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => processRequest(request.id, 'approve')}
                      disabled={working}
                      className="w-full sm:w-auto"
                    >
                      {state?.action === 'approving' ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                      )}
                      Approve
                    </Button>
                  </div>
                </CardFooter>
              )}
            </Card>
          );
        })}
      </div>
    );
  };

  return (
    <Tabs
      value={activeTab}
      onValueChange={(value: string) =>
        setActiveTab(value as 'PENDING' | 'APPROVED' | 'REJECTED')
      }
    >
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="PENDING">Pending</TabsTrigger>
        <TabsTrigger value="APPROVED">Approved</TabsTrigger>
        <TabsTrigger value="REJECTED">Rejected</TabsTrigger>
      </TabsList>

      <TabsContent value="PENDING">
        {isLoading && <Skeleton className="h-20 w-full mt-4" />}
        {!isLoading && !error && renderRequestList(requests)}
        {error && (
          <Alert variant="destructive">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </TabsContent>

      <TabsContent value="APPROVED">
        {isLoading && <Skeleton className="h-20 w-full mt-4" />}
        {!isLoading && !error && renderRequestList(requests)}
        {error && (
          <Alert variant="destructive">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </TabsContent>

      <TabsContent value="REJECTED">
        {isLoading && <Skeleton className="h-20 w-full mt-4" />}
        {!isLoading && !error && renderRequestList(requests)}
        {error && (
          <Alert variant="destructive">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </TabsContent>
    </Tabs>
  );
}
