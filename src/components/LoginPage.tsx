import { useState, type FormEvent } from 'react';
import { Shield, LogIn } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function LoginPage() {
  const { signIn, isConfigured } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const ok = signIn(username, password);
    if (!ok) {
      setError('Invalid username or password.');
      setPassword('');
    }
    setSubmitting(false);
  };

  return (
    <div className="min-h-full flex items-center justify-center bg-slate-300 p-6">
      <div className="w-full max-w-sm bg-slate-100 border border-slate-400 shadow-sm">
        <div className="px-6 py-5 border-b border-slate-400 bg-white">
          <h1 className="text-lg font-bold text-slate-900 tracking-tight">Grandview Care</h1>
          <p className="text-xs text-slate-600 mt-0.5">Healthcare Monitoring — Staff sign-in</p>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {!isConfigured && (
            <p
              className="text-xs text-amber-900 bg-amber-50 border border-amber-700 px-3 py-2"
              role="alert"
            >
              Authentication is not configured. Add VITE_AUTH_USERNAME and VITE_AUTH_PASSWORD to
              your .env.local file.
            </p>
          )}

          <div>
            <label htmlFor="username" className="block text-xs font-semibold text-slate-800 mb-1">
              Username
            </label>
            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={!isConfigured || submitting}
              className="w-full px-3 py-2 bg-white border border-slate-400 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 disabled:opacity-60"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-xs font-semibold text-slate-800 mb-1">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={!isConfigured || submitting}
              className="w-full px-3 py-2 bg-white border border-slate-400 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 disabled:opacity-60"
            />
          </div>

          {error && (
            <p className="text-xs text-red-900 bg-red-50 border border-red-800 px-3 py-2" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={!isConfigured || submitting}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-800 text-white text-sm font-bold uppercase tracking-wide border border-blue-900 hover:bg-blue-900 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            <LogIn className="w-4 h-4" aria-hidden />
            Sign in
          </button>
        </form>

        <div className="px-6 py-3 border-t border-slate-400 bg-white flex items-center gap-1.5">
          <Shield className="w-3 h-3 text-slate-600 shrink-0" aria-hidden />
          <p className="text-[10px] text-slate-700">
            <span className="font-semibold">PHI</span> — Authorized personnel only
          </p>
        </div>
      </div>
    </div>
  );
}
