import { useAuthStore } from '../src/store/useAuthStore';
import type { UserProfile } from '../src/store/useAuthStore';

describe('useAuthStore', () => {
  beforeEach(() => {
    useAuthStore.setState({
      session: null,
      user: null,
      profile: null,
      isLoading: true,
      isInitialized: false,
    });
  });

  const mockProfile: UserProfile = {
    id: 'user-123',
    nombre: 'Maria',
    telefono: '0999999999',
    rol: 'pasajero',
  };

  describe('initial state', () => {
    it('should have null session', () => {
      expect(useAuthStore.getState().session).toBeNull();
    });

    it('should have null user', () => {
      expect(useAuthStore.getState().user).toBeNull();
    });

    it('should have null profile', () => {
      expect(useAuthStore.getState().profile).toBeNull();
    });

    it('should have isLoading as true', () => {
      expect(useAuthStore.getState().isLoading).toBe(true);
    });

    it('should have isInitialized as false', () => {
      expect(useAuthStore.getState().isInitialized).toBe(false);
    });
  });

  describe('setSession', () => {
    it('should set session and extract user from it', () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' } as any;
      const mockSession = { user: mockUser, access_token: 'token-abc' } as any;

      useAuthStore.getState().setSession(mockSession);

      const state = useAuthStore.getState();
      expect(state.session).toEqual(mockSession);
      expect(state.user).toEqual(mockUser);
    });

    it('should set user to null when session is null', () => {
      // First set a session
      const mockUser = { id: 'user-123' } as any;
      const mockSession = { user: mockUser } as any;
      useAuthStore.getState().setSession(mockSession);

      // Then clear it
      useAuthStore.getState().setSession(null);

      const state = useAuthStore.getState();
      expect(state.session).toBeNull();
      expect(state.user).toBeNull();
    });
  });

  describe('setProfile', () => {
    it('should set the user profile', () => {
      useAuthStore.getState().setProfile(mockProfile);
      expect(useAuthStore.getState().profile).toEqual(mockProfile);
    });

    it('should set profile to null', () => {
      useAuthStore.getState().setProfile(mockProfile);
      useAuthStore.getState().setProfile(null);
      expect(useAuthStore.getState().profile).toBeNull();
    });
  });

  describe('setLoading', () => {
    it('should set isLoading to false', () => {
      useAuthStore.getState().setLoading(false);
      expect(useAuthStore.getState().isLoading).toBe(false);
    });

    it('should set isLoading to true', () => {
      useAuthStore.getState().setLoading(false);
      useAuthStore.getState().setLoading(true);
      expect(useAuthStore.getState().isLoading).toBe(true);
    });
  });

  describe('setInitialized', () => {
    it('should set isInitialized to true', () => {
      useAuthStore.getState().setInitialized(true);
      expect(useAuthStore.getState().isInitialized).toBe(true);
    });
  });

  describe('clearSession', () => {
    it('should clear session, user, profile and set isLoading to false', () => {
      // Set up state first
      const mockUser = { id: 'user-123' } as any;
      const mockSession = { user: mockUser } as any;
      useAuthStore.getState().setSession(mockSession);
      useAuthStore.getState().setProfile(mockProfile);

      // Clear
      useAuthStore.getState().clearSession();

      const state = useAuthStore.getState();
      expect(state.session).toBeNull();
      expect(state.user).toBeNull();
      expect(state.profile).toBeNull();
      expect(state.isLoading).toBe(false);
    });
  });
});
