import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface AIAssistantProps {
  currentUser: {
    id: string;
    name: string;
    role: 'admin' | 'volunteer' | 'user';
    skills?: string[];
    area?: string;
  };
}

const AIAssistant: React.FC<AIAssistantProps> = ({ currentUser }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Role Styling
  const theme = {
    admin: { color: '#7c3aed', label: 'Command Core', emoji: '👑' },
    volunteer: { color: '#059669', label: 'Field Ops', emoji: '🛠️' },
    user: { color: '#2563eb', label: 'Community', emoji: '🏠' }
  };

  const currentTheme = theme[currentUser?.role] || theme.user;

  // Role Action Buttons
  const actionButtons = {
    admin: ['Overview', 'Urgent Needs', 'Volunteers', 'Report', 'Coverage', 'Match'],
    volunteer: ['Find Tasks', 'My Tasks', 'Done Task', 'Availability', 'Directions', 'My History'],
    user: ['Report Need', 'Check Status', 'Emergency', 'Contact', 'How it Works', 'Volunteer']
  };

  const currentActions = actionButtons[currentUser?.role] || actionButtons.user;

  // Initialize Chat
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const welcome = getWelcomeMessage(currentUser.role);
      setMessages([{ 
        text: welcome, 
        sender: 'bot', 
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
      }]);
    }
  }, [isOpen]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const getWelcomeMessage = (role: string) => {
    if (role === 'admin') return `Operational clearance granted, ${currentUser.name}. I can help you monitor regional overview, manage field volunteers, check infrastructure coverage, and generate mission reports. How shall we proceed?`;
    if (role === 'volunteer') return `Safety protocols active, ${currentUser.name}. Ready to assist with finding frontline tasks, reviewing your assignments, updating mission availability, or marking tasks as secured. What's the status?`;
    return `Welcome to the community sync, ${currentUser.name}. I'm here to help you report emergency needs, check the status of your requests, or connect with local coordinators. How are you today?`;
  };

  const handleSend = async (text: string = input) => {
    if (!text.trim()) return;

    const userMsg = { 
      text, 
      sender: 'user', 
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
    };
    
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          userId: currentUser.id,
          userRole: currentUser.role,
          userData: currentUser
        })
      });

      const data = await response.json();
      const developerHint =
        typeof data.error === 'string' && data.error.includes('PERMISSION_DENIED')
          ? 'Vertex assistant is using credentials from a different Google Cloud project. Update the Vertex service account or enable Dialogflow API access for that credential.'
          : null;
      
      const botMsg = { 
        text: developerHint || data.reply, 
        sender: 'bot', 
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
      };
      setMessages(prev => [...prev, botMsg]);
    } catch (err) {
      setMessages(prev => [...prev, { 
        text: "Terminal link unstable. Re-establishing connection...", 
        sender: 'bot', 
        time: new Date().toLocaleTimeString() 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const resetChat = async () => {
    try {
      await fetch('/api/ai/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id })
      });
      setMessages([]);
      setIsOpen(false);
      setTimeout(() => setIsOpen(true), 100);
    } catch (err) {
      console.error('Reset failed');
    }
  };

  return (
    <div style={{ position: 'fixed', bottom: '104px', right: '32px', zIndex: 9999, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      
      {/* Floating Button */}
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
          fontSize: '28px'
        }}
      >
        {isOpen ? '✕' : '🤖'}
      </motion.button>

      {/* Chat Window */}
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
              width: '400px',
              height: '600px',
              backgroundColor: 'white',
              borderRadius: '24px',
              boxShadow: '0 24px 48px -12px rgba(0,0,0,0.18)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              border: '1px solid #f1f5f9'
            }}
          >
            {/* Header */}
            <div style={{ backgroundColor: currentTheme.color, padding: '20px', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '24px' }}>🤖</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px' }}>ReliefSync Assistant</h3>
                  <p style={{ margin: 0, fontSize: '10px', opacity: 0.8, fontWeight: 700 }}>{currentTheme.label} • ACTIVE</p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={resetChat} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', cursor: 'pointer', padding: '6px', borderRadius: '8px' }}>🔄</button>
                <button onClick={() => setIsOpen(false)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', cursor: 'pointer', padding: '6px', borderRadius: '8px' }}>ー</button>
              </div>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', backgroundColor: '#f8fafc' }}>
              {messages.map((msg, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.sender === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%', alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div style={{ 
                    padding: '12px 16px', 
                    borderRadius: msg.sender === 'user' ? '18px 18px 2px 18px' : '18px 18px 18px 2px',
                    backgroundColor: msg.sender === 'user' ? currentTheme.color : 'white',
                    color: msg.sender === 'user' ? 'white' : '#1e293b',
                    fontSize: '14px',
                    fontWeight: 500,
                    boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                    lineHeight: '1.5'
                  }}>
                    {msg.sender === 'bot' ? '🤖 ' : `${currentTheme.emoji} `}
                    {msg.text}
                  </div>
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

            {/* Quick Actions */}
            <div style={{ padding: '12px', display: 'flex', flexWrap: 'wrap', gap: '8px', borderTop: '1px solid #f1f5f9', backgroundColor: 'white', justifyContent: 'center' }}>
              {currentActions.map(action => (
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
                    transition: 'all 0.2s'
                  }}
                >
                  {action}
                </button>
              ))}
            </div>

            {/* Input Form */}
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
                    fontWeight: 500
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
                    cursor: 'pointer'
                  }}
                >
                  ➤
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
