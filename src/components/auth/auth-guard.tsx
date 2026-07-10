'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // Skip auth check for login page
    if (pathname === '/login') {
      setChecking(false);
      return;
    }

    const isAuth = localStorage.getItem('kaldik_auth');
    if (isAuth !== 'true') {
      router.replace('/login');
    } else {
      setChecking(false);
    }
  }, [pathname, router]);

  // Show loading while checking auth (except on login page)
  if (checking && pathname !== '/login') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 size={24} className="animate-spin text-indigo-500" />
      </div>
    );
  }

  return <>{children}</>;
}
