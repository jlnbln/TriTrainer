import { BottomNav } from '@/components/bottom-nav';
import { AppHeader } from '@/components/app-header';

export const dynamic = 'force-dynamic';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-screen">
      <AppHeader />
      <main className="flex-1 pt-[72px] pb-20">{children}</main>
      <BottomNav />
    </div>
  );
}
