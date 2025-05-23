'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label'; // Added for better form structure
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"; // Added for important messages
import { Terminal } from "lucide-react"; // For Alert icon

interface ApiKeyManagerProps {
  appId: string;
  appName: string;
}

export default function ApiKeyManager({ appId, appName }: ApiKeyManagerProps) {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleGenerateKey = async () => {
    setIsLoading(true);
    setError(null);
    setApiKey(null);
    setCopied(false); // Reset copied state

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

  const copyToClipboard = () => {
    if (apiKey) {
      navigator.clipboard.writeText(apiKey)
        .then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000); // Reset after 2s
        })
        .catch(() => {
          setError('Failed to copy API key. Please copy it manually.');
        });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <Label htmlFor="appName">Application Name</Label>
        <Input id="appName" type="text" value={appName} readOnly disabled className="mt-1" />
      </div>

      <Button onClick={handleGenerateKey} disabled={isLoading} className="w-full sm:w-auto">
        {isLoading ? 'Generating Key...' : (apiKey ? 'Regenerate API Key' : 'Generate API Key')}
      </Button>

      {error && (
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
              <Button onClick={copyToClipboard} variant="outline" className="flex-shrink-0">
                {copied ? 'Copied!' : 'Copy Key'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
