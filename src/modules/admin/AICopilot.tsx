export const AICopilot = () => {
  return (
    <div className="flex flex-col gap-8">
       <div className="flex justify-between items-start shrink-0">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">AI Copilot</h2>
          <p className="text-slate-500 font-medium">Strategic decision support and predictive operational recommendations.</p>
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
                        <div className="flex justify-between items-start mb-3">
                           <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-[10px] font-black uppercase tracking-widest leading-none">Deployment Opt.</span>
                           <span className="text-[10px] font-bold text-slate-400">92% Confidence</span>
                        </div>
                        <h4 className="font-extrabold text-base mb-2">Redeploy 24% of Sector 4 responders to Sector 7.</h4>
                        <p className="text-xs text-slate-500 font-medium leading-relaxed">
                          Analysis predicts a demand surge in Sector 7 due to flash flood progression. Current responder density is insufficient for the forecasted casualty load.
                        </p>
                        <button className="mt-6 w-full py-3 rounded-2xl bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all">
                           Accept Recommendation
                        </button>
                     </div>

                     <div className="p-6 rounded-[32px] bg-white/10 border border-white/20">
                        <h4 className="font-extrabold text-sm mb-2 text-white/90">Supply Shortage Warning</h4>
                        <p className="text-xs text-blue-100 font-medium opacity-80 leading-relaxed">
                          Oxygen supplies in District Hospital C will be exhausted in <span className="font-bold text-white">42 minutes</span> at current burn rate. Suggest immediate reallocation from Central Lab.
                        </p>
                     </div>
                  </div>
               </div>
               <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-white/5 blur-3xl rounded-full"></div>
            </div>
         </div>

         <div className="flex flex-col gap-8">
            <div className="bg-white rounded-[48px] border border-slate-200 p-10 shadow-sm">
               <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-8">Copilot Query Console</h4>
               <div className="bg-slate-50 rounded-[32px] p-6 border border-slate-100 mb-8">
                  <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-4">Prompt Example</p>
                  <p className="text-sm font-bold text-slate-900 mb-2 italic">"What is the impact if the flood reaching the industrial zone?"</p>
                  <div className="flex gap-2">
                     <span className="px-2 py-1 rounded-lg bg-white border border-slate-200 text-[9px] font-bold text-slate-500 uppercase tracking-widest leading-none">Simulation</span>
                     <span className="px-2 py-1 rounded-lg bg-white border border-slate-200 text-[9px] font-bold text-slate-500 uppercase tracking-widest leading-none">Resource Forecast</span>
                  </div>
               </div>

               <div className="relative">
                  <textarea 
                    placeholder="Ask Copilot a strategic question..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-[32px] p-6 pr-20 min-h-[120px] text-sm font-medium focus:outline-none focus:ring-4 focus:ring-blue-700/5 focus:border-blue-700/20 transition-all resize-none"
                  ></textarea>
                  <button className="absolute bottom-4 right-4 w-12 h-12 rounded-2xl bg-blue-700 text-white flex items-center justify-center hover:bg-blue-800 transition-all shadow-lg shadow-blue-700/20">
                     <span className="material-symbols-outlined">send</span>
                  </button>
               </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
                <div className="p-6 rounded-[32px] bg-slate-900 text-white">
                   <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Anomaly Detection</h4>
                   <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                      <span className="text-base font-black">No Anomalies</span>
                   </div>
                </div>
                <div className="p-6 rounded-[32px] bg-white border border-slate-200 shadow-sm">
                   <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Mission Efficiency</h4>
                   <div className="flex items-center gap-2">
                      <span className="text-2xl font-black text-blue-700">94.8</span>
                      <span className="material-symbols-outlined text-green-500 text-sm">trending_up</span>
                   </div>
                </div>
            </div>
         </div>
      </div>
    </div>
  );
};
