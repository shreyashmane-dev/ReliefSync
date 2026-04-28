import { useEffect, useState, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
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
import { googleMapsLibraries, googleMapsScriptId } from '../../core/maps/googleMaps';
import { useStore } from '../../core/store/useStore';
import { CircleF, GoogleMap, useJsApiLoader } from '@react-google-maps/api';
import { FullMapScreen } from '../../components/FullMapScreen';
import { googleMapsMapId } from '../../config/googleMaps';

const SEVERITY_ZONE_STYLE: Record<string, { radius: number; fillOpacity: number }> = {
  Critical: { radius: 900, fillOpacity: 0.28 },
  High: { radius: 700, fillOpacity: 0.22 },
  Medium: { radius: 500, fillOpacity: 0.18 },
  Low: { radius: 360, fillOpacity: 0.14 },
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
  const [showFullMap, setShowFullMap] = useState(false);
  const [allVolunteers, setAllVolunteers] = useState<any[]>([]);
  const [locationSavedBanner, setLocationSavedBanner] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    
    // Requirement 1: Fetch volunteer document and their registered location
    const unsubscribe = onSnapshot(doc(db, 'volunteers', user.id), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setVolunteerStatus({
          registered: true,
          approved: data.approved === true
        });
        
        // If they have a registered coverage location, use it as the operational center
        if (data.location?.lat && data.location?.lng) {
          console.log('[SYNC] Using registered volunteer location:', data.location);
          setUserLocation({ lat: data.location.lat, lng: data.location.lng });
        }
      } else {
        setVolunteerStatus({ registered: false, approved: false });
      }
    }, (err) => {
      console.error('Failed to sync volunteer status:', err);
    });

    return () => unsubscribe();
  }, [user?.id]);

  useEffect(() => {
    // Fallback/Update browser location if not already set by registered profile
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation(prev => {
            if (prev) return prev; // Keep registered location if exists
            return { lat: pos.coords.latitude, lng: pos.coords.longitude };
          });
        },
        (err) => console.warn('Geolocation error:', err)
      );
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'volunteers'), (snapshot) => {
      setAllVolunteers(
        snapshot.docs.map((entry) => ({
          id: entry.id,
          ...entry.data()
        }))
      );
    }, (err) => {
      console.error('Failed to sync all volunteers:', err);
    });

    return () => unsubscribe();
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
    id: googleMapsScriptId,
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
    libraries: googleMapsLibraries,
  });

  const mapSignals = useMemo(() => {
    return jobs
      .filter(j => j.location?.lat && j.location?.lng)
      .map(j => ({
        id: j.id,
        center: { lat: j.location.lat, lng: j.location.lng },
        color: SEVERITY_COLORS[j.severity] || SEVERITY_COLORS.Low,
        zone: SEVERITY_ZONE_STYLE[j.severity] || SEVERITY_ZONE_STYLE.Low,
      }));
  }, [jobs]);

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
      where('status', 'in', ['open', 'pending', 'notifying'])
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
          assignedResponderName: user.name,
          progressNote: `${user.name || 'A responder'} accepted your report and is preparing the safest route to your location.`,
          etaText: 'Route check in progress',
          status: 'assigned',
          updatedAt: serverTimestamp(),
          missionStatus: 'assigned',
        });
        
        // 2. Log Action in taskUpdates
        const updateRef = doc(collection(db, 'taskUpdates'));
        transaction.set(updateRef, {
          taskId: jobId,
          volunteerId: user.id,
          userName: user.name,
          type: 'claim',
          title: 'Responder accepted the mission',
          message: `${user.name || 'A responder'} has taken ownership of this incident and is getting ready to move.`,
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
            <p className="text-xs text-rose-700">Your account is in volunteer mode, but no matching volunteer document was found in our mission systems.</p>
            <button 
              onClick={async () => {
                if (!user?.id) return;
                try {
                  const { setDoc } = await import('firebase/firestore');
                  await setDoc(doc(db, 'volunteers', user.id), {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    photoURL: user.photoURL || null,
                    approved: user.role === 'volunteer', // If they already have the role, assume they were approved
                    appliedAt: new Date().toISOString(),
                    repairedAt: new Date().toISOString()
                  });
                  window.location.reload();
                } catch (err) {
                  console.error(err);
                  alert('Repair failed. Please contact admin.');
                }
              }}
              className="mt-2 px-4 py-1.5 bg-rose-600 text-white text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-rose-700 transition-all"
            >
              Repair Status
            </button>
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

      {locationSavedBanner && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between gap-4">
          <div>
            <h4 className="text-sm font-bold text-emerald-900">Volunteer coverage updated</h4>
            <p className="text-xs text-emerald-700">{locationSavedBanner}</p>
          </div>
          <button
            onClick={() => setLocationSavedBanner(null)}
            className="w-8 h-8 rounded-lg hover:bg-emerald-100 flex items-center justify-center transition-colors"
          >
            <span className="material-symbols-outlined text-sm text-emerald-700">close</span>
          </button>
        </div>
      )}

      <div className="flex justify-between items-center gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-on-surface">Operations Console</h1>
          <p className="text-on-surface-variant text-sm mt-1">Discover available high-impact missions in your area.</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => setShowFullMap(true)}
            className="px-4 py-2 rounded-xl bg-blue-700 text-white text-xs font-black uppercase tracking-widest shadow-lg shadow-blue-700/20 flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">map</span>
            View Map
          </button>
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
              mapId: googleMapsMapId,
              disableDefaultUI: true,
              zoomControl: true,
              scrollwheel: true,
            }}
          >
            {mapSignals.map((signal) => (
              <CircleF
                key={signal.id}
                center={signal.center}
                radius={signal.zone.radius}
                options={{
                  fillColor: signal.color,
                  fillOpacity: signal.zone.fillOpacity,
                  strokeColor: signal.color,
                  strokeOpacity: 0.5,
                  strokeWeight: 1.5,
                }}
              />
            ))}
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

      {/* Location picker moved to profile */}

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
        <div className="py-12 px-8 rounded-[32px] bg-white border border-slate-100 shadow-sm flex items-center gap-8 animate-in fade-in slide-in-from-bottom-4">
          <div className="w-20 h-20 rounded-3xl bg-slate-50 flex items-center justify-center shrink-0 relative overflow-hidden group">
            <div className="absolute inset-0 bg-blue-600/5 scale-0 group-hover:scale-100 transition-transform duration-500 rounded-full" />
            <span className="material-symbols-outlined text-slate-400 text-4xl animate-pulse relative z-10">radar</span>
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              Operational Standby
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </h2>
            <p className="text-slate-500 text-sm font-bold mt-1 leading-relaxed">
              Scanning local frequencies... No active missions match your current filters in this sector. 
              Try expanding your search radius or adjusting severity levels to find nearby needs.
            </p>
          </div>
          <div className="hidden md:flex flex-col items-end gap-1 shrink-0">
             <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Active Scan</span>
             <span className="text-xs font-bold text-slate-400">Radius: {distanceFilter}km</span>
          </div>
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

    <AnimatePresence>
      {showFullMap && (
        <motion.div 
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 100 }}
          className="fixed inset-0 z-[200] bg-slate-50 flex flex-col"
        >
          {/* Dashboard Header */}
          <div className="bg-white px-8 py-6 flex items-center justify-between border-b border-slate-100 shadow-sm shrink-0">
             <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-700 flex items-center justify-center text-white shadow-lg shadow-blue-700/20">
                   <span className="material-symbols-outlined">map</span>
                </div>
                <div>
                   <h2 className="text-xl font-black text-slate-900 tracking-tight">Geospatial Awareness</h2>
                   <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Scanning Active Sector</span>
                   </div>
                </div>
             </div>
             
             <div className="flex items-center gap-3">
                <div className="hidden md:flex flex-col items-end mr-4">
                   <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Radius: {distanceFilter}km</span>
                   <span className="text-[10px] font-bold text-slate-400 uppercase">{filteredJobs.length} Missions Identified</span>
                </div>
                <button 
                  onClick={() => setShowFullMap(false)}
                  className="px-6 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-900 text-xs font-black uppercase tracking-[0.1em] flex items-center gap-2 transition-all group"
                >
                  <span className="material-symbols-outlined text-[18px] group-hover:rotate-90 transition-transform">close</span>
                  Close Console
                </button>
             </div>
          </div>

          {/* Map Surface */}
          <div className="flex-1 relative">
             <FullMapScreen
               currentUser={user}
               reports={filteredJobs}
               volunteers={allVolunteers}
               isFullScreen={true}
               focusLocation={userLocation}
               onAssignVolunteer={(report) => {
                 handleTakeJob(report.id);
                 setShowFullMap(false);
               }}
             />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  </div>
);
};
