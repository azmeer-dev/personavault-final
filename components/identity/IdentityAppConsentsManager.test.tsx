import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import IdentityAppConsentsManager from './IdentityAppConsentsManager'; // Adjust path as necessary

// Mock fetch
global.fetch = jest.fn();

// Mock UI components that are not essential for the logic tests
jest.mock('@/components/ui/skeleton', () => ({
  Skeleton: ({ children, ...props }: any) => <div data-testid="skeleton" {...props}>{children}</div>,
}));
jest.mock('lucide-react', () => ({
  AlertCircle: () => <div data-testid="icon-alert-circle" />,
  CheckCircle2: () => <div data-testid="icon-check-circle" />,
}));

const mockGrantedApps = [
  { id: 'app-g1', name: 'Granted App 1', logoUrl: null, consentId: 'consent-g1', grantedScopes: ['read'], grantedAt: new Date().toISOString(), description: 'Granted App 1 Description' },
];
const mockAvailableApps = [
  { id: 'app-a1', name: 'Available App 1', logoUrl: null, description: 'Available App 1 Description' },
  { id: 'app-a2', name: 'Available App 2', logoUrl: null, description: 'Available App 2 Description' },
];

const mockUserId = 'user-123';
const mockIdentityId = 'identity-123';

describe('IdentityAppConsentsManager', () => {
  beforeEach(() => {
    (fetch as jest.Mock).mockClear();
    jest.useFakeTimers(); // For auto-dismissal of messages
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  const renderComponent = (visibility: string, initialFetchSuccess = true) => {
    if (initialFetchSuccess) {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ grantedApps: mockGrantedApps, availableApps: mockAvailableApps }),
      });
    } else {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: 'Failed to fetch initial data' }),
      });
    }
    return render(
      <IdentityAppConsentsManager
        identityId={mockIdentityId}
        userId={mockUserId}
        identityVisibility={visibility}
      />
    );
  };

  it('renders nothing if identityVisibility is not PRIVATE', () => {
    const { container } = renderComponent('PUBLIC');
    expect(container.firstChild).toBeNull();
  });

  it('renders correctly when identityVisibility is PRIVATE', async () => {
    renderComponent('PRIVATE');
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(`/api/identities/${mockIdentityId}/consents`);

    await waitFor(() => {
      expect(screen.getByText('Applications with Existing Access')).toBeInTheDocument();
      expect(screen.getByText('Granted App 1')).toBeInTheDocument();
      expect(screen.getByText('Available Applications')).toBeInTheDocument();
      expect(screen.getByText('Available App 1')).toBeInTheDocument();
    });
  });

  it('shows loading skeletons during initial data fetch', async () => {
    (fetch as jest.Mock).mockImplementationOnce(() => new Promise(() => {})); // Keep promise pending
    renderComponent('PRIVATE');
    // Expect multiple skeletons for apps
    await waitFor(() => {
        expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(1)
    });
  });
  
  it('displays error message if initial fetch fails', async () => {
    renderComponent('PRIVATE', false);
    await waitFor(() => {
      expect(screen.getByText('Error')).toBeInTheDocument();
      expect(screen.getByText('Failed to fetch initial data')).toBeInTheDocument();
    });
  });

  it('displays "no applications" messages when lists are empty', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ grantedApps: [], availableApps: [] }),
    });
    render(
      <IdentityAppConsentsManager
        identityId={mockIdentityId}
        userId={mockUserId}
        identityVisibility="PRIVATE"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('No applications currently have access to this identity.')).toBeInTheDocument();
      expect(screen.getByText('No new applications available to connect at this time.')).toBeInTheDocument();
    });
  });

  describe('Granting Consent', () => {
    it('handles successful consent grant', async () => {
      renderComponent('PRIVATE');
      await waitFor(() => expect(screen.getByText('Available App 1')).toBeInTheDocument());

      // Mock the POST request for granting
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'new-consent', appId: 'app-a1', scopes: ['identity.read'] }),
      });
      // Mock the subsequent GET request (fetchData re-fetch)
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ 
          grantedApps: [...mockGrantedApps, { ...mockAvailableApps[0], consentId: 'new-consent', grantedScopes: ['identity.read'], grantedAt: new Date().toISOString() }],
          availableApps: [mockAvailableApps[1]], // app-a1 is now granted
        }),
      });
      
      const grantButton = screen.getByRole('button', { name: /Grant access to Available App 1/i });
      fireEvent.click(grantButton);

      expect(grantButton).toBeDisabled();
      expect(screen.getByText('Granting...')).toBeInTheDocument();

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(`/api/identities/${mockIdentityId}/consents`, expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ appId: 'app-a1', scopes: ['identity.read'] }),
        }));
      });
      
      await waitFor(() => {
        expect(screen.getByText('Success')).toBeInTheDocument();
        expect(screen.getByText('Access granted to Available App 1.')).toBeInTheDocument();
      });

      // Check if UI updated (app moved from available to granted)
      await waitFor(() => {
        // Available App 1 should now be in granted apps list
        const grantedAppCards = screen.getByText('Applications with Existing Access').closest('div');
        expect(grantedAppCards).toHaveTextContent('Available App 1'); 
        // And removed from available apps
        const availableAppCards = screen.getByText('Available Applications').closest('div');
        expect(availableAppCards).not.toHaveTextContent('Available App 1');
      });

      // Test success message auto-dismissal
      act(() => { jest.advanceTimersByTime(5000); });
      await waitFor(() => {
        expect(screen.queryByText('Access granted to Available App 1.')).not.toBeInTheDocument();
      });
    });

    it('handles failed consent grant', async () => {
        renderComponent('PRIVATE');
        await waitFor(() => expect(screen.getByText('Available App 1')).toBeInTheDocument());
  
        // Mock the POST request for granting to fail
        (fetch as jest.Mock).mockResolvedValueOnce({
          ok: false,
          json: async () => ({ message: 'Granting failed' }),
        });
        // No need to mock fetchData for this one as it won't be called on failure before error
        
        const grantButton = screen.getByRole('button', { name: /Grant access to Available App 1/i });
        fireEvent.click(grantButton);
  
        await waitFor(() => {
          expect(fetch).toHaveBeenCalledWith(`/api/identities/${mockIdentityId}/consents`, expect.objectContaining({ method: 'POST' }));
        });
        
        await waitFor(() => {
          expect(screen.getByText('Error')).toBeInTheDocument();
          expect(screen.getByText('Granting failed')).toBeInTheDocument();
          expect(grantButton).not.toBeDisabled(); // Button should be re-enabled
        });
  
        // Test error message auto-dismissal (longer timeout)
        act(() => { jest.advanceTimersByTime(7000); });
        await waitFor(() => {
          expect(screen.queryByText('Granting failed')).not.toBeInTheDocument();
        });
      });
  });

  describe('Revoking Consent', () => {
    it('handles successful consent revocation', async () => {
      renderComponent('PRIVATE');
      await waitFor(() => expect(screen.getByText('Granted App 1')).toBeInTheDocument());

      // Mock the DELETE request
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Consent revoked' }),
      });
      // Mock the subsequent GET request (fetchData re-fetch)
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ 
          grantedApps: [], // Granted App 1 is now revoked
          availableApps: [...mockAvailableApps, { id: 'app-g1', name: 'Granted App 1', logoUrl: null, description: 'Granted App 1 Description' }], // app-g1 is now available
        }),
      });
      
      const revokeButton = screen.getByRole('button', { name: /Revoke access from Granted App 1/i });
      fireEvent.click(revokeButton);

      expect(revokeButton).toBeDisabled();
      expect(screen.getByText('Revoking...')).toBeInTheDocument();

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(`/api/consents/${mockGrantedApps[0].consentId}`, expect.objectContaining({
          method: 'DELETE',
        }));
      });
      
      await waitFor(() => {
        expect(screen.getByText('Success')).toBeInTheDocument();
        expect(screen.getByText('Access revoked from Granted App 1.')).toBeInTheDocument();
      });

       // Check if UI updated (app moved from granted to available)
       await waitFor(() => {
        const grantedAppCards = screen.getByText('Applications with Existing Access').closest('div');
        expect(grantedAppCards).not.toHaveTextContent('Granted App 1'); 
        
        const availableAppCards = screen.getByText('Available Applications').closest('div');
        expect(availableAppCards).toHaveTextContent('Granted App 1');
      });
    });

    it('handles failed consent revocation', async () => {
        renderComponent('PRIVATE');
        await waitFor(() => expect(screen.getByText('Granted App 1')).toBeInTheDocument());
  
        (fetch as jest.Mock).mockResolvedValueOnce({
          ok: false,
          json: async () => ({ message: 'Revocation failed' }),
        });
        
        const revokeButton = screen.getByRole('button', { name: /Revoke access from Granted App 1/i });
        fireEvent.click(revokeButton);
  
        await waitFor(() => {
          expect(fetch).toHaveBeenCalledWith(`/api/consents/${mockGrantedApps[0].consentId}`, expect.objectContaining({ method: 'DELETE' }));
        });
        
        await waitFor(() => {
          expect(screen.getByText('Error')).toBeInTheDocument();
          expect(screen.getByText('Revocation failed')).toBeInTheDocument();
          expect(revokeButton).not.toBeDisabled();
        });
      });
  });
});
