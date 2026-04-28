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

type VolunteerAwareUser = {
  role?: string | null;
  responderActive?: boolean | null;
  volunteerRegistered?: boolean | null;
  isVolunteerApproved?: boolean | null;
};

export const isVolunteerConsoleEnabled = (user?: VolunteerAwareUser | null) => {
  if (!user) return false;

  // Strict role-based access for volunteers
  if (user.role === 'volunteer') return true;
  
  // If role is explicitly something else, they are NOT in volunteer mode
  if (user.role === 'user' || user.role === 'admin') return false;
  
  // Fallback for edge cases where role might be missing but attributes exist
  return (
    user.responderActive === true ||
    user.volunteerRegistered === true
  );
};

export const canClaimVolunteerJobs = (user?: VolunteerAwareUser | null) => {
  return user?.volunteerRegistered === true && user?.isVolunteerApproved === true;
};

export const getVolunteerAccessMessage = (user?: VolunteerAwareUser | null) => {
  if (user?.volunteerRegistered !== true) {
    return 'You are not registered as volunteer';
  }

  if (user?.isVolunteerApproved !== true) {
    return 'Waiting for approval';
  }

  return null;
};
