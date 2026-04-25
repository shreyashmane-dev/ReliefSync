import { useEffect, useRef, useState } from 'react';
import { useIsMobile } from '../../core/hooks/useIsMobile';

interface Message {
  id: string;
  role: 'model' | 'user';
  text: string;
  streaming?: boolean;
}

const SUGGESTIONS = [
  { icon: 'shield', label: 'Safety Guidelines' },
  { icon: 'near_me', label: 'Find Nearby Help' },
  { icon: 'inventory_2', label: 'Check Resources' },
  { icon: 'warning', label: 'Report an Incident' },
];

export const Assistant = () => {
  const isMobile = useIsMobile();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'model',
      text: `Welcome to ReliefSync! I am your dedicated AI Assistant for disaster response and community coordination.\n\nI can help you assess emergencies, find safety guidelines, or coordinate resources. How can I assist you today?`,
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const handleStop = () => {
    abortRef.current?.abort();
    setLoading(false);
    setMessages((prev) => prev.map((message) => ({ ...message, streaming: false })));
  };

  const handleSend = async (text?: string) => {
    const message = (text || input).trim();
    if (!message || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: message,
    };

    const botId = (Date.now() + 1).toString();
    const botMessage: Message = { id: botId, role: 'model', text: '', streaming: true };

    setMessages((prev) => [...prev, userMessage, botMessage]);
    setInput('');
    setLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
        signal: controller.signal,
      });

      const contentType = response.headers.get('content-type') || '';

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `API error ${response.status}`);
      }

      if (contentType.includes('application/json')) {
        const data = await response.json();
        setMessages((prev) =>
          prev.map((currentMessage) =>
            currentMessage.id === botId ? { ...currentMessage, text: data.reply || 'No response.', streaming: false } : currentMessage,
          ),
        );
        return;
      }

      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';

        for (const part of parts) {
          const line = part.replace(/^data:\s*/, '').trim();
          if (!line) continue;

          try {
            const payload = JSON.parse(line);

            if (payload.error) throw new Error(payload.error);

            if (payload.done) {
              setMessages((prev) =>
                prev.map((currentMessage) => (currentMessage.id === botId ? { ...currentMessage, streaming: false } : currentMessage)),
              );
              break;
            }

            if (payload.chunk) {
              setMessages((prev) =>
                prev.map((currentMessage) =>
                  currentMessage.id === botId ? { ...currentMessage, text: currentMessage.text + payload.chunk } : currentMessage,
                ),
              );
            }
          } catch (parseError: any) {
            if (parseError?.message && !parseError.message.startsWith('Unexpected')) {
              throw parseError;
            }
          }
        }
      }
    } catch (error: any) {
      if (error?.name === 'AbortError') return;

      console.error('Chat stream error:', error);
      setMessages((prev) =>
        prev.map((currentMessage) =>
          currentMessage.id === botId
            ? {
                ...currentMessage,
                text: `Could not reach the AI service.\n\n${error?.message || 'Please try again.'}`,
                streaming: false,
              }
            : currentMessage,
        ),
      );
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  };

  const formatText = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, index) => (
      <span key={`${index}`}>
        {line}
        {index < lines.length - 1 && <br />}
      </span>
    ));
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: isMobile ? 'calc(100dvh - 10.75rem)' : 'calc(100dvh - 8.75rem)',
        maxHeight: isMobile ? 'calc(100dvh - 10.75rem)' : 'calc(100dvh - 8.75rem)',
        position: 'relative',
        minWidth: 0,
      }}
    >
      <div
        style={{
          padding: '0 4px 16px',
          borderBottom: '1px solid #f1f5f9',
          marginBottom: 8,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #0052cc 0%, #003d99 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(0,82,204,0.2)',
            flexShrink: 0,
          }}
        >
          <span className="material-symbols-outlined" style={{ color: '#fff', fontSize: 22, fontVariationSettings: "'FILL' 1" }}>
            smart_toy
          </span>
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#191c1e' }}>ReliefSync AI</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Always Ready
            </span>
          </div>
        </div>
      </div>

      <div
        ref={scrollRef}
        style={{ flex: 1, overflowY: 'auto', padding: '10px 0 20px', display: 'flex', flexDirection: 'column', gap: 20, minHeight: 0 }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: '#94a3b8',
              background: '#f8fafc',
              padding: '4px 12px',
              borderRadius: 9999,
              border: '1px solid #f1f5f9',
              textAlign: 'center',
            }}
          >
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })} |{' '}
            {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        {messages.map((message) => (
          <div
            key={message.id}
            style={{
              display: 'flex',
              gap: 10,
              flexDirection: message.role === 'user' ? 'row-reverse' : 'row',
              alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: isMobile ? '100%' : '85%',
              width: 'fit-content',
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: message.role === 'user' ? '#b81a36' : '#0052cc',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
              }}
            >
              <span className="material-symbols-outlined" style={{ color: '#fff', fontSize: 18, fontVariationSettings: "'FILL' 1" }}>
                {message.role === 'user' ? 'person' : 'smart_toy'}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
              <div
                style={{
                  background: message.role === 'user' ? '#0052cc' : '#fff',
                  color: message.role === 'user' ? '#fff' : '#191c1e',
                  padding: isMobile ? '12px 14px' : '12px 16px',
                  borderRadius: message.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                  fontSize: 15,
                  lineHeight: 1.6,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                  border: message.role === 'model' ? '1px solid #f1f5f9' : 'none',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  maxWidth: isMobile ? 'calc(100vw - 7.5rem)' : '100%',
                }}
              >
                {message.text ? formatText(message.text) : null}
                {message.streaming && (
                  <span
                    style={{
                      display: 'inline-block',
                      width: 2,
                      height: '1em',
                      background: message.role === 'user' ? '#fff' : '#0052cc',
                      marginLeft: 2,
                      verticalAlign: 'text-bottom',
                      animation: 'blink 0.8s step-end infinite',
                    }}
                  />
                )}
              </div>
            </div>
          </div>
        ))}

        {loading && messages[messages.length - 1]?.text === '' && (
          <div style={{ display: 'flex', gap: 10, maxWidth: isMobile ? '100%' : '85%' }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#0052cc', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span className="material-symbols-outlined" style={{ color: '#fff', fontSize: 18, fontVariationSettings: "'FILL' 1" }}>
                smart_toy
              </span>
            </div>
            <div
              style={{
                background: '#fff',
                border: '1px solid #f1f5f9',
                borderRadius: '18px 18px 18px 4px',
                padding: '14px 18px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                display: 'flex',
                gap: 6,
                alignItems: 'center',
              }}
            >
              {[0, 1, 2].map((i) => (
                <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: '#0052cc', opacity: 0.5, animation: `bounce 1.2s ${i * 0.2}s infinite` }} />
              ))}
            </div>
          </div>
        )}
      </div>

      <div
        style={{
          marginTop: 12,
          background: 'linear-gradient(to top, #f8f9fb 88%, rgba(248,249,251,0.88) 100%)',
          paddingTop: 8,
          paddingBottom: 4,
        }}
      >
        <div className="hide-scrollbar" style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 10, marginBottom: 4 }}>
          {SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion.label}
              onClick={() => handleSend(suggestion.label)}
              disabled={loading}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 14px',
                borderRadius: 9999,
                border: '1px solid #e1e2e4',
                background: '#fff',
                fontSize: 13,
                fontWeight: 600,
                color: '#434654',
                cursor: loading ? 'default' : 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                fontFamily: 'Inter, sans-serif',
                opacity: loading ? 0.5 : 1,
                transition: 'opacity 0.2s',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                {suggestion.icon}
              </span>
              {suggestion.label}
            </button>
          ))}
        </div>

        <div
          style={{
            display: 'flex',
            gap: 10,
            alignItems: 'flex-end',
            background: '#fff',
            borderRadius: 24,
            padding: isMobile ? '10px' : '8px 8px 8px 16px',
            boxShadow: '0 4px 20px rgba(0,82,204,0.1)',
            border: '1px solid #e1e2e4',
          }}
        >
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && !event.shiftKey && handleSend()}
            placeholder="Describe the emergency situation..."
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              fontSize: 15,
              background: 'transparent',
              fontFamily: 'Inter, sans-serif',
              color: '#191c1e',
              minWidth: 0,
              padding: isMobile ? '4px 2px 4px 6px' : 0,
            }}
          />

          {loading ? (
            <button
              onClick={handleStop}
              title="Stop generating"
              style={{
                width: 42,
                height: 42,
                borderRadius: '50%',
                background: '#b81a36',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                flexShrink: 0,
                transition: 'background 0.2s',
              }}
            >
              <span className="material-symbols-outlined" style={{ color: '#fff', fontSize: 20, fontVariationSettings: "'FILL' 1" }}>
                stop
              </span>
            </button>
          ) : (
            <button
              onClick={() => handleSend()}
              disabled={!input.trim()}
              style={{
                width: 42,
                height: 42,
                borderRadius: '50%',
                background: input.trim() ? '#0052cc' : '#e1e2e4',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: input.trim() ? 'pointer' : 'default',
                transition: 'background 0.2s',
                flexShrink: 0,
              }}
            >
              <span className="material-symbols-outlined" style={{ color: input.trim() ? '#fff' : '#9ca3af', fontSize: 20, fontVariationSettings: "'FILL' 1" }}>
                send
              </span>
            </button>
          )}
        </div>
      </div>

      <style>{`
        @keyframes bounce { 0%, 60%, 100% { transform: translateY(0); opacity: 0.5 } 30% { transform: translateY(-6px); opacity: 1 } }
        @keyframes blink { 0%, 100% { opacity: 1 } 50% { opacity: 0 } }
      `}</style>
    </div>
  );
};
