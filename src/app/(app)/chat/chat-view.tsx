'use client';

import { useState, useRef, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const SUGGESTIONS = [
  "What's my training this week?",
  'How should I pace the swim?',
  'I feel tired, can I adjust today?',
  'Explain the brick session',
];

export function ChatView({ initialMessages }: { initialMessages: any[] }) {
  const router = useRouter();
  const supabase = createClient();
  const [messages, setMessages] = useState<Message[]>(
    initialMessages.map((m) => ({ role: m.role, content: m.content }))
  );
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  async function sendMessage(text?: string) {
    const msg = (text || input).trim();
    if (!msg || loading) return;

    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: msg }]);
    setLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, history: messages.slice(-20) }),
      });
      const data = await response.json();

      if (data.error) {
        setMessages((prev) => [...prev, { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' }]);
      } else {
        const display = data.message.replace(/```modify\n[\s\S]*?\n```/g, '').trim();
        setMessages((prev) => [...prev, { role: 'assistant', content: display }]);
        if (data.message.includes('```modify')) router.refresh();
      }
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Failed to connect. Please check your connection.' }]);
    } finally {
      setLoading(false);
    }
  }

  async function clearHistory() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('chat_messages').delete().eq('user_id', user.id);
      setMessages([]);
    }
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-72px-80px)] max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-6 pb-3 flex-shrink-0">
        <div>
          <h2 className="font-headline font-bold text-3xl tracking-tight">Chat</h2>
          <p className="text-muted-foreground text-sm mt-0.5">Ask about your training plan</p>
        </div>
        {messages.length > 0 && (
          <button onClick={clearHistory} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-muted transition-colors">
            <span className="material-symbols-outlined text-muted-foreground text-xl">delete</span>
          </button>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 space-y-6 pb-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center border border-border/40">
              <span className="material-symbols-outlined text-primary text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>smart_toy</span>
            </div>
            <div>
              <p className="font-headline font-bold text-lg">Training Assistant</p>
              <p className="text-sm text-muted-foreground max-w-xs mt-1">
                Ask me anything about your training plan, technique, nutrition, or race strategy.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center mt-1">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  className="text-xs font-medium px-3 py-2 rounded-xl bg-card border border-border/40 hover:border-primary/40 hover:text-primary transition-all"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={cn('flex gap-3', msg.role === 'user' ? 'justify-end pl-8' : 'justify-start pr-8')}>
            {msg.role === 'assistant' && (
              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 border border-border/20 mt-0.5">
                <span className="material-symbols-outlined text-primary text-base" style={{ fontVariationSettings: "'FILL' 1" }}>smart_toy</span>
              </div>
            )}
            <div className={cn(
              'rounded-2xl px-4 py-3 text-sm leading-relaxed max-w-full',
              msg.role === 'user'
                ? 'bg-primary text-primary-foreground rounded-tr-sm'
                : 'bg-card border border-border/40 border-l-4 rounded-tl-sm'
            )}
            style={msg.role === 'assistant' ? { borderLeftColor: 'var(--sport-swim)' } : {}}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-3 pr-8">
            <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 border border-border/20 mt-0.5">
              <span className="material-symbols-outlined text-primary text-base" style={{ fontVariationSettings: "'FILL' 1" }}>smart_toy</span>
            </div>
            <div className="bg-card border border-border/40 rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex gap-1 items-center h-4">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input bar */}
      <div className="px-4 py-3 flex-shrink-0">
        <div className="flex items-center gap-2 bg-card border border-border/40 rounded-full px-2 py-1.5 shadow-sm">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder="Ask about your training plan..."
            className="flex-1 bg-transparent text-sm px-3 outline-none placeholder:text-muted-foreground"
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || loading}
            className="w-9 h-9 bg-primary text-primary-foreground rounded-full flex items-center justify-center flex-shrink-0 disabled:opacity-40 active:scale-90 transition-all shadow-sm"
          >
            <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>send</span>
          </button>
        </div>
      </div>
    </div>
  );
}
