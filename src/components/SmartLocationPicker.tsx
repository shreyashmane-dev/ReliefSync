import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Autocomplete, CircleF, GoogleMap, useJsApiLoader } from '@react-google-maps/api';
import { AdvancedMarker } from './AdvancedMarker';
import { buildApiUrl } from '../core/config/api';
import {
  defaultMapCenter,
  googleMapsApiKey,
  googleMapsLibraries,
  googleMapsMapId,
  googleMapsScriptId,
} from '../config/googleMaps';

interface LocationPayload {
  address: string;
  area: string;
  lat: number;
  lng: number;
  coverageRadius?: number;
}

interface SmartLocationPickerProps {
  volunteerId: string;
  existingLocation?: Partial<LocationPayload> | null;
  onLocationSave?: (location: any) => void;
}

const extractArea = (place: google.maps.GeocoderResult | google.maps.places.PlaceResult | null) => {
  const components = place?.address_components || [];
  const locality =
    components.find((component) => component.types.includes('sublocality'))?.long_name ||
    components.find((component) => component.types.includes('locality'))?.long_name ||
    components.find((component) => component.types.includes('administrative_area_level_2'))?.long_name ||
    '';
  return locality;
};

const historyKey = (volunteerId: string) => `reliefsync-location-history-${volunteerId}`;

