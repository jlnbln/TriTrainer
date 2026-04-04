import { createClient } from '@/lib/supabase/server';
import { ChatView } from './chat-view';

export default async function ChatPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Load chat history
  const { data: messages } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(100);

  return <ChatView initialMessages={messages || []} />;
}
