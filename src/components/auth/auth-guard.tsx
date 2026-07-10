'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);
  const [isAuthed, setIsAuthed] = useState(false);

  useEffect(() => {
    // Skip auth check for login page
    if (pathname === '/login') {
      setChecking(false);
      return;
    }

    const auth = localStorage.getItem('kaldik_auth');
    if (auth !== 'true') {
      router.replace('/login');
    } else {
      setIsAuthed(true);
      setChecking(false);
    }
  }, [pathname, router]);

  // On login page, render children directly without app shell
  if (pathname === '/login') {
    return <>{children}</>;
  }

  // Show loading while checking auth
  if (checking || !isAuthed) {
    return (
      <div className="flex items-center justify-center min-h-screen w-full">
        <Loader2 size={24} className="animate-spin text-indigo-500" />
      </div>
    );
  }

  return <>{children}</>;
}
