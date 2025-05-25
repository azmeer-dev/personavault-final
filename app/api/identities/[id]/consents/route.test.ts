import { GET, POST } from './route'; // Adjust path as necessary if tests are in a __tests__ folder
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
    identity: {
      findUnique: jest.fn(),
    },
    app: {
      findMany: jest.fn(),
    },
    consent: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  },
}));

// Helper to create a mock NextRequest
const mockRequest = (method: string, options: { params?: any; json?: any; url?: string } = {}) => {
  const { params, json, url = 'http://localhost/api/identities/test-identity-id/consents' } = options;
  const req = new NextRequest(new Request(url, {
    method,
    ...(json && { body: JSON.stringify(json) }),
    headers: { 'Content-Type': 'application/json' },
  }));
  return { req, params: params || {} };
};


describe('/api/identities/[id]/consents', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default mock for getToken to return an authenticated user
    mockGetToken.mockResolvedValue({ sub: 'test-user-id' });
  });

  describe('GET', () => {
    const identityId = 'test-identity-id';
    const userId = 'test-user-id';

    it('should return granted and available apps for a private identity owned by the user', async () => {
      const mockIdentity = { id: identityId, userId, visibility: 'PRIVATE' }; // Assuming visibility is part of Identity model
      const mockConnectableApps = [
        { id: 'app-1', name: 'App One', description: 'Desc One', logoUrl: 'logo1.png', isSystemApp: false, isAdminApproved: true, isEnabled: true },
        { id: 'app-2', name: 'App Two', description: 'Desc Two', logoUrl: 'logo2.png', isSystemApp: false, isAdminApproved: true, isEnabled: true },
        { id: 'app-3', name: 'App Three', description: 'Desc Three', logoUrl: 'logo3.png', isSystemApp: false, isAdminApproved: true, isEnabled: true },
      ];
      const mockActiveConsents = [
        { 
          id: 'consent-1', 
          identityId, 
          appId: 'app-1', 
          userId, 
          revokedAt: null, 
          grantedScopes: ['scope1'], 
          createdAt: new Date(),
          app: { id: 'app-1', name: 'App One', description: 'Desc One', logoUrl: 'logo1.png' } 
        },
      ];

      (prisma.identity.findUnique as jest.Mock).mockResolvedValue(mockIdentity);
      (prisma.app.findMany as jest.Mock).mockResolvedValue(mockConnectableApps);
      (prisma.consent.findMany as jest.Mock).mockResolvedValue(mockActiveConsents);

      const { req, params } = mockRequest('GET', { params: { id: identityId } });
      const response = await GET(req, { params });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(prisma.identity.findUnique).toHaveBeenCalledWith({ where: { id: identityId } });
      expect(prisma.app.findMany).toHaveBeenCalledWith({
        where: { isSystemApp: false, isAdminApproved: true, isEnabled: true },
        select: { id: true, name: true, description: true, logoUrl: true },
      });
      expect(prisma.consent.findMany).toHaveBeenCalledWith({
        where: { identityId, revokedAt: null },
        include: { app: { select: { id: true, name: true, description: true, logoUrl: true } } },
      });
      
      expect(body.grantedApps).toHaveLength(1);
      expect(body.grantedApps[0].id).toBe('app-1');
      expect(body.grantedApps[0].consentId).toBe('consent-1');
      expect(body.grantedApps[0].name).toBe('App One');
      expect(body.grantedApps[0]).not.toHaveProperty('isSystemApp'); // Ensure sensitive data excluded

      expect(body.availableApps).toHaveLength(2);
      expect(body.availableApps.find((app: any) => app.id === 'app-2')).toBeDefined();
      expect(body.availableApps.find((app: any) => app.id === 'app-3')).toBeDefined();
      expect(body.availableApps[0]).not.toHaveProperty('isSystemApp');
    });

    it('should return 401 if user is not authenticated', async () => {
      mockGetToken.mockResolvedValue(null);
      const { req, params } = mockRequest('GET', { params: { id: identityId } });
      const response = await GET(req, { params });
      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body.message).toBe('Authentication required');
    });

    it('should return 404 if identity is not found', async () => {
      (prisma.identity.findUnique as jest.Mock).mockResolvedValue(null);
      const { req, params } = mockRequest('GET', { params: { id: identityId } });
      const response = await GET(req, { params });
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body.message).toBe('Identity not found or access denied');
    });

    it('should return 404 if identity is not owned by the user', async () => {
      const mockIdentity = { id: identityId, userId: 'another-user-id', visibility: 'PRIVATE' };
      (prisma.identity.findUnique as jest.Mock).mockResolvedValue(mockIdentity);
      
      const { req, params } = mockRequest('GET', { params: { id: identityId } });
      const response = await GET(req, { params });
      const body = await response.json();

      expect(response.status).toBe(404); // or 403, current implementation returns 404
      expect(body.message).toBe('Identity not found or access denied');
    });

    // Note: The API as written doesn't explicitly block non-private identities for GET,
    // as the UI component `IdentityAppConsentsManager` handles this.
    // If API-level restriction for non-private identities is desired for GET, that would be a new requirement.
    // For now, testing the "happy path" for private identities is aligned with current implementation.

    it('should return empty arrays if no apps or consents exist', async () => {
        const mockIdentity = { id: identityId, userId, visibility: 'PRIVATE' };
        (prisma.identity.findUnique as jest.Mock).mockResolvedValue(mockIdentity);
        (prisma.app.findMany as jest.Mock).mockResolvedValue([]); // No connectable apps
        (prisma.consent.findMany as jest.Mock).mockResolvedValue([]); // No active consents
  
        const { req, params } = mockRequest('GET', { params: { id: identityId } });
        const response = await GET(req, { params });
        const body = await response.json();
  
        expect(response.status).toBe(200);
        expect(body.grantedApps).toEqual([]);
        expect(body.availableApps).toEqual([]);
      });

  });

  describe('POST', () => {
    const identityId = 'test-identity-id';
    const userId = 'test-user-id';
    const appId = 'app-to-grant';
    const scopes = ['identity.read'];

    it('should successfully create a consent record', async () => {
      const mockIdentity = { id: identityId, userId, visibility: 'PRIVATE' };
      const mockApp = { id: appId, name: 'App To Grant', isSystemApp: false, isAdminApproved: true, isEnabled: true };
      const mockCreatedConsent = { id: 'new-consent-id', identityId, appId, userId, grantedScopes: scopes, revokedAt: null };

      (prisma.identity.findUnique as jest.Mock).mockResolvedValue(mockIdentity);
      (prisma.app.findUnique as jest.Mock).mockResolvedValue(mockApp);
      (prisma.consent.findFirst as jest.Mock).mockResolvedValue(null); // No existing active consent
      (prisma.consent.create as jest.Mock).mockResolvedValue(mockCreatedConsent);

      const { req, params } = mockRequest('POST', { params: { id: identityId }, json: { appId, scopes } });
      const response = await POST(req, { params });
      const body = await response.json();

      expect(response.status).toBe(201);
      expect(prisma.identity.findUnique).toHaveBeenCalledWith({ where: { id: identityId } });
      expect(prisma.app.findUnique).toHaveBeenCalledWith({ where: { id: appId } });
      expect(prisma.consent.findFirst).toHaveBeenCalledWith({
        where: { userId, appId, identityId, revokedAt: null },
      });
      expect(prisma.consent.create).toHaveBeenCalledWith({
        data: { userId, appId, identityId, grantedScopes: scopes },
      });
      expect(body).toEqual(mockCreatedConsent);
    });

    it('should return 401 if user is not authenticated', async () => {
      mockGetToken.mockResolvedValue(null);
      const { req, params } = mockRequest('POST', { params: { id: identityId }, json: { appId, scopes } });
      const response = await POST(req, { params });
      expect(response.status).toBe(401);
    });

    it('should return 400 if appId or scopes are missing', async () => {
      const { req, params } = mockRequest('POST', { params: { id: identityId }, json: { scopes } }); // Missing appId
      let response = await POST(req, { params });
      expect(response.status).toBe(400);
      let body = await response.json();
      expect(body.message).toBe('Missing appId or scopes in request body');

      const { req: req2, params: params2 } = mockRequest('POST', { params: { id: identityId }, json: { appId } }); // Missing scopes
      response = await POST(req2, { params: params2 });
      expect(response.status).toBe(400);
      body = await response.json();
      expect(body.message).toBe('Missing appId or scopes in request body');
    });
    
    it('should return 404 if identity is not found', async () => {
      (prisma.identity.findUnique as jest.Mock).mockResolvedValue(null);
      const { req, params } = mockRequest('POST', { params: { id: identityId }, json: { appId, scopes } });
      const response = await POST(req, { params });
      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.message).toBe('Identity not found or access denied');
    });

    it('should return 404 if identity is not owned by the user', async () => {
      const mockIdentity = { id: identityId, userId: 'another-user-id' };
      (prisma.identity.findUnique as jest.Mock).mockResolvedValue(mockIdentity);
      const { req, params } = mockRequest('POST', { params: { id: identityId }, json: { appId, scopes } });
      const response = await POST(req, { params });
      expect(response.status).toBe(404); // Or 403, current is 404
      const body = await response.json();
      expect(body.message).toBe('Identity not found or access denied');
    });

    it('should return 404 if app is not found or not connectable', async () => {
      const mockIdentity = { id: identityId, userId, visibility: 'PRIVATE' };
      (prisma.identity.findUnique as jest.Mock).mockResolvedValue(mockIdentity);
      
      // Test app not found
      (prisma.app.findUnique as jest.Mock).mockResolvedValue(null);
      let { req, params } = mockRequest('POST', { params: { id: identityId }, json: { appId, scopes } });
      let response = await POST(req, { params });
      expect(response.status).toBe(404);
      let body = await response.json();
      expect(body.message).toBe('App not found or not connectable');

      // Test app isSystemApp
      (prisma.app.findUnique as jest.Mock).mockResolvedValue({ id: appId, isSystemApp: true, isAdminApproved: true, isEnabled: true });
      response = await POST(req, { params });
      expect(response.status).toBe(404);
      body = await response.json();
      expect(body.message).toBe('App not found or not connectable');

      // Test app not isAdminApproved
      (prisma.app.findUnique as jest.Mock).mockResolvedValue({ id: appId, isSystemApp: false, isAdminApproved: false, isEnabled: true });
      response = await POST(req, { params });
      expect(response.status).toBe(404);
      body = await response.json();
      expect(body.message).toBe('App not found or not connectable');
      
      // Test app not isEnabled
      (prisma.app.findUnique as jest.Mock).mockResolvedValue({ id: appId, isSystemApp: false, isAdminApproved: true, isEnabled: false });
      response = await POST(req, { params });
      expect(response.status).toBe(404);
      body = await response.json();
      expect(body.message).toBe('App not found or not connectable');
    });

    it('should return 409 if an active consent already exists for this app and identity', async () => {
      const mockIdentity = { id: identityId, userId, visibility: 'PRIVATE' };
      const mockApp = { id: appId, name: 'App To Grant', isSystemApp: false, isAdminApproved: true, isEnabled: true };
      const existingConsent = { id: 'existing-consent-id', userId, appId, identityId, revokedAt: null };

      (prisma.identity.findUnique as jest.Mock).mockResolvedValue(mockIdentity);
      (prisma.app.findUnique as jest.Mock).mockResolvedValue(mockApp);
      (prisma.consent.findFirst as jest.Mock).mockResolvedValue(existingConsent);

      const { req, params } = mockRequest('POST', { params: { id: identityId }, json: { appId, scopes } });
      const response = await POST(req, { params });
      const body = await response.json();

      expect(response.status).toBe(409);
      expect(body.message).toBe('Active consent already exists for this app and identity.');
      expect(prisma.consent.create).not.toHaveBeenCalled();
    });
    
    it('should create a new consent if a revoked consent exists', async () => {
        const mockIdentity = { id: identityId, userId, visibility: 'PRIVATE' };
        const mockApp = { id: appId, name: 'App To Grant', isSystemApp: false, isAdminApproved: true, isEnabled: true };
        const revokedConsent = { id: 'revoked-consent-id', userId, appId, identityId, revokedAt: new Date() };
        const mockCreatedConsent = { id: 'new-consent-id', identityId, appId, userId, grantedScopes: scopes, revokedAt: null };

        (prisma.identity.findUnique as jest.Mock).mockResolvedValue(mockIdentity);
        (prisma.app.findUnique as jest.Mock).mockResolvedValue(mockApp);
        // findFirst for active consent returns null
        (prisma.consent.findFirst as jest.Mock).mockImplementation(async (query: any) => {
            if (query.where.revokedAt === null) {
                return null; // No active consent
            }
            return undefined; // Should not be called for other types of queries in this test
        });
        (prisma.consent.create as jest.Mock).mockResolvedValue(mockCreatedConsent);
  
        const { req, params } = mockRequest('POST', { params: { id: identityId }, json: { appId, scopes } });
        const response = await POST(req, { params });
        const body = await response.json();
  
        expect(response.status).toBe(201);
        expect(prisma.consent.create).toHaveBeenCalledWith({
          data: { userId, appId, identityId, grantedScopes: scopes },
        });
        expect(body).toEqual(mockCreatedConsent);
      });
  });
});
