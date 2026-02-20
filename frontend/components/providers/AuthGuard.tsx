'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/authStore';
import { Loader2 } from 'lucide-react';

interface AuthGuardProps {
  children: React.ReactNode;
}

/**
 * Read auth data directly from localStorage / sessionStorage,
 * bypassing Zustand persist hydration (which is unreliable with SSR).
 */
function restoreAuthFromStorage(): boolean {
  if (typeof window === 'undefined') return false;
  const raw =
    localStorage.getItem('auth-storage') ||
    sessionStorage.getItem('auth-storage');
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw);
    const s = parsed?.state;
    if (s?.isAuthenticated && s?.accessToken) {
      // Push stored credentials into Zustand so the rest of the app works
      useAuthStore.setState({
        accessToken: s.accessToken,
        refreshToken: s.refreshToken ?? null,
        isAuthenticated: true,
        rememberMe: s.rememberMe ?? false,
      });
      return true;
    }
  } catch {
    // corrupted data – treat as unauthenticated
  }
  return false;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Already authenticated in memory (client-side navigation)
    if (useAuthStore.getState().isAuthenticated) {
      setReady(true);
      return;
    }
    // Hard navigation – restore from storage manually
    const restored = restoreAuthFromStorage();
    if (restored) {
      setReady(true);
    } else {
      router.replace('/login');
    }
  }, [router]);

  // Keep redirecting if auth is lost later (e.g. token expired → logout)
  useEffect(() => {
    if (ready && !isAuthenticated) {
      router.replace('/login');
    }
  }, [ready, isAuthenticated, router]);

  if (!ready || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
          <p className="mt-2 text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
