import { Link } from 'react-router-dom';
import { useIsMobile } from '../../core/hooks/useIsMobile';

export const LandingPage = () => {
  const isMobile = useIsMobile();

  return (
    <div style={{ fontFamily: 'Inter, sans-serif', background: '#f8f9fb', minHeight: '100vh', display: 'flex', flexDirection: 'column', color: '#191c1e' }}>
      <nav style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(255,255,255,0.84)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(255,255,255,0.4)', padding: isMobile ? '0 16px' : '0 32px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, height: 64 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="material-symbols-outlined" style={{ color: '#0052cc', fontSize: 28, fontVariationSettings: "'FILL' 1" }}>emergency</span>
            <span style={{ fontWeight: 800, fontSize: isMobile ? 18 : 22, color: '#0052cc', letterSpacing: '-0.5px' }}>ReliefSync</span>
          </div>

          {!isMobile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
              <a href="#" style={{ color: '#434654', fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>Home</a>
              <a href="#features" style={{ color: '#434654', fontSize: 14, fontWeight: 500, textDecoration: 'none' }}>Features</a>
              <a href="#how-it-works" style={{ color: '#434654', fontSize: 14, fontWeight: 500, textDecoration: 'none' }}>How It Works</a>
              <a href="#faq" style={{ color: '#434654', fontSize: 14, fontWeight: 500, textDecoration: 'none' }}>FAQ</a>
            </div>
          )}

          <div style={{ display: 'flex', gap: isMobile ? 8 : 12, alignItems: 'center', flexShrink: 0 }}>
            <Link to="/auth/signin" style={{ textDecoration: 'none' }}>
              <button style={{ padding: isMobile ? '8px 12px' : '8px 20px', borderRadius: 9999, background: 'transparent', border: 'none', color: '#0052cc', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>Login</button>
            </Link>
            <Link to="/auth" style={{ textDecoration: 'none' }}>
              <button style={{ padding: isMobile ? '10px 14px' : '10px 22px', borderRadius: 9999, background: '#0052cc', border: 'none', color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,82,204,0.3)' }}>Get Started</button>
            </Link>
          </div>
        </div>
      </nav>

      <section style={{ background: 'radial-gradient(ellipse at 50% 20%, rgba(0,82,204,0.06) 0%, transparent 70%)', padding: isMobile ? '48px 16px 64px' : '80px 32px 100px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? 32 : 64, alignItems: 'center' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '4px 14px', borderRadius: 9999, background: '#ffdad9', marginBottom: 24 }}>
              <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#b81a36' }}></span>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: '#b81a36' }}>LIVE COORDINATION ACTIVE</span>
            </div>
            <h1 style={{ fontSize: isMobile ? 38 : 56, fontWeight: 800, lineHeight: 1.08, letterSpacing: isMobile ? '-1px' : '-1.5px', margin: '0 0 24px', color: '#191c1e' }}>
              Precision Response
              <br />
              <span style={{ color: '#0052cc' }}>For Global Crisis</span>
            </h1>
            <p style={{ fontSize: isMobile ? 16 : 18, color: '#434654', lineHeight: 1.7, maxWidth: 520, margin: '0 0 36px' }}>
              The ultimate infrastructure for civic stability. Orchestrate real-time relief operations with AI-powered logistics and seamless resource deployment.
            </p>
            <div style={{ display: 'flex', gap: 16, flexDirection: isMobile ? 'column' : 'row' }}>
              <Link to="/auth" style={{ textDecoration: 'none' }}>
                <button style={{ width: isMobile ? '100%' : 'auto', padding: '14px 28px', borderRadius: 12, background: '#0052cc', color: '#fff', fontWeight: 700, fontSize: 16, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 8px 24px rgba(0,82,204,0.3)' }}>
                  Initialize Deployment
                  <span className="material-symbols-outlined" style={{ fontSize: 20 }}>arrow_forward</span>
                </button>
              </Link>
              <button style={{ width: isMobile ? '100%' : 'auto', padding: '14px 28px', borderRadius: 12, background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(8px)', color: '#191c1e', fontWeight: 600, fontSize: 16, border: '1px solid #c3c6d6', cursor: 'pointer' }}>
                View Documentation
              </button>
            </div>
          </div>

          <div style={{ position: 'relative' }}>
            <div style={{ background: 'rgba(255,255,255,0.5)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.5)', borderRadius: 28, padding: 16, boxShadow: '0 20px 60px rgba(0,82,204,0.1)' }}>
              <img
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuCIaOdqNAEPnhDJxUf02Lg6Cj53Jv3YQmMv_MzzjqS-1Wz4WYstVO79gguaSKJIe5G3InrcxF3rL9PQzUhjlgbVoYM_9tanpgOSseIm3AAwjMYqHxBxwAg_UIAwFVbxxzV_dkaJ8AKyrrihFxfcvoExoxi4m9Wssg1k_He5lRKX7IiUi1wdErtNYHAT0uLcRSd2ci3BA0L3__Gg6AzJIPm4yU6HmJCjEgDkFlazaaBlVsY6fFWF43l0I6wWdPjhhHjqMjGethwcSzv6"
                alt="Crisis coordination"
                style={{ width: '100%', borderRadius: 18, display: 'block' }}
              />
            </div>

            <div style={{ position: 'absolute', top: isMobile ? 12 : -20, left: isMobile ? 12 : -20, background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(12px)', borderRadius: 16, padding: isMobile ? '12px 14px' : '16px 20px', boxShadow: '0 8px 32px rgba(0,0,0,0.08)', border: '1px solid rgba(255,255,255,0.7)', width: isMobile ? 168 : 200 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span className="material-symbols-outlined" style={{ color: '#22c55e', fontSize: 18 }}>check_circle</span>
                <span style={{ fontWeight: 700, fontSize: 13, color: '#191c1e' }}>Resource Alert</span>
              </div>
              <div style={{ background: '#f1f5f9', borderRadius: 9999, height: 6, overflow: 'hidden' }}>
                <div style={{ background: '#0052cc', height: '100%', width: '85%', borderRadius: 9999 }}></div>
              </div>
            </div>

            <div style={{ position: 'absolute', bottom: isMobile ? 12 : -20, right: isMobile ? 12 : -12, background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(12px)', borderRadius: 16, padding: isMobile ? '12px 14px' : '16px 20px', boxShadow: '0 8px 32px rgba(0,0,0,0.08)', border: '1px solid rgba(255,255,255,0.7)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#0052cc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span className="material-symbols-outlined" style={{ color: '#fff', fontSize: 20 }}>groups</span>
                </div>
                <div>
                  <p style={{ fontSize: 10, fontWeight: 700, color: '#737685', letterSpacing: '0.08em', margin: 0 }}>ACTIVE TEAMS</p>
                  <p style={{ fontSize: isMobile ? 15 : 18, fontWeight: 800, color: '#191c1e', margin: 0 }}>1,248 Units</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section style={{ background: '#fff', padding: isMobile ? '40px 16px' : '60px 32px', borderTop: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4,1fr)', gap: isMobile ? 20 : 32, textAlign: 'center' }}>
          {[
            { label: 'LATENCY', value: '42ms' },
            { label: 'CITIZENS SECURED', value: '12M+' },
            { label: 'EFFICIENCY GAIN', value: '89%' },
            { label: 'REAL-TIME UPTIME', value: '24/7' },
          ].map((stat) => (
            <div key={stat.label}>
              <p style={{ fontSize: isMobile ? 28 : 40, fontWeight: 800, color: '#0052cc', margin: 0 }}>{stat.value}</p>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#737685', letterSpacing: '0.1em', marginTop: 6 }}>{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="features" style={{ padding: isMobile ? '56px 16px' : '80px 32px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <h2 style={{ fontSize: isMobile ? 30 : 40, fontWeight: 800, margin: '0 0 12px', letterSpacing: '-0.5px' }}>Engineered for Extremes</h2>
            <p style={{ fontSize: isMobile ? 16 : 18, color: '#434654', margin: 0 }}>Modern tools for unprecedented coordination during critical incidents.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr', gap: 20, marginBottom: 20 }}>
            <div style={{ background: '#fff', borderRadius: 24, padding: isMobile ? 24 : 40, border: '1px solid #f1f5f9', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', position: 'relative', overflow: 'hidden', minHeight: isMobile ? 220 : 320 }}>
              <div style={{ position: 'absolute', top: 0, right: 0, opacity: 0.04, pointerEvents: 'none' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 180 }}>psychology</span>
              </div>
              <div style={{ width: 48, height: 48, background: '#0052cc', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
                <span className="material-symbols-outlined" style={{ color: '#fff', fontSize: 22 }}>bolt</span>
              </div>
              <h3 style={{ fontSize: isMobile ? 22 : 28, fontWeight: 700, margin: '0 0 12px', letterSpacing: '-0.3px' }}>Neural Resource Prediction</h3>
              <p style={{ fontSize: 16, color: '#434654', lineHeight: 1.7, maxWidth: 460, margin: 0 }}>Our AI engine analyzes historical crisis data to predict resource shortages before they occur, optimizing supply chains in real-time.</p>
            </div>

            <div style={{ background: '#fff', borderRadius: 24, padding: isMobile ? 24 : 40, border: '1px solid #f1f5f9', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <div style={{ width: 72, height: 72, background: '#eff6ff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24, border: '1px solid #dbeafe' }}>
                <span className="material-symbols-outlined" style={{ color: '#0052cc', fontSize: 34 }}>verified_user</span>
              </div>
              <h3 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 12px' }}>Smart Reporting</h3>
              <p style={{ fontSize: 15, color: '#434654', lineHeight: 1.6, margin: 0 }}>Validated multi-channel reporting that filters noise and prioritizes life-safety signals instantly.</p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 2fr', gap: 20 }}>
            <div style={{ background: '#fff', borderRadius: 24, padding: isMobile ? 24 : 40, border: '1px solid #f1f5f9', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              <div style={{ width: 44, height: 44, background: '#eff6ff', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                <span className="material-symbols-outlined" style={{ color: '#0052cc', fontSize: 22 }}>diversity_3</span>
              </div>
              <h3 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 10px' }}>Volunteer Orchestration</h3>
              <p style={{ fontSize: 15, color: '#434654', lineHeight: 1.6, margin: 0 }}>Intelligent matching of certified responders to specific incident zones based on skill and proximity.</p>
            </div>

            <div style={{ background: '#0052cc', borderRadius: 24, padding: isMobile ? 24 : 40, color: '#fff', position: 'relative', overflow: 'hidden', minHeight: isMobile ? 210 : 240 }}>
              <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.25)' }}></div>
              <div style={{ position: 'relative', zIndex: 1 }}>
                <h3 style={{ fontSize: isMobile ? 24 : 32, fontWeight: 800, margin: '0 0 12px', letterSpacing: '-0.3px' }}>Tactical Coordination Hub</h3>
                <p style={{ fontSize: isMobile ? 15 : 17, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6, maxWidth: 440, margin: 0 }}>A unified dashboard for multi-agency collaboration, ensuring every responder is synchronized with the latest field intelligence.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" style={{ background: '#f8f9fb', padding: isMobile ? '56px 16px' : '80px 32px', borderTop: '1px solid #edeef0' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <h2 style={{ fontSize: isMobile ? 30 : 40, fontWeight: 800, margin: 0, letterSpacing: '-0.5px' }}>System Lifecycle</h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: 32, position: 'relative' }}>
            {!isMobile && <div style={{ position: 'absolute', top: 32, left: '5%', width: '90%', height: 2, background: '#e1e2e4', zIndex: 0 }}></div>}
            {[
              { id: '01', title: 'Ingest & Map', desc: 'Data floods in from satellites, sensors, and local reports, forming a live digital twin of the crisis.' },
              { id: '02', title: 'Process & Deploy', desc: 'The ReliefSync Engine prioritizes high-impact zones and automatically assigns the nearest resources.' },
              { id: '03', title: 'Resolve & Restore', desc: 'Ground teams execute tasks with real-time feedback until the infrastructure reaches full stability.' },
            ].map((step) => (
              <div key={step.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', position: 'relative', zIndex: 1 }}>
                <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#fff', border: '4px solid #0052cc', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24, boxShadow: '0 4px 16px rgba(0,82,204,0.15)' }}>
                  <span style={{ fontSize: 20, fontWeight: 800, color: '#0052cc' }}>{step.id}</span>
                </div>
                <h4 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 10px' }}>{step.title}</h4>
                <p style={{ fontSize: 15, color: '#434654', margin: 0, lineHeight: 1.6, maxWidth: 280 }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="faq" style={{ padding: isMobile ? '56px 16px' : '80px 32px' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <h2 style={{ fontSize: isMobile ? 30 : 40, fontWeight: 800, margin: '0 0 12px', letterSpacing: '-0.5px' }}>Strategic Clarity</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { q: 'How secure is the data transmission?', a: 'ReliefSync utilizes military-grade end-to-end encryption and decentralized nodes to ensure mission-critical data remains secure and accessible even when local infrastructure fails.' },
              { q: 'Can it integrate with existing emergency services?', a: 'Yes. We provide a robust API ecosystem that connects directly with dispatch systems, hospital systems, and municipal logistics networks.' },
              { q: 'How does the AI handle false reports?', a: 'Our proprietary trust-score logic cross-references reports with context signals to validate incident authenticity before dispatching teams.' },
            ].map((item) => (
              <details key={item.q} style={{ background: '#fff', borderRadius: 16, border: '1px solid #e1e2e4', overflow: 'hidden' }}>
                <summary style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: isMobile ? '18px 16px' : '20px 24px', cursor: 'pointer', fontWeight: 700, fontSize: 15, color: '#191c1e', listStyle: 'none' }}>
                  {item.q}
                  <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#737685', flexShrink: 0 }}>expand_more</span>
                </summary>
                <div style={{ padding: isMobile ? '0 16px 18px' : '0 24px 20px', fontSize: 15, color: '#434654', lineHeight: 1.7 }}>{item.a}</div>
              </details>
            ))}
          </div>
        </div>
      </section>

      <footer style={{ background: '#fff', borderTop: '1px solid #f1f5f9', padding: isMobile ? '32px 16px' : '48px 32px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 24 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontWeight: 900, fontSize: 18, color: '#191c1e' }}>ReliefSync</span>
              <span style={{ fontSize: 10, padding: '2px 8px', background: '#dae2ff', color: '#0052cc', borderRadius: 9999, fontWeight: 700 }}>V2.4</span>
            </div>
            <p style={{ fontSize: 13, color: '#737685', margin: 0 }}>Copyright 2024 ReliefSync. Mission-critical reliability for civic infrastructure.</p>
          </div>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            {['Home', 'Features', 'How It Works', 'FAQ', 'Privacy Policy'].map((item) => (
              <a key={item} href="#" style={{ fontSize: 13, color: '#737685', textDecoration: 'none', fontWeight: 500 }}>{item}</a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
};
