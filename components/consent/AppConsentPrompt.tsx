'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
// Card components are not used in the final conceptual structure, but keeping them for potential future use.
// import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-react';

// Define interfaces for props based on what /authorize-app/page.tsx passes
interface AppDetails {
  id: string;
  name: string;
  logoUrl?: string | null;
  description?: string | null;
}

interface IdentityDetails {
  id: string;
  identityLabel: string;
  profilePictureUrl?: string | null;
  category?: string | null; // category is provided by the server component
  description?: string | null; // description is provided
}

interface AppConsentPromptProps {
  app: AppDetails;
  identity: IdentityDetails;
  requestedScopes: string[];
  rawSearchParamsString?: string; // Retained, though not used in this version
}

export default function AppConsentPrompt({ app, identity, requestedScopes }: AppConsentPromptProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{type: 'success' | 'error' | 'info'; message: string} | null>(null);
  const [actionTaken, setActionTaken] = useState(false);

  const handleAllow = useCallback(async () => {
    setIsSubmitting(true);
    setFeedbackMessage(null);
    try {
      const response = await fetch('/api/users/me/consents/batch-grant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appId: app.id,
          identityIds: [identity.id], // Correctly pass as an array
          scopes: requestedScopes,
        }),
      });
      const responseData = await response.json();
      if (!response.ok) {
        throw new Error(responseData.error || 'Failed to grant consent.');
      }
      setFeedbackMessage({type: 'success', message: responseData.message || `Access granted to ${app.name} for identity ${identity.identityLabel}. You can now return to the application or close this page.`});
      setActionTaken(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unknown error occurred.';
      setFeedbackMessage({type: 'error', message});
    } finally {
      setIsSubmitting(false);
    }
  }, [app, identity, requestedScopes]);

  const handleDeny = useCallback(() => {
    // For Deny, we can set a brief loading state for visual consistency if desired
    setIsSubmitting(true); 
    setFeedbackMessage(null); // Clear previous messages

    // Simulate a brief delay or directly set message
    setTimeout(() => {
        setFeedbackMessage({type: 'info', message: `Access to identity '${identity.identityLabel}' for application '${app.name}' has been denied. You can close this page.`});
        setActionTaken(true);
        setIsSubmitting(false);
    }, 300); // Short delay to make UX feel responsive
  }, [app, identity]);


  return (
    <div className="space-y-6 rounded-lg border bg-card text-card-foreground shadow-sm p-6"> {/* Added Card-like styling to the container */}
      {/* App Information */}
      <div className="flex items-center space-x-4 pb-4 border-b">
        <Avatar className="h-16 w-16 border">
          <AvatarImage src={app.logoUrl ?? undefined} alt={`${app.name} logo`} />
          <AvatarFallback className="text-lg">{app.name?.substring(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div>
          <h2 className="text-xl font-semibold">{app.name}</h2>
          {app.description && <p className="text-sm text-muted-foreground">{app.description}</p>}
        </div>
      </div>

      {/* Request Details */}
      <p className="text-base leading-relaxed">
        The application <strong className="text-primary">{app.name}</strong> is requesting permission to access your identity: <strong className="text-primary">{identity.identityLabel}</strong>
        {identity.category && <span className="text-muted-foreground"> ({identity.category})</span>}.
      </p>
      {identity.description && (
        <p className="text-sm text-muted-foreground italic">
           Identity description: &quot;{identity.description}&quot;
        </p>
      )}


      {/* Requested Permissions */}
      <div>
        <h3 className="text-md font-semibold mb-2">Permissions being requested:</h3>
        <div className="flex flex-wrap gap-2">
          {requestedScopes.length > 0 ? (
            requestedScopes.map(scope => <Badge key={scope} variant="secondary" className="text-sm px-3 py-1">{scope}</Badge>)
          ) : (
            <Badge variant="outline">No specific scopes requested.</Badge>
          )}
        </div>
      </div>
      
      {/* Action Buttons and Feedback */}
      <div className="pt-4 space-y-4">
        {!actionTaken && (
          <div className="flex flex-col sm:flex-row sm:space-x-4 space-y-2 sm:space-y-0">
            <Button onClick={handleAllow} disabled={isSubmitting} className="flex-1 py-3 text-base"> {/* Increased padding and text size */}
              {isSubmitting ? (
                <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Processing...</> 
              ) : (
                <><CheckCircle className="mr-2 h-5 w-5" /> Allow Access</>
              )}
            </Button>
            <Button variant="outline" onClick={handleDeny} disabled={isSubmitting} className="flex-1 py-3 text-base"> {/* Increased padding and text size */}
              {isSubmitting ? (
                 <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Processing...</>
              ) : (
                <><XCircle className="mr-2 h-5 w-5" /> Deny Access</>
              )}
            </Button>
          </div>
        )}

        {feedbackMessage && (
          <Alert 
            variant={feedbackMessage.type === 'error' ? 'destructive' : feedbackMessage.type === 'success' ? 'default' : 'default'}
            className={feedbackMessage.type === 'success' ? 'bg-green-50 border-green-300 text-green-700 dark:bg-green-900/30 dark:border-green-700 dark:text-green-400' : ''}
          >
            {feedbackMessage.type === 'success' && <CheckCircle className="h-4 w-4" />}
            {feedbackMessage.type === 'error' && <AlertTriangle className="h-4 w-4" />}
            {feedbackMessage.type === 'info' && <Info className="h-4 w-4" />}
            <AlertTitle className="font-semibold">{feedbackMessage.type.charAt(0).toUpperCase() + feedbackMessage.type.slice(1)}</AlertTitle>
            <AlertDescription>{feedbackMessage.message}</AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
}
