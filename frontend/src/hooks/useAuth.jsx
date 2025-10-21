// src/hooks/useAuth.js - Authentication hooks
import { useState, useEffect, useContext, createContext } from 'react';
import authService from '../services/authService';

// Auth Context
const AuthContext = createContext();

// Auth Provider Component
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Initialize auth state
  useEffect(() => {
    const initAuth = async () => {
      try {
        const storedUser = authService.getUser();
        const token = authService.getToken();

        if (storedUser && token) {
          // Verify token is still valid
          const isValid = await authService.verifyToken();
          if (isValid) {
            setUser(storedUser);
            setIsAuthenticated(true);
          } else {
            authService.clearAuth();
          }
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        authService.clearAuth();
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  // Login function
  const login = async (credentials) => {
    try {
      setLoading(true);
      const result = await authService.login(credentials);
      
      if (result.success) {
        setUser(result.user);
        setIsAuthenticated(true);
      }
      
      return result;
    } catch (error) {
      console.error('Login hook error:', error);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  // Register function
  const register = async (userData) => {
    try {
      setLoading(true);
      const result = await authService.register(userData);
      
      if (result.success) {
        setUser(result.user);
        setIsAuthenticated(true);
      }
      
      return result;
    } catch (error) {
      console.error('Register hook error:', error);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  // Logout function
  const logout = async () => {
    try {
      await authService.logout();
      setUser(null);
      setIsAuthenticated(false);
    } catch (error) {
      console.error('Logout hook error:', error);
    }
  };

  // Update profile function
  const updateProfile = async (updates) => {
    try {
      const result = await authService.updateProfile(updates);
      
      if (result.success) {
        setUser(result.user);
        // Update stored user
        authService.setAuth(authService.getToken(), result.user);
      }
      
      return result;
    } catch (error) {
      console.error('Update profile hook error:', error);
      return { success: false, error: error.message };
    }
  };

  // Refresh user data
  const refreshUser = async () => {
    try {
      const result = await authService.getProfile();
      
      if (result.success) {
        setUser(result.user);
        authService.setAuth(authService.getToken(), result.user);
      }
      
      return result;
    } catch (error) {
      console.error('Refresh user hook error:', error);
      return { success: false, error: error.message };
    }
  };

  const value = {
    user,
    isAuthenticated,
    loading,
    login,
    register,
    logout,
    updateProfile,
    refreshUser
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// Hook to use auth context
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Hook for login form
export function useLogin() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { login } = useAuth();

  const handleLogin = async (credentials) => {
    try {
      setLoading(true);
      setError(null);
      const result = await login(credentials);
      
      if (!result.success) {
        setError(result.error);
      }
      
      return result;
    } catch (error) {
      setError(error.message);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  return { handleLogin, loading, error, setError };
}

// Hook for register form
export function useRegister() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { register } = useAuth();

  const handleRegister = async (userData) => {
    try {
      setLoading(true);
      setError(null);
      const result = await register(userData);
      
      if (!result.success) {
        setError(result.error);
      }
      
      return result;
    } catch (error) {
      setError(error.message);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  return { handleRegister, loading, error, setError };
}

// Hook for username availability
export function useUsernameCheck() {
  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState(null);

  const checkUsername = async (username) => {
    if (!username || username.length < 3) {
      setAvailable(null);
      return;
    }

    try {
      setChecking(true);
      const result = await authService.checkUsername(username);
      setAvailable(result.available);
    } catch (error) {
      console.error('Username check error:', error);
      setAvailable(null);
    } finally {
      setChecking(false);
    }
  };

  return { checkUsername, checking, available };
}
