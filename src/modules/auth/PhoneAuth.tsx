import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../../core/store/useStore';

export const PhoneAuth = () => {
  const [step, setStep] = useState<'phone' | 'otp' | 'success'>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  
  const { setUser } = useStore();
  const navigate = useNavigate();

  const handleSendCode = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setStep('otp');
    }, 800);
  };

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) return; // Prevent multiple chars
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto focus next
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  useEffect(() => {
    if (step === 'otp' && otp.every(digit => digit !== '')) {
      verifyOtp();
    }
  }, [otp, step]);

  const verifyOtp = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setStep('success');
      setTimeout(() => {
        setUser({
          id: 'user-phone-' + phone,
          name: 'Verified User',
          email: '',
          role: 'user',
          impactScore: 0,
          location: { latitude: 37.7749, longitude: -122.4194 }
        });
        navigate('/');
      }, 1500);
    }, 1000);
  };

  return (
    <div className="p-8 relative min-h-[350px]">
      <Link to="/auth/signin" className="inline-flex items-center text-sm text-outline hover:text-primary transition-colors mb-6 font-label-bold">
        <span className="material-symbols-outlined text-sm mr-1">arrow_back</span>
        Cancel
      </Link>
      
      <AnimatePresence mode="wait">
        {step === 'phone' && (
          <motion.div
            key="phone"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div>
              <h2 className="text-2xl font-h2 text-on-surface mb-2">Phone Verification</h2>
              <p className="text-sm font-body-sm text-on-surface-variant">We'll send a 6-digit secure code to verify your identity.</p>
            </div>

            <form onSubmit={handleSendCode} className="space-y-4">
              <div>
                <label className="block text-xs font-label-bold text-on-surface mb-1.5 uppercase tracking-wide">Phone Number</label>
                <div className="flex gap-2">
                  <select className="w-24 px-3 py-3 rounded-lg border border-outline-variant bg-surface-bright focus:border-primary focus:ring-1 focus:ring-primary outline-none text-on-surface font-body-sm">
                    <option>+1</option>
                    <option>+44</option>
                    <option>+91</option>
                  </select>
                  <input 
                    type="tel" 
                    className="flex-1 px-4 py-3 rounded-lg border border-outline-variant bg-surface-bright focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-on-surface placeholder-outline font-body-sm"
                    placeholder="(555) 000-0000"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                  />
                </div>
              </div>
              <button 
                type="submit" 
                disabled={loading || phone.length < 5}
                className="w-full h-12 mt-2 bg-primary text-white rounded-lg font-label-bold text-sm shadow-md hover:bg-primary/90 disabled:opacity-50 disabled:active:scale-100 active:scale-[0.98] transition-all flex items-center justify-center"
              >
                {loading ? <span className="material-symbols-outlined animate-spin text-xl">progress_activity</span> : 'Send Code'}
              </button>
            </form>
          </motion.div>
        )}

        {step === 'otp' && (
          <motion.div
            key="otp"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div>
              <h2 className="text-2xl font-h2 text-on-surface mb-2">Enter Code</h2>
              <p className="text-sm font-body-sm text-on-surface-variant">We sent a verification code to <strong className="text-on-surface">{phone}</strong>.</p>
            </div>

            <div className="flex justify-between gap-2">
              {otp.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => { inputRefs.current[index] = el; }}
                  type="text"
                  maxLength={1}
                  className="w-12 h-14 text-center text-xl font-h2 rounded-lg border border-outline-variant bg-surface-bright focus:border-primary focus:ring-2 focus:ring-primary outline-none transition-all text-on-surface"
                  value={digit}
                  onChange={(e) => handleOtpChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                />
              ))}
            </div>

            <div className="flex flex-col gap-3">
              <button 
                disabled={loading || otp.some(d => d === '')}
                onClick={verifyOtp}
                className="w-full h-12 bg-primary text-white rounded-lg font-label-bold text-sm shadow-md hover:bg-primary/90 disabled:opacity-50 disabled:active:scale-100 active:scale-[0.98] transition-all flex items-center justify-center"
              >
                {loading ? <span className="material-symbols-outlined animate-spin text-xl">progress_activity</span> : 'Verify Code'}
              </button>
              <button className="text-xs font-label-bold text-outline hover:text-primary transition-colors">Resend Code</button>
            </div>
          </motion.div>
        )}

        {step === 'success' && (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute inset-0 flex flex-col items-center justify-center bg-white p-8"
          >
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15 }}
              className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6"
            >
              <span className="material-symbols-outlined text-4xl" style={{ fontVariationSettings: "'wght' 700" }}>check</span>
            </motion.div>
            <h2 className="text-2xl font-h2 text-on-surface mb-2">Verified Successfully</h2>
            <p className="text-sm font-body-sm text-on-surface-variant text-center">Redirecting you to ReliefSync...</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
