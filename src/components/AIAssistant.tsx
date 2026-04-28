import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { buildApiUrl } from '../core/config/api';

interface AIAssistantProps {
  currentUser: {
    id: string;
    name: string;
    role: 'admin' | 'volunteer' | 'user';
    skills?: string[];
    area?: string;
  };
}

type ChatMessage = {
  sender: 'user' | 'bot';
  text: string;
  time: string;
  title?: string;
  suggestions?: string[];
};

const normalizePrompt = (value: string) => value.trim().toLowerCase();

const isVolunteerOpsPrompt = (role: string, value: string) => {
  if (role !== 'volunteer') return false;
  return [
    'find tasks',
    'my tasks',
    'done task',
    'availability',
    'check availability',
    'directions',
    'ask for directions',
    'my history',
  ].includes(normalizePrompt(value));
};

const buildAssistantMessage = (payload: { text: string; title?: string; suggestions?: string[] }): ChatMessage => ({
  sender: 'bot',
  text: payload.text,
  title: payload.title,
  suggestions: payload.suggestions?.slice(0, 4) || [],
  time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
});

const formatStructuredReply = (data: any) => {
  const sections: string[] = [];

  if (typeof data.reply === 'string' && data.reply.trim()) {
    sections.push(data.reply.trim());
  }
  if (Array.isArray(data.nextActions) && data.nextActions.length > 0) {
    sections.push(`Next actions:\n${data.nextActions.map((item: string, index: number) => `${index + 1}. ${item}`).join('\n')}`);
  }
  if (Array.isArray(data.riskFlags) && data.riskFlags.length > 0) {
    sections.push(`Risk flags:\n${data.riskFlags.map((item: string) => `- ${item}`).join('\n')}`);
  }

  return {
    title: data.title || undefined,
    text: sections.join('\n\n') || 'No response.',
    suggestions: data.suggestions || data.suggestedTools || [],
  };
};

