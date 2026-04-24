import { Link } from 'react-router-dom';

export const AuthEntry = () => {
  return (
    <div style={{ fontFamily: 'Inter, sans-serif', background: '#f8f9fb', minHeight: '100vh', display: 'flex', flexDirection: 'column', color: '#191c1e' }}>

      {/* NAV */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(255,255,255,0.4)', padding: '0 32px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
            <span className="material-symbols-outlined" style={{ color: '#0052cc', fontSize: 28, fontVariationSettings: "'FILL' 1" }}>emergency</span>
            <span style={{ fontWeight: 800, fontSize: 22, color: '#0052cc', letterSpacing: '-0.5px' }}>ReliefSync</span>
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
            <a href="#" style={{ color: '#434654', fontSize: 14, fontWeight: 500, textDecoration: 'none' }}>How It Works</a>
            <a href="#" style={{ color: '#434654', fontSize: 14, fontWeight: 500, textDecoration: 'none' }}>Emergency Support</a>
          </div>
        </div>
      </nav>

      {/* MAIN */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 32px', position: 'relative', overflow: 'hidden' }}>
        {/* Background glow */}
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 800, height: 800, background: 'radial-gradient(circle, rgba(0,82,204,0.05) 0%, transparent 70%)', borderRadius: '50%', pointerEvents: 'none' }} />

        <div style={{ width: '100%', maxWidth: 960, position: 'relative', zIndex: 1 }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <h1 style={{ fontSize: 52, fontWeight: 800, letterSpacing: '-1.5px', margin: 0, marginBottom: 16 }}>Access Infrastructure</h1>
            <p style={{ fontSize: 18, color: '#737685', margin: 0, maxWidth: 560, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.6 }}>
              Select your entry point to the ReliefSync coordination ecosystem. Mission-critical security for humanitarian response.
            </p>
          </div>

          {/* Cards grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

            {/* User Access Card */}
            <div style={{ background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.6)', borderRadius: 24, padding: 40, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxShadow: '0 20px 48px rgba(0,82,204,0.06)' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
                  <div style={{ width: 64, height: 64, borderRadius: 16, background: 'rgba(0,82,204,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 34, color: '#0052cc', fontVariationSettings: "'FILL' 1" }}>person</span>
                  </div>
                  <span style={{ padding: '4px 12px', borderRadius: 9999, background: '#f1f5f9', fontSize: 12, fontWeight: 700, color: '#0052cc' }}>Public & Volunteer</span>
                </div>
                <h2 style={{ fontSize: 28, fontWeight: 800, margin: 0, marginBottom: 12, letterSpacing: '-0.3px' }}>User Access</h2>
                <p style={{ fontSize: 15, color: '#737685', margin: 0, marginBottom: 28, lineHeight: 1.65 }}>
                  For volunteers, civilians, and field responders seeking to report incidents, offer resources, or coordinate local aid.
                </p>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, marginBottom: 36, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {['Report Local Emergencies', 'Real-time Resource Mapping', 'Volunteer Deployment Status'].map(item => (
                    <li key={item} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 15, color: '#434654' }}>
                      <span className="material-symbols-outlined" style={{ color: '#0052cc', fontSize: 20 }}>check_circle</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <Link to="/auth/signin" style={{ textDecoration: 'none', display: 'block' }}>
                <button style={{ width: '100%', padding: '16px', borderRadius: 9999, background: '#0052cc', border: 'none', color: '#fff', fontWeight: 700, fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 8px 20px rgba(0,82,204,0.25)' }}>
                  Continue to Workspace
                  <span className="material-symbols-outlined" style={{ fontSize: 20 }}>arrow_forward</span>
                </button>
              </Link>
            </div>

            {/* Admin Access Card */}
            <div style={{ background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.6)', borderRadius: 24, padding: 40, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxShadow: '0 20px 48px rgba(0,82,204,0.06)', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: -60, right: -60, width: 160, height: 160, background: 'rgba(0,82,204,0.06)', borderRadius: '50%', filter: 'blur(40px)', pointerEvents: 'none' }} />
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
                  <div style={{ width: 64, height: 64, borderRadius: 16, background: 'rgba(184,26,54,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 34, color: '#b81a36', fontVariationSettings: "'FILL' 1" }}>admin_panel_settings</span>
                  </div>
                  <span style={{ padding: '4px 12px', borderRadius: 9999, background: '#fff1f2', fontSize: 12, fontWeight: 700, color: '#b81a36' }}>Critical Ops</span>
                </div>
                <h2 style={{ fontSize: 28, fontWeight: 800, margin: 0, marginBottom: 12, letterSpacing: '-0.3px' }}>Admin Access</h2>
                <p style={{ fontSize: 15, color: '#737685', margin: 0, marginBottom: 28, lineHeight: 1.65 }}>
                  For government agencies, NGO headquarters, and infrastructure managers overseeing regional relief operations.
                </p>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, marginBottom: 36, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {['Fleet & Logistics Management', 'Multi-agency Data Synchronization', 'Policy & Response Configuration'].map(item => (
                    <li key={item} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 15, color: '#434654' }}>
                      <span className="material-symbols-outlined" style={{ color: '#b81a36', fontSize: 20 }}>security</span>
                      {item}
                    </li>
                  ))}
                </ul>
                <p style={{ fontSize: 12, color: '#737685', margin: 0, marginBottom: 28, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>lock</span>
                  Secure Protocols Enabled
                </p>
              </div>
              <Link to="/auth/admin" style={{ textDecoration: 'none', display: 'block', position: 'relative', zIndex: 1 }}>
                <button style={{ width: '100%', padding: '16px', borderRadius: 9999, background: 'transparent', border: '2px solid #e1e2e4', color: '#191c1e', fontWeight: 700, fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  Enterprise Authentication
                  <span className="material-symbols-outlined" style={{ fontSize: 20 }}>key</span>
                </button>
              </Link>
            </div>
          </div>

          {/* Bottom links */}
          <div style={{ textAlign: 'center', marginTop: 32, display: 'flex', justifyContent: 'center', gap: 32 }}>
            {['New Organization?', 'API Access', 'System Status'].map(l => (
              <a key={l} href="#" style={{ fontSize: 13, color: '#737685', textDecoration: 'none', fontWeight: 500 }}>{l}</a>
            ))}
          </div>
        </div>
      </main>

      {/* FOOTER */}
      <footer style={{ background: '#fff', borderTop: '1px solid #f1f5f9', padding: '24px 32px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <p style={{ fontSize: 13, color: '#737685', margin: 0 }}>© 2024 ReliefSync. Mission-critical reliability for civic infrastructure.</p>
          <div style={{ display: 'flex', gap: 20 }}>
            {['Home','Features','How It Works','FAQ','Privacy Policy'].map(l => (
              <a key={l} href="#" style={{ fontSize: 13, color: '#737685', textDecoration: 'none' }}>{l}</a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
};
