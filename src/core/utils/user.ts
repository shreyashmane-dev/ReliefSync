export const getInitials = (name?: string | null) => {
  if (!name) return 'RS';

  const parts = name
    .split(' ')
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) return 'RS';

  return parts.map((part) => part.charAt(0).toUpperCase()).join('');
};

export const normalizePhoneNumber = (value: string) => {
  const cleaned = value.replace(/[^\d+]/g, '');

  if (!cleaned.startsWith('+')) return null;
  if (cleaned.length < 8 || cleaned.length > 16) return null;

  return cleaned;
};
