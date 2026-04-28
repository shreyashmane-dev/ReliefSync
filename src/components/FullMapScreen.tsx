import React, { useEffect, useRef, useState } from 'react';
import { GoogleMap, InfoWindowF, PolylineF, CircleF } from '@react-google-maps/api';
import { AdvancedMarker } from './AdvancedMarker';
import { MapWrapper } from './MapWrapper';
import { defaultMapCenter, defaultMapOptions } from '../config/googleMaps';

interface FullMapScreenProps {
  currentUser: any;
  reports: any[];
  volunteers: any[];
  onAssignVolunteer?: (report: any, volunteer?: any) => void;
  isFullScreen?: boolean;
  focusLocation?: { lat: number; lng: number } | null;
  selectedReportId?: string | null;
  onReportSelect?: (report: any) => void;
}

const getUrgencyColor = (severity: string) => {
  switch (severity) {
    case 'Critical': return '#ef4444'; // Red
    case 'High': return '#f97316';     // Orange
    case 'Medium': return '#facc15';   // Yellow
    case 'Low': return '#22c55e';      // Green
    default: return '#2563eb';
  }
};

const volunteerColor = (status: string) => {
  const s = String(status || '').toLowerCase();
  if (s === 'on_task' || s === 'busy') return '#3b82f6'; // Blue
  if (s === 'offline') return '#94a3b8'; // Gray
  return '#16a34a'; // Green (Available)
};

