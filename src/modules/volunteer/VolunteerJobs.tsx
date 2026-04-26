import { useEffect, useState, useMemo } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../core/firebase/config';
import { useStore } from '../../core/store/useStore';
import { GoogleMap, useJsApiLoader, HeatmapLayerF } from '@react-google-maps/api';

const libraries: ("places" | "geometry" | "visualization")[] = ['places', 'visualization'];

const SEVERITY_WEIGHTS: Record<string, number> = {
  Critical: 3,
  High: 2,
  Medium: 1,
  Low: 1,
};

const SEVERITY_COLORS: Record<string, string> = {
  Critical: '#ba1a1a',
  High: '#f97316',
  Medium: '#eab308',
  Low: '#22c55e',
};

const SEVERITY_BG: Record<string, string> = {
  Critical: '#ffdad6',
  High: '#ffedd5',
  Medium: '#fef9c3',
  Low: '#dcfce7',
};

const NOT_REGISTERED_MESSAGE = 'You are not registered as volunteer';
const WAITING_APPROVAL_MESSAGE = 'Waiting for approval';
type VolunteerStatus = { registered: boolean; approved: boolean };

const getVolunteerStatus = async (uid: string): Promise<VolunteerStatus> => {
  const volunteerSnapshot = await getDoc(doc(db, 'volunteers', uid));

  if (!volunteerSnapshot.exists()) {
    return { registered: false, approved: false };
  }

  const volunteerData = volunteerSnapshot.data();
  return {
    registered: true,
    approved: volunteerData.approved === true,
  };
};

