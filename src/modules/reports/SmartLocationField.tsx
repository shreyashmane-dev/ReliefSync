import React, { useState, useRef, useEffect } from 'react';
import { useJsApiLoader, Autocomplete, GoogleMap, MarkerF } from '@react-google-maps/api';

const libraries: ("places" | "geometry")[] = ['places'];

export interface LocationData {
  address: string;
  lat: number;
  lng: number;
}

interface SmartLocationFieldProps {
  value: LocationData | null;
  onChange: (loc: LocationData) => void;
}

export const SmartLocationField: React.FC<SmartLocationFieldProps> = ({ value, onChange }) => {
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
    libraries,
  });

  const [isOpen, setIsOpen] = useState(false);
  const [addressInput, setAddressInput] = useState(value?.address || '');
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);

  // Default to a wide view if no location is selected
  const defaultCenter = { lat: 20.5937, lng: 78.9629 };
  const center = value?.lat && value?.lng ? { lat: value.lat, lng: value.lng } : defaultCenter;

  // Sync local input with props when value changes from outside (e.g., reset or external update)
  useEffect(() => {
    if (value?.address) {
      setAddressInput(value.address);
    } else {
      setAddressInput('');
      setIsOpen(false);
    }
  }, [value?.address]);

  // Debugging: Confirm Places API loaded
  useEffect(() => {
    if (isLoaded && window.google) {
      console.log('Google Maps Places Library Loaded:', !!window.google.maps.places);
    }
  }, [isLoaded]);

  const handlePlaceChanged = () => {
    if (autocompleteRef.current !== null) {
      const place = autocompleteRef.current.getPlace();
      if (place.geometry && place.geometry.location) {
        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();
        const address = place.formatted_address || place.name || addressInput;
        setAddressInput(address);
        onChange({ address, lat, lng });
        setIsOpen(true);
      }
    }
  };

  const handleMapClick = (e: google.maps.MapMouseEvent) => {
    if (e.latLng) {
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ location: { lat, lng } }, (results, status) => {
        let newAddr = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        if (status === 'OK' && results && results[0]) {
          newAddr = results[0].formatted_address;
        }
        setAddressInput(newAddr);
        onChange({ address: newAddr, lat, lng });
      });
    }
  };

  const handleCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const geocoder = new window.google.maps.Geocoder();
          geocoder.geocode({ location: { lat, lng } }, (results, status) => {
            let newAddr = 'Current Location';
            if (status === 'OK' && results && results[0]) {
              newAddr = results[0].formatted_address;
            }
            setAddressInput(newAddr);
            onChange({ address: newAddr, lat, lng });
            setIsOpen(true);
          });
        },
        () => {
          alert('Location permission denied or unavailable. Please search manually.');
        }
      );
    } else {
      alert('Geolocation is not supported by your browser.');
    }
  };

  if (loadError) {
    return (
      <div style={{ color: '#b91c1c', fontSize: 13, background: '#fef2f2', padding: 12, borderRadius: 8, border: '1px solid #fee2e2' }}>
        Error loading maps. Please check your API key and connection.
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#737685', padding: '12px 0' }}>
        <span className="material-symbols-outlined animate-spin" style={{ fontSize: 18 }}>progress_activity</span>
        Loading smart location field...
      </div>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#434654', marginBottom: 6 }}>
        Reporting Location *
      </label>
      <div style={{ position: 'relative' }}>
        <span className="material-symbols-outlined" style={{ position: 'absolute', left: 12, top: 12, fontSize: 18, color: '#737685', pointerEvents: 'none', zIndex: 2 }}>
          location_on
        </span>
        <Autocomplete
          onLoad={(autocomplete) => { autocompleteRef.current = autocomplete; }}
          onPlaceChanged={handlePlaceChanged}
          options={{ types: ['geocode'] }}
        >
          <input
            required
            type="text"
            value={addressInput}
            onChange={(e) => {
              setAddressInput(e.target.value);
              // Allow manual typing even if autocomplete isn't used
              if (e.target.value === '') {
                onChange({ address: '', lat: 0, lng: 0 });
              }
            }}
            onFocus={() => setIsOpen(true)}
            placeholder="Search or select reporting location"
            style={{ 
              width: '100%', 
              padding: '12px 40px', 
              borderRadius: 12, 
              border: '1.5px solid #e1e2e4', 
              fontSize: 15, 
              color: '#000000', // Explicit black text
              backgroundColor: '#ffffff', // Explicit white background
              fontFamily: 'Inter, sans-serif', 
              outline: 'none', 
              boxSizing: 'border-box',
              caretColor: '#000000', // Visible cursor
              opacity: 1,
              zIndex: 1
            }}
          />
        </Autocomplete>
        <button
          type="button"
          onClick={handleCurrentLocation}
          title="Use my location"
          style={{ position: 'absolute', right: 8, top: 6, background: '#f8f9fb', border: '1px solid #e1e2e4', borderRadius: 8, padding: '4px 6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#0052cc' }}>my_location</span>
        </button>
      </div>

      {isOpen && (
        <div style={{ marginTop: 12, borderRadius: 16, border: '1px solid #e1e2e4', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', animation: 'fadeIn 0.2s ease-out' }}>
          <GoogleMap
            mapContainerStyle={{ width: '100%', height: 200 }}
            center={center}
            zoom={value?.lat ? 16 : 4}
            onClick={handleMapClick}
            onLoad={(map) => { mapRef.current = map; }}
            options={{
              streetViewControl: false,
              mapTypeControl: false,
              fullscreenControl: false,
              zoomControl: true,
              disableDefaultUI: false,
              gestureHandling: 'greedy'
            }}
          >
            {value?.lat && value?.lng && <MarkerF position={{ lat: value.lat, lng: value.lng }} />}
          </GoogleMap>
          <div style={{ padding: '10px 14px', background: '#f8f9fb', fontSize: 12, color: '#737685', textAlign: 'center', borderTop: '1px solid #e1e2e4', fontWeight: 500 }}>
            Adjust pin by clicking on the map
          </div>
        </div>
      )}
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
};
