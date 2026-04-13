import { createClient } from '@/lib/supabase/server';
import { ChatView } from './chat-view';

export default async function ChatPage() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  const { data: messages } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: true })
    .limit(100);

  return <ChatView initialMessages={messages || []} />;
}
