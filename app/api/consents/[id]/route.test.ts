import { DELETE } from './route'; // Adjust path as necessary
import { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import prisma from '@/lib/prisma';

// Mock next-auth/jwt
jest.mock('next-auth/jwt');
const mockGetToken = getToken as jest.Mock;

// Mock prisma
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    consent: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    identity: { // Also mock identity for ownership check via identity
      findUnique: jest.fn(),
    }
  },
}));

// Helper to create a mock NextRequest
const mockRequest = (method: string, options: { params?: any; url?: string } = {}) => {
  const { params, url = 'http://localhost/api/consents/test-consent-id' } = options;
  const req = new NextRequest(new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
  }));
  return { req, params: params || {} };
};

describe('/api/consents/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default mock for getToken to return an authenticated user
    mockGetToken.mockResolvedValue({ sub: 'test-user-id' });
  });

  describe('DELETE', () => {
    const consentId = 'test-consent-id';
    const userId = 'test-user-id';
    const identityId = 'associated-identity-id';

    it('should successfully soft delete a consent owned directly by the user', async () => {
      const mockConsent = { 
        id: consentId, 
        userId: userId, // User directly owns the consent
        identityId: null, 
        identity: null 
      };
      (prisma.consent.findUnique as jest.Mock).mockResolvedValue(mockConsent);
      (prisma.consent.update as jest.Mock).mockResolvedValue({ ...mockConsent, revokedAt: new Date() });

      const { req, params } = mockRequest('DELETE', { params: { id: consentId } });
      const response = await DELETE(req, { params });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(prisma.consent.findUnique).toHaveBeenCalledWith({
        where: { id: consentId },
        include: { identity: true },
      });
      expect(prisma.consent.update).toHaveBeenCalledWith({
        where: { id: consentId },
        data: { revokedAt: expect.any(Date) },
      });
      expect(body.message).toBe('Consent revoked successfully');
    });

    it('should successfully soft delete a consent if user owns the associated identity', async () => {
      const mockConsent = { 
        id: consentId, 
        userId: 'another-user-id', // Consent owned by someone else
        identityId: identityId,
        identity: { id: identityId, userId: userId } // But current user owns the identity
      };
      // Mock for the initial consent find
      (prisma.consent.findUnique as jest.Mock).mockResolvedValue(mockConsent);
      // Mock for the identity check (though it's included in the above, let's be explicit if direct call happens)
      // (prisma.identity.findUnique as jest.Mock).mockResolvedValue({ id: identityId, userId: userId });
      (prisma.consent.update as jest.Mock).mockResolvedValue({ ...mockConsent, revokedAt: new Date() });

      const { req, params } = mockRequest('DELETE', { params: { id: consentId } });
      const response = await DELETE(req, { params });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(prisma.consent.findUnique).toHaveBeenCalledWith({
        where: { id: consentId },
        include: { identity: true },
      });
      // No need to check prisma.identity.findUnique separately if the include works as expected for auth logic
      expect(prisma.consent.update).toHaveBeenCalledWith({
        where: { id: consentId },
        data: { revokedAt: expect.any(Date) },
      });
      expect(body.message).toBe('Consent revoked successfully');
    });
    
    it('should return 401 if user is not authenticated', async () => {
      mockGetToken.mockResolvedValue(null);
      const { req, params } = mockRequest('DELETE', { params: { id: consentId } });
      const response = await DELETE(req, { params });
      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.message).toBe('Authentication required');
    });

    it('should return 404 if consent is not found', async () => {
      (prisma.consent.findUnique as jest.Mock).mockResolvedValue(null);
      const { req, params } = mockRequest('DELETE', { params: { id: consentId } });
      const response = await DELETE(req, { params });
      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.message).toBe('Consent not found');
    });

    it('should return 403 if user is not authorized (does not own consent or associated identity)', async () => {
      const mockConsent = { 
        id: consentId, 
        userId: 'another-user-id', 
        identityId: identityId,
        identity: { id: identityId, userId: 'yet-another-user-id' } // User owns neither
      };
      (prisma.consent.findUnique as jest.Mock).mockResolvedValue(mockConsent);
      // (prisma.identity.findUnique as jest.Mock).mockResolvedValue({ id: identityId, userId: 'yet-another-user-id' });


      const { req, params } = mockRequest('DELETE', { params: { id: consentId } });
      const response = await DELETE(req, { params });
      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.message).toBe('User not authorized to delete this consent');
      expect(prisma.consent.update).not.toHaveBeenCalled();
    });
    
    it('should return 403 if consent has no identity and user does not own consent', async () => {
        const mockConsent = { 
          id: consentId, 
          userId: 'another-user-id', // User does not own consent
          identityId: null,
          identity: null // No associated identity
        };
        (prisma.consent.findUnique as jest.Mock).mockResolvedValue(mockConsent);
  
        const { req, params } = mockRequest('DELETE', { params: { id: consentId } });
        const response = await DELETE(req, { params });
        expect(response.status).toBe(403);
        const body = await response.json();
        expect(body.message).toBe('User not authorized to delete this consent');
        expect(prisma.consent.update).not.toHaveBeenCalled();
      });

    it('should handle errors during prisma update', async () => {
        const mockConsent = { 
            id: consentId, 
            userId: userId, 
            identityId: null, 
            identity: null 
        };
        (prisma.consent.findUnique as jest.Mock).mockResolvedValue(mockConsent);
        (prisma.consent.update as jest.Mock).mockRejectedValue(new Error('Prisma update failed'));

        const { req, params } = mockRequest('DELETE', { params: { id: consentId } });
        const response = await DELETE(req, { params });
        const body = await response.json();

        expect(response.status).toBe(500);
        expect(body.message).toBe('Internal server error');
    });
  });
});
