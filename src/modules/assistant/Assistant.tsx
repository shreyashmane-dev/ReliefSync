import { useEffect, useRef, useState } from 'react';
import { useStore } from '../../core/store/useStore';

interface Message {
  id: string;
  role: 'model' | 'user';
  text: string;
}

const SUGGESTIONS = [
  { icon: 'shield', label: 'Safety Guidelines' },
  { icon: 'near_me', label: 'Find Nearby Help' },
  { icon: 'inventory_2', label: 'Check Resources' },
  { icon: 'warning', label: 'Report an Incident' },
];

export const Assistant = () => {
  const { user } = useStore();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'model',
      text: `Hello${user?.name ? `, ${user.name.split(' ')[0]}` : ''}! I can analyze a problem and respond with:\n\n- Category\n- Urgency level\n- Suggested solution\n- Required resources or volunteers\n\nWhat would you like me to review?`,
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const requestChatReply = async (message: string) => {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message }),
    });

    const rawBody = await response.text();
    let data: { error?: string; reply?: string } = {};

    if (rawBody) {
      try {
        data = JSON.parse(rawBody);
      } catch {
        if (response.status === 502) {
          throw new Error('AI backend is unavailable. Start the API server or run `npm run dev` to launch both services.');
        }
        throw new Error(`Chat API returned a non-JSON response (${response.status}).`);
      }
    }

    if (!response.ok) {
      if (response.status === 502) {
        throw new Error('AI backend is unavailable. Start the API server or run `npm run dev` to launch both services.');
      }
      throw new Error(data.error || `Failed to get AI response (${response.status}).`);
    }

    return (data.reply || '').trim();
  };

  const handleSend = async (text?: string) => {
    const message = (text || input).trim();
    if (!message || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: message,
    };

    setMessages((current) => [...current, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const reply = await requestChatReply(message);

      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: reply || 'I could not generate a useful response just now.',
      };

      setMessages((current) => [...current, botMessage]);
    } catch (error: any) {
      console.error('Chat API error:', error);
      setMessages((current) => [
        ...current,
        {
          id: (Date.now() + 1).toString(),
          role: 'model',
          text: `I couldn't reach the AI service right now.\n\n${error?.message || 'Please try again in a moment.'}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const formatText = (text: string) => {
    const lines = text.split('\n');

    return lines.map((line, index) => (
      <span key={`${line}-${index}`}>
        {line}
        {index < lines.length - 1 && <br />}
      </span>
    ));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 140px)', position: 'relative' }}>
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '20px 0 220px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#737685', background: '#f1f5f9', padding: '4px 14px', borderRadius: 9999 }}>
            Today, {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        {messages.map((message) => (
          <div
            key={message.id}
            style={{ display: 'flex', gap: 10, flexDirection: message.role === 'user' ? 'row-reverse' : 'row', alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}
          >
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: message.role === 'user' ? '#b81a36' : '#0052cc', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}>
              <span className="material-symbols-outlined" style={{ color: '#fff', fontSize: 18, fontVariationSettings: "'FILL' 1" }}>
                {message.role === 'user' ? 'person' : 'smart_toy'}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
              <div
                style={{
                  background: message.role === 'user' ? '#0052cc' : '#fff',
                  color: message.role === 'user' ? '#fff' : '#191c1e',
                  padding: '12px 16px',
                  borderRadius: message.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                  fontSize: 15,
                  lineHeight: 1.6,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                  border: message.role === 'model' ? '1px solid #f1f5f9' : 'none',
                }}
              >
                {formatText(message.text)}
              </div>
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: 'flex', gap: 10, maxWidth: '85%' }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#0052cc', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span className="material-symbols-outlined" style={{ color: '#fff', fontSize: 18, fontVariationSettings: "'FILL' 1" }}>smart_toy</span>
            </div>
            <div style={{ background: '#fff', border: '1px solid #f1f5f9', borderRadius: '18px 18px 18px 4px', padding: '14px 18px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', display: 'flex', gap: 6, alignItems: 'center' }}>
              {[0, 1, 2].map((index) => (
                <div key={index} style={{ width: 8, height: 8, borderRadius: '50%', background: '#0052cc', opacity: 0.5, animation: `bounce 1.2s ${index * 0.2}s infinite` }} />
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(to top, #f8f9fb 80%, transparent)', paddingTop: 32, paddingBottom: 12, paddingLeft: 0, paddingRight: 0 }}>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 10, marginBottom: 4 }}>
          {SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion.label}
              onClick={() => handleSend(suggestion.label)}
              disabled={loading}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 9999, border: '1px solid #e1e2e4', background: '#fff', fontSize: 13, fontWeight: 600, color: '#434654', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, fontFamily: 'Inter, sans-serif' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{suggestion.icon}</span>
              {suggestion.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', background: '#fff', borderRadius: 9999, padding: '6px 6px 6px 16px', boxShadow: '0 4px 20px rgba(0,82,204,0.1)', border: '1px solid #e1e2e4' }}>
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && !event.shiftKey && handleSend()}
            placeholder="Describe a problem and I will analyze it..."
            style={{ flex: 1, border: 'none', outline: 'none', fontSize: 15, background: 'transparent', fontFamily: 'Inter, sans-serif', color: '#191c1e' }}
          />
          <button
            onClick={() => handleSend()}
            disabled={loading || !input.trim()}
            style={{ width: 42, height: 42, borderRadius: '50%', background: input.trim() && !loading ? '#0052cc' : '#e1e2e4', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: input.trim() && !loading ? 'pointer' : 'default', transition: 'background 0.2s', flexShrink: 0 }}
          >
            <span className="material-symbols-outlined" style={{ color: input.trim() && !loading ? '#fff' : '#9ca3af', fontSize: 20, fontVariationSettings: "'FILL' 1" }}>send</span>
          </button>
        </div>
      </div>

      <style>{`
        @keyframes bounce { 0%, 60%, 100% { transform: translateY(0); opacity: 0.5 } 30% { transform: translateY(-6px); opacity: 1 } }
      `}</style>
    </div>
  );
};
