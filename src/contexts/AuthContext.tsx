import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import { HARDCODED_CREDENTIALS } from '../components/Login';

interface AuthContextType {
  isAuthenticated: boolean;
  currentUser: string | null;
  login: (username: string, password: string) => boolean;
  logout: () => void;
  loginError: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = 'timeline-auth-state';

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Check for existing authentication on app start
  useEffect(() => {
    const savedAuthState = localStorage.getItem(AUTH_STORAGE_KEY);
    if (savedAuthState) {
      try {
        const { isAuthenticated: savedAuth, currentUser: savedUser } =
          JSON.parse(savedAuthState);
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

  const login = (username: string, password: string): boolean => {
    setLoginError(null);

    // Check against hardcoded credentials
    if (
      username === HARDCODED_CREDENTIALS.username &&
      password === HARDCODED_CREDENTIALS.password
    ) {
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

  const logout = () => {
    console.log('AuthContext: Starting logout process');
    console.log(
      'AuthContext: Current localStorage keys:',
      Object.keys(localStorage)
    );

    setIsAuthenticated(false);
    setCurrentUser(null);
    setLoginError(null);

    // Clear all authentication and project data
    console.log('AuthContext: Removing auth storage key:', AUTH_STORAGE_KEY);
    localStorage.removeItem(AUTH_STORAGE_KEY);
    localStorage.removeItem('timeline-current-project-id');
    localStorage.removeItem('timeline-projects');

    // Clear any other timeline-related data
    console.log(
      'AuthContext: Clearing all timeline-related localStorage entries'
    );
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('timeline-')) {
        console.log('AuthContext: Removing key:', key);
        localStorage.removeItem(key);
      }
    });

    console.log(
      'AuthContext: localStorage after cleanup:',
      Object.keys(localStorage)
    );
    console.log('AuthContext: Forcing page reload for clean state');
    // Force page reload to ensure clean state
    window.location.reload();
  };

  const value: AuthContextType = {
    isAuthenticated,
    currentUser,
    login,
    logout,
    loginError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
