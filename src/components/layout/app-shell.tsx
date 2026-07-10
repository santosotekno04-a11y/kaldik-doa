'use client';

import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/layout/sidebar';
import { MobileNav } from '@/components/layout/mobile-nav';
import { Topbar } from '@/components/layout/topbar';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Login page gets no app shell (sidebar, topbar, mobile nav)
  if (pathname === '/login') {
    return <>{children}</>;
  }

  return (
    <>
      {/* Desktop Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen min-w-0 w-full max-w-full overflow-x-hidden">
        <Topbar />
        <main className="flex-1 p-4 lg:p-6 pb-20 lg:pb-6 overflow-x-hidden w-full max-w-full">{children}</main>
      </div>

      {/* Mobile Bottom Nav */}
      <MobileNav />
    </>
  );
}
