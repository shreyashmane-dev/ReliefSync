import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useStore } from '../../core/store/useStore';
import { auth, db } from '../../core/firebase/config';
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const s = {
  page: { fontFamily: 'Inter, sans-serif', background: 'radial-gradient(at 0% 0%, rgba(0,82,204,0.05) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(184,26,54,0.03) 0px, transparent 50%), #faf8ff', minHeight: '100vh', display: 'flex', flexDirection: 'column' as const, color: '#191c1e' },
  nav: { position: 'sticky' as const, top: 0, zIndex: 50, background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(255,255,255,0.4)', padding: '0 32px' },
  navInner: { maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 },
  logo: { display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' },
  navLinks: { display: 'flex', alignItems: 'center', gap: 28 },
  navLink: { color: '#434654', fontSize: 14, fontWeight: 500, textDecoration: 'none' },
  navLinkActive: { color: '#0052cc', fontSize: 14, fontWeight: 700, textDecoration: 'none', borderBottom: '2px solid #0052cc', paddingBottom: 2 },
  main: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', position: 'relative' as const, overflow: 'hidden' },
  blob1: { position: 'absolute' as const, top: -96, right: -96, width: 384, height: 384, background: 'rgba(190,215,255,0.2)', borderRadius: '50%', filter: 'blur(100px)', pointerEvents: 'none' as const },
  blob2: { position: 'absolute' as const, bottom: -96, left: -96, width: 384, height: 384, background: 'rgba(255,210,215,0.2)', borderRadius: '50%', filter: 'blur(100px)', pointerEvents: 'none' as const },
  card: { background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.5)', borderRadius: 28, padding: '48px', boxShadow: '0 40px 64px rgba(0,82,204,0.08)', width: '100%', maxWidth: 480, position: 'relative' as const, zIndex: 1 },
  nodeImg: { width: 80, height: 80, objectFit: 'contain' as const, display: 'block', margin: '0 auto 32px' },
  cardTitle: { textAlign: 'center' as const, marginBottom: 36 },
  h1: { fontSize: 30, fontWeight: 700, margin: 0, marginBottom: 8, color: '#191c1e' },
  subtitle: { fontSize: 15, color: '#434654', margin: 0 },
  label: { display: 'block', fontSize: 13, fontWeight: 600, color: '#434654', marginBottom: 6 },
  input: { width: '100%', background: '#f5f7fa', border: '2px solid transparent', borderRadius: 12, padding: '14px 16px', fontSize: 15, color: '#191c1e', outline: 'none', boxSizing: 'border-box' as const, fontFamily: 'Inter, sans-serif' },
  btnPrimary: { width: '100%', background: '#0052cc', border: 'none', borderRadius: 9999, padding: '16px', fontSize: 17, fontWeight: 700, color: '#fff', cursor: 'pointer', boxShadow: '0 8px 20px rgba(0,82,204,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 },
  divider: { display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0' },
  dividerLine: { flex: 1, height: 1, background: '#e1e2e4' },
  dividerText: { fontSize: 12, fontWeight: 600, color: '#737685' },
  btnGoogle: { width: '100%', background: '#fff', border: '1px solid #e1e2e4', borderRadius: 9999, padding: '14px', fontSize: 14, fontWeight: 600, color: '#191c1e', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 },
  footer: { borderTop: '1px solid #f1f5f9', padding: '24px 32px' },
  footerInner: { maxWidth: 1200, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' as const, gap: 12 },
  footerText: { fontSize: 13, color: '#737685', margin: 0 },
  footerLinks: { display: 'flex', gap: 20 },
  footerLink: { fontSize: 13, color: '#737685', textDecoration: 'none', fontWeight: 500 },
  error: { background: '#fef2f2', color: '#b91c1c', padding: '12px 16px', borderRadius: 10, fontSize: 13, border: '1px solid #fecaca', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 },
  forgotRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  forgotLink: { fontSize: 12, color: '#0052cc', textDecoration: 'none', fontWeight: 600 },
  signupText: { textAlign: 'center' as const, fontSize: 14, color: '#434654', marginTop: 24 },
};

export const UserSignIn = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { setUser } = useStore();
  const navigate = useNavigate();

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const snap = await getDoc(doc(db, 'users', cred.user.uid));
      let data = { id: cred.user.uid, name: cred.user.displayName || 'User', email: cred.user.email || email, role: 'user' as const, impactScore: 0, location: null };
      if (snap.exists()) data = { ...data, ...snap.data() } as any;
      setUser(data); navigate('/');
    } catch (err: any) { setError(err.message || 'Sign in failed.'); }
    finally { setLoading(false); }
  };

  const handleGoogle = async () => {
    setLoading(true); setError(null);
    try {
      const cred = await signInWithPopup(auth, new GoogleAuthProvider());
      const ref = doc(db, 'users', cred.user.uid);
      const snap = await getDoc(ref);
      let data = { id: cred.user.uid, name: cred.user.displayName || 'User', email: cred.user.email || '', role: 'user' as const, impactScore: 0, location: null };
      if (snap.exists()) data = { ...data, ...snap.data() } as any;
      else await setDoc(ref, data);
      setUser(data); navigate('/');
    } catch (err: any) { setError(err.message || 'Google sign in failed.'); }
    finally { setLoading(false); }
  };

  return (
    <div style={s.page}>
      {/* NAV */}
      <nav style={s.nav}>
        <div style={s.navInner}>
          <Link to="/" style={s.logo}>
            <span className="material-symbols-outlined" style={{ color: '#0052cc', fontSize: 28, fontVariationSettings: "'FILL' 1" }}>emergency</span>
            <span style={{ fontWeight: 800, fontSize: 22, color: '#0052cc', letterSpacing: '-0.5px' }}>ReliefSync</span>
          </Link>
          <div style={s.navLinks}>
            <Link to="/" style={s.navLink}>Home</Link>
            <a href="#" style={s.navLink}>Features</a>
          </div>
          <span style={s.navLinkActive}>Login</span>
        </div>
      </nav>

      {/* MAIN */}
      <div style={s.main}>
        <div style={s.blob1} />
        <div style={s.blob2} />
        <div style={s.card}>
          <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuC6gX7mXk1gvI5SuQwI9hM2gwlvr0CnprifkZUTBJhAl0goQiEAFLNMKSPjTjTVN6FUd0Vh3DNVe8NKeVs1APNROKZahLal51Xc2q-jcYH9v0c1SuVB5Tqk_bUkxGI_Ut6dW3GzgilovfOsmXNqGff8xryGwK-Z11o3ddzxg_Xm8zab79s_KL8ET_aIXPfKuW46EAKVlPLfaF3-Fe_hoqLVb7pYsWxohLDSutgbRAGNGLO8rvXEXwxmzbySMPrcT3wU0_TF9WTC40yF" alt="node" style={s.nodeImg} />
          <div style={s.cardTitle}>
            <h1 style={s.h1}>Welcome Back</h1>
            <p style={s.subtitle}>Mission-critical infrastructure access.</p>
          </div>

          {error && (
            <div style={s.error}>
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>error</span>
              {error}
            </div>
          )}

          <form onSubmit={handleSignIn} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <label style={s.label}>Email Address</label>
              <input style={s.input} type="email" placeholder="name@organization.gov" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div>
              <div style={s.forgotRow}>
                <label style={{ ...s.label, margin: 0 }}>Password</label>
                <a href="#" style={s.forgotLink}>Forgot Password?</a>
              </div>
              <input style={{ ...s.input, marginTop: 6 }} type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
            <button type="submit" disabled={loading} style={{ ...s.btnPrimary, opacity: loading ? 0.7 : 1, marginTop: 6 }}>
              {loading && <span className="material-symbols-outlined" style={{ fontSize: 18, animation: 'spin 1s linear infinite' }}>progress_activity</span>}
              Sign In
            </button>
          </form>

          <div style={s.divider}>
            <div style={s.dividerLine} /><span style={s.dividerText}>OR</span><div style={s.dividerLine} />
          </div>

          <button onClick={handleGoogle} disabled={loading} style={{ ...s.btnGoogle, opacity: loading ? 0.7 : 1 }}>
            <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuBWKlHvoSnYT2EFusslvafZuvOXqVufAEZ1bih7k1I6rwSlzAdZlipZocKob4TM3Gu9Cf9SMHM_n1NRgdxareZoWZaG6dpV1hSC8PU4NQhcXQm4QrYfsDUfB7ntj7F52qqBSX-tqpETe2qRoQTZn3tKknz8U1ujoyxHu_EkIkyQ7r0pwhb-tysW_ljkbFKw9o2Sntoh5CDas7gWr-DbWrqCTDMgMX0270bNoemnXXMsvRduSy8kndXWysWzMB2GXXq0XTlvN6VJHLP_" alt="Google" style={{ width: 20, height: 20 }} />
            Continue with Google
          </button>

          <p style={s.signupText}>
            New to ReliefSync?{' '}
            <Link to="/auth/signup" style={{ color: '#0052cc', fontWeight: 700, textDecoration: 'none' }}>Create Account</Link>
          </p>
        </div>
      </div>

      {/* FOOTER */}
      <footer style={s.footer}>
        <div style={s.footerInner}>
          <p style={s.footerText}>© 2024 ReliefSync. Mission-critical reliability for civic infrastructure.</p>
          <div style={s.footerLinks}>
            {['Home','Features','How It Works','FAQ','Privacy Policy'].map(l => (
              <a key={l} href="#" style={s.footerLink}>{l}</a>
            ))}
          </div>
        </div>
      </footer>

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  );
};
