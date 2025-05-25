import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import IdentityForm, { IdentityFormProps } from './IdentityForm'; // Adjust path
import { IdentityFormValues, identityVisibilityOptions } from '@/types/types'; // Assuming types are accessible

// Mock IdentityAppConsentsManager
jest.mock('@/components/identity/IdentityAppConsentsManager', () => ({
  __esModule: true,
  default: jest.fn(({ identityId, userId, identityVisibility }) => (
    <div data-testid="mock-consents-manager">
      MockConsentsManager - Identity: {identityId}, User: {userId}, Visibility: {identityVisibility}
    </div>
  )),
}));

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    refresh: jest.fn(),
  }),
}));

// Mock sonner
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock fetch for form submission (optional, can prevent submit)
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
  } as Response)
);

const defaultProps: IdentityFormProps = {
  userId: 'test-user-id',
  accounts: [
    { id: 'acc1', provider: 'google', emailFromProvider: 'test@google.com' },
    { id: 'acc2', provider: 'github', emailFromProvider: 'test@github.com' },
  ],
  initialValues: { identityLabel: 'Test Identity', visibility: 'PRIVATE' }, // Default to PRIVATE for some tests
  identityId: 'existing-identity-id', // Default to existing identity
  onSuccess: jest.fn(),
};

const renderForm = (props?: Partial<IdentityFormProps>) => {
  return render(<IdentityForm {...defaultProps} {...props} />);
};

describe('IdentityForm - Application Consents Section', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows Application Consents section with manager for an existing PRIVATE identity', async () => {
    renderForm({ 
        identityId: 'private-id', 
        initialValues: { ...defaultProps.initialValues, visibility: 'PRIVATE' } 
    });

    // Open the accordion
    const accordionTrigger = screen.getByText('Application Consents');
    expect(accordionTrigger).toBeInTheDocument();
    fireEvent.click(accordionTrigger);
    
    await waitFor(() => {
      const consentsManager = screen.getByTestId('mock-consents-manager');
      expect(consentsManager).toBeInTheDocument();
      expect(consentsManager).toHaveTextContent('MockConsentsManager - Identity: private-id, User: test-user-id, Visibility: PRIVATE');
    });
  });

  it('shows message instead of manager for an existing PUBLIC identity', async () => {
    renderForm({ 
        identityId: 'public-id', 
        initialValues: { ...defaultProps.initialValues, visibility: 'PUBLIC' } 
    });
    
    const accordionTrigger = screen.getByText('Application Consents');
    expect(accordionTrigger).toBeInTheDocument();
    fireEvent.click(accordionTrigger);

    await waitFor(() => {
      expect(screen.queryByTestId('mock-consents-manager')).not.toBeInTheDocument();
      expect(screen.getByText(/Application consents are only available for identities with 'PRIVATE' visibility/)).toBeInTheDocument();
    });
  });

  it('does NOT show Application Consents section when creating a new identity (no identityId)', () => {
    renderForm({ identityId: undefined, initialValues: { visibility: 'PRIVATE' } });
    expect(screen.queryByText('Application Consents')).not.toBeInTheDocument();
  });

  it('dynamically shows manager when visibility changes from PUBLIC to PRIVATE for an existing identity', async () => {
    renderForm({ 
        identityId: 'dynamic-id', 
        initialValues: { ...defaultProps.initialValues, visibility: 'PUBLIC' } 
    });

    const accordionTrigger = screen.getByText('Application Consents');
    expect(accordionTrigger).toBeInTheDocument();
    fireEvent.click(accordionTrigger); // Open consents accordion

    await waitFor(() => {
      expect(screen.getByText(/Application consents are only available for identities with 'PRIVATE' visibility/)).toBeInTheDocument();
    });

    // Find the visibility radio group and change it
    // The RadioGroup itself doesn't have a direct label, we find it by its items.
    // Assuming 'PRIVATE' and 'PUBLIC' are labels for RadioGroupItems
    const visibilityFieldset = screen.getByText('Visibility').closest('fieldset') || screen.getByText('Visibility').closest('div'); // More robust query
    if (!visibilityFieldset) throw new Error("Visibility fieldset not found");

    const privateRadio = within(visibilityFieldset).getByLabelText('PRIVATE');
    fireEvent.click(privateRadio);

    await waitFor(() => {
      const consentsManager = screen.getByTestId('mock-consents-manager');
      expect(consentsManager).toBeInTheDocument();
      expect(consentsManager).toHaveTextContent('MockConsentsManager - Identity: dynamic-id, User: test-user-id, Visibility: PRIVATE');
      expect(screen.queryByText(/Application consents are only available for identities with 'PRIVATE' visibility/)).not.toBeInTheDocument();
    });
  });

  it('dynamically shows message when visibility changes from PRIVATE to PUBLIC for an existing identity', async () => {
    renderForm({ 
        identityId: 'dynamic-id-2', 
        initialValues: { ...defaultProps.initialValues, visibility: 'PRIVATE' } 
    });

    const accordionTrigger = screen.getByText('Application Consents');
    expect(accordionTrigger).toBeInTheDocument();
    fireEvent.click(accordionTrigger); // Open consents accordion
    
    await waitFor(() => {
      const consentsManager = screen.getByTestId('mock-consents-manager');
      expect(consentsManager).toBeInTheDocument();
      expect(consentsManager).toHaveTextContent('Visibility: PRIVATE');
    });

    // Find the visibility radio group and change it
    const visibilityFieldset = screen.getByText('Visibility').closest('fieldset') || screen.getByText('Visibility').closest('div');
    if (!visibilityFieldset) throw new Error("Visibility fieldset not found");
    
    const publicRadio = within(visibilityFieldset).getByLabelText('PUBLIC');
    fireEvent.click(publicRadio);

    await waitFor(() => {
      expect(screen.queryByTestId('mock-consents-manager')).not.toBeInTheDocument();
      expect(screen.getByText(/Application consents are only available for identities with 'PRIVATE' visibility/)).toBeInTheDocument();
    });
  });
});