const AIAssistant: React.FC<AIAssistantProps> = ({ currentUser }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const theme = {
    admin: { color: '#7c3aed', label: 'Command Core', emoji: 'Admin' },
    volunteer: { color: '#059669', label: 'Field Ops', emoji: 'Field' },
    user: { color: '#2563eb', label: 'Community', emoji: 'User' },
  };

  const currentTheme = theme[currentUser?.role] || theme.user;

  const actionButtons = {
    admin: ['Overview', 'Urgent Needs', 'Volunteers', 'Coverage', 'Match', 'Resources'],
    volunteer: ['Find Tasks', 'My Tasks', 'Done Task', 'Availability', 'Directions', 'My History'],
    user: ['Report Need', 'Check Status', 'Emergency', 'Safety', 'Volunteer'],
  };

  const currentActions = actionButtons[currentUser?.role] || actionButtons.user;

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const welcome = getWelcomeMessage(currentUser.role);
      setMessages([
        {
          text: welcome,
          title: currentTheme.label,
          suggestions: currentActions.slice(0, 4),
          sender: 'bot',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    }
  }, [isOpen]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const getWelcomeMessage = (role: string) => {
    if (role === 'admin') return `Operational clearance granted, ${currentUser.name}. I can give command summaries, hotspot warnings, responder matching, and resource recommendations.`;
    if (role === 'volunteer') return `Field console ready, ${currentUser.name}. I can show your tasks, open missions, availability, route guidance, and mission history.`;
    return `Community assistant ready, ${currentUser.name}. I can help with emergency reporting, safety guidance, and request status.`;
  };

  const pushBotMessage = (payload: { text: string; title?: string; suggestions?: string[] }) => {
    setMessages((prev) => [...prev, buildAssistantMessage(payload)]);
  };

  const handleSend = async (text: string = input) => {
    if (!text.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      text,
      sender: 'user',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      if (isVolunteerOpsPrompt(currentUser.role, text)) {
        const response = await fetch(buildApiUrl('/api/ai/intelligence/volunteer-ops'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            volunteerId: currentUser.id,
            query: text,
          }),
        });
        const data = await response.json();
        pushBotMessage(formatStructuredReply(data));
        return;
      }

      const response = await fetch(buildApiUrl('/api/ai/chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          userId: currentUser.id,
          userRole: currentUser.role,
          userData: currentUser,
        }),
      });

      const data = await response.json();
      const developerHint =
        typeof data.error === 'string' && data.error.includes('PERMISSION_DENIED')
          ? 'Vertex assistant credentials need to be corrected before advanced responses can work reliably.'
          : null;

      pushBotMessage(developerHint ? { text: developerHint } : formatStructuredReply(data));
    } catch (_err) {
      pushBotMessage({
        text: 'Connection unstable. Try again, or use one of the quick actions below.',
        title: 'Connection',
        suggestions: currentActions.slice(0, 4),
      });
    } finally {
      setIsLoading(false);
    }
  };

  const resetChat = async () => {
    try {
      await fetch(buildApiUrl('/api/ai/reset'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id }),
      });
      setMessages([]);
      setIsOpen(false);
      setTimeout(() => setIsOpen(true), 100);
    } catch (_err) {
      setMessages([]);
    }
  };

  return (
    <div style={{ position: 'fixed', bottom: '104px', right: '32px', zIndex: 9999, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '64px',
          height: '64px',
          borderRadius: '24px',
          backgroundColor: currentTheme.color,
          color: 'white',
          border: 'none',
          boxShadow: '0 12px 24px -8px rgba(0,0,0,0.3)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '28px',
        }}
      >
        <span
          className="material-symbols-outlined"
          style={{
            fontSize: '30px',
            fontVariationSettings: isOpen ? "'FILL' 1" : "'FILL' 0",
          }}
        >
          {isOpen ? 'close' : 'smart_toy'}
        </span>
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            style={{
              position: 'absolute',
              bottom: '80px',
              right: '0',
              width: '420px',
              height: '620px',
              backgroundColor: 'white',
              borderRadius: '24px',
              boxShadow: '0 24px 48px -12px rgba(0,0,0,0.18)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              border: '1px solid #f1f5f9',
            }}
          >
            <div style={{ backgroundColor: currentTheme.color, padding: '20px', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '22px', fontVariationSettings: "'FILL' 1" }}>
                  smart_toy
                </span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px' }}>ReliefSync Assistant</h3>
                  <p style={{ margin: 0, fontSize: '10px', opacity: 0.85, fontWeight: 700 }}>{currentTheme.label} ACTIVE</p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={resetChat} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', color: 'white', cursor: 'pointer', padding: '6px 8px', borderRadius: '8px' }}>Reset</button>
                <button onClick={() => setIsOpen(false)} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', color: 'white', cursor: 'pointer', padding: '6px 8px', borderRadius: '8px' }}>Close</button>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', backgroundColor: '#f8fafc' }}>
              {messages.map((msg, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.sender === 'user' ? 'flex-end' : 'flex-start', maxWidth: '88%', alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div
                    style={{
                      padding: '12px 16px',
                      borderRadius: msg.sender === 'user' ? '18px 18px 2px 18px' : '18px 18px 18px 2px',
                      backgroundColor: msg.sender === 'user' ? currentTheme.color : 'white',
                      color: msg.sender === 'user' ? 'white' : '#1e293b',
                      fontSize: '14px',
                      fontWeight: 500,
                      boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                      lineHeight: '1.6',
                    }}
                  >
                    {msg.sender === 'bot' && msg.title && (
                      <div style={{ fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748b', marginBottom: '8px' }}>
                        {msg.title}
                      </div>
                    )}
                    <div style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</div>
                  </div>

                  {msg.sender === 'bot' && Array.isArray(msg.suggestions) && msg.suggestions.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                      {msg.suggestions.map((suggestion) => (
                        <button
                          key={suggestion}
                          onClick={() => handleSend(suggestion)}
                          style={{
                            border: `1px solid ${currentTheme.color}20`,
                            background: '#fff',
                            color: currentTheme.color,
                            borderRadius: '999px',
                            padding: '6px 10px',
                            fontSize: '11px',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  )}
                  <span style={{ fontSize: '10px', color: '#94a3b8', marginTop: '4px', fontWeight: 600 }}>{msg.time}</span>
                </div>
              ))}

              {isLoading && (
                <div style={{ alignSelf: 'flex-start', padding: '12px 20px', backgroundColor: 'white', borderRadius: '18px', display: 'flex', gap: '4px' }}>
                  <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1 }} style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#cbd5e1' }} />
                  <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#cbd5e1' }} />
                  <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#cbd5e1' }} />
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <div style={{ padding: '12px', display: 'flex', flexWrap: 'wrap', gap: '8px', borderTop: '1px solid #f1f5f9', backgroundColor: 'white', justifyContent: 'center' }}>
              {currentActions.map((action) => (
                <button
                  key={action}
                  onClick={() => handleSend(action)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '12px',
                    border: `1px solid ${currentTheme.color}20`,
                    backgroundColor: `${currentTheme.color}08`,
                    color: currentTheme.color,
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {action}
                </button>
              ))}
            </div>

            <div style={{ padding: '20px', borderTop: '1px solid #f1f5f9', backgroundColor: 'white' }}>
              <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} style={{ display: 'flex', gap: '12px' }}>
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask for mission guidance..."
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    outline: 'none',
                    fontSize: '14px',
                    fontWeight: 500,
                  }}
                />
                <button
                  type="submit"
                  style={{
                    padding: '12px 20px',
                    borderRadius: '12px',
                    backgroundColor: currentTheme.color,
                    color: 'white',
                    border: 'none',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  Send
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AIAssistant;
