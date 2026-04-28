import { useState, useRef, useEffect } from 'react';
import { useStore } from '../../core/store/useStore';

export const VolunteerAssistant = () => {
  const { user } = useStore();
  const [messages, setMessages] = useState<any[]>([
    {
      role: 'assistant',
      content: `Field Operations Console initialized. Active volunteer ${user?.name} recognized. I am your operational AI, ready to assist with risk assessments, route optimization, and resource coordination. Type your field inquiry or select a scan below.`,
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMsg = { role: 'user', content: input, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    
    try {
      const response = await fetch('/api/chat/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'AI Service Busy');
      }

      const data = await response.json();
      setMessages(prev => [...prev, {
          role: 'assistant',
          content: data.reply || 'No response.',
          timestamp: new Date()
      }]);
    } catch (err) {
      const message =
        err instanceof Error && err.message === 'QUOTA_EXCEEDED'
          ? 'Gemini is rate limited right now. Give it a few seconds, then retry.'
          : err instanceof Error && err.message?.startsWith('API_ERROR:')
            ? 'HQ rejected the AI request. Check the server log for the exact Gemini error.'
            : "I'm having trouble connecting to HQ. Please try again or check your signal.";
      setMessages(prev => [...prev, {
          role: 'assistant',
          content: message,
          timestamp: new Date()
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full max-h-[70vh] gap-4">
       <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold tracking-tight text-on-surface">Field Assistant</h1>
        <p className="text-on-surface-variant text-sm">Actionable intelligence for active missions.</p>
      </div>

      <div className="flex-1 bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 no-scrollbar">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] p-4 rounded-2xl text-sm leading-relaxed ${
                m.role === 'user' 
                  ? 'bg-blue-700 text-white rounded-br-none' 
                  : 'bg-slate-50 text-on-surface-variant rounded-bl-none border border-slate-100'
              }`}>
                {m.content}
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-slate-50 bg-slate-50/30 flex flex-col gap-3">
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {['Risk Scan', 'Protocol Check', 'Resource Supply', 'Backup Policy'].map(chip => (
               <button 
                key={chip} 
                className="px-3 py-1.5 rounded-full bg-white border border-slate-200 text-[10px] font-black text-blue-700 uppercase tracking-widest whitespace-nowrap active:bg-blue-50"
               >
                 {chip}
               </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask for operational guidance..."
              className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:border-blue-500 transition-colors shadow-sm"
            />
            <button 
              onClick={handleSend}
              className="w-12 h-12 rounded-xl bg-blue-700 text-white flex items-center justify-center shadow-lg shadow-blue-700/20 active:scale-95 transition-transform"
            >
              <span className="material-symbols-outlined text-[20px]">send</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