export const SmartLocationPicker: React.FC<SmartLocationPickerProps> = ({
  volunteerId,
  existingLocation,
  onLocationSave,
}) => {
  const { isLoaded, loadError } = useJsApiLoader({
    id: googleMapsScriptId,
    googleMapsApiKey,
    libraries: googleMapsLibraries,
  });
  const [location, setLocation] = useState<LocationPayload>({
    address: existingLocation?.address || '',
    area: existingLocation?.area || '',
    lat: Number(existingLocation?.lat || defaultMapCenter.lat),
    lng: Number(existingLocation?.lng || defaultMapCenter.lng),
    coverageRadius: 10,
  });
  const [addressInput, setAddressInput] = useState(existingLocation?.address || '');
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [locationHistory, setLocationHistory] = useState<LocationPayload[]>([]);
  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(historyKey(volunteerId));
      if (!raw) return;
      setLocationHistory(JSON.parse(raw));
    } catch (error) {
      console.warn('Failed to load location history:', error);
    }
  }, [volunteerId]);

  const persistLocationHistory = (nextLocation: LocationPayload) => {
    const nextHistory = [
      nextLocation,
      ...locationHistory.filter((item) => item.address !== nextLocation.address),
    ].slice(0, 3);

    setLocationHistory(nextHistory);
    window.localStorage.setItem(historyKey(volunteerId), JSON.stringify(nextHistory));
  };

  const mapCenter = useMemo(
    () => ({
      lat: Number(location.lat || defaultMapCenter.lat),
      lng: Number(location.lng || defaultMapCenter.lng),
    }),
    [location.lat, location.lng]
  );

  const applyResolvedLocation = (
    address: string,
    area: string,
    lat: number,
    lng: number
  ) => {
    const nextLocation = {
      address,
      area,
      lat,
      lng,
      coverageRadius: 10,
    };
    setAddressInput(address);
    setLocation(nextLocation);
    setStatusMessage(`Selected location: ${address}`);
  };

  const reverseGeocode = (lat: number, lng: number) => {
    if (!window.google) return;
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
      if (status === 'OK' && results?.[0]) {
        applyResolvedLocation(
          results[0].formatted_address,
          extractArea(results[0]),
          lat,
          lng
        );
        return;
      }

      applyResolvedLocation(`${lat.toFixed(5)}, ${lng.toFixed(5)}`, '', lat, lng);
    });
  };

  const handlePlaceChanged = () => {
    const place = autocompleteRef.current?.getPlace();
    if (!place?.geometry?.location) return;
    applyResolvedLocation(
      place.formatted_address || place.name || addressInput,
      extractArea(place),
      place.geometry.location.lat(),
      place.geometry.location.lng()
    );
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setStatusMessage('Geolocation is not supported by your browser.');
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        reverseGeocode(position.coords.latitude, position.coords.longitude);
        setLocating(false);
      },
      () => {
        setStatusMessage('Please allow location access in your browser settings.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSaveLocation = async () => {
    setSaving(true);
    setStatusMessage(null);
    try {
      const response = await fetch(buildApiUrl('/api/notifications/volunteers/update-location'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          volunteerId,
          location,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save location.');
      }

      persistLocationHistory(location);
      setStatusMessage('Location saved! You will now receive notifications within 10 km.');
      onLocationSave?.(data.volunteer);
    } catch (error: any) {
      setStatusMessage(error.message || 'Unable to save volunteer location.');
    } finally {
      setSaving(false);
    }
  };

  if (loadError) {
    return (
      <div
        style={{
          background: '#fff',
          borderRadius: 28,
          border: '1px solid #fecaca',
          padding: 20,
          color: '#991b1b',
          boxShadow: '0 10px 30px rgba(15,23,42,0.06)',
        }}
      >
        Google Maps failed to load for volunteer location setup. Please verify the API key and Maps permissions.
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div
        style={{
          background: '#fff',
          borderRadius: 28,
          border: '1px solid #e2e8f0',
          padding: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          color: '#475569',
          fontWeight: 800,
          boxShadow: '0 10px 30px rgba(15,23,42,0.06)',
        }}
      >
        <span className="material-symbols-outlined animate-spin">progress_activity</span>
        Loading volunteer location tools...
      </div>
    );
  }

  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 28,
        border: '1px solid #e2e8f0',
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
        boxShadow: '0 10px 30px rgba(15,23,42,0.06)',
      }}
    >
      <div>
        <div style={{ fontSize: 11, fontWeight: 900, color: '#2563eb', textTransform: 'uppercase', letterSpacing: 1.2 }}>
          My Location
        </div>
        <div style={{ marginTop: 6, fontSize: 18, fontWeight: 900, color: '#0f172a' }}>
          Set volunteer coverage location
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={{ display: 'block', marginBottom: 8, fontWeight: 800, color: '#334155' }}>
            Search your location
          </label>
          <Autocomplete onLoad={(instance) => { autocompleteRef.current = instance; }} onPlaceChanged={handlePlaceChanged}>
            <input
              value={addressInput}
              onChange={(event) => setAddressInput(event.target.value)}
              placeholder="Search address, area, or landmark"
              style={{
                width: '100%',
                height: 48,
                borderRadius: 14,
                border: '1px solid #cbd5e1',
                padding: '0 14px',
                fontSize: 14,
                fontWeight: 700,
                color: '#0f172a',
                boxSizing: 'border-box',
              }}
            />
          </Autocomplete>
        </div>

        <button
          onClick={handleUseCurrentLocation}
          style={{
            height: 46,
            borderRadius: 14,
            border: '1px solid #bfdbfe',
            background: '#eff6ff',
            color: '#1d4ed8',
            fontWeight: 900,
            cursor: 'pointer',
          }}
        >
          {locating ? 'Getting your location...' : 'Use My Current Location'}
        </button>

        <div style={{ borderRadius: 24, overflow: 'hidden', border: '1px solid #e2e8f0', height: 420 }}>
          <GoogleMap
            mapContainerStyle={{ width: '100%', height: '100%' }}
            center={mapCenter}
            zoom={13}
            onLoad={(map) => {
              setMapInstance(map);
            }}
            options={{
              disableDefaultUI: true,
              gestureHandling: 'greedy',
              mapId: googleMapsMapId,
            }}
            onClick={(event) => {
              if (!event.latLng) return;
              reverseGeocode(event.latLng.lat(), event.latLng.lng());
            }}
          >
            <AdvancedMarker
              map={mapInstance}
              position={mapCenter}
              draggable
              onDragEnd={(nextPosition) => {
                reverseGeocode(nextPosition.lat, nextPosition.lng);
              }}
            >
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  background: '#2563eb',
                  border: '3px solid #fff',
                  boxShadow: '0 6px 16px rgba(37,99,235,0.35)',
                }}
              />
            </AdvancedMarker>
            <CircleF
              center={mapCenter}
              radius={10000}
              options={{
                fillColor: '#60a5fa',
                fillOpacity: 0.15,
                strokeColor: '#2563eb',
                strokeOpacity: 0.6,
                strokeWeight: 1.5,
              }}
            />
          </GoogleMap>
        </div>

        <div
          style={{
            borderRadius: 20,
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            padding: 16,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 12,
          }}
        >
          <div>
            <div style={{ fontSize: 10, fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1 }}>
              Full Address
            </div>
            <div style={{ marginTop: 5, fontSize: 13, fontWeight: 800, color: '#0f172a', lineHeight: 1.5 }}>
              {location.address || 'Select a location on the map'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1 }}>
              Coordinates
            </div>
            <div style={{ marginTop: 5, fontSize: 13, fontWeight: 800, color: '#0f172a' }}>
              {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1 }}>
              Area / District
            </div>
            <div style={{ marginTop: 5, fontSize: 13, fontWeight: 800, color: '#0f172a' }}>
              {location.area || 'Area will appear after selection'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1 }}>
              Coverage Radius
            </div>
            <div style={{ marginTop: 5, fontSize: 13, fontWeight: 800, color: '#0f172a' }}>10 km</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ color: '#64748b', fontSize: 12, fontWeight: 700 }}>
            Estimated population in coverage: Not available
          </div>
          <button
            onClick={handleSaveLocation}
            disabled={saving}
            style={{
              minWidth: 190,
              height: 50,
              borderRadius: 16,
              border: 'none',
              background: '#2563eb',
              color: '#fff',
              fontWeight: 900,
              cursor: 'pointer',
            }}
          >
            {saving ? 'Saving...' : 'Save My Location'}
          </button>
        </div>

        {locationHistory.length > 0 && (
          <div>
            <div style={{ fontSize: 10, fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
              Location History
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {locationHistory.map((item, index) => (
                <button
                  key={`${item.address}-${index}`}
                  onClick={() => {
                    setLocation(item);
                    setAddressInput(item.address);
                    setStatusMessage(`Loaded saved location: ${item.address}`);
                  }}
                  style={{
                    textAlign: 'left',
                    borderRadius: 16,
                    border: '1px solid #e2e8f0',
                    background: '#fff',
                    padding: 12,
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>{item.address}</div>
                  <div style={{ marginTop: 4, fontSize: 11, color: '#64748b', fontWeight: 700 }}>
                    {item.area || 'Saved area'} • {item.lat.toFixed(4)}, {item.lng.toFixed(4)}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {statusMessage && (
          <div
            style={{
              borderRadius: 16,
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              color: '#1d4ed8',
              padding: 12,
              fontWeight: 800,
              fontSize: 13,
            }}
          >
            {statusMessage}
          </div>
        )}
      </div>
    </div>
  );
};
