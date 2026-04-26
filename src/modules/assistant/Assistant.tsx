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
      text: `Hello! I am ReliefSync AI. Whether you need safety protocols, resource mapping, or emergency assessment, I'm here to coordinate. How can I help you in the field today?`,
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (text?: string) => {
    const message = (text || input).trim();
    if (!message || loading) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', text: message };
    const botId = (Date.now() + 1).toString();
    const botMsg: Message = { id: botId, role: 'model', text: 'Analyzing satellite data and connecting to field response unit...', streaming: true };

    setMessages(prev => [...prev, userMsg, botMsg]);
    setInput('');
    setLoading(true);

    try {
       const response = await fetch('/api/chat', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ message }),
       });
       const data = await response.json();
       setMessages(prev => prev.map(m => m.id === botId ? { ...m, text: data.reply || 'No response.', streaming: false } : m));
    } catch (err) {
       setMessages(prev => prev.map(m => m.id === botId ? { ...m, text: 'Service busy. Please try again.', streaming: false } : m));
    } finally {
       setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)] max-w-4xl mx-auto w-full">
      {/* AI Header */}
      <div className="flex items-center gap-4 p-8 bg-slate-900 rounded-[32px] mb-6 text-white shadow-xl shadow-slate-900/10">
         <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/20">
            <span className="material-symbols-outlined text-white">smart_toy</span>
         </div>
         <div className="flex-1">
            <h2 className="text-lg font-black tracking-tight leading-none">ReliefSync AI</h2>
            <div className="flex items-center gap-2 mt-1">
               <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
               <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Cognitive Dispatch Live</span>
            </div>
         </div>
      </div>

      {/* Chat Area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 flex flex-col gap-8 hide-scrollbar pb-10"
      >
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
             <div className={`max-w-[85%] p-6 rounded-[32px] text-sm font-medium leading-relaxed shadow-sm border ${
               msg.role === 'user' 
               ? 'bg-blue-600 border-blue-500 text-white rounded-tr-none shadow-blue-600/10' 
               : 'bg-white border-slate-100 text-slate-700 rounded-tl-none'
             }`}>
                {msg.text}
             </div>
          </div>
        ))}
      </div>

      {/* Input Section */}
      <div className="mt-auto px-4 pb-4 bg-transparent border-t border-slate-50 pt-6">
         <div className="flex gap-2 overflow-x-auto pb-4 hide-scrollbar">
            {SUGGESTIONS.map(s => (
              <button 
                key={s.label}
                onClick={() => handleSend(s.label)}
                className="px-5 py-2.5 rounded-xl bg-white border border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:border-blue-200 hover:text-blue-700 transition-all whitespace-nowrap shadow-sm"
              >
                 {s.label}
              </button>
            ))}
         </div>

         <div className="relative flex items-center gap-2 bg-white rounded-[32px] p-2 border border-slate-200 shadow-xl shadow-slate-200/20 focus-within:ring-4 focus-within:ring-blue-700/5 transition-all">
            <input 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask for mission guidance..."
              className="flex-1 bg-transparent border-none focus:outline-none pl-6 text-sm font-medium text-slate-700"
            />
            <button 
              onClick={() => handleSend()}
              disabled={!input.trim() || loading}
              className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center hover:bg-slate-800 transition-all disabled:opacity-20"
            >
               <span className="material-symbols-outlined text-sm">send</span>
            </button>
         </div>
      </div>
    </div>
  );
};