export const FullMapScreen: React.FC<FullMapScreenProps> = ({
  currentUser,
  reports,
  volunteers,
  onAssignVolunteer,
  isFullScreen = true,
  focusLocation = null,
  selectedReportId = null,
  onReportSelect,
}) => {
  const mapRef = useRef<google.maps.Map | null>(null);
  const [selectedMarker, setSelectedMarker] = useState<any | null>(null);
  
  useEffect(() => {
    if (focusLocation && mapRef.current) {
      mapRef.current.panTo(focusLocation);
      mapRef.current.setZoom(15);
    }
  }, [focusLocation]);

  useEffect(() => {
    if (selectedReportId) {
      const report = reports.find(r => r.id === selectedReportId);
      if (report) setSelectedMarker({ kind: 'report', data: report });
    }
  }, [selectedReportId, reports]);

  const containerStyle = isFullScreen
    ? { height: 'calc(100vh - 220px)' }
    : { height: 520 };

  const selectedReportObj = reports.find(r => r.id === selectedReportId);

  return (
    <div style={{ background: '#fff', borderRadius: 32, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 18px 40px rgba(15,23,42,0.06)' }}>

      <MapWrapper loadingHeight={Number(containerStyle.height) || 520}>
        <GoogleMap
          mapContainerStyle={{ width: '100%', height: '100%' }}
          center={defaultMapCenter}
          zoom={12}
          options={defaultMapOptions}
          onLoad={(map) => { mapRef.current = map; }}
        >
          {reports
            .filter((report) => report.location?.lat && report.location?.lng)
            .map((report) => (
              <AdvancedMarker
                key={report.id}
                position={{ lat: Number(report.location.lat), lng: Number(report.location.lng) }}
                title={report.title}
                onClick={() => {
                  setSelectedMarker({ kind: 'report', data: report });
                  if (onReportSelect) onReportSelect(report);
                }}
              >
                <div style={{
                  width: selectedReportId === report.id ? 28 : 20,
                  height: selectedReportId === report.id ? 28 : 20,
                  background: getUrgencyColor(report.severity),
                  border: '3px solid white',
                  borderRadius: '50%',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                  transform: selectedReportId === report.id ? 'scale(1.2)' : 'scale(1)',
                  transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                  animation: selectedReportId === report.id ? 'markerBounce 1s infinite' : 'none'
                }} />
              </AdvancedMarker>
            ))}

          {volunteers
            .filter((v) => v.location?.lat && v.location?.lng)
            .map((v) => (
              <AdvancedMarker
                key={v.id}
                position={{ lat: Number(v.location.lat), lng: Number(v.location.lng) }}
                title={v.name}
                onClick={() => setSelectedMarker({ kind: 'volunteer', data: v })}
              >
                <div style={{
                  width: 18, height: 18,
                  background: volunteerColor(v.status),
                  border: '2px solid white',
                  borderRadius: 4,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                }} />
              </AdvancedMarker>
            ))}

          {selectedReportObj && (
            <>
              <CircleF
                center={{ lat: Number(selectedReportObj.location.lat), lng: Number(selectedReportObj.location.lng) }}
                radius={10000} // 10km
                options={{
                  fillColor: '#3b82f6',
                  fillOpacity: 0.05,
                  strokeColor: '#3b82f6',
                  strokeOpacity: 0.3,
                  strokeWeight: 1
                }}
              />
              {volunteers
                .filter(v => v.location?.lat && v.location?.lng)
                .slice(0, 5)
                .map(v => (
                  <PolylineF
                    key={v.id}
                    path={[
                      { lat: Number(v.location.lat), lng: Number(v.location.lng) },
                      { lat: Number(selectedReportObj.location.lat), lng: Number(selectedReportObj.location.lng) }
                    ]}
                    options={{ strokeColor: '#3b82f6', strokeWeight: 2, strokeOpacity: 0.2, linetype: 'dashed' } as any}
                  />
                ))}
            </>
          )}

          {selectedMarker && (
            <InfoWindowF
              position={{ lat: Number(selectedMarker.data.location?.lat), lng: Number(selectedMarker.data.location?.lng) }}
              onCloseClick={() => setSelectedMarker(null)}
            >
              <div style={{ minWidth: 260, padding: 8 }}>
                {selectedMarker.kind === 'report' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 18 }}>🚨</span>
                      <strong style={{ fontSize: 15, color: '#0f172a' }}>{selectedMarker.data.title}</strong>
                    </div>
                    <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 8 }}>
                      <p style={{ margin: '4px 0', fontSize: 12, color: '#444' }}><strong>📋 Type:</strong> {selectedMarker.data.category}</p>
                      <p style={{ margin: '4px 0', fontSize: 12, color: getUrgencyColor(selectedMarker.data.severity) }}>
                        <strong>⚡ Urgency:</strong> {selectedMarker.data.severity}
                      </p>
                      <p style={{ margin: '4px 0', fontSize: 12, color: '#444' }}><strong>📍 Location:</strong> {selectedMarker.data.location?.area || selectedMarker.data.location?.address || 'Operational sector'}</p>
                      <p style={{ margin: '4px 0', fontSize: 12, color: '#444' }}><strong>👥 Status:</strong> {selectedMarker.data.status}</p>
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                      {currentUser?.role === 'volunteer' ? (
                        <button 
                          onClick={() => onAssignVolunteer && onAssignVolunteer(selectedMarker.data)}
                          style={{ flex: 1, height: 32, background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, fontSize: 11, fontWeight: 800, cursor: 'pointer' }}
                        >
                          🚩 Claim Mission
                        </button>
                      ) : (
                        <button 
                          onClick={() => onAssignVolunteer && onAssignVolunteer(selectedMarker.data)}
                          style={{ flex: 1, height: 32, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontSize: 11, fontWeight: 800, cursor: 'pointer' }}
                        >
                          🙋 Assign Volunteer
                        </button>
                      )}
                      <button style={{ height: 32, padding: '0 10px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 11, fontWeight: 800 }}>
                        📞 Details
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <strong style={{ fontSize: 14 }}>{selectedMarker.data.name}</strong>
                    <p style={{ fontSize: 12, color: '#64748b', margin: '4px 0' }}>{selectedMarker.data.status || 'Available'}</p>
                  </div>
                )}
              </div>
            </InfoWindowF>
          )}
        </GoogleMap>
      </MapWrapper>
      <style>{`
        @keyframes markerBounce {
          0%, 100% { transform: scale(1.2) translateY(0); }
          50% { transform: scale(1.2) translateY(-10px); }
        }
      `}</style>
    </div>
  );
};
;
