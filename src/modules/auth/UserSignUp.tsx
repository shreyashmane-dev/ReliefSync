import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useStore } from '../../core/store/useStore';
import { auth, db } from '../../core/firebase/config';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';

export const UserSignUp = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { setUser } = useStore();
  const navigate = useNavigate();

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }
    setLoading(true); setError(null);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName: name });
      const userData = { id: cred.user.uid, name, email, phone: phone || null, role: 'user' as const, impactScore: 0, location: null, createdAt: new Date().toISOString() };
      await setDoc(doc(db, 'users', cred.user.uid), userData);
      setUser(userData); navigate('/');
    } catch (err: any) { setError(err.message || 'Failed to create account.'); }
    finally { setLoading(false); }
  };

  const inp = { width: '100%', background: '#f5f7fa', border: '2px solid transparent', borderRadius: 14, padding: '14px 16px 14px 48px', fontSize: 15, color: '#191c1e', outline: 'none', boxSizing: 'border-box' as const, fontFamily: 'Inter, sans-serif' };
  const iconWrap = { position: 'relative' as const };
  const iconStyle = { position: 'absolute' as const, left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 20, color: '#9ca3af', pointerEvents: 'none' as const };

  return (
    <div style={{ fontFamily: 'Inter, sans-serif', background: 'radial-gradient(at 0% 0%, rgba(0,82,204,0.05) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(184,26,54,0.03) 0px, transparent 50%), #faf8ff', minHeight: '100vh', display: 'flex', flexDirection: 'column', color: '#191c1e' }}>

      {/* NAV */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(255,255,255,0.4)', padding: '0 32px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
            <span className="material-symbols-outlined" style={{ color: '#0052cc', fontSize: 28, fontVariationSettings: "'FILL' 1" }}>emergency</span>
            <span style={{ fontWeight: 800, fontSize: 22, color: '#0052cc', letterSpacing: '-0.5px' }}>ReliefSync</span>
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
            <Link to="/" style={{ color: '#434654', fontSize: 14, fontWeight: 500, textDecoration: 'none' }}>Home</Link>
            <a href="#" style={{ color: '#434654', fontSize: 14, fontWeight: 500, textDecoration: 'none' }}>Features</a>
            <span style={{ color: '#0052cc', fontSize: 14, fontWeight: 700, borderBottom: '2px solid #0052cc', paddingBottom: 2 }}>Sign Up</span>
          </div>
          <Link to="/auth/signin" style={{ textDecoration: 'none' }}>
            <button style={{ padding: '10px 22px', borderRadius: 9999, background: '#0052cc', border: 'none', color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>Login</button>
          </Link>
        </div>
      </nav>

      {/* MAIN */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', position: 'relative', overflow: 'hidden' }}>
        {/* Blobs */}
        <div style={{ position: 'absolute', top: '25%', left: -80, width: 384, height: 384, background: 'rgba(0,82,204,0.04)', borderRadius: '50%', filter: 'blur(80px)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '25%', right: -80, width: 320, height: 320, background: 'rgba(184,26,54,0.04)', borderRadius: '50%', filter: 'blur(80px)', pointerEvents: 'none' }} />

        <div style={{ background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.5)', borderRadius: 28, padding: '48px', boxShadow: '0 40px 64px rgba(0,82,204,0.08)', width: '100%', maxWidth: 560, position: 'relative', zIndex: 1 }}>
          <div style={{ textAlign: 'center', marginBottom: 36 }}>
            <h1 style={{ fontSize: 34, fontWeight: 800, margin: 0, marginBottom: 10, letterSpacing: '-0.5px' }}>Join the Network</h1>
            <p style={{ fontSize: 16, color: '#737685', margin: 0 }}>Empowering civic infrastructure through mission-critical coordination.</p>
          </div>

          {error && (
            <div style={{ background: '#fef2f2', color: '#b91c1c', padding: '12px 16px', borderRadius: 10, fontSize: 13, border: '1px solid #fecaca', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>error</span>{error}
            </div>
          )}

          <form onSubmit={handleSignUp} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* Full Name */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#434654', marginBottom: 6 }}>Full Name</label>
              <div style={iconWrap}>
                <span className="material-symbols-outlined" style={{ ...iconStyle }}>person</span>
                <input style={inp} type="text" placeholder="John Doe" value={name} onChange={e => setName(e.target.value)} required />
              </div>
            </div>
            {/* Email */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#434654', marginBottom: 6 }}>Email Address</label>
              <div style={iconWrap}>
                <span className="material-symbols-outlined" style={{ ...iconStyle }}>mail</span>
                <input style={inp} type="email" placeholder="john@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
              </div>
            </div>
            {/* Passwords */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#434654', marginBottom: 6 }}>Password</label>
                <div style={iconWrap}>
                  <span className="material-symbols-outlined" style={{ ...iconStyle }}>lock</span>
                  <input style={inp} type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#434654', marginBottom: 6 }}>Confirm Password</label>
                <div style={iconWrap}>
                  <span className="material-symbols-outlined" style={{ ...iconStyle }}>shield</span>
                  <input style={inp} type="password" placeholder="••••••••" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required minLength={6} />
                </div>
              </div>
            </div>
            {/* Phone */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#434654' }}>Phone Number</label>
                <span style={{ fontSize: 12, color: '#9ca3af', fontStyle: 'italic' }}>Optional</span>
              </div>
              <div style={iconWrap}>
                <span className="material-symbols-outlined" style={{ ...iconStyle }}>call</span>
                <input style={inp} type="tel" placeholder="+1 (555) 000-0000" value={phone} onChange={e => setPhone(e.target.value)} />
              </div>
            </div>

            {/* Info note */}
            <div style={{ background: '#eff6ff', border: '1px solid #dbeafe', borderRadius: 14, padding: '14px 16px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span className="material-symbols-outlined" style={{ color: '#0052cc', fontSize: 20, flexShrink: 0, marginTop: 1, fontVariationSettings: "'FILL' 1" }}>info</span>
              <p style={{ fontSize: 13, color: '#1e3a8a', margin: 0, lineHeight: 1.6 }}>
                Volunteer role can be applied for later from profile. Standard users have immediate access to real-time incident tracking.
              </p>
            </div>

            <button type="submit" disabled={loading} style={{ width: '100%', background: '#0052cc', border: 'none', borderRadius: 16, padding: '18px', fontSize: 17, fontWeight: 700, color: '#fff', cursor: loading ? 'not-allowed' : 'pointer', boxShadow: '0 8px 24px rgba(0,82,204,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: loading ? 0.7 : 1, marginTop: 4 }}>
              {loading && <span className="material-symbols-outlined" style={{ fontSize: 18, animation: 'spin 1s linear infinite' }}>progress_activity</span>}
              Create Account
            </button>
          </form>

          <p style={{ textAlign: 'center', fontSize: 14, color: '#737685', marginTop: 24 }}>
            Already have an account?{' '}
            <Link to="/auth/signin" style={{ color: '#0052cc', fontWeight: 700, textDecoration: 'none' }}>Log in</Link>
          </p>
        </div>
      </div>

      {/* FOOTER */}
      <footer style={{ borderTop: '1px solid #f1f5f9', padding: '24px 32px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <p style={{ fontSize: 13, color: '#737685', margin: 0 }}>© 2024 ReliefSync. Mission-critical reliability for civic infrastructure.</p>
          <div style={{ display: 'flex', gap: 20 }}>
            {['Home','Features','How It Works','FAQ','Privacy Policy'].map(l => (
              <a key={l} href="#" style={{ fontSize: 13, color: '#737685', textDecoration: 'none' }}>{l}</a>
            ))}
          </div>
        </div>
      </footer>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
};
