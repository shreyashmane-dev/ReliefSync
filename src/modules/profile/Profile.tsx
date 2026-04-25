import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PhoneAuthProvider,
  RecaptchaVerifier,
  linkWithCredential,
  signOut,
  updatePhoneNumber,
  updateProfile,
} from 'firebase/auth';
import { collection, doc, onSnapshot, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { auth, db, storage } from '../../core/firebase/config';
import { useStore } from '../../core/store/useStore';
import { computeTrustScore, getEarnedBadges } from '../../core/utils/impact';
import { getInitials, normalizePhoneNumber } from '../../core/utils/user';

interface ProfileFormState {
  bio: string;
  emergencyContact1: string;
  emergencyContact2: string;
  location_text: string;
  name: string;
  skillsText: string;
}

const buildProfileForm = (user: any): ProfileFormState => ({
  name: user?.name || '',
  bio: user?.bio || '',
  location_text: user?.location_text || '',
  emergencyContact1: user?.emergencyContacts?.[0] || '',
  emergencyContact2: user?.emergencyContacts?.[1] || '',
  skillsText: Array.isArray(user?.skills) ? user.skills.join(', ') : '',
});

export const Profile = () => {
  const { user, setUser } = useStore();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [removingPhoto, setRemovingPhoto] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [reports, setReports] = useState<any[]>([]);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [phoneMessage, setPhoneMessage] = useState<string | null>(null);
  const [verificationId, setVerificationId] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [phoneDraft, setPhoneDraft] = useState(user?.phone || '');
  const [showAvatarPreview, setShowAvatarPreview] = useState(false);
  const [form, setForm] = useState<ProfileFormState>(() => buildProfileForm(user));

  useEffect(() => {
    setForm(buildProfileForm(user));
    setPhoneDraft(user?.phone || '');
  }, [user]);

  useEffect(() => {
    if (!user?.id) return;

    const reportsQuery = query(collection(db, 'reports'), where('userId', '==', user.id));
    const unsubscribe = onSnapshot(reportsQuery, (snapshot) => {
      setReports(snapshot.docs.map((reportDoc) => ({ ...reportDoc.data(), id: reportDoc.id })));
    });

    return () => unsubscribe();
  }, [user?.id]);

  useEffect(() => {
    return () => {
      if (recaptchaRef.current) {
        recaptchaRef.current.clear();
        recaptchaRef.current = null;
      }
    };
  }, []);

  const setFlashMessage = (message: string) => {
    setSaveMsg(message);
    window.setTimeout(() => setSaveMsg(null), 3200);
  };

  const ensureRecaptcha = () => {
    if (recaptchaRef.current) return recaptchaRef.current;

    recaptchaRef.current = new RecaptchaVerifier(auth, 'profile-phone-recaptcha', {
      size: 'invisible',
    });

    return recaptchaRef.current;
  };

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user?.id) return;

    setUploading(true);
    try {
      const storagePath = `profile_photos/${user.id}/avatar-${Date.now()}-${file.name}`;
      const storageRef = ref(storage, storagePath);

      await uploadBytes(storageRef, file);
      const photoURL = await getDownloadURL(storageRef);

      if (auth.currentUser) await updateProfile(auth.currentUser, { photoURL });
      await updateDoc(doc(db, 'users', user.id), {
        photoURL,
        photoStoragePath: storagePath,
        updatedAt: serverTimestamp(),
      });

      setUser({ ...user, photoURL, photoStoragePath: storagePath });
      setFlashMessage('Profile photo updated.');
    } catch (error) {
      console.error('Photo upload error:', error);
      setFlashMessage('Failed to upload photo.');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const handleRemovePhoto = async () => {
    if (!user?.id || !user?.photoURL) return;

    setRemovingPhoto(true);
    try {
      if (user.photoStoragePath) {
        await deleteObject(ref(storage, user.photoStoragePath)).catch(() => undefined);
      }

      if (auth.currentUser) await updateProfile(auth.currentUser, { photoURL: '' });
      await updateDoc(doc(db, 'users', user.id), {
        photoURL: null,
        photoStoragePath: null,
        updatedAt: serverTimestamp(),
      });

      setUser({ ...user, photoURL: null, photoStoragePath: null });
      setShowAvatarPreview(false);
      setFlashMessage('Profile photo removed.');
    } catch (error) {
      console.error('Remove photo error:', error);
      setFlashMessage('Failed to remove photo.');
    } finally {
      setRemovingPhoto(false);
    }
  };

  const handleSave = async () => {
    if (!user?.id) return;

    setSaving(true);
    try {
      const emergencyContacts = [form.emergencyContact1, form.emergencyContact2].map((value) => value.trim()).filter(Boolean);
      const skills = form.skillsText
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);

      const updates = {
        name: form.name.trim(),
        bio: form.bio.trim(),
        location_text: form.location_text.trim(),
        emergencyContacts,
        skills,
        updatedAt: serverTimestamp(),
      };

      await updateDoc(doc(db, 'users', user.id), updates);

      if (auth.currentUser && form.name.trim()) {
        await updateProfile(auth.currentUser, { displayName: form.name.trim() });
      }

      setUser({
        ...user,
        name: updates.name,
        bio: updates.bio,
        location_text: updates.location_text,
        emergencyContacts,
        skills,
      });
      setEditing(false);
      setFlashMessage('Profile saved successfully.');
    } catch (error) {
      console.error('Save error:', error);
      setFlashMessage('Failed to save profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleSendCode = async () => {
    if (!user?.id) return;

    const normalizedPhone = normalizePhoneNumber(phoneDraft);
    if (!normalizedPhone) {
      setPhoneMessage('Enter a valid phone number in international format, for example +919876543210.');
      return;
    }

    setSendingCode(true);
    setPhoneMessage(null);
    try {
      const verifier = ensureRecaptcha();
      const provider = new PhoneAuthProvider(auth);
      const nextVerificationId = await provider.verifyPhoneNumber(normalizedPhone, verifier);

      setVerificationId(nextVerificationId);
      setOtpCode('');
      setPhoneMessage(`OTP sent to ${normalizedPhone}.`);
    } catch (error: any) {
      console.error('Send OTP error:', error);
      setPhoneMessage(error?.message || 'Could not send OTP right now.');
    } finally {
      setSendingCode(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!user?.id || !auth.currentUser) return;

    const normalizedPhone = normalizePhoneNumber(phoneDraft);
    if (!verificationId || !normalizedPhone) {
      setPhoneMessage('Send a new OTP before verifying.');
      return;
    }

    if (otpCode.trim().length < 6) {
      setPhoneMessage('Enter the 6-digit OTP.');
      return;
    }

    setVerifyingCode(true);
    setPhoneMessage(null);
    try {
      const credential = PhoneAuthProvider.credential(verificationId, otpCode.trim());

      if (auth.currentUser.phoneNumber && auth.currentUser.phoneNumber !== normalizedPhone) {
        await updatePhoneNumber(auth.currentUser, credential);
      } else {
        try {
          await linkWithCredential(auth.currentUser, credential);
        } catch (error: any) {
          if (error?.code === 'auth/provider-already-linked' || error?.code === 'auth/credential-already-in-use') {
            await updatePhoneNumber(auth.currentUser, credential);
          } else {
            throw error;
          }
        }
      }

      await updateDoc(doc(db, 'users', user.id), {
        phone: normalizedPhone,
        phoneVerified: true,
        phoneVerifiedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setUser({
        ...user,
        phone: normalizedPhone,
        phoneVerified: true,
        phoneVerifiedAt: new Date().toISOString(),
      });
      setVerificationId('');
      setOtpCode('');
      setPhoneMessage('Phone number verified successfully.');
    } catch (error: any) {
      console.error('Verify OTP error:', error);
      if (error?.code === 'auth/requires-recent-login') {
        setPhoneMessage('Please sign in again before updating this phone number.');
      } else {
        setPhoneMessage(error?.message || 'Could not verify the OTP.');
      }
    } finally {
      setVerifyingCode(false);
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    setUser(null);
    navigate('/');
  };

  const sortedReports = [...reports].sort((left, right) => {
    const leftTime = left.createdAt?.toDate?.()?.getTime?.() ?? 0;
    const rightTime = right.createdAt?.toDate?.()?.getTime?.() ?? 0;
    return rightTime - leftTime;
  });

  const trustScore = computeTrustScore({
    reports,
    phoneVerified: Boolean(user?.phoneVerified),
    hasProfilePhoto: Boolean(user?.photoURL),
  });
  const badges = getEarnedBadges({ reports, phoneVerified: Boolean(user?.phoneVerified), trustScore });
  const resolvedReports = reports.filter((report) => report.status === 'resolved').length;
  const pendingReports = reports.filter((report) => report.status === 'pending').length;
  const confirmationCount = reports.reduce((total, report) => total + (Array.isArray(report.verifiedBy) ? report.verifiedBy.length : 0), 0);
  const trustedReporter = badges.find((badge) => badge.key === 'trusted-reporter')?.earned;

  const renderAvatar = (size: number) => {
    if (user?.photoURL) {
      return (
        <img
          src={user.photoURL}
          alt="Profile"
          style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: '3px solid #fff', boxShadow: '0 4px 16px rgba(0,82,204,0.15)' }}
        />
      );
    }

    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #0052cc, #60a5fa)',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: Math.max(18, Math.floor(size / 3)),
          fontWeight: 800,
          border: '3px solid #fff',
          boxShadow: '0 4px 16px rgba(0,82,204,0.15)',
        }}
      >
        {getInitials(user?.name)}
      </div>
    );
  };

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 80 }}>
      {saveMsg && (
        <div style={{ background: saveMsg.includes('Failed') ? '#fef2f2' : '#f0fdf4', border: `1px solid ${saveMsg.includes('Failed') ? '#fecaca' : '#bbf7d0'}`, color: saveMsg.includes('Failed') ? '#b91c1c' : '#166534', padding: '12px 16px', borderRadius: 12, fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{saveMsg.includes('Failed') ? 'error' : 'check_circle'}</span>
          {saveMsg}
        </div>
      )}

      <div style={{ background: '#fff', borderRadius: 20, overflow: 'hidden', border: '1px solid #f1f5f9', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
        <div style={{ height: 6, background: 'linear-gradient(to right, #0052cc, #60a5fa)' }} />
        <div style={{ padding: '28px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center' }}>
          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowAvatarPreview(true)} style={{ padding: 0, border: 'none', background: 'transparent', cursor: 'zoom-in' }}>
              {renderAvatar(96)}
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              style={{ position: 'absolute', bottom: 0, right: 0, width: 30, height: 30, borderRadius: '50%', background: '#0052cc', border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              title="Change photo"
            >
              {uploading ? (
                <span className="material-symbols-outlined" style={{ color: '#fff', fontSize: 14, animation: 'spin 1s linear infinite' }}>progress_activity</span>
              ) : (
                <span className="material-symbols-outlined" style={{ color: '#fff', fontSize: 14 }}>photo_camera</span>
              )}
            </button>
            <input ref={fileRef} type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display: 'none' }} />
          </div>

          {!editing ? (
            <>
              <div>
                <h2 style={{ fontSize: 24, fontWeight: 800, margin: 0, marginBottom: 4 }}>{user?.name || 'User'}</h2>
                {form.bio && <p style={{ fontSize: 14, color: '#737685', margin: '4px 0 0' }}>{form.bio}</p>}
                {form.location_text && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 6, fontSize: 13, color: '#737685' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 15 }}>location_on</span>
                    {form.location_text}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                {user?.phoneVerified && (
                  <span style={{ padding: '4px 12px', borderRadius: 9999, background: '#dcfce7', color: '#15803d', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 14, fontVariationSettings: "'FILL' 1" }}>verified</span>
                    Phone Verified
                  </span>
                )}
                {trustedReporter && (
                  <span style={{ padding: '4px 12px', borderRadius: 9999, background: '#fff7ed', color: '#c2410c', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 14, fontVariationSettings: "'FILL' 1" }}>star</span>
                    Trusted Reporter
                  </span>
                )}
                {user?.role === 'admin' && (
                  <span style={{ padding: '4px 12px', borderRadius: 9999, background: '#ffdad6', color: '#b81a36', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>admin_panel_settings</span>
                    Admin
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
                <button
                  onClick={() => setEditing(true)}
                  style={{ padding: '10px 24px', borderRadius: 10, border: '1.5px solid #e1e2e4', background: '#fff', fontSize: 14, fontWeight: 700, color: '#191c1e', cursor: 'pointer', fontFamily: 'Inter, sans-serif', display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span>
                  Edit Profile
                </button>
                {user?.photoURL && (
                  <button
                    onClick={handleRemovePhoto}
                    disabled={removingPhoto}
                    style={{ padding: '10px 18px', borderRadius: 10, border: '1.5px solid #fecaca', background: '#fff5f5', fontSize: 14, fontWeight: 700, color: '#b91c1c', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
                  >
                    {removingPhoto ? 'Removing...' : 'Remove Photo'}
                  </button>
                )}
              </div>
            </>
          ) : (
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 14, textAlign: 'left' }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, textAlign: 'center' }}>Edit Your Profile</h3>
              {[
                { label: 'Full Name', key: 'name', icon: 'person', type: 'text' },
                { label: 'Location', key: 'location_text', icon: 'location_on', type: 'text' },
                { label: 'Emergency Contact 1', key: 'emergencyContact1', icon: 'call', type: 'tel' },
                { label: 'Emergency Contact 2', key: 'emergencyContact2', icon: 'call', type: 'tel' },
              ].map((field) => (
                <div key={field.key}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#737685', marginBottom: 6 }}>{field.label}</label>
                  <div style={{ position: 'relative' }}>
                    <span className="material-symbols-outlined" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 18, color: '#9ca3af', pointerEvents: 'none' }}>{field.icon}</span>
                    <input
                      type={field.type}
                      value={form[field.key as keyof ProfileFormState]}
                      onChange={(event) => setForm((current) => ({ ...current, [field.key]: event.target.value }))}
                      style={{ width: '100%', padding: '11px 14px 11px 40px', borderRadius: 10, border: '1.5px solid #e1e2e4', fontSize: 14, fontFamily: 'Inter, sans-serif', outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>
              ))}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#737685', marginBottom: 6 }}>Bio</label>
                <textarea
                  value={form.bio}
                  onChange={(event) => setForm((current) => ({ ...current, bio: event.target.value }))}
                  rows={2}
                  placeholder="Short bio about yourself..."
                  style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: '1.5px solid #e1e2e4', fontSize: 14, fontFamily: 'Inter, sans-serif', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#737685', marginBottom: 6 }}>Skills</label>
                <textarea
                  value={form.skillsText}
                  onChange={(event) => setForm((current) => ({ ...current, skillsText: event.target.value }))}
                  rows={2}
                  placeholder="First aid, transport, translation"
                  style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: '1.5px solid #e1e2e4', fontSize: 14, fontFamily: 'Inter, sans-serif', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => { setEditing(false); setForm(buildProfileForm(user)); }} style={{ flex: 1, padding: '12px', borderRadius: 10, border: '1.5px solid #e1e2e4', background: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Cancel</button>
                <button onClick={handleSave} disabled={saving} style={{ flex: 2, padding: '12px', borderRadius: 10, border: 'none', background: '#0052cc', color: '#fff', fontSize: 14, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: saving ? 0.7 : 1 }}>
                  {saving && <span className="material-symbols-outlined" style={{ fontSize: 16, animation: 'spin 1s linear infinite' }}>progress_activity</span>}
                  Save Changes
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
        {[
          { label: 'Reports Submitted', value: reports.length, accent: '#0052cc', icon: 'assignment' },
          { label: 'Resolved Reports', value: resolvedReports, accent: '#15803d', icon: 'task_alt' },
          { label: 'Trust Score', value: trustScore, accent: '#c2410c', icon: 'shield' },
        ].map((stat) => (
          <div key={stat.label} style={{ background: '#fff', borderRadius: 16, border: '1px solid #f1f5f9', boxShadow: '0 2px 12px rgba(0,0,0,0.04)', padding: '18px 16px', textAlign: 'center' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 24, color: stat.accent, fontVariationSettings: "'FILL' 1" }}>{stat.icon}</span>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#191c1e', marginTop: 8 }}>{stat.value}</div>
            <div style={{ fontSize: 11, color: '#737685', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 6 }}>{stat.label}</div>
          </div>
        ))}
      </div>

      <div style={{ background: '#fff', borderRadius: 20, border: '1px solid #f1f5f9', boxShadow: '0 2px 12px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f8f9fb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div>
            <h3 style={{ fontSize: 12, fontWeight: 700, color: '#737685', margin: 0, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Phone Verification</h3>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: '#475569' }}>Verify your profile number with Firebase OTP.</p>
          </div>
          <span style={{ padding: '6px 10px', borderRadius: 9999, background: user?.phoneVerified ? '#dcfce7' : '#fff7ed', color: user?.phoneVerified ? '#15803d' : '#c2410c', fontSize: 12, fontWeight: 800 }}>
            {user?.phoneVerified ? 'Verified' : 'Pending'}
          </span>
        </div>

        <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#737685', marginBottom: 6 }}>Phone Number</label>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <input
                value={phoneDraft}
                onChange={(event) => {
                  setPhoneDraft(event.target.value);
                  if (user?.phoneVerified && event.target.value !== (user.phone || '')) {
                    setPhoneMessage('Phone number changed. Reverify to restore the verified badge.');
                  }
                }}
                placeholder="+919876543210"
                style={{ flex: 1, minWidth: 220, padding: '12px 14px', borderRadius: 10, border: '1.5px solid #e1e2e4', fontSize: 14, fontFamily: 'Inter, sans-serif' }}
              />
              <button onClick={handleSendCode} disabled={sendingCode} style={{ padding: '12px 16px', borderRadius: 10, border: 'none', background: '#0052cc', color: '#fff', fontWeight: 700, cursor: 'pointer', opacity: sendingCode ? 0.7 : 1 }}>
                {sendingCode ? 'Sending...' : verificationId ? 'Resend OTP' : 'Verify Phone'}
              </button>
            </div>
          </div>

          {verificationId && (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <input
                value={otpCode}
                onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="Enter 6-digit OTP"
                style={{ flex: 1, minWidth: 180, padding: '12px 14px', borderRadius: 10, border: '1.5px solid #e1e2e4', fontSize: 14, letterSpacing: '0.3em', fontFamily: 'Inter, sans-serif' }}
              />
              <button onClick={handleVerifyCode} disabled={verifyingCode} style={{ padding: '12px 16px', borderRadius: 10, border: 'none', background: '#15803d', color: '#fff', fontWeight: 700, cursor: 'pointer', opacity: verifyingCode ? 0.7 : 1 }}>
                {verifyingCode ? 'Verifying...' : 'Confirm OTP'}
              </button>
            </div>
          )}

          {phoneMessage && <p style={{ margin: 0, fontSize: 13, color: phoneMessage.toLowerCase().includes('success') || phoneMessage.toLowerCase().includes('sent') ? '#166534' : '#b45309' }}>{phoneMessage}</p>}
          <div id="profile-phone-recaptcha" />
        </div>
      </div>

      <div style={{ background: '#fff', borderRadius: 20, border: '1px solid #f1f5f9', boxShadow: '0 2px 12px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f8f9fb' }}>
          <h3 style={{ fontSize: 12, fontWeight: 700, color: '#737685', margin: 0, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Account Info</h3>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {[
            { icon: 'mail', label: 'Email', value: user?.email || '-' },
            { icon: 'call', label: 'Phone', value: phoneDraft || 'Not set' },
            { icon: 'verified_user', label: 'Verification', value: user?.phoneVerified ? 'Phone verified' : 'Phone pending' },
            { icon: 'military_tech', label: 'Role', value: user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'User' },
            { icon: 'fingerprint', label: 'User ID', value: user?.id?.slice(0, 12) + '...' || '-' },
          ].map((item, index) => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: index < 4 ? '1px solid #f8f9fb' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#f8f9fb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#737685' }}>{item.icon}</span>
                </div>
                <span style={{ fontWeight: 600, fontSize: 14, color: '#191c1e' }}>{item.label}</span>
              </div>
              <span style={{ fontSize: 14, color: '#737685', fontWeight: 500 }}>{item.value}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 20 }}>
        <div style={{ background: '#fff', borderRadius: 20, border: '1px solid #f1f5f9', boxShadow: '0 2px 12px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #f8f9fb' }}>
            <h3 style={{ fontSize: 12, fontWeight: 700, color: '#737685', margin: 0, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Activity Log</h3>
          </div>
          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
              {[
                { label: 'Pending', value: pendingReports },
                { label: 'Resolved', value: resolvedReports },
                { label: 'Confirmations', value: confirmationCount },
              ].map((item) => (
                <div key={item.label} style={{ borderRadius: 14, background: '#f8fafc', border: '1px solid #e2e8f0', padding: '14px 12px' }}>
                  <p style={{ margin: 0, fontSize: 11, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{item.label}</p>
                  <p style={{ margin: '8px 0 0', fontSize: 24, fontWeight: 800, color: '#0f172a' }}>{item.value}</p>
                </div>
              ))}
            </div>
            {sortedReports.length === 0 && <p style={{ margin: 0, fontSize: 14, color: '#64748b' }}>Your recent report activity will appear here.</p>}
            {sortedReports.slice(0, 4).map((report) => (
              <div key={report.id} style={{ padding: '12px 14px', borderRadius: 14, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{report.title}</p>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: '#64748b' }}>
                  {report.status === 'resolved' ? 'Resolved' : report.status === 'active' ? 'Active' : 'Pending'} · {report.category}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: '#fff', borderRadius: 20, border: '1px solid #f1f5f9', boxShadow: '0 2px 12px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #f8f9fb' }}>
            <h3 style={{ fontSize: 12, fontWeight: 700, color: '#737685', margin: 0, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Badges</h3>
          </div>
          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {badges.map((badge) => (
              <div key={badge.key} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', borderRadius: 14, padding: '12px 14px', background: badge.earned ? `${badge.accent}10` : '#f8fafc', border: `1px solid ${badge.earned ? `${badge.accent}40` : '#e2e8f0'}`, opacity: badge.earned ? 1 : 0.65 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: badge.earned ? `${badge.accent}18` : '#e2e8f0', color: badge.earned ? badge.accent : '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>{badge.icon}</span>
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{badge.name}</p>
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: '#64748b' }}>{badge.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ background: '#fff', borderRadius: 20, border: '1px solid #f1f5f9', boxShadow: '0 2px 12px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f8f9fb' }}>
          <h3 style={{ fontSize: 12, fontWeight: 700, color: '#737685', margin: 0, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Profile Details</h3>
        </div>
        <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
          <div style={{ borderRadius: 14, background: '#f8fafc', border: '1px solid #e2e8f0', padding: '14px' }}>
            <p style={{ margin: 0, fontSize: 11, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Emergency Contacts</p>
            <p style={{ margin: '8px 0 0', fontSize: 14, color: '#0f172a', lineHeight: 1.6 }}>{user?.emergencyContacts?.join(', ') || 'No contacts added yet'}</p>
          </div>
          <div style={{ borderRadius: 14, background: '#f8fafc', border: '1px solid #e2e8f0', padding: '14px' }}>
            <p style={{ margin: 0, fontSize: 11, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Skills</p>
            <p style={{ margin: '8px 0 0', fontSize: 14, color: '#0f172a', lineHeight: 1.6 }}>{user?.skills?.join(', ') || 'No skills listed yet'}</p>
          </div>
        </div>
      </div>

      <button
        onClick={handleSignOut}
        style={{ width: '100%', padding: '14px', borderRadius: 14, border: '1.5px solid #fecaca', background: '#fef2f2', color: '#b91c1c', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 20 }}>logout</span>
        Sign Out
      </button>

      {showAvatarPreview && (
        <div onClick={() => setShowAvatarPreview(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.78)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 110, padding: 24 }}>
          <div onClick={(event) => event.stopPropagation()} style={{ background: '#fff', borderRadius: 24, padding: 28, maxWidth: 420, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
            {renderAvatar(220)}
            <div style={{ textAlign: 'center' }}>
              <h3 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#0f172a' }}>{user?.name || 'User'}</h3>
              <p style={{ margin: '6px 0 0', fontSize: 14, color: '#64748b' }}>Profile preview</p>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
              <button onClick={() => fileRef.current?.click()} style={{ padding: '12px 16px', borderRadius: 12, border: 'none', background: '#0052cc', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
                Change Photo
              </button>
              {user?.photoURL && (
                <button onClick={handleRemovePhoto} disabled={removingPhoto} style={{ padding: '12px 16px', borderRadius: 12, border: '1px solid #fecaca', background: '#fff5f5', color: '#b91c1c', fontWeight: 700, cursor: 'pointer' }}>
                  {removingPhoto ? 'Removing...' : 'Remove'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
};
