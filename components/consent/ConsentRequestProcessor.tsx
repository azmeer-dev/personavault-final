'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { ExternalLink, ShieldAlert, Info, CheckCircle2, XCircle, Loader2 } from 'lucide-react'; // Icons

// Type definitions based on expected API response
interface AppInfo {
  id: string;
  name: string;
  logoUrl?: string | null;
  description?: string | null;
  websiteUrl?: string | null;
}

interface IdentityInfo {
  id: string;
  identityLabel: string;
  profilePictureUrl?: string | null;
  category?: string | null;
}

interface ConsentRequestWithDetails {
  id: string;
  app: AppInfo;
  identity?: IdentityInfo | null; // Identity is optional on ConsentRequest
  requestedScopes: string[];
  contextDescription?: string | null;
  createdAt: string; // ISO Date string
  // other fields like status, targetUserId are not directly displayed but exist
}

interface ProcessingState {
  action: 'approving' | 'rejecting' | null;
  error: string | null;
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
  } catch  {
    return 'Invalid Date';
  }
};

export default function ConsentRequestProcessor() {
  const [requests, setRequests] = useState<ConsentRequestWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingStates, setProcessingStates] = useState<{ [key: string]: ProcessingState }>({});

  const fetchRequests = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/users/me/consent-requests');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to fetch consent requests: ${response.statusText}`);
      }
      const data: ConsentRequestWithDetails[] = await response.json();
      setRequests(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(errorMessage);
      setRequests([]); // Clear requests on error
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const processRequest = async (requestId: string, action: 'approve' | 'reject') => {
    setProcessingStates(prev => ({
      ...prev,
      [requestId]: { action: action === 'approve' ? 'approving' : 'rejecting', error: null }
    }));

    try {
      const response = await fetch(`/api/consent-requests/${requestId}/${action}`, {
        method: 'POST',
      });
      const responseData = await response.json(); // Try to get response data for error or success
      if (!response.ok) {
        throw new Error(responseData.error || `Failed to ${action} request: ${response.statusText}`);
      }
      // Success: remove from list and clear processing state for this item
      setRequests(prevRequests => prevRequests.filter(r => r.id !== requestId));
      setProcessingStates(prev => {
        const newState = { ...prev };
        delete newState[requestId];
        return newState;
      });
      // Optionally: show a global success toast/alert here
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : `An unknown error occurred during ${action}`;
      setProcessingStates(prev => ({
        ...prev,
        [requestId]: { action: null, error: errorMessage }
      }));
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(2)].map((_, i) => (
          <Card key={i}>
            <CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center space-x-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <Skeleton className="h-4 w-[150px]" />
              </div>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
            </CardContent>
            <CardFooter className="flex justify-end space-x-2">
              <Skeleton className="h-10 w-24" />
              <Skeleton className="h-10 w-24" />
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
        <AlertTitle>Error Fetching Requests</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (requests.length === 0) {
    return (
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>No Pending Requests</AlertTitle>
        <AlertDescription>You have no pending consent requests to review at this time.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {requests.map(request => {
        const currentProcessingState = processingStates[request.id];
        const isProcessing = currentProcessingState?.action === 'approving' || currentProcessingState?.action === 'rejecting';

        return (
          <Card key={request.id} className="overflow-hidden">
            <CardHeader className="bg-muted/30 p-4">
                <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                        <Avatar className="h-12 w-12 border">
                        <AvatarImage src={request.app.logoUrl ?? undefined} alt={request.app.name} />
                        <AvatarFallback>{request.app.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div>
                        <CardTitle className="text-lg">{request.app.name}</CardTitle>
                        {request.app.websiteUrl && (
                            <a
                            href={request.app.websiteUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center"
                            >
                            Visit Website <ExternalLink className="ml-1 h-3 w-3" />
                            </a>
                        )}
                        </div>
                    </div>
                     {request.identity && (
                        <div className="flex items-center space-x-2 text-sm text-muted-foreground border p-2 rounded-md bg-background">
                            <Avatar className="h-6 w-6">
                                <AvatarImage src={request.identity.profilePictureUrl ?? undefined} alt={request.identity.identityLabel} />
                                <AvatarFallback>{request.identity.identityLabel.substring(0,1)}</AvatarFallback>
                            </Avatar>
                            <span>For: {request.identity.identityLabel} ({request.identity.category})</span>
                        </div>
                    )}
                </div>

            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {request.app.description && (
                <p className="text-sm text-muted-foreground italic">&quot;{request.app.description}&quot;</p>
              )}
              {request.contextDescription && (
                <p className="text-sm"><strong className="font-medium">Reason for request:</strong> {request.contextDescription}</p>
              )}
              <div>
                <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-1">Requested Permissions:</h4>
                <div className="flex flex-wrap gap-1">
                  {request.requestedScopes.length > 0 ? request.requestedScopes.map(scope => (
                    <Badge key={scope} variant="secondary">{scope}</Badge>
                  )) : <Badge variant="outline">No specific scopes requested</Badge>}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Requested on: {formatDate(request.createdAt)}
              </p>
            </CardContent>
            <CardFooter className="bg-muted/30 p-4 flex flex-col items-stretch space-y-2">
              {currentProcessingState?.error && (
                <Alert variant="destructive" className="p-2 text-xs mb-2">
                    <ShieldAlert className="h-3 w-3 mr-1 inline-block" />
                    <AlertDescription>{currentProcessingState.error}</AlertDescription>
                </Alert>
              )}
              <div className="flex flex-col sm:flex-row sm:justify-end sm:space-x-2 space-y-2 sm:space-y-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => processRequest(request.id, 'reject')}
                  disabled={isProcessing}
                  className="w-full sm:w-auto"
                >
                  {currentProcessingState?.action === 'rejecting' ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <XCircle className="mr-2 h-4 w-4" />
                  )}
                  Reject
                </Button>
                <Button
                  size="sm"
                  onClick={() => processRequest(request.id, 'approve')}
                  disabled={isProcessing}
                  className="w-full sm:w-auto"
                >
                  {currentProcessingState?.action === 'approving' ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                  )}
                  Approve
                </Button>
              </div>
            </CardFooter>
          </Card>
        );
      })}
    </div>
  );
}
