'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { Bot, Mail, Lock, User as UserIcon, ArrowRight, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/FirebaseAuthContext';
import { auth } from '@/lib/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendEmailVerification, GoogleAuthProvider, signInWithPopup, sendPasswordResetEmail } from 'firebase/auth';
import { useSearchParams } from 'next/navigation';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function BrandHeader() {
  return (
    <div className="flex flex-col items-center mb-5">
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded-lg bg-gradient-to-tr from-purple-500 to-indigo-500 shadow-sm shadow-purple-500/10">
          <Bot className="w-5 h-5 text-white" />
        </div>
        <span className="font-bold text-2xl tracking-tight bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">
          AI Job Copilot
        </span>
      </div>
    </div>
  );
}

function AuthContent() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') === 'signup' ? 'signup' : 'signin';
  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>(initialTab);
  const [authStep, setAuthStep] = useState<'form' | 'forgot-password' | 'email-sent'>('form');

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otpInput, setOtpInput] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const { user, loading: authLoading } = useAuth();
  const isSignedIn = !!user;

  useEffect(() => {
    let isMounted = true;
    const checkAuth = async () => {
      if (isSignedIn && authStep !== 'email-sent') {
        try {
          const token = await auth.currentUser?.getIdToken();
          if (!token) return;
          const res = await fetch(`${API_BASE}/auth/status`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const data = await res.json();
          if (data.emailVerified) {
             await auth.currentUser?.reload();
             if (isMounted) window.location.href = '/dashboard';
          } else {
             if (isMounted) setAuthStep('email-sent');
             // Trigger OTP sending
             await fetch(`${API_BASE}/auth/send-email-otp`, {
               method: 'POST',
               headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
               body: JSON.stringify({ email: auth.currentUser?.email })
             });
          }
        } catch (err) {
           console.error(err);
        }
      }
    };
    checkAuth();
    return () => { isMounted = false; };
  }, [isSignedIn, authStep]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      setError(err.message || 'Sign-in failed. Please check your email and password.');
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (!isSignedIn && activeTab === 'signup') {
        // PRE-SIGNUP VERIFICATION
        const res = await fetch(`${API_BASE}/auth/signup-verify-otp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, otp: otpInput })
        });
        const result = await res.json();
        if (!res.ok || !result.verified) {
          throw new Error(result.message || 'Invalid OTP code.');
        }
        
        // OTP is verified! Now securely create the Firebase user.
        // Once created, the useEffect will take over and redirect to dashboard.
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        
        // Update the display name in Firebase!
        if (fullName) {
          const { updateProfile } = await import('firebase/auth');
          await updateProfile(userCredential.user, { displayName: fullName });
          
          // Sync it to the backend so it doesn't get lost
          try {
            const token = await userCredential.user.getIdToken();
            await fetch(`${API_BASE}/user/profile`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({ name: fullName })
            });
          } catch (e) {
            console.error("Failed to sync name to backend on signup", e);
          }
        }
        
        return;
      }

      // POST-SIGNIN VERIFICATION (Fallback)
      const currentAuthUser = auth.currentUser;
      if (!currentAuthUser) throw new Error("Authentication session lost.");
      
      const fbToken = await currentAuthUser.getIdToken();
      
      const res = await fetch(`${API_BASE}/auth/verify-email-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${fbToken}`
        },
        body: JSON.stringify({ otp: otpInput })
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Invalid OTP code.');
      }

      await currentAuthUser.reload();
      await currentAuthUser.getIdToken(true);
      window.location.href = '/dashboard';
    } catch (err: any) {
      setError(err.message || 'Failed to verify OTP.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/auth/signup-send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Failed to send OTP.');
      }
      setAuthStep('email-sent');
    } catch (err: any) {
      setError(err.message || 'Sign-up failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      await sendPasswordResetEmail(auth, email);
      setMessage('A password reset link has been sent to your email.');
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (authLoading || (isSignedIn && authStep !== 'email-sent')) {
    return (
      <div className="w-full h-full min-h-[400px] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authStep === 'email-sent') {
    return (
      <div className="w-full max-w-md relative z-10">
        <BrandHeader />
        <div className="glass-card py-5 px-6 border border-white/5 text-center">
          <h3 className="font-bold text-sm text-white mb-2">Verify Your Email</h3>
          <p className="text-xs text-neutral-400 mb-6">
            We sent a 6-digit verification code to <span className="text-purple-400">{email}</span>. Please enter the code below to continue.
          </p>
          
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div className="space-y-1.5 text-left">
              <label className="text-[10px] font-semibold text-neutral-400 block">Verification Code (OTP)</label>
              <div className="relative">
                <Lock className="absolute left-4 top-2.5 w-3.5 h-3.5 text-neutral-500" />
                <input 
                  placeholder="123456" 
                  type="text" 
                  maxLength={6}
                  value={otpInput} 
                  onChange={(e) => setOtpInput(e.target.value.replace(/[^0-9]/g, ''))} 
                  className="w-full bg-neutral-900 border border-white/5 rounded-xl pl-11 pr-4 py-2 text-xs text-white focus:outline-none focus:border-purple-500/50 tracking-widest font-mono" 
                  required 
                />
              </div>
            </div>

            {error && <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-[10px] text-red-400 text-left">{error}</div>}

            <button type="submit" disabled={loading || otpInput.length !== 6} className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:bg-neutral-800 disabled:text-neutral-500 text-xs font-bold text-white transition flex items-center justify-center gap-2">
              {loading ? 'Verifying...' : 'Verify & Continue'} <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (authStep === 'forgot-password') {
    return (
      <div className="w-full max-w-md relative z-10">
        <BrandHeader />
        <div className="glass-card py-5 px-6 border border-white/5">
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div className="text-center mb-2">
              <h3 className="font-bold text-sm text-white">Reset Password</h3>
              <p className="text-[10px] text-neutral-400 mt-1">Enter your email and we'll send you a reset link</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-neutral-400 block">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-4 top-2.5 w-3.5 h-3.5 text-neutral-500" />
                <input placeholder="you@example.com" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-neutral-900 border border-white/5 rounded-xl pl-11 pr-4 py-2 text-xs text-white focus:outline-none focus:border-purple-500/50" required />
              </div>
            </div>
            {error && <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-[10px] text-red-400">{error}</div>}
            {message && <div className="p-2.5 rounded-xl bg-green-500/10 border border-green-500/20 text-[10px] text-green-400">{message}</div>}
            <button type="submit" disabled={loading || !email} className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:bg-neutral-800 disabled:text-neutral-500 text-xs font-bold text-white transition flex items-center justify-center gap-2">
              {loading ? 'Sending...' : 'Send Reset Link'} <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button type="button" onClick={() => setAuthStep('form')} className="w-full text-center text-[10px] font-semibold text-neutral-400 hover:text-white transition mt-2">
              ← Back to Sign In
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md relative z-10">
      <BrandHeader />
      <div className="flex bg-neutral-900/50 border border-white/5 rounded-2xl p-1 mb-4">
        <button onClick={() => { setActiveTab('signin'); setError(null); }} className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${activeTab === 'signin' ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/10' : 'text-neutral-400 hover:text-white'}`}>Sign In</button>
        <button onClick={() => { setActiveTab('signup'); setError(null); }} className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${activeTab === 'signup' ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/10' : 'text-neutral-400 hover:text-white'}`}>Sign Up</button>
      </div>

      <div className="glass-card py-5 px-6 border border-white/5">
        <form onSubmit={activeTab === 'signin' ? handleSignIn : handleSignUp} className="space-y-4">
          <AnimatePresence mode="wait">
            {activeTab === 'signup' && (
              <motion.div key="signup-name" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-1.5 overflow-hidden">
                <label className="text-[10px] font-semibold text-neutral-400 block">Full Name</label>
                <div className="relative">
                  <UserIcon className="absolute left-4 top-2.5 w-3.5 h-3.5 text-neutral-500" />
                  <input placeholder="Jane Doe" type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full bg-neutral-900 border border-white/5 rounded-xl pl-11 pr-4 py-2 text-xs text-white focus:outline-none focus:border-purple-500/50" required={activeTab === 'signup'} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold text-neutral-400 block">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-4 top-2.5 w-3.5 h-3.5 text-neutral-500" />
              <input placeholder="user@example.com" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-neutral-900 border border-white/5 rounded-xl pl-11 pr-4 py-2 text-xs text-white focus:outline-none focus:border-purple-500/50" required />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-semibold text-neutral-400 block">Password</label>
              {activeTab === 'signin' && (
                <button type="button" onClick={() => { setAuthStep('forgot-password'); setError(null); }} className="text-[9px] font-semibold text-purple-400 hover:text-purple-300 transition cursor-pointer">
                  Forgot Password?
                </button>
              )}
            </div>
            <div className="relative">
              <Lock className="absolute left-4 top-2.5 w-3.5 h-3.5 text-neutral-500" />
              <input placeholder="••••••••" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-neutral-900 border border-white/5 rounded-xl pl-11 pr-4 py-2 text-xs text-white focus:outline-none focus:border-purple-500/50" required />
            </div>
          </div>

          {error && <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-[10px] text-red-400">{error}</div>}

          <button type="submit" disabled={loading} className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:bg-neutral-800 disabled:text-neutral-500 text-xs font-bold text-white transition flex items-center justify-center gap-2 shadow-lg shadow-purple-500/15">
            {loading ? 'Authenticating...' : activeTab === 'signin' ? 'Sign In' : 'Create Account'}
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>

        <div className="flex items-center my-4 text-neutral-600">
          <div className="flex-1 h-px bg-white/5" />
          <span className="text-[9px] uppercase font-bold px-3">or</span>
          <div className="flex-1 h-px bg-white/5" />
        </div>

        <button onClick={handleGoogleLogin} disabled={loading} className="w-full flex items-center justify-center gap-2.5 py-2.5 rounded-xl border border-white/5 bg-neutral-900 hover:bg-neutral-800 transition text-xs font-semibold cursor-pointer text-neutral-300">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
            <path fill="#EA4335" d="M12 5.04c1.66 0 3.2.57 4.38 1.69l3.27-3.27C17.67 1.6 15.01 0 12 0 7.37 0 3.37 2.65 1.41 6.59l3.8 2.95C6.18 6.77 8.87 5.04 12 5.04z" />
            <path fill="#4285F4" d="M23.49 12.27c0-.81-.07-1.59-.2-2.36H12v4.51h6.46c-.27 1.57-1.16 2.9-2.46 3.77v3.15h3.99c2.33-2.14 3.7-5.31 3.7-8.87z" />
            <path fill="#FBBC05" d="M5.35 14.46c-.24-.72-.37-1.48-.37-2.46s.13-1.74.37-2.46l-3.8-2.95C.56 8.35 0 10.11 0 12s.56 3.65 1.55 5.41l3.8-2.95z" />
            <path fill="#34A853" d="M12 23c3.24 0 5.97-1.07 7.96-2.91l-3.91-2.97c-1.12.75-2.54 1.2-4.05 1.2-3.13 0-5.82-1.73-6.79-4.28l-3.8 2.95C3.37 21.35 7.37 24 12 24z" />
          </svg>
          Continue with Google
        </button>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="flex-1 bg-[#050508] text-white relative flex flex-col justify-center items-center min-h-screen p-6 overflow-hidden">
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <style jsx global>{`
          @keyframes drift-slow { 0% { transform: translate(0px, 0px) scale(1); } 33% { transform: translate(40px, -60px) scale(1.15); } 66% { transform: translate(-30px, 30px) scale(0.9); } 100% { transform: translate(0px, 0px) scale(1); } }
          @keyframes drift-medium { 0% { transform: translate(0px, 0px) scale(1); } 50% { transform: translate(-50px, 50px) scale(1.2); } 100% { transform: translate(0px, 0px) scale(1); } }
          .orb-1 { animation: drift-slow 22s infinite ease-in-out; will-change: transform; }
          .orb-2 { animation: drift-medium 18s infinite ease-in-out; will-change: transform; }
          .grid-overlay { background-image: linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px); background-size: 50px 50px; }
        `}</style>
        <div className="absolute inset-0 grid-overlay opacity-30" />
        <div className="absolute top-[-15%] left-[-10%] w-[550px] h-[550px] rounded-full orb-1" style={{ background: 'radial-gradient(circle, rgba(168, 85, 247, 0.15) 0%, transparent 70%)' }} />
        <div className="absolute bottom-[-15%] right-[-10%] w-[550px] h-[550px] rounded-full orb-2" style={{ background: 'radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, transparent 70%)' }} />
      </div>

      <Link href="/" className="absolute top-6 left-6 inline-flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-full border border-white/5 bg-neutral-900/60 hover:bg-neutral-800 text-neutral-300 hover:text-white transition duration-200 group z-25">
        <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
        <span>Back to home</span>
      </Link>

      <Suspense fallback={
        <div className="flex flex-col items-center gap-4 relative z-10">
          <div className="p-3 rounded-2xl bg-gradient-to-tr from-purple-500 to-indigo-500 shadow-lg shadow-purple-500/20 animate-pulse">
            <Bot className="w-8 h-8 text-white animate-spin [animation-duration:10s]" />
          </div>
        </div>
      }>
        <AuthContent />
      </Suspense>
    </div>
  );
}
