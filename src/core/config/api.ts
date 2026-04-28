const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');

const getConfiguredApiBaseUrl = () => {
  const configured = import.meta.env.VITE_API_BASE_URL;
  return configured ? trimTrailingSlash(configured) : '';
};

export const getApiBaseUrl = () => {
  if (import.meta.env.DEV) {
    return '';
  }

  return getConfiguredApiBaseUrl();
};

export const buildApiUrl = (path: string) => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const baseUrl = getApiBaseUrl();
  return baseUrl ? `${baseUrl}${normalizedPath}` : normalizedPath;
};

export const getSocketServerUrl = () => {
  const configuredSocketUrl = import.meta.env.VITE_SOCKET_SERVER_URL;
  if (configuredSocketUrl) {
    return trimTrailingSlash(configuredSocketUrl);
  }

  const configuredApiBaseUrl = getConfiguredApiBaseUrl();
  if (configuredApiBaseUrl) {
    return configuredApiBaseUrl;
  }

  if (typeof window === 'undefined') {
    return 'http://localhost:3001';
  }

  return import.meta.env.DEV
    ? `${window.location.protocol}//${window.location.hostname}:3001`
    : window.location.origin;
};
