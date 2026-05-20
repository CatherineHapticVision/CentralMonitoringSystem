import type { ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';
import { LoginPage } from './LoginPage';

export function AuthGate({ children }: { children: ReactNode }) {
  const { session } = useAuth();

  if (!session) {
    return <LoginPage />;
  }

  return <>{children}</>;
}
