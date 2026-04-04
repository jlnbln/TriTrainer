'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/home',     label: 'Home',     icon: 'home',          iconFill: 'home' },
  { href: '/plan',     label: 'Plan',     icon: 'calendar_today', iconFill: 'calendar_today' },
  { href: '/chat',     label: 'Chat',     icon: 'chat_bubble',   iconFill: 'chat_bubble' },
  { href: '/settings', label: 'Settings', icon: 'settings',      iconFill: 'settings' },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 w-full z-50 bg-background border-t border-border/20 safe-area-pb">
      <div className="flex items-center justify-around h-14 max-w-lg mx-auto px-4">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 flex-1 h-full py-1 px-3 rounded-xl transition-all active:scale-90',
                isActive
                  ? 'text-primary bg-primary/10'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <span
                className="material-symbols-outlined text-2xl"
                style={isActive ? { fontVariationSettings: "'FILL' 1" } : {}}
              >
                {item.icon}
              </span>
              <span className="font-headline text-[9px] uppercase tracking-widest font-medium">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
