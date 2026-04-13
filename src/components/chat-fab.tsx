'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function ChatFab() {
  const pathname = usePathname();
  const isActive = pathname.startsWith('/chat');

  // Don't show the FAB on the chat page itself
  if (isActive) return null;

  return (
    <Link
      href="/chat"
      className="fixed z-50 flex items-center justify-center w-14 h-14 rounded-full bg-primary shadow-lg transition-all active:scale-90 hover:scale-105"
      style={{
        bottom: 'calc(56px + env(safe-area-inset-bottom, 0px) + 16px)',
        right: '20px',
      }}
      aria-label="Open chat"
    >
      <span
        className="material-symbols-outlined text-2xl text-primary-foreground"
        style={{ fontVariationSettings: "'FILL' 1" }}
      >
        chat_bubble
      </span>
    </Link>
  );
}
