import React from 'react';
import { useJsApiLoader } from '@react-google-maps/api';
import { googleMapsApiKey, googleMapsLibraries, googleMapsScriptId } from '../config/googleMaps';

interface MapWrapperProps {
  children: React.ReactNode;
  loadingHeight?: number;
}

export const MapWrapper: React.FC<MapWrapperProps> = ({ children, loadingHeight = 320 }) => {
  const { isLoaded, loadError } = useJsApiLoader({
    id: googleMapsScriptId,
    googleMapsApiKey,
    libraries: googleMapsLibraries,
  });

  if (loadError) {
    return (
      <div
        style={{
          minHeight: loadingHeight,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          borderRadius: 24,
          border: '1px solid #fecaca',
          background: '#fef2f2',
          color: '#991b1b',
          fontWeight: 700,
          textAlign: 'center',
        }}
      >
        Google Maps failed to load. Please verify the API key and Maps JavaScript API permissions.
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div
        style={{
          minHeight: loadingHeight,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          borderRadius: 24,
          border: '1px solid #e2e8f0',
          background: '#f8fafc',
          color: '#475569',
          fontWeight: 700,
        }}
      >
        <span className="material-symbols-outlined animate-spin">progress_activity</span>
        Loading map intelligence...
      </div>
    );
  }

  return <>{children}</>;
};
