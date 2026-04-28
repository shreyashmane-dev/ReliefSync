import { useMemo, useState, useEffect } from 'react';
import { GoogleMap, useJsApiLoader, HeatmapLayer } from '@react-google-maps/api';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../core/firebase/config';
import { googleMapsLibraries, googleMapsScriptId } from '../../core/maps/googleMaps';
import { googleMapsMapId } from '../../config/googleMaps';

export const AnalyticsMap = () => {
  const [timeRange, setTimeRange] = useState('24h');
  const [reports, setReports] = useState<any[]>([]);
  const { isLoaded } = useJsApiLoader({
    id: googleMapsScriptId,
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
    libraries: googleMapsLibraries,
  });

  useEffect(() => {
    return onSnapshot(collection(db, 'reports'), (snap) => {
      setReports(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
  }, []);

  const heatmapData = useMemo(() => {
    if (!isLoaded || !reports.length) return [];
    try {
      return reports
        .filter(r => r.location && r.location.lat && r.location.lng)
        .map(r => ({
          location: new google.maps.LatLng(Number(r.location.lat), Number(r.location.lng)),
          weight: r.severity === 'Critical' ? 5 : r.severity === 'High' ? 3 : 1
        }));
    } catch (e) {
      console.error('Heatmap Data Error:', e);
      return [];
    }
  }, [reports, isLoaded]);

  const mapContainerStyle = {
    width: '100%',
    height: '100%'
  };

  // Center based on first available report or default to Pune
  const initialCenter = useMemo(() => {
    const firstRep = reports.find(r => r.location?.lat && r.location?.lng);
    if (firstRep) return { lat: Number(firstRep.location.lat), lng: Number(firstRep.location.lng) };
    return { lat: 18.5204, lng: 73.8567 };
  }, [reports]);

  const mapStyles = [
    {
      "elementType": "geometry",
      "stylers": [{ "color": "#0f172a" }] // Deep slate
    },
    {
      "elementType": "labels.icon",
      "stylers": [{ "visibility": "off" }]
    },
    {
      "elementType": "labels.text.fill",
      "stylers": [{ "color": "#64748b" }]
    },
    {
       "featureType": "water",
       "elementType": "geometry",
       "stylers": [{ "color": "#0ea5e9" }]
    }
  ];

  return (
    <div className="flex flex-col gap-8 h-[calc(100vh-160px)]">
      <div className="flex justify-between items-start shrink-0">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Active Incident Heatmap</h2>
          <p className="text-slate-500 font-medium">Real-time intensity cluster based on verified registration points.</p>
        </div>
        <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
          {['24h', '7d', '30d', 'Forecast'].map(range => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                timeRange === range 
                  ? 'bg-white text-blue-700 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0 flex gap-8">
        {/* Map View */}
        <div className="flex-[2] bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm relative">
          {isLoaded ? (
            <GoogleMap
              mapContainerStyle={mapContainerStyle}
              center={initialCenter}
              zoom={13}
              options={{
                styles: mapStyles,
                mapId: googleMapsMapId,
                disableDefaultUI: true,
                zoomControl: true,
              }}
            >
              {heatmapData.length > 0 && (
                <HeatmapLayer
                  data={heatmapData}
                  options={{
                    radius: 60,
                    opacity: 1,
                    dissipating: true
                  }}
                />
              )}
            </GoogleMap>
          ) : (
            <div className="w-full h-full bg-slate-50 flex items-center justify-center">
              <span className="material-symbols-outlined animate-spin text-slate-300">progress_activity</span>
            </div>
          )}

          {/* Map Overlay Controls */}
          <div className="absolute top-6 left-6 flex flex-col gap-2">
             <div className="bg-white/90 backdrop-blur rounded-2xl p-4 shadow-xl border border-slate-100 min-w-[200px]">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Live Intensity Legend</h4>
                <div className="flex flex-col gap-3">
                   {[
                     { label: 'Critical Reports', color: '#ef4444', count: reports.filter(r => r.severity === 'Critical').length },
                     { label: 'High Priority', color: '#f97316', count: reports.filter(r => r.severity === 'High').length },
                     { label: 'Active Incidents', color: '#3b82f6', count: reports.length },
                   ].map(layer => (
                     <div key={layer.label} className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: layer.color }}></div>
                        <span className="flex-1 text-[11px] font-bold text-slate-600">{layer.label}</span>
                        <span className="text-[10px] font-black text-slate-400">{layer.count}</span>
                     </div>
                   ))}
                </div>
             </div>
          </div>
        </div>

        {/* Analytics Side Panel */}
        <div className="flex-1 flex flex-col gap-6 overflow-y-auto pr-2">
           <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
              <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-4">Risk Forecasting</h4>
              <div className="flex flex-col gap-6">
                 <div>
                    <div className="flex justify-between items-center mb-2">
                       <span className="text-[11px] font-bold text-slate-500 uppercase">Demand Surge Prob.</span>
                       <span className="text-sm font-black text-red-600">82%</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                       <div className="h-full bg-red-600 rounded-full" style={{ width: '82%' }}></div>
                    </div>
                 </div>
                 <p className="text-xs text-slate-500 font-medium leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    AI detects anomaly in rainfall patterns near Sector 12. Potential flash flood risk within next 3 hours.
                 </p>
              </div>
           </div>

           <div className="bg-slate-900 rounded-3xl p-6 text-white">
              <h4 className="text-sm font-black uppercase tracking-widest mb-4">What-if Simulation</h4>
              <p className="text-slate-400 text-xs font-medium mb-6">Simulate escalation impact on resource availability.</p>
              <button className="w-full py-3 rounded-2xl bg-blue-600 text-white text-[10px] font-bold uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/30">
                 Run Flood Simulation
              </button>
           </div>
        </div>
      </div>
    </div>
  );
};
