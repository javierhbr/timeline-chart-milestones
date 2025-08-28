import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { HARDCODED_CREDENTIALS } from '../components/Login';
import { GoogleSheetsService } from '../services/googleSheetsService';
import { logger } from '../utils/logger';

interface AuthContextType {
  isAuthenticated: boolean;
  currentUser: string | null;
  login: (username: string, password: string) => boolean;
  logout: () => void;
  loginError: string | null;
  // Google Sheets integration
  isGoogleConnected: boolean;
  connectGoogle: () => Promise<void>;
  disconnectGoogle: () => void;
  googleError: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = 'timeline-auth-state';

// Google OAuth configuration
// To enable Google Sheets integration:
// 1. Go to Google Cloud Console: https://console.cloud.google.com/
// 2. Create a project or select existing one
// 3. Enable Google Sheets API and Google Drive API
// 4. Create OAuth 2.0 credentials (Web application)
// 5. Add authorized redirect URI: http://localhost:5173 (adjust for production)
// 6. Copy Client ID to .env file
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isGoogleConnected, setIsGoogleConnected] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);

  // Check for existing authentication on app start
  useEffect(() => {
    const savedAuthState = localStorage.getItem(AUTH_STORAGE_KEY);
    if (savedAuthState) {
      try {
        const { isAuthenticated: savedAuth, currentUser: savedUser } = JSON.parse(savedAuthState);
        if (savedAuth && savedUser) {
          setIsAuthenticated(true);
          setCurrentUser(savedUser);
        }
      } catch {
        // Invalid stored data, clear it
        localStorage.removeItem(AUTH_STORAGE_KEY);
      }
    }
  }, []);

  // Initialize Google Sheets API when authenticated
  useEffect(() => {
    const initializeGoogle = async () => {
      if (isAuthenticated && GOOGLE_CLIENT_ID) {
        logger.info('Starting Google Sheets initialization', { 
          module: 'Auth', 
          action: 'initializeGoogle',
          hasClientId: !!GOOGLE_CLIENT_ID,
          clientIdLength: GOOGLE_CLIENT_ID.length
        });

        try {
          await GoogleSheetsService.getInstance().initialize(GOOGLE_CLIENT_ID);
          
          // Check if user is already signed in to Google
          if (GoogleSheetsService.getInstance().isAuthenticated()) {
            logger.info('User already authenticated with Google', { 
              module: 'Auth', 
              action: 'initializeGoogle' 
            });
            setIsGoogleConnected(true);
          } else {
            logger.debug('User not yet authenticated with Google', { 
              module: 'Auth', 
              action: 'initializeGoogle' 
            });
          }
        } catch (error) {
          logger.error('Failed to initialize Google Sheets', error as Error, { 
            module: 'Auth', 
            action: 'initializeGoogle' 
          });
        }
      } else {
        logger.debug('Skipping Google Sheets initialization', { 
          module: 'Auth', 
          action: 'initializeGoogle',
          isAuthenticated,
          hasClientId: !!GOOGLE_CLIENT_ID
        });
      }
    };

    initializeGoogle();
  }, [isAuthenticated]);

  const login = (username: string, password: string): boolean => {
    setLoginError(null);
    
    // Check against hardcoded credentials
    if (username === HARDCODED_CREDENTIALS.username && password === HARDCODED_CREDENTIALS.password) {
      setIsAuthenticated(true);
      setCurrentUser(username);
      
      // Persist authentication state
      const authState = { isAuthenticated: true, currentUser: username };
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authState));
      
      return true;
    } else {
      setLoginError('Invalid username or password');
      return false;
    }
  };

  const connectGoogle = async (): Promise<void> => {
    logger.logAuthEvent('connectGoogle started', { 
      isAuthenticated, 
      hasClientId: !!GOOGLE_CLIENT_ID 
    });

    if (!isAuthenticated) {
      const errorMsg = 'You must be logged in to connect Google Sheets';
      logger.warn(errorMsg, { module: 'Auth', action: 'connectGoogle' });
      setGoogleError(errorMsg);
      return;
    }

    if (!GOOGLE_CLIENT_ID) {
      const errorMsg = 'Google OAuth is not configured. Please set up Google API credentials.';
      logger.error(errorMsg, undefined, { module: 'Auth', action: 'connectGoogle' });
      setGoogleError(errorMsg);
      return;
    }

    setGoogleError(null);

    try {
      logger.info('Connecting to Google Sheets', { 
        module: 'Auth', 
        action: 'connectGoogle' 
      });

      // Initialize Google Sheets service if not already done
      await GoogleSheetsService.getInstance().initialize(GOOGLE_CLIENT_ID);
      
      // Sign in to Google
      await GoogleSheetsService.getInstance().signIn();
      
      setIsGoogleConnected(true);
      logger.logAuthEvent('connectGoogle successful');
    } catch (error) {
      logger.error('Google authentication failed', error as Error, { 
        module: 'Auth', 
        action: 'connectGoogle' 
      });
      setGoogleError(error instanceof Error ? error.message : 'Failed to connect to Google');
      throw error;
    }
  };

  const disconnectGoogle = (): void => {
    logger.info('Disconnecting from Google Sheets', { 
      module: 'Auth', 
      action: 'disconnectGoogle' 
    });
    
    setIsGoogleConnected(false);
    setGoogleError(null);
    GoogleSheetsService.getInstance().disconnect();
    
    logger.logAuthEvent('disconnectGoogle successful');
  };

  const logout = () => {
    logger.info('Starting logout process', { 
      module: 'Auth', 
      action: 'logout',
      currentStorageKeys: Object.keys(localStorage).length
    });
    
    setIsAuthenticated(false);
    setCurrentUser(null);
    setLoginError(null);
    
    // Disconnect Google Sheets
    logger.debug('Disconnecting Google Sheets during logout', { 
      module: 'Auth', 
      action: 'logout' 
    });
    disconnectGoogle();
    
    // Clear all authentication and project data
    logger.debug('Removing auth storage keys', { 
      module: 'Auth', 
      action: 'logout',
      authStorageKey: AUTH_STORAGE_KEY
    });
    localStorage.removeItem(AUTH_STORAGE_KEY);
    localStorage.removeItem('timeline-current-project-id');
    localStorage.removeItem('timeline-projects');
    
    // Clear any other timeline-related data
    const timelineKeys = Object.keys(localStorage).filter(key => key.startsWith('timeline-'));
    logger.debug('Clearing timeline-related localStorage entries', { 
      module: 'Auth', 
      action: 'logout',
      keysToRemove: timelineKeys.length
    });
    
    timelineKeys.forEach(key => {
      localStorage.removeItem(key);
    });
    
    logger.info('Logout completed, forcing page reload', { 
      module: 'Auth', 
      action: 'logout',
      finalStorageKeys: Object.keys(localStorage).length
    });
    
    // Force page reload to ensure clean state
    window.location.reload();
  };

  const value: AuthContextType = {
    isAuthenticated,
    currentUser,
    login,
    logout,
    loginError,
    isGoogleConnected,
    connectGoogle,
    disconnectGoogle,
    googleError,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}