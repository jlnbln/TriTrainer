import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { BottomNav } from '@/components/bottom-nav';
import { AppHeader } from '@/components/app-header';
import { ChatFab } from '@/components/chat-fab';

export const dynamic = 'force-dynamic';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <div className="flex flex-col min-h-screen">
        <AppHeader />
        <main className="flex-1" style={{ paddingTop: 'calc(72px + env(safe-area-inset-top, 0px))', paddingBottom: 'calc(56px + env(safe-area-inset-bottom, 0px))' }}>{children}</main>
        <ChatFab />
        <BottomNav />
      </div>
    </NextIntlClientProvider>
  );
}