export const VolunteerJobs = () => {
  const { user } = useStore();
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [volunteerStatus, setVolunteerStatus] = useState<VolunteerStatus>({ registered: true, approved: true }); // Assume true to avoid flicker if just transitioned
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [filter, setFilter] = useState('All');
  const [severityFilter, setSeverityFilter] = useState('All');
  const [distanceFilter, setDistanceFilter] = useState(50); // km
  const [userLocation, setUserLocation] = useState<{ lat: number, lng: number } | null>(null);
  const [mapView, setMapView] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    
    // Requirement 1: Fetch volunteer document using current user UID
    const checkStatus = async () => {
      try {
        const status = await getVolunteerStatus(user.id);
        setVolunteerStatus(status);
      } catch (err) {
        console.error('Failed to sync volunteer status:', err);
      }
    };
    checkStatus();
  }, [user?.id]);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        (err) => console.warn('Geolocation error:', err)
      );
    }
  }, []);

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
    libraries,
  });

  const heatmapData = useMemo(() => {
    if (!isLoaded) return [];
    return jobs
      .filter(j => j.location?.lat && j.location?.lng)
      .map(j => ({
        location: new google.maps.LatLng(j.location.lat, j.location.lng),
        weight: SEVERITY_WEIGHTS[j.severity] || 1,
      }));
  }, [jobs, isLoaded]);

  const getTimestampValue = (value: any) => {
    if (!value) return 0;
    if (typeof value.toMillis === 'function') return value.toMillis();
    if (typeof value.seconds === 'number') return value.seconds * 1000;
    if (value instanceof Date) return value.getTime();

    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  };



  useEffect(() => {
    if (!user?.id) return;

    setLoading(true);
    setErrorMessage(null);

    const q = query(
      collection(db, 'reports'),
      where('status', '==', 'open')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        try {
          const docs = snapshot.docs
            .map(doc => ({
              id: doc.id,
              ...doc.data()
            }))
            .filter((doc: any) => !doc.assignedTo)
            .sort((a: any, b: any) => getTimestampValue(b.createdAt) - getTimestampValue(a.createdAt));

          setJobs(docs);
          setErrorMessage(null);
        } catch (err) {
          console.error('Error processing VolunteerJobs snapshot:', err);
          setErrorMessage('Error processing mission data.');
        } finally {
          setLoading(false);
        }
      },
      (error) => {
        console.error('VolunteerJobs Firestore query failed:', error);

        const nextMessage =
          error.code === 'permission-denied'
            ? 'Your account does not have permission to view active missions right now.'
            : 'Please try again in a moment. ' + (error.message || '');

        setJobs([]);
        setErrorMessage(nextMessage);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user?.id]);

  const handleTakeJob = async (jobId: string) => {
    if (!user?.id) {
      alert('Authentication required. Please sign in again.');
      return;
    }

    setClaimingId(jobId);
    console.log(`[EXECUTION] User UID: ${user.id} | Action: Claim Job ${jobId}`);

    try {
      await runTransaction(db, async (transaction) => {
        // Requirement 1: Fetch volunteer document and check status
        const volunteerRef = doc(db, 'volunteers', user.id);
        const volunteerSnapshot = await transaction.get(volunteerRef);
        
        console.log(`[STAGING] Volunteer Doc Presence: ${volunteerSnapshot.exists()}`);
        
        if (!volunteerSnapshot.exists()) {
          throw new Error("NOT_REGISTERED");
        }
        
        const volunteerData = volunteerSnapshot.data();
        console.log(`[STAGING] Volunteer Approval Status: ${volunteerData.approved} (${typeof volunteerData.approved})`);
        
        // Requirement 1: Ensure approved is boolean true
        if (volunteerData.approved !== true) {
          throw new Error("NOT_APPROVED");
        }

        // Requirement 2: Validate job status
        const jobRef = doc(db, 'reports', jobId);
        const jobDoc = await transaction.get(jobRef);

        if (!jobDoc.exists()) {
          throw new Error("NOT_FOUND");
        }

        const data = jobDoc.data();
        console.log(`[STAGING] Job Status: ${data.status} | Already Assigned: ${!!data.assignedTo}`);
        
        if (data.status !== 'open' || data.assignedTo) {
          throw new Error("ALREADY_ASSIGNED");
        }

        // Requirement 3: Safe Transactional Updates
        // 1. Update Global Report
        transaction.update(jobRef, {
          assignedTo: user.id,
          assignedAt: serverTimestamp(),
          status: 'assigned',
          updatedAt: serverTimestamp(),
          missionStatus: 'assigned',
        });
        
        // 2. Log Action in taskUpdates
        const updateRef = doc(collection(db, 'taskUpdates'));
        transaction.set(updateRef, {
          taskId: jobId,
          volunteerId: user.id,
          type: 'claim',
          note: `System Audit: Mission claimed by verified responder ${user.name} (UID: ${user.id.slice(0, 8)})`,
          createdAt: serverTimestamp(),
        });

      });
      
      alert('Mission successfully claimed! Check "My Tasks" for deployment details.');
    } catch (error: any) {
      console.error("[ERROR] Job Assignment Failed:", error);
      
      // Requirement 5: Specific Error Messages
      let userMsg = 'Failed to claim mission. Please try again.';
      
      if (error.message === 'NOT_REGISTERED') {
        userMsg = NOT_REGISTERED_MESSAGE;
      } else if (error.message === 'NOT_APPROVED') {
        userMsg = WAITING_APPROVAL_MESSAGE;
      } else if (error.message === 'ALREADY_ASSIGNED') {
        userMsg = 'Job already assigned: Another responder has already claimed this mission.';
      } else if (error.message === 'NOT_FOUND') {
        userMsg = 'Error: The selected mission data could not be found.';
      } else if (error.code === 'permission-denied') {
        const status = await getVolunteerStatus(user.id);

        if (!status.registered) {
          userMsg = NOT_REGISTERED_MESSAGE;
        } else if (status.approved !== true) {
          userMsg = WAITING_APPROVAL_MESSAGE;
        } else {
          userMsg = 'Mission claim blocked by Firestore permissions. Refresh and try again.';
        }
      } else if (error.code === 'aborted') {
        userMsg = 'This mission changed while you were claiming it. Refresh and try again.';
      }
      
      alert(userMsg);
    } finally {
      // Requirement 4: Loading state reset
      setClaimingId(null);
    }
  };

  const filteredJobs = useMemo(() => {
    return jobs.filter(j => {
      const matchCategory = filter === 'All' || j.category === filter;
      const matchSeverity = severityFilter === 'All' || j.severity === severityFilter;
      
      let matchDistance = true;
      if (userLocation && j.location?.lat && j.location?.lng) {
        const dist = calculateDistance(userLocation.lat, userLocation.lng, j.location.lat, j.location.lng);
        matchDistance = dist <= distanceFilter;
        j.computedDistance = dist; // Inject distance for UI
      }

      return matchCategory && matchSeverity && matchDistance;
    });
  }, [jobs, filter, severityFilter, distanceFilter, userLocation]);

  const categories = useMemo(() => ['All', ...new Set(jobs.map(j => j.category))], [jobs]);

  return (
    <div className="flex flex-col gap-6">
      {!volunteerStatus.registered && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-center gap-4 animate-in fade-in slide-in-from-top-2">
          <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-rose-600">person_off</span>
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-bold text-rose-900">Volunteer Registration Missing</h4>
            <p className="text-xs text-rose-700">Your account is in volunteer mode, but no matching volunteer document was found. Open Firebase and create `volunteers/&lt;uid&gt;` or re-run the volunteer activation flow.</p>
          </div>
        </div>
      )}

      {volunteerStatus.registered && !volunteerStatus.approved && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-4 animate-in fade-in slide-in-from-top-2">
          <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-amber-600">lock_clock</span>
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-bold text-amber-900">Verification Pending</h4>
            <p className="text-xs text-amber-700">Your responder clearance is currently being reviewed. You can view missions but cannot claim them yet.</p>
          </div>
        </div>
      )}


      <div className="flex justify-between items-center gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-on-surface">Operations Console</h1>
          <p className="text-on-surface-variant text-sm mt-1">Discover available high-impact missions in your area.</p>
        </div>
        <div className="flex bg-slate-100 rounded-xl p-1">
          <button 
            onClick={() => setMapView(false)}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${!mapView ? 'bg-white shadow-[0_4px_12px_rgba(0,0,0,0.05)] text-blue-700' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: !mapView ? "'FILL' 1" : "" }}>reorder</span>
            Grid View
          </button>
          <button 
            onClick={() => setMapView(true)}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${mapView ? 'bg-white shadow-[0_4px_12px_rgba(0,0,0,0.05)] text-blue-700' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: mapView ? "'FILL' 1" : "" }}>radar</span>
            Heatmap
          </button>
        </div>
      </div>

      {mapView && isLoaded ? (
        <div className="h-[500px] w-full rounded-[32px] overflow-hidden border border-slate-200/50 shadow-2xl relative group">
           <GoogleMap
            mapContainerStyle={{ width: '100%', height: '100%' }}
            center={userLocation || { lat: 20.5937, lng: 78.9629 }} 
            zoom={userLocation ? 13 : 5}
            options={{
              styles: [
                {
                  featureType: 'all',
                  elementType: 'labels.text.fill',
                  stylers: [{ color: '#746855' }]
                },
                {
                  featureType: 'water',
                  elementType: 'geometry',
                  stylers: [{ color: '#e9e9e9' }]
                },
                {
                  featureType: 'landscape',
                  elementType: 'geometry',
                  stylers: [{ color: '#f5f5f5' }]
                },
                {
                  featureType: 'road',
                  elementType: 'geometry',
                  stylers: [{ color: '#ffffff' }]
                },
                {
                  featureType: 'all',
                  elementType: 'all',
                  stylers: [{ saturation: -100 }, { lightness: 10 }]
                }
              ],
              disableDefaultUI: true,
              zoomControl: true,
              scrollwheel: true,
            }}
          >
            <HeatmapLayerF 
              data={heatmapData}
              options={{ 
                radius: 40,
                opacity: 0.9,
                gradient: [
                  'rgba(0, 0, 0, 0)',
                  'rgba(128, 0, 128, 0.1)',
                  'rgba(255, 0, 0, 0.4)',
                  'rgba(255, 69, 0, 0.7)',
                  'rgba(255, 140, 0, 0.85)',
                  'rgba(255, 215, 0, 1)',
                  'rgba(255, 255, 200, 1)'
                ]
              }}
            />
          </GoogleMap>
          
          {/* Intelligence Overlays */}
          <div className="absolute top-6 left-6 right-6 flex justify-between items-start pointer-events-none">
            <div className="bg-white/80 backdrop-blur-xl p-4 rounded-3xl border border-white shadow-2xl pointer-events-auto transition-all hover:scale-105">
               <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/20">
                    <span className="material-symbols-outlined text-white text-xl font-bold">query_stats</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-orange-600 uppercase tracking-[0.2em] leading-none mb-1">Signal Density</span>
                    <span className="text-sm font-black text-slate-900 tracking-tight">Active Heat Signature</span>
                  </div>
               </div>
            </div>

            <div className="flex flex-col gap-2 pointer-events-auto">
               <div className="bg-slate-900/40 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-[10px] font-bold text-white uppercase tracking-widest">Live Updates</span>
               </div>
            </div>
          </div>

          <div className="absolute bottom-6 left-6 right-6 pointer-events-none">
             <div className="bg-white/90 backdrop-blur-xl p-5 rounded-[24px] border border-white shadow-2xl flex items-center justify-between pointer-events-auto">
                <div className="flex gap-6">
                   <div className="flex flex-col">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Reports</span>
                      <span className="text-xl font-black text-slate-900">{jobs.length}</span>
                   </div>
                   <div className="w-px h-10 bg-slate-100" />
                   <div className="flex flex-col">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">High Severity</span>
                      <span className="text-xl font-black text-red-600">{jobs.filter(j => j.severity === 'Critical' || j.severity === 'High').length}</span>
                   </div>
                </div>
                <div className="flex items-center gap-2 bg-blue-50 px-4 py-2 rounded-xl text-blue-700">
                   <span className="material-symbols-outlined text-sm font-bold">my_location</span>
                   <span className="text-xs font-black uppercase tracking-wider">Auto-Centered</span>
                </div>
             </div>
          </div>
        </div>
      ) : (
        <>
      <div className="flex justify-between items-end gap-4 flex-wrap">
        <div className="hidden">
          <h1 className="text-2xl font-extrabold tracking-tight text-on-surface">Operations Console</h1>
          <p className="text-on-surface-variant text-sm mt-1">Discover available high-impact missions in your area.</p>
        </div>
        <div className="flex bg-surface-container rounded-lg p-1">
          {['All', 'Critical', 'High'].map(f => (
            <button
              key={f}
              onClick={() => setSeverityFilter(f)}
              className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${
                severityFilter === f
                  ? 'bg-white shadow-sm text-primary' 
                  : 'text-on-surface-variant'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Filter Chips */}
      <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${
              filter === cat 
                ? 'bg-blue-700 text-white border-blue-700' 
                : 'bg-white text-on-surface-variant border-slate-200'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Distance Slider */}
      <div className="flex flex-col gap-2 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex justify-between items-center">
          <span className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Radius: {distanceFilter} km</span>
          <span className="material-symbols-outlined text-slate-400 text-sm">distance</span>
        </div>
        <input 
          type="range" 
          min="1" 
          max="500" 
          value={distanceFilter} 
          onChange={(e) => setDistanceFilter(parseInt(e.target.value))}
          className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-700"
        />
      </div>

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-4 text-on-surface-variant">
          <span className="material-symbols-outlined animate-spin text-4xl">progress_activity</span>
          <p className="text-sm font-bold uppercase tracking-widest">Scanning for signals...</p>
        </div>
      ) : errorMessage ? (
        <div className="py-20 flex flex-col items-center justify-center text-center px-6">
          <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-red-500 text-3xl">cloud_off</span>
          </div>
          <h2 className="text-lg font-bold text-on-surface">Unable to fetch data</h2>
          <p className="text-on-surface-variant text-sm max-w-sm mt-2">{errorMessage}</p>
        </div>
      ) : filteredJobs.length === 0 ? (
        <div className="py-20 flex flex-col items-center justify-center text-center px-6">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-slate-400 text-3xl">radar</span>
          </div>
          <h2 className="text-lg font-bold text-on-surface">No active missions available</h2>
          <p className="text-on-surface-variant text-sm max-w-xs mt-2">No active missions matching your criteria at this moment.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredJobs.map(job => (
            <div key={job.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow flex flex-col">
              <div className="p-4 flex flex-col gap-3">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex flex-col gap-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span 
                        className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider"
                        style={{ backgroundColor: SEVERITY_BG[job.severity], color: SEVERITY_COLORS[job.severity] }}
                      >
                        {job.severity}
                      </span>
                      <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">{job.category}</span>
                      {job.isAnonymous && (
                        <div className="flex items-center gap-1 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-2 py-0.5 rounded">
                           <span className="material-symbols-outlined text-[12px]">visibility_off</span>
                           Anonymous
                        </div>
                      )}
                    </div>
                    <h3 className="text-base font-extrabold text-on-surface truncate">{job.title}</h3>
                    <div className="flex items-center gap-2">
                       <span className="text-[10px] font-bold text-slate-500">{job.isAnonymous ? `@${job.userName || 'Anonymous'}` : job.userName || 'Community user'}</span>
                       <div className="w-1 h-1 rounded-full bg-slate-300" />
                       <div className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px] text-blue-600 font-bold">verified</span>
                          <span className="text-[10px] font-black text-blue-700 uppercase">Confidence: {Math.min(100, 60 + (Array.isArray(job.verifiedBy) ? job.verifiedBy.length : 0) * 10)}%</span>
                       </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end shrink-0">
                    <span className="text-blue-700 font-black text-sm">{job.computedDistance ? job.computedDistance.toFixed(1) : '??'} km</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Distance</span>
                  </div>
                </div>

                <p className="text-sm text-on-surface-variant line-clamp-2 leading-relaxed">
                  {job.description || 'No description provided for this incident.'}
                </p>

                <div className="grid grid-cols-2 gap-2 mt-1">
                  <div className="bg-slate-50 rounded-xl p-3 flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Est. Effort</span>
                    <span className="text-xs font-extrabold text-slate-700 flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">schedule</span>
                      2-3 Hours
                    </span>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3 flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Affected</span>
                    <span className="text-xs font-extrabold text-slate-700 flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">groups</span>
                      5-10 People
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-4 mt-auto border-t border-slate-50 bg-slate-50/50 flex gap-2">
                <button 
                  onClick={() => handleTakeJob(job.id)}
                  disabled={!!claimingId || !volunteerStatus.registered || !volunteerStatus.approved}
                  className="flex-1 h-11 rounded-xl bg-blue-700 text-white font-bold text-sm shadow-lg shadow-blue-700/20 active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 flex items-center justify-center gap-2"
                  title={!volunteerStatus.registered ? NOT_REGISTERED_MESSAGE : !volunteerStatus.approved ? WAITING_APPROVAL_MESSAGE : 'Take This Job'}
                >
                  {claimingId === job.id ? (
                    <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>
                  ) : (
                    <span className="material-symbols-outlined text-base">pan_tool</span>
                  )}
                  {claimingId === job.id
                    ? 'Claiming...'
                    : (volunteerStatus.registered && volunteerStatus.approved)
                      ? 'Take This Job'
                      : !volunteerStatus.registered 
                        ? 'Not Registered' 
                        : 'Pending Approval'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      </>
    )}
  </div>
);
};
