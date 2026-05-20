const SESSION_KEY = 'nursing-home-dashboard-auth';
const SESSION_MS = 8 * 60 * 60 * 1000;

export interface AuthSession {
  username: string;
  expiresAt: number;
}

function getExpectedCredentials(): { username: string; password: string } | null {
  const username = import.meta.env.VITE_AUTH_USERNAME?.trim();
  const password = import.meta.env.VITE_AUTH_PASSWORD;
  if (!username || !password) return null;
  return { username, password };
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export function isAuthConfigured(): boolean {
  return getExpectedCredentials() !== null;
}

export function validateCredentials(username: string, password: string): boolean {
  const expected = getExpectedCredentials();
  if (!expected) return false;
  return (
    timingSafeEqual(username.trim(), expected.username) &&
    timingSafeEqual(password, expected.password)
  );
}

export function readSession(): AuthSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as AuthSession;
    if (!session.username || typeof session.expiresAt !== 'number') return null;
    if (Date.now() >= session.expiresAt) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    return session;
  } catch {
    sessionStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export function createSession(username: string): AuthSession {
  const session: AuthSession = {
    username,
    expiresAt: Date.now() + SESSION_MS,
  };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export function clearSession(): void {
  sessionStorage.removeItem(SESSION_KEY);
}
