export const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
export const googleMapsScriptId = 'reliefsync-google-maps';
export const googleMapsMapId = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || '4504f8b37365c3d0';

export const googleMapsLibraries: ("places" | "geometry" | "drawing" | "visualization" | "marker")[] = [
  'places',
  'geometry',
  'drawing',
  'visualization',
  'marker' as any,
];

export const defaultMapOptions: google.maps.MapOptions = {
  mapId: googleMapsMapId,
  zoomControl: true,
  streetViewControl: false,
  mapTypeControl: true,
  fullscreenControl: true,
  gestureHandling: 'greedy',
  clickableIcons: false,
};

export const defaultMapCenter = {
  lat: 18.5204,
  lng: 73.8567,
};
