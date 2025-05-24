'use client';

import { useState, useCallback } from 'react'; // Added useCallback
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal, Copy, Check } from "lucide-react"; // Added Copy and Check icons

interface ApiKeyManagerProps {
  appId: string;
  appName: string;
}

export default function ApiKeyManager({ appId, appName }: ApiKeyManagerProps) {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiKeyCopied, setApiKeyCopied] = useState(false); // Renamed from 'copied' for clarity
  const [appIdCopied, setAppIdCopied] = useState(false); // New state for App ID copy feedback

  const handleCopyAppId = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(appId);
      setAppIdCopied(true);
      setTimeout(() => setAppIdCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy App ID:", err);
      // Optionally set an error state specific to App ID copy
    }
  }, [appId]);

  const handleGenerateKey = async () => {
    setIsLoading(true);
    setError(null);
    setApiKey(null);
    setApiKeyCopied(false); // Reset API key copied state

    try {
      const response = await fetch(`/api/apps/${appId}/keys`, {
        method: 'POST',
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate API key');
      }

      setApiKey(data.apiKey);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const copyApiKeyToClipboard = useCallback(() => {
    if (apiKey) {
      navigator.clipboard.writeText(apiKey)
        .then(() => {
          setApiKeyCopied(true);
          setTimeout(() => setApiKeyCopied(false), 2000);
        })
        .catch(() => {
          setError('Failed to copy API key. Please copy it manually.');
        });
    }
  }, [apiKey]);

  return (
    <div className="space-y-6">
      <div>
        <Label htmlFor="appName">Application Name</Label>
        <Input id="appName" type="text" value={appName} readOnly disabled className="mt-1 bg-muted/50" />
      </div>

      {/* Display App ID */}
      <div>
        <Label htmlFor="displayedAppId">App ID</Label>
        <div className="flex items-center space-x-2 mt-1">
          <Input
            id="displayedAppId"
            type="text"
            value={appId}
            readOnly
            className="font-mono bg-muted/50 flex-grow"
          />
          <Button variant="outline" size="icon" onClick={handleCopyAppId} title="Copy App ID" className="flex-shrink-0">
            {appIdCopied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
            <span className="sr-only">Copy App ID</span>
          </Button>
        </div>
      </div>

      <Button onClick={handleGenerateKey} disabled={isLoading} className="w-full sm:w-auto">
        {isLoading ? 'Generating Key...' : (apiKey ? 'Regenerate API Key' : 'Generate API Key')}
      </Button>

      {/* Display error from API key generation or general copy error */}
      {error && !apiKey && ( // Only show general error if no API key is present (i.e., error is not from API key copy failure)
        <Alert variant="destructive">
          <Terminal className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {apiKey && (
        <div className="space-y-3">
           <Alert variant="default">
            <Terminal className="h-4 w-4" />
            <AlertTitle className="font-semibold text-orange-600 dark:text-orange-400">
                Important: API Key Generated
            </AlertTitle>
            <AlertDescription>
                Your new API key has been generated. Please copy it now.
                For security reasons, <strong>it will not be shown again.</strong>
                Store it in a safe place.
            </AlertDescription>
          </Alert>

          <div className="space-y-1">
            <Label htmlFor="apiKey">Generated API Key</Label>
            <div className="flex items-center space-x-2">
              <Input id="apiKey" type="text" value={apiKey} readOnly className="font-mono flex-grow" />
              <Button onClick={copyApiKeyToClipboard} variant="outline" className="flex-shrink-0">
                {apiKeyCopied ? (
                    <><Check className="mr-2 h-4 w-4 text-green-500" />Copied!</>
                ) : (
                    <><Copy className="mr-2 h-4 w-4" />Copy Key</>
                )}
              </Button>
            </div>
          </div>
          {error && apiKey && ( // Show error related to API key copy if API key is present
             <Alert variant="destructive" className="mt-2">
                <Terminal className="h-4 w-4" />
                <AlertTitle>Copy Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>
      )}
    </div>
  );
}
