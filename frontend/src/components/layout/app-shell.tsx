'use client';

import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

/** Minimal shell — HUD page is full viewport; legacy routes keep compact chrome. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isHud = pathname === '/';

  if (isHud) {
    return <div className="h-screen max-h-screen overflow-hidden">{children}</div>;
  }

  return (
    <div className="layout-shell">
      <main className="layout-main">{children}</main>
    </div>
  );
}
