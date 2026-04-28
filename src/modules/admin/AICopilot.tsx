import { useEffect, useState } from 'react';
import { buildApiUrl } from '../../core/config/api';
import { useStore } from '../../core/store/useStore';

type CommandCenterBrief = {
  overview?: {
    activeIncidents?: number;
    criticalOpen?: number;
    availableVolunteers?: number;
    unreadAlerts?: number;
  };
  hotspots?: Array<{
    zone: string;
    incidents: number;
    critical: number;
    open: number;
    volunteerCoverage: number;
    demandPressure: number;
    underserved: boolean;
  }>;
  strategicRecommendations?: string[];
  resourcePlan?: {
    shortagePrediction?: string;
    prepositioningAdvice?: string;
    redeployments?: Array<{
      from: string;
      to: string;
      volunteers: string[];
    }>;
  };
};

export const AICopilot = () => {
  const { user } = useStore();
  const [brief, setBrief] = useState<CommandCenterBrief | null>(null);
  const [prompt, setPrompt] = useState('');
  const [reply, setReply] = useState('');
  const [nextActions, setNextActions] = useState<string[]>([]);
  const [riskFlags, setRiskFlags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    const loadBrief = async () => {
      try {
        const response = await fetch(buildApiUrl('/api/ai/intelligence/command-center'));
        if (!response.ok) return;
        const data = await response.json();
        setBrief(data);
      } catch (error) {
        console.warn('Failed to load command center brief:', error);
      } finally {
        setLoading(false);
      }
    };

    loadBrief();
  }, []);

  const submitPrompt = async () => {
    if (!prompt.trim() || asking) return;

    setAsking(true);
    try {
      const response = await fetch(buildApiUrl('/api/ai/chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: prompt,
          userId: user?.id || 'admin-console',
          userRole: 'admin',
          userData: user,
          context: brief || {},
        }),
      });
      const data = await response.json();
      setReply(data.reply || 'Copilot could not produce a recommendation.');
      setNextActions(data.nextActions || []);
      setRiskFlags(data.riskFlags || []);
    } catch (error) {
      setReply('Copilot is temporarily unavailable. Please retry in a moment.');
      setNextActions([]);
      setRiskFlags([]);
    } finally {
      setAsking(false);
    }
  };

  const primaryRecommendation = brief?.strategicRecommendations?.[0] || 'Loading strategic recommendation...';
  const resourceWarning = brief?.resourcePlan?.shortagePrediction || 'No shortage warning detected.';
  const anomalyLabel =
    brief?.hotspots?.some((entry) => entry.demandPressure > 55) ? 'Escalation Watch' : 'Stable Patterns';
  const missionEfficiency = brief?.overview?.activeIncidents
    ? Math.max(62, 100 - (brief.overview.criticalOpen || 0) * 4 - Math.max(0, (brief.overview.unreadAlerts || 0) - 2) * 2)
    : 94.8;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex justify-between items-start shrink-0">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">AI Copilot</h2>
          <p className="text-slate-500 font-medium">Vertex-powered operational intelligence, escalation planning, and command recommendations.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-8">
        <div className="flex flex-col gap-8">
          <div className="p-8 rounded-[48px] bg-blue-700 text-white shadow-2xl shadow-blue-700/30 relative overflow-hidden">
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center backdrop-blur-xl border border-white/20">
                  <span className="material-symbols-outlined text-white text-[28px] animate-pulse" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                </div>
                <h3 className="text-2xl font-black tracking-tight">Strategic Advisory</h3>
              </div>

              <div className="flex flex-col gap-6">
                <div className="p-6 rounded-[32px] bg-white text-slate-900 shadow-sm border border-white/20">
                  <div className="flex justify-between items-start mb-3 gap-3">
                    <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-[10px] font-black uppercase tracking-widest leading-none">Command Brief</span>
                    <span className="text-[10px] font-bold text-slate-400">
                      {loading ? 'Syncing...' : `${brief?.overview?.criticalOpen || 0} critical open`}
                    </span>
                  </div>
                  <h4 className="font-extrabold text-base mb-2">{primaryRecommendation}</h4>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed">
                    {brief?.resourcePlan?.prepositioningAdvice || 'Operational engine is reviewing responder balance, hotspot demand, and alert pressure.'}
                  </p>
                  <button
                    onClick={() => setPrompt('Summarize the highest priority operational move for the next 30 minutes.')}
                    className="mt-6 w-full py-3 rounded-2xl bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all"
                  >
                    Generate Next Move
                  </button>
                </div>

                <div className="p-6 rounded-[32px] bg-white/10 border border-white/20">
                  <h4 className="font-extrabold text-sm mb-2 text-white/90">Resource Warning</h4>
                  <p className="text-xs text-blue-100 font-medium opacity-80 leading-relaxed">
                    {resourceWarning}
                  </p>
                </div>
              </div>
            </div>
            <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-white/5 blur-3xl rounded-full"></div>
          </div>

          <div className="bg-white rounded-[40px] border border-slate-200 p-8 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">Hotspot Intelligence</h4>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                {brief?.hotspots?.length || 0} Zones
              </span>
            </div>
            <div className="flex flex-col gap-3">
              {(brief?.hotspots || []).slice(0, 4).map((hotspot) => (
                <div key={hotspot.zone} className="rounded-[24px] border border-slate-100 bg-slate-50 px-5 py-4">
                  <div className="flex justify-between items-center gap-4">
                    <div>
                      <div className="text-xs font-black text-slate-900">{hotspot.zone}</div>
                      <div className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        {hotspot.open} open • {hotspot.critical} critical • {hotspot.volunteerCoverage} volunteers
                      </div>
                    </div>
                    <div className={`text-sm font-black ${hotspot.underserved ? 'text-red-600' : 'text-blue-700'}`}>
                      {hotspot.demandPressure}
                    </div>
                  </div>
                </div>
              ))}
              {!loading && (!brief?.hotspots || brief.hotspots.length === 0) && (
                <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center text-xs font-bold text-slate-400 uppercase tracking-widest">
                  No hotspot spikes detected
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-8">
          <div className="bg-white rounded-[48px] border border-slate-200 p-10 shadow-sm">
            <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-8">Copilot Query Console</h4>
            <div className="bg-slate-50 rounded-[32px] p-6 border border-slate-100 mb-8">
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-4">Prompt Example</p>
              <p className="text-sm font-bold text-slate-900 mb-2 italic">"Where should we redeploy responders if one flood corridor escalates in the next 30 minutes?"</p>
              <div className="flex gap-2">
                <span className="px-2 py-1 rounded-lg bg-white border border-slate-200 text-[9px] font-bold text-slate-500 uppercase tracking-widest leading-none">Escalation</span>
                <span className="px-2 py-1 rounded-lg bg-white border border-slate-200 text-[9px] font-bold text-slate-500 uppercase tracking-widest leading-none">Resource Forecast</span>
              </div>
            </div>

            <div className="relative">
              <textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="Ask Copilot a strategic question..."
                className="w-full bg-slate-50 border border-slate-200 rounded-[32px] p-6 pr-20 min-h-[120px] text-sm font-medium focus:outline-none focus:ring-4 focus:ring-blue-700/5 focus:border-blue-700/20 transition-all resize-none"
              />
              <button
                onClick={submitPrompt}
                disabled={asking || !prompt.trim()}
                className="absolute bottom-4 right-4 w-12 h-12 rounded-2xl bg-blue-700 text-white flex items-center justify-center hover:bg-blue-800 transition-all shadow-lg shadow-blue-700/20 disabled:opacity-50"
              >
                <span className="material-symbols-outlined">{asking ? 'progress_activity' : 'send'}</span>
              </button>
            </div>

            {(reply || nextActions.length > 0 || riskFlags.length > 0) && (
              <div className="mt-8 rounded-[32px] border border-slate-100 bg-slate-50 p-6">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Copilot Response</div>
                <p className="text-sm font-medium text-slate-800 leading-relaxed">{reply}</p>
                {nextActions.length > 0 && (
                  <div className="mt-4 flex flex-col gap-2">
                    {nextActions.map((action) => (
                      <div key={action} className="rounded-2xl bg-white border border-slate-100 px-4 py-3 text-xs font-bold text-slate-700">
                        {action}
                      </div>
                    ))}
                  </div>
                )}
                {riskFlags.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {riskFlags.map((flag) => (
                      <span key={flag} className="px-3 py-1 rounded-full bg-red-50 text-red-700 text-[10px] font-black uppercase tracking-widest">
                        {flag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="p-6 rounded-[32px] bg-slate-900 text-white">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Anomaly Detection</h4>
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${anomalyLabel === 'Escalation Watch' ? 'bg-red-500' : 'bg-blue-500'} animate-pulse`}></div>
                <span className="text-base font-black">{anomalyLabel}</span>
              </div>
            </div>
            <div className="p-6 rounded-[32px] bg-white border border-slate-200 shadow-sm">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Mission Efficiency</h4>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-black text-blue-700">{missionEfficiency.toFixed(1)}</span>
                <span className="material-symbols-outlined text-green-500 text-sm">trending_up</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
