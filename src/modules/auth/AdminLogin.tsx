import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useStore } from '../../core/store/useStore';
import { auth, db } from '../../core/firebase/config';
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithRedirect, getRedirectResult } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

export const AdminLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { setUser } = useStore();
  const navigate = useNavigate();
  const hasHandledResult = useRef(false);

  useEffect(() => {
    if (hasHandledResult.current) return;
    
    // Standard approach to handle redirect result for COOP-restricted environments
    const handleResult = async () => {
      try {
        const cred = await getRedirectResult(auth);
        if (cred) {
          hasHandledResult.current = true;
          console.log('Redirect Auth successful. Checking registry for UID:', cred.user.uid);
          setLoading(true);
          const adminSnap = await getDoc(doc(db, 'admins', cred.user.uid));
          
          if (adminSnap.exists()) {
            const adminData = adminSnap.data();
            const userData = {
               id: cred.user.uid,
               name: cred.user.displayName || adminData.name || 'Admin',
               email: cred.user.email || 'Admin',
               role: 'admin' as const,
               ...adminData
            };
            setUser(userData);
            console.log('Admin verified. Navigating to Command Center...');
            navigate('/admin');
          } else {
            console.warn('Access Denied: UID not found in admins collection:', cred.user.uid);
            setError(`Access Denied: Your Google UID (${cred.user.uid}) is not in the "admins" collection. Please register this account as an admin.`);
            // Sign out if they are not an admin to avoid being stuck in a "half-logged" state
            await auth.signOut();
            setUser(null);
          }
        }
      } catch (err: any) {
        console.error('Redirect Auth Error:', err);
        setError(err.message || 'Authentication redirection failed.');
      } finally {
        setLoading(false);
      }
    };
    handleResult();
  }, [navigate, setUser]);

  const handleAdminAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      console.log('Login successful. Checking admin registry for UID:', cred.user.uid);
      
      const adminSnap = await getDoc(doc(db, 'admins', cred.user.uid));
      
      if (!adminSnap.exists()) {
        setError(`Access Denied: Your UID (${cred.user.uid}) is not in the "admins" collection. Please add it manually in Firebase Console.`);
        setLoading(false);
        return;
      }
      
      const adminData = adminSnap.data();
      const userData = {
        id: cred.user.uid,
        name: cred.user.displayName || adminData.name || 'Admin',
        email: cred.user.email || email,
        role: 'admin',
        ...adminData
      };
      
      setUser(userData);
      navigate('/admin');
    } catch (err: any) {
      console.error('Admin Auth Error:', err);
      if (err.code === 'permission-denied') {
        setError('Firebase Permission Error: Ensure the "admins" collection exists and rules are published.');
      } else {
        setError(err.message || 'Authentication failed.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAdminAuth = async () => {
    setLoading(true); setError(null);
    try {
      const provider = new GoogleAuthProvider();
      
      // Smart Auth Strategy: 
      // Use Popup for zero-configuration local development on localhost.
      // Use Redirect for strict security compliance in production.
      if (window.location.hostname === 'localhost') {
        const { signInWithPopup } = await import('firebase/auth');
        const cred = await signInWithPopup(auth, provider);
        handleManualAuth(cred); // Reuse logic to check admin registry
      } else {
        await signInWithRedirect(auth, provider);
      }
    } catch (err: any) {
      console.error('Admin Google Auth initialization failed:', err);
      setError(err.message || 'Google Authentication initialization failed.');
      setLoading(false);
    }
  };

  const handleManualAuth = async (cred: any) => {
      try {
          setLoading(true);
          const adminSnap = await getDoc(doc(db, 'admins', cred.user.uid));
          if (adminSnap.exists()) {
            const adminData = adminSnap.data();
            const userData = {
               id: cred.user.uid,
               name: cred.user.displayName || adminData.name || 'Admin',
               email: cred.user.email || 'Admin',
               role: 'admin' as const,
               ...adminData
            };
            setUser(userData);
            navigate('/admin');
          } else {
            setError(`Access Denied: Your Google UID (${cred.user.uid}) is not in the "admins" collection.`);
            await auth.signOut();
            setUser(null);
          }
      } catch (err: any) {
          setError('Verification failed after login.');
      } finally {
          setLoading(false);
      }
  };

  const inp = { width: '100%', background: '#f5f7fa', border: '2px solid transparent', borderRadius: 12, padding: '14px 16px 14px 48px', fontSize: 15, color: '#191c1e', outline: 'none', boxSizing: 'border-box' as const, fontFamily: 'Inter, sans-serif' };

  return (
    <div style={{ fontFamily: 'Inter, sans-serif', background: 'radial-gradient(at 0% 0%, rgba(0,82,204,0.05) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(184,26,54,0.03) 0px, transparent 50%), #faf8ff', minHeight: '100vh', display: 'flex', flexDirection: 'column', color: '#191c1e' }}>

      {/* NAV */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(255,255,255,0.4)', padding: '0 32px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
            <span className="material-symbols-outlined" style={{ color: '#0052cc', fontSize: 26 }}>emergency</span>
            <span style={{ fontWeight: 800, fontSize: 22, color: '#0052cc', letterSpacing: '-0.5px' }}>ReliefSync</span>
          </Link>
          <span style={{ fontSize: 13, color: '#737685', fontWeight: 500 }}>System Status: Secure</span>
        </div>
      </nav>

      {/* MAIN */}
      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', position: 'relative', overflow: 'hidden' }}>
        {/* Decorative orbs */}
        <div style={{ position: 'absolute', top: -96, left: -96, width: 384, height: 384, background: 'rgba(0,82,204,0.06)', borderRadius: '50%', filter: 'blur(100px)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -128, right: -128, width: 500, height: 500, background: 'rgba(184,26,54,0.04)', borderRadius: '50%', filter: 'blur(120px)', pointerEvents: 'none' }} />

        <div style={{ background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.5)', borderRadius: 28, padding: '48px 40px', boxShadow: '0 20px 52px rgba(0,82,204,0.08)', width: '100%', maxWidth: 440, position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: 28 }}>

          {/* Header */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(0,82,204,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 32, color: '#0052cc' }}>admin_panel_settings</span>
            </div>
            <h2 style={{ fontSize: 28, fontWeight: 800, margin: 0, marginBottom: 8, letterSpacing: '-0.3px' }}>ReliefSync Admin</h2>
            <p style={{ fontSize: 15, color: '#737685', margin: 0 }}>Enter your credentials to access the command center</p>
          </div>

          {/* Form */}
          <form onSubmit={handleAdminAuth} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {error && (
              <div style={{ background: '#fef2f2', color: '#b91c1c', padding: '12px 16px', borderRadius: 10, fontSize: 13, border: '1px solid #fecaca', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>error</span>{error}
              </div>
            )}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#434654', marginBottom: 6 }}>Admin Email</label>
              <div style={{ position: 'relative' }}>
                <span className="material-symbols-outlined" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 20, color: '#9ca3af', pointerEvents: 'none' }}>mail</span>
                <input style={inp} id="admin-email" type="email" placeholder="name@reliefsync.gov" value={email} onChange={e => setEmail(e.target.value)} required />
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#434654', marginBottom: 6 }}>Password</label>
              <div style={{ position: 'relative' }}>
                <span className="material-symbols-outlined" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 20, color: '#9ca3af', pointerEvents: 'none' }}>lock</span>
                <input style={inp} id="admin-password" type="password" placeholder="••••••••••••" value={password} onChange={e => setPassword(e.target.value)} required />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" style={{ width: 16, height: 16 }} />
                <span style={{ fontSize: 13, color: '#737685' }}>Remember session</span>
              </label>
              <a href="#" style={{ fontSize: 13, color: '#0052cc', textDecoration: 'none', fontWeight: 600 }}>Forgot password?</a>
            </div>
            <button type="submit" disabled={loading} style={{ width: '100%', background: '#0052cc', border: 'none', borderRadius: 9999, padding: '16px', fontSize: 16, fontWeight: 700, color: '#fff', cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: loading ? 0.7 : 1, boxShadow: '0 8px 20px rgba(0,82,204,0.2)' }}>
              {loading && <span className="material-symbols-outlined" style={{ fontSize: 18, animation: 'spin 1s linear infinite' }}>progress_activity</span>}
              Access Command Center
              {!loading && <span className="material-symbols-outlined" style={{ fontSize: 18 }}>chevron_right</span>}
            </button>
          </form>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1, height: 1, background: '#e1e2e4' }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', letterSpacing: '0.08em' }}>OR CONTINUE WITH</span>
            <div style={{ flex: 1, height: 1, background: '#e1e2e4' }} />
          </div>

          <button 
            onClick={handleGoogleAdminAuth} 
            disabled={loading}
            style={{ 
              width: '100%', 
              background: '#fff', 
              border: '1px solid #e1e2e4', 
              borderRadius: 9999, 
              padding: '14px', 
              fontSize: 15, 
              fontWeight: 600, 
              color: '#191c1e', 
              cursor: loading ? 'not-allowed' : 'pointer', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              gap: 12,
              transition: 'background 0.2s'
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Sign in with Google Workspace
          </button>

          {/* Security divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1, height: 1, background: '#e1e2e4' }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', letterSpacing: '0.08em' }}>ENTERPRISE SECURITY</span>
            <div style={{ flex: 1, height: 1, background: '#e1e2e4' }} />
          </div>

          {/* Security badges */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 32, opacity: 0.6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>encrypted</span>
              <span style={{ fontSize: 13, fontWeight: 600 }}>SSL Secure</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>verified_user</span>
              <span style={{ fontSize: 13, fontWeight: 600 }}>2FA Ready</span>
            </div>
          </div>
        </div>
      </main>

      {/* FOOTER */}
      <footer style={{ background: '#fff', borderTop: '1px solid #f1f5f9', padding: '28px 32px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <span style={{ fontSize: 16, fontWeight: 900, color: '#191c1e', display: 'block', marginBottom: 4 }}>ReliefSync</span>
            <p style={{ fontSize: 13, color: '#737685', margin: 0 }}>© 2024 ReliefSync. Mission-critical reliability for civic infrastructure.</p>
          </div>
          <div style={{ display: 'flex', gap: 20 }}>
            {['Privacy Policy','Security Protocols','Support'].map(l => (
              <a key={l} href="#" style={{ fontSize: 13, color: '#737685', textDecoration: 'none' }}>{l}</a>
            ))}
          </div>
        </div>
      </footer>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
};
