'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Bot, LayoutDashboard, FileText, Briefcase, Layers, LogOut, ShieldCheck, Award, HelpCircle, Bell, Globe, Sparkles, Menu, X } from 'lucide-react';
import { useAuth, useUser } from '@/context/FirebaseAuthContext';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { isLoaded } = useUser();
  const { user, signOut, getToken } = useAuth();
  
  const [userName, setUserName] = useState('User');
  const [userEmail, setUserEmail] = useState('');
  const [userPhoto, setUserPhoto] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [needsProfileSetup, setNeedsProfileSetup] = useState(false);
  const [resumeUploaded, setResumeUploaded] = useState(false);
  const [unreadTicketsCount, setUnreadTicketsCount] = useState(0);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [customAlertMsg, setCustomAlertMsg] = useState<string | null>(null);


  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (isLoaded) {
      if (!user) {
        router.push('/login');
      } else if (!user.emailVerified) {
        // Fallback protection: if OTP not verified, redirect to login
        router.push('/login');
      }
    }
  }, [isLoaded, user, router]);

  useEffect(() => {
    if (user) {
      setUserName(user.displayName || 'User');
      setUserEmail(user.email || 'user@example.com');
      setUserPhoto(user.photoURL || localStorage.getItem('userAvatarUrl') || null);
    }
  }, [user]);

  // Sync layout state with local storage on page navigation (instant and synchronous)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setNeedsProfileSetup(localStorage.getItem('needsProfileSetup') === 'true');
      setResumeUploaded(localStorage.getItem('resumeUploaded') === 'true');
    }
    setIsMobileMenuOpen(false); // Close mobile menu on navigation
  }, [pathname]);

  useEffect(() => {
    const handleProfileUpdate = () => {
      setUserPhoto(localStorage.getItem('userAvatarUrl') || user?.photoURL || null);
    };
    window.addEventListener('profileUpdated', handleProfileUpdate);
    return () => window.removeEventListener('profileUpdated', handleProfileUpdate);
  }, [user]);

  const [features, setFeatures] = useState({ ats: true, optimizer: true });

  const fetchFeatures = async () => {
    try {
      const res = await fetch(`${API_BASE}/public/config/features`);
      if (res.ok) {
        const data = await res.json();
        setFeatures({ ats: data.feature_ats_enabled, optimizer: data.feature_optimizer_enabled });
      }
    } catch (err) {
      console.error('Failed to fetch features:', err);
    }
  };

  useEffect(() => {
    if (user?.uid) {
      fetchUnreadCount();
      checkResumeStatus();
      fetchFeatures();
      fetchUserProfile();
    }
  }, [user?.uid]);

  const fetchUserProfile = async () => {
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/user/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.avatarUrl) {
          setUserPhoto(data.avatarUrl);
          localStorage.setItem('userAvatarUrl', data.avatarUrl);
        }
      }
    } catch (err) {
      console.error('Failed to fetch user profile:', err);
    }
  };

  const checkResumeStatus = async () => {
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/resume/latest`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.parsedProfile) {
          setResumeUploaded(true);
          localStorage.setItem('resumeUploaded', 'true');
          return;
        }
      }
      setResumeUploaded(false);
      localStorage.removeItem('resumeUploaded');
    } catch (err) {
      console.error('Failed to check resume status:', err);
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/support/notifications`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUnreadTicketsCount(data.count || 0);
      }
    } catch (err) {
      console.error('Failed to fetch unread ticket count:', err);
    }
  };

  const navItems = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Resume Profile', href: '/resume', icon: FileText },
    { name: 'AI Resume Optimizer', href: '/resume-tailor', icon: Sparkles },
    { name: 'ATS Scanner', href: '/ats', icon: Award },
    { name: 'Jobs Board', href: '/jobs', icon: Briefcase },
    { name: 'External Boards', href: '/external-boards', icon: Globe },
    { name: 'Applications Tracker', href: '/applications', icon: Layers },
    { name: 'Support & Help', href: '/support', icon: HelpCircle }
  ];

  if (userEmail === 'jobcopilot.ai@gmail.com' || userEmail === 'jsfejoe@gmail.com') {
    navItems.push({ name: 'Admin Settings', href: '/admin', icon: ShieldCheck });
  }

  if (!isMounted || !isLoaded) {
    return (
      <div className="min-h-screen bg-[#050508] flex flex-col justify-center items-center relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
          <div className="absolute top-[-15%] left-[-10%] w-[550px] h-[550px] rounded-full bg-purple-900/10 blur-[130px]" />
          <div className="absolute bottom-[-15%] right-[-10%] w-[550px] h-[550px] rounded-full bg-indigo-900/10 blur-[130px]" />
        </div>
        <div className="relative z-10 flex flex-col items-center gap-4">
          <div className="p-3 rounded-2xl bg-gradient-to-tr from-purple-500 to-indigo-500 shadow-lg shadow-purple-500/20 animate-pulse">
            <Bot className="w-8 h-8 text-white animate-spin [animation-duration:10s]" />
          </div>
          <div className="w-20 h-1.5 rounded-full bg-white/5 overflow-hidden relative">
            <div 
              className="absolute h-full w-[40%] bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full"
              style={{
                animation: 'loading-bar 1.2s infinite ease-in-out'
              }}
            />
          </div>
        </div>
        <style jsx>{`
          @keyframes loading-bar {
            0% { left: -40%; }
            50% { left: 100%; }
            100% { left: -40%; }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#09090b] text-white font-sans relative overflow-hidden">
      {/* Animated Floating Gradient Background Orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        {/* Subtle Grid Pattern Overlay */}
        <div 
          className="absolute inset-0 opacity-10" 
          style={{
            backgroundImage: `
              linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(255,255,255,0.05) 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px'
          }}
        />

        <style jsx global>{`
          @keyframes drift-slow {
            0% { transform: translate(0px, 0px) scale(1); }
            33% { transform: translate(30px, -50px) scale(1.1); }
            66% { transform: translate(-20px, 20px) scale(0.9); }
            100% { transform: translate(0px, 0px) scale(1); }
          }
          @keyframes drift-medium {
            0% { transform: translate(0px, 0px) scale(1); }
            50% { transform: translate(-40px, 40px) scale(1.2); }
            100% { transform: translate(0px, 0px) scale(1); }
          }
          @keyframes drift-fast {
            0% { transform: translate(0px, 0px) scale(1); }
            40% { transform: translate(50px, 30px) scale(0.85); }
            80% { transform: translate(-30px, -20px) scale(1.05); }
            100% { transform: translate(0px, 0px) scale(1); }
          }
          .orb-slow { 
            animation: drift-slow 25s infinite ease-in-out;
            will-change: transform;
          }
          .orb-medium { 
            animation: drift-medium 20s infinite ease-in-out;
            will-change: transform;
          }
          .orb-fast { 
            animation: drift-fast 18s infinite ease-in-out;
            will-change: transform;
          }
        `}</style>

        <div 
          className="absolute top-[10%] left-[5%] w-[450px] h-[450px] rounded-full orb-slow" 
          style={{ background: 'radial-gradient(circle, rgba(168, 85, 247, 0.15) 0%, transparent 70%)' }}
        />
        <div 
          className="absolute bottom-[15%] right-[10%] w-[500px] h-[500px] rounded-full orb-medium" 
          style={{ background: 'radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, transparent 70%)' }}
        />
        <div 
          className="absolute top-[50%] left-[45%] w-[350px] h-[350px] rounded-full orb-fast" 
          style={{ background: 'radial-gradient(circle, rgba(139, 92, 246, 0.12) 0%, transparent 70%)' }}
        />
        <div 
          className="absolute bottom-[40%] left-[10%] w-[300px] h-[300px] rounded-full orb-slow" 
          style={{ background: 'radial-gradient(circle, rgba(30, 58, 138, 0.15) 0%, transparent 70%)' }}
        />
      </div>

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-30 md:hidden backdrop-blur-sm transition-opacity" 
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-[#0c0c0e]/90 backdrop-blur-md border-b border-white/5 z-30 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <Bot className="w-6 h-6 text-purple-400" />
          <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">
            AI Job Copilot
          </span>
        </div>
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 text-neutral-400 hover:text-white hover:bg-white/5 rounded-lg transition"
        >
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Sidebar navigation */}
      <aside className={`w-64 bg-[#0c0c0e]/95 border-r border-white/5 flex flex-col justify-between fixed h-full z-40 backdrop-blur-xl transition-transform duration-300 md:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6">
          <Link href="/dashboard" className="flex items-center gap-2 mb-8">
            <Bot className="w-8 h-8 text-purple-400" />
            <span className="font-bold text-xl tracking-tight bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">
              AI Job Copilot
            </span>
          </Link>

          <nav className="space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              const isLocked = needsProfileSetup 
                ? item.href !== '/dashboard'
                : (!resumeUploaded && (item.href === '/jobs' || item.href === '/external-boards' || item.href === '/applications'));

              const alertMsg = needsProfileSetup
                ? 'Please complete your profile setup wizard on the dashboard first!'
                : 'Please upload your resume in the Resume Profile section first to unlock Jobs Board, External Boards, and Applications Tracker!';

              return (
                <Link
                  key={item.href}
                  href={isLocked ? (needsProfileSetup ? '/dashboard' : '/resume') : item.href}
                  onClick={(e) => {
                    if (isLocked) {
                      e.preventDefault();
                      setCustomAlertMsg(alertMsg);
                    }
                  }}
                  className={`flex items-center justify-between px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                    isLocked 
                      ? 'opacity-40 cursor-not-allowed text-neutral-600 border border-transparent hover:bg-transparent'
                      : isActive
                        ? 'bg-purple-600/15 border border-purple-500/30 text-purple-300 shadow-lg shadow-purple-500/5'
                        : 'border border-transparent text-neutral-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${isLocked ? 'text-neutral-700' : isActive ? 'text-purple-400' : 'text-neutral-500'}`} />
                    <span>{item.name}</span>
                  </div>
                  {item.href === '/support' && unreadTicketsCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full text-[9px] bg-purple-500 text-white font-bold animate-bounce flex items-center gap-0.5">
                      <Bell className="w-2 h-2" />
                      {unreadTicketsCount}
                    </span>
                  )}
                  {isLocked && (
                    <span className="text-[10px] text-neutral-600 bg-neutral-950 px-1.5 py-0.5 rounded border border-white/5 font-bold uppercase">
                      Lock
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Profile / Logout section at bottom */}
        <div className="p-4 border-t border-white/5 bg-[#09090b]/50">
          <Link href="/settings" className="flex items-center gap-3 p-2 mb-3 rounded-xl hover:bg-white/5 border border-transparent hover:border-white/5 transition cursor-pointer group">
            {userPhoto ? (
              <img src={userPhoto} alt="Avatar" className="w-9 h-9 rounded-full object-cover border border-white/10" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center border border-white/10">
                <span className="text-white font-medium text-sm">
                  {userName.substring(0, 2).toUpperCase()}
                </span>
              </div>
            )}
            <div className="overflow-hidden">
              <p className="font-semibold text-xs text-white truncate group-hover:text-purple-300 transition">{userName}</p>
              <p className="text-[10px] text-neutral-500 truncate mt-0.5">{userEmail}</p>
            </div>
          </Link>
              <div className="border-t border-white/10 mt-auto">
                <button 
                  onClick={() => signOut()}
                  className="w-full flex items-center justify-between py-4 px-4 text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <LogOut className="w-5 h-5" />
                    Sign Out
                  </div>
                </button>
              </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 md:ml-64 p-4 md:p-8 pt-20 md:pt-8 relative z-10 min-h-screen flex flex-col justify-start w-full overflow-x-hidden">
        {children}
      </main>
      {/* Custom Alert Modal */}
      {customAlertMsg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setCustomAlertMsg(null)}>
          <div className="bg-zinc-950 ring-1 ring-white/10 shadow-[0_0_50px_-12px_rgba(168,85,247,0.3)] rounded-2xl p-6 max-w-md w-full relative overflow-hidden transform transition-all animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
            {/* Top gradient line */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 via-indigo-500 to-purple-500" />
            
            <div className="flex items-start gap-4">
              <div className="p-3 bg-gradient-to-br from-purple-500/20 to-indigo-500/20 ring-1 ring-purple-500/30 rounded-2xl shrink-0">
                <Bot className="w-6 h-6 text-purple-400" />
              </div>
              <div className="flex-1 mt-1">
                <h3 className="text-lg font-extrabold text-white mb-2 tracking-tight">AI Job Copilot</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">{customAlertMsg}</p>
              </div>
            </div>
            
            <div className="mt-8 flex justify-end">
              <button 
                onClick={() => setCustomAlertMsg(null)}
                className="px-6 py-2.5 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-400 hover:to-indigo-400 text-white shadow-lg shadow-purple-500/25 text-sm font-bold rounded-xl transition-all hover:scale-105 active:scale-95"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
