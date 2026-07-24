'use client';

import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Sparkles, FileText, Briefcase, Layers, Sliders, Save, Check, Shield, Phone, Mail, CheckCircle, Send, ArrowRight, ArrowLeft, User as UserIcon, Globe, Loader2, Award } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUser, useAuth } from '@/context/FirebaseAuthContext';
import { auth } from '@/lib/firebase';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function DashboardPage() {
  const { user } = useUser();
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  
  // Onboarding Wizard states
  const [isSetupPending, setIsSetupPending] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [locationInput, setLocationInput] = useState('');
  const [experienceLevel, setExperienceLevel] = useState('Mid');

  // User Filters state
  const [minSalary, setMinSalary] = useState(600000); // 6 Lakhs INR
  const [workTypes, setWorkTypes] = useState<string[]>(['Remote', 'Hybrid']);
  const [countries, setCountries] = useState<string[]>(['Bengaluru', 'Remote']); // Target locations
  const [targetJobRole, setTargetJobRole] = useState('');
  const [educationFilter, setEducationFilter] = useState('B.E./B.Tech');
  const [jobSourceFilter, setJobSourceFilter] = useState<'All' | 'Company' | 'Consultant'>('All');

  // Real-time Dashboard metrics state
  const [realtimeStats, setRealtimeStats] = useState({
    atsScore: 0,
    recsCount: 0,
    highMatches: 0,
    activeApps: 0,
    submittedApps: 0
  });

  // Verification state
  const [phone, setPhone] = useState('');
  const [emailOtp, setEmailOtp] = useState('');
  const [phoneOtp, setPhoneOtp] = useState('');
  const [emailVerified, setEmailVerified] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [phoneOtpSent, setPhoneOtpSent] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState<string | null>(null);
  const [verifyMsg, setVerifyMsg] = useState<string | null>(null);

  // Sync with Clerk User session dynamically
  useEffect(() => {
    if (user) {
      setFullName(user.fullName || '');
      setEmail(user.primaryEmailAddress?.emailAddress || '');
    }
  }, [user]);

  // Load live metric statistics from NestJS backend instead of mock localStorage seeding
  useEffect(() => {
    const fetchRealStats = async () => {
      try {
        const token = await getToken();
        if (!token) return;

        // Run all stats fetches in parallel for massive speedup!
        const [appRes, matchRes, extRes, resumeRes] = await Promise.all([
          fetch(`${API_BASE}/application`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_BASE}/job/dashboard`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_BASE}/external-board/list`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ ok: false, json: async () => [] } as any)),
          fetch(`${API_BASE}/resume/latest`, { headers: { Authorization: `Bearer ${token}` } })
        ]);

        let appsList = [];
        if (appRes.ok) appsList = await appRes.json();

        let recsCount = 0;
        let highMatches = 0;
        if (matchRes.ok) {
          const matchData = await matchRes.json();
          const jobsList = Array.isArray(matchData) ? matchData : (matchData.recommendations || []);
          recsCount = jobsList.length;
          highMatches = jobsList.filter((item: any) => item.match && item.match.matchScore >= 90).length;
        }

        let extCount = 0;
        if (extRes.ok) {
          try {
            const extJobs = await extRes.json();
            if (Array.isArray(extJobs)) extCount = extJobs.length;
          } catch (e) {}
        }
        
        let atsScore = 0;
        if (resumeRes.ok) {
          const resumeData = await resumeRes.json();
          atsScore = resumeData.atsScore || 0;

          if (!atsScore) {
            const cachedAts = typeof window !== 'undefined' ? localStorage.getItem('ats_result') : null;
            if (cachedAts) {
              try {
                const parsedAts = JSON.parse(cachedAts);
                atsScore = parsedAts.overallScore || 0;
              } catch (e) {
                atsScore = 0;
              }
            }
          }
        }

        const active = appsList.filter((a: any) => 
          a.status === 'Matched' || a.status === 'Tailored' || a.status === 'Applying'
        ).length;

        const submitted = appsList.filter((a: any) => 
          a.status === 'Applied' || a.status === 'Interviewing' || a.status === 'Offered' || a.status === 'Rejected'
        ).length;

        setRealtimeStats({
          atsScore: resumeRes.ok ? atsScore : 0,
          recsCount: isSetupPending ? 0 : (recsCount + extCount),
          highMatches: isSetupPending ? 0 : highMatches,
          activeApps: active,
          submittedApps: submitted
        });
      } catch (err) {
        console.error('Failed to load real stats:', err);
      }
    };

    fetchRealStats();
  }, [isSetupPending, refreshKey, user, getToken]);

  // Fetch or init filters
  useEffect(() => {
    const isLoggedIn = localStorage.getItem('isLoggedIn');
    const needsSetup = localStorage.getItem('needsProfileSetup') === 'true';
    setIsSetupPending(needsSetup);

    const loadProfileAndFilters = async () => {
      setProfileLoading(true);
      try {
        const token = await getToken();
        
        // 1. Fetch user verification status and profile simultaneously!
        const [statusRes, profileRes] = await Promise.all([
          fetch(`${API_BASE}/auth/status`, { headers: { 'Authorization': `Bearer ${token}` } }),
          fetch(`${API_BASE}/user/profile`, { headers: { 'Authorization': `Bearer ${token}` } })
        ]);

        if (statusRes.ok) {
          const data = await statusRes.json();
          setEmailVerified(data.emailVerified);
          setPhoneVerified(data.phoneVerified);
          if (data.emailVerified) localStorage.setItem('emailVerified', 'true');
          else localStorage.removeItem('emailVerified');
          if (data.phoneVerified) localStorage.setItem('phoneVerified', 'true');
          else localStorage.removeItem('phoneVerified');
        }

        if (profileRes.ok) {
          const profile = await profileRes.json();
          if (profile && profile.filters) {
            const f = profile.filters;
            if (f.minSalary) setMinSalary(Number(f.minSalary));
            if (f.workTypes) setWorkTypes(f.workTypes);
            if (f.countries) setCountries(f.countries);
            if (f.experienceLevel) setExperienceLevel(f.experienceLevel);
            const targetRoleStr = f.targetJobRole || (f.targetRoles ? f.targetRoles.join(', ') : '');
            if (targetRoleStr) setTargetJobRole(targetRoleStr);

            // Sync to local storage
            localStorage.setItem('minSalary', (f.minSalary || 300000).toString());
            localStorage.setItem('workTypes', JSON.stringify(f.workTypes || []));
            localStorage.setItem('countries', JSON.stringify(f.countries || []));
            localStorage.setItem('experienceLevel', f.experienceLevel || 'Mid');
            localStorage.setItem('targetJobRole', targetRoleStr);
          } else {
            // Profile has no filters -> trigger wizard setup
            setIsSetupPending(true);
            localStorage.setItem('needsProfileSetup', 'true');
          }
          if (profile.name) setFullName(profile.name);
          if (profile.email) setEmail(profile.email);
        } else if (profileRes.status === 404) {
          // No profile found -> trigger wizard setup
          setIsSetupPending(true);
          localStorage.setItem('needsProfileSetup', 'true');
        } else {
          fallbackToLocalStorage();
        }
      } catch (err) {
        console.error('Failed to load profile from Mongoose backend:', err);
        fallbackToLocalStorage();
      } finally {
        setProfileLoading(false);
      }
    };

    const fallbackToLocalStorage = () => {
      if (!user) {
        setFullName(localStorage.getItem('userName') || '');
        setEmail(localStorage.getItem('userEmail') || '');
      }

      const savedMinSalary = localStorage.getItem('minSalary');
      const savedWorkTypes = localStorage.getItem('workTypes');
      const savedCountries = localStorage.getItem('countries');
      const savedExp = localStorage.getItem('experienceLevel');
      const savedEdu = localStorage.getItem('educationFilter');
      const savedSrc = localStorage.getItem('jobSourceFilter');
      const savedRole = localStorage.getItem('targetJobRole');

      if (savedMinSalary) setMinSalary(Number(savedMinSalary));
      if (savedWorkTypes) setWorkTypes(JSON.parse(savedWorkTypes));
      if (savedCountries) setCountries(JSON.parse(savedCountries));
      if (savedExp) setExperienceLevel(savedExp);
      if (savedEdu) setEducationFilter(savedEdu);
      if (savedSrc) setJobSourceFilter(savedSrc as any);
      if (savedRole) setTargetJobRole(savedRole);
    };

    loadProfileAndFilters();
  }, [user]);

  const handleSaveFilters = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSaved(false);

    // Save to local storage for failproof fallback
    localStorage.setItem('minSalary', minSalary.toString());
    localStorage.setItem('workTypes', JSON.stringify(workTypes));
    localStorage.setItem('countries', JSON.stringify(countries));
    localStorage.setItem('experienceLevel', experienceLevel);
    localStorage.setItem('educationFilter', educationFilter);
    localStorage.setItem('jobSourceFilter', jobSourceFilter);
    localStorage.setItem('targetJobRole', targetJobRole);

    try {
      const token = await getToken();
      // Try hitting the backend API
      const res = await fetch(`${API_BASE}/job/filters`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          email: email || 'user@example.com',
          filters: {
            workTypes,
            minSalary,
            countries,
            experienceLevel,
            targetJobRole: targetJobRole || undefined,
            targetRoles: targetJobRole ? targetJobRole.split(',').map(r => r.trim()).filter(Boolean) : []
          }
        })
      });

      if (res.ok) {
        console.log('Filters saved to backend API');
        setRefreshKey(prev => prev + 1);
      }
    } catch (err) {
      console.warn('Backend API connection offline. Filters saved locally in Sandbox.', err);
    } finally {
      setLoading(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
  };

  const handleToggleWorkType = (type: string) => {
    if (workTypes.includes(type)) {
      setWorkTypes(workTypes.filter(t => t !== type));
    } else {
      setWorkTypes([...workTypes, type]);
    }
  };

  const handleCompleteWizard = async () => {
    const profileData = {
      fullName,
      email,
      phone: phoneInput,
      location: locationInput,
      filters: {
        workTypes,
        minSalary,
        countries,
        experienceLevel
      },
    };
    const token = await getToken();
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
    const [profileResult, filtersResult] = await Promise.all([
      fetch(`${API_BASE}/user/profile`, { method: 'POST', headers, body: JSON.stringify({ name: fullName, phone: phoneInput, location: locationInput }) }),
      fetch(`${API_BASE}/job/filters`, { method: 'POST', headers, body: JSON.stringify({ email, filters: profileData.filters }) }),
    ]);
    if (!profileResult.ok || !filtersResult.ok) {
      setVerifyMsg('Unable to save your profile. Please try again.');
      return;
    }
    localStorage.removeItem('needsProfileSetup');

    setPhone(phoneInput);
    setCountries(profileData.filters.countries);
    setEmailVerified(false);
    setPhoneVerified(false);
    setIsSetupPending(false);

    window.location.reload(); // Refresh layout state & unlock links!
  };


  if (isSetupPending) {
    return (
      <div className="max-w-xl mx-auto w-full py-12 flex-1 flex flex-col justify-center">
        {/* Step Indicator */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs font-bold text-purple-400 uppercase tracking-widest">Step {wizardStep} of 2</span>
            <span className="text-xs text-neutral-400 font-semibold">
              {wizardStep === 1 ? 'Contact Details & Preferences' : 'Experience & Salary expectations'}
            </span>
          </div>
          <div className="h-1.5 w-full bg-neutral-900 border border-white/5 rounded-full overflow-hidden">
            <div 
              className="bg-gradient-to-r from-purple-500 to-indigo-500 h-full rounded-full transition-all duration-300"
              style={{ width: `${(wizardStep / 2) * 100}%` }}
            />
          </div>
        </div>

        {/* Wizard Container */}
        <div className="glass-card p-4 md:p-8 min-h-[400px] flex flex-col justify-between">
          <AnimatePresence mode="wait">
            {wizardStep === 1 && (
              <motion.div
                key="wizard-step-1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="space-y-5"
              >
                <div className="flex items-center gap-2.5 mb-6">
                  <div className="p-2 bg-purple-500/10 border border-purple-500/20 rounded-xl text-purple-400">
                    <UserIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="font-bold text-lg">Candidate Profile Info</h2>
                    <p className="text-xs text-neutral-400">Enter details to generate applications</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-neutral-400">Full Name</label>
                    <input placeholder="Jane Doe" type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full bg-neutral-900 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500/50"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-neutral-400">WhatsApp / Phone</label>
                      <input placeholder="+91 9876543210" type="tel"
                        value={phoneInput}
                        onChange={(e) => setPhoneInput(e.target.value)}
                        className="w-full bg-neutral-900 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500/50"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-neutral-400">City, Country</label>
                      <input placeholder="Enter location" type="text"
                        value={locationInput}
                        onChange={(e) => setLocationInput(e.target.value)}
                        className="w-full bg-neutral-900 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500/50"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-neutral-400 block">Work Preference</label>
                    <div className="flex gap-2">
                      {['Remote', 'Hybrid', 'Onsite'].map(type => {
                        const active = workTypes.includes(type);
                        return (
                          <button
                            key={type}
                            type="button"
                            onClick={() => {
                              if (workTypes.includes(type)) {
                                setWorkTypes(workTypes.filter(t => t !== type));
                              } else {
                                setWorkTypes([...workTypes, type]);
                              }
                            }}
                            className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                              active
                                ? 'bg-purple-600/20 border-purple-500/40 text-purple-300'
                                : 'bg-neutral-900 border-white/5 text-neutral-400 hover:text-white'
                            }`}
                          >
                            {type}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {wizardStep === 2 && (
              <motion.div
                key="wizard-step-2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="space-y-5"
              >
                <div className="flex items-center gap-2.5 mb-6">
                  <div className="p-2 bg-purple-500/10 border border-purple-500/20 rounded-xl text-purple-400">
                    <Briefcase className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="font-bold text-lg">Target Preferences</h2>
                    <p className="text-xs text-neutral-400">Configure salary rules and experience index</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-neutral-400 block">Target Level</label>
                      <select
                        value={experienceLevel}
                        onChange={(e) => setExperienceLevel(e.target.value)}
                        className="w-full bg-neutral-900 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500/50 cursor-pointer"
                      >
                        <option value="Fresher">Fresher (0-1 years)</option>
                        <option value="Junior">Junior (1-3 years)</option>
                        <option value="Mid">Mid Level (3-5 years)</option>
                        <option value="Senior">Senior (5+ years)</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-neutral-400 block">Min Annual Salary</label>
                      <div className="flex justify-between items-center bg-neutral-900 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-purple-300 font-bold">
                        <span>Minimum</span>
                        <span>₹{(minSalary / 100000).toFixed(0)} Lakhs (LPA)</span>
                      </div>
                    </div>
                  </div>

                  <input
                    type="range"
                    min="300000"
                    max="5000000"
                    step="100000"
                    value={minSalary}
                    onChange={(e) => setMinSalary(Number(e.target.value))}
                    className="w-full accent-purple-500 cursor-pointer"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Action buttons */}
          <div className="flex justify-between items-center border-t border-white/5 pt-6 mt-8">
            <button
              onClick={() => wizardStep > 1 && setWizardStep(wizardStep - 1)}
              disabled={wizardStep === 1}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-neutral-400 hover:text-white disabled:opacity-40 disabled:hover:text-neutral-400 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </button>

            {wizardStep < 2 ? (
              <button
                onClick={() => setWizardStep(wizardStep + 1)}
                className="flex items-center gap-1.5 px-5 py-2.5 bg-neutral-900 border border-white/5 hover:bg-neutral-800 rounded-xl text-xs font-semibold text-white cursor-pointer"
              >
                Next Step <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={handleCompleteWizard}
                className="flex items-center gap-1.5 px-6 py-3 bg-green-600 hover:bg-green-700 rounded-xl text-xs font-bold text-white cursor-pointer shadow-lg shadow-green-600/10 animate-pulse"
              >
                Complete Setup & Unlock Dashboard <Check className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (profileLoading) {
    return (
      <div className="flex-1 flex justify-center items-center h-64">
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!emailVerified) {
    return (
      <div className="max-w-xl mx-auto w-full py-12 flex-1 flex flex-col justify-center">
        <div className="glass-card py-10 px-8 border border-white/5 space-y-6 text-center">
          <Mail className="w-12 h-12 text-purple-400 mx-auto" />
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">Verify Your Email</h2>
            <p className="text-sm text-neutral-400">
              You must verify your email address to unlock the dashboard.
            </p>
          </div>
          
          <div className="bg-neutral-950/40 p-5 rounded-xl border border-white/5 text-left">
            {!emailOtpSent ? (
              <button
                onClick={async () => {
                  setVerifyLoading('email-send');
                  setVerifyMsg(null);
                  try {
                    const response = await fetch(`${API_BASE}/auth/send-email-otp`, { 
                      method: 'POST', 
                      headers: { 
                        'Authorization': `Bearer ${await getToken()}`, 
                        'Content-Type': 'application/json' 
                      },
                      body: JSON.stringify({ email })
                    });
                    if (!response.ok) {
                      setVerifyMsg(`Failed to send OTP. Server returned status ${response.status}`);
                      setVerifyLoading(null);
                      setTimeout(() => setVerifyMsg(null), 5000);
                      return;
                    }
                    setEmailOtpSent(true);
                    setVerifyMsg(`OTP sent to ${email || 'your email'}!`);
                  } catch (err: any) {
                    console.error('Fetch error:', err);
                    setVerifyMsg('Failed to send OTP. Please check backend server log.');
                  } finally {
                    setVerifyLoading(null);
                    setTimeout(() => setVerifyMsg(null), 5000);
                  }
                }}
                disabled={verifyLoading === 'email-send'}
                className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" /> {verifyLoading === 'email-send' ? 'Sending...' : 'Send Email OTP'}
              </button>
            ) : (
              <div className="flex gap-2">
                <input placeholder="Enter OTP" type="text"
                  maxLength={6}
                  value={emailOtp}
                  onChange={e => setEmailOtp(e.target.value.replace(/\D/g, ''))}
                  className="flex-1 bg-neutral-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white text-center tracking-[6px] font-mono focus:outline-none focus:border-purple-500/50"
                />
                <button
                  onClick={async () => {
                    setVerifyLoading('email-verify');
                    setVerifyMsg(null);
                    try {
                      const response = await fetch(`${API_BASE}/auth/verify-email-otp`, { 
                        method: 'POST', 
                        headers: { 
                          'Authorization': `Bearer ${await getToken()}`, 
                          'Content-Type': 'application/json' 
                        }, 
                        body: JSON.stringify({ otp: emailOtp }) 
                      });
                      const result = await response.json();
                      if (!response.ok || !result.verified) {
                        setVerifyMsg(result.message || 'Incorrect OTP code');
                        setVerifyLoading(null);
                        setTimeout(() => setVerifyMsg(null), 5000);
                        return;
                      }
                      setEmailVerified(true);
                      localStorage.setItem('emailVerified', 'true');
                      
                      // Important: refresh token so Firebase knows
                      if (auth.currentUser) await auth.currentUser.getIdToken(true);
                      
                      setVerifyMsg('Email verified successfully!');
                      window.location.reload(); // Reload to start the setup wizard
                    } catch (err: any) {
                      console.error(err);
                      setVerifyMsg(err.message || 'Incorrect OTP code. Please try again.');
                    } finally {
                      setVerifyLoading(null);
                      setTimeout(() => setVerifyMsg(null), 5000);
                    }
                  }}
                  disabled={emailOtp.length !== 6 || verifyLoading === 'email-verify'}
                  className="px-4 py-2 rounded-xl bg-green-600 hover:bg-green-700 disabled:bg-neutral-800 disabled:text-neutral-500 text-white text-xs font-bold transition cursor-pointer"
                >
                  {verifyLoading === 'email-verify' ? '...' : 'Verify'}
                </button>
              </div>
            )}
            {verifyMsg && <div className="mt-3 text-[11px] text-center text-purple-300 bg-purple-500/10 p-2 rounded-lg">{verifyMsg}</div>}
          </div>

          <button onClick={() => auth.signOut()} className="text-xs text-neutral-500 hover:text-white transition mt-4 cursor-pointer block mx-auto">
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 flex-1 flex flex-col justify-start">
      {/* Welcome Banner */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-[1.3rem] sm:text-2xl md:text-3xl font-bold tracking-tight bg-gradient-to-r from-purple-400 via-indigo-300 to-indigo-400 bg-clip-text text-transparent whitespace-nowrap flex items-center gap-2">
            <LayoutDashboard className="w-5 h-5 md:w-6 md:h-6 text-purple-400 shrink-0" />
            Overview Dashboard
          </h1>
          <p className="hidden md:block text-neutral-400 text-sm mt-1.5 leading-relaxed max-w-2xl">Track your job matches, resume score, and automation pipeline status.</p>
        </div>
        {realtimeStats.atsScore > 0 ? (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-xs text-purple-300 font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-purple-400 animate-pulse" /> AI Engine Online
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-neutral-900 border border-white/5 text-xs text-neutral-400 font-semibold">
            <div className="w-1.5 h-1.5 rounded-full bg-neutral-600 animate-ping" /> AI Engine Offline
          </div>
        )}
      </div>

      {/* Grid of Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="glass-card p-6">
          <div className="flex justify-between items-start text-neutral-400">
            <span className="text-sm font-semibold">Resume ATS Score</span>
            <FileText className="w-5 h-5 text-purple-400" />
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold">
              {realtimeStats.atsScore > 0 ? `${realtimeStats.atsScore}%` : 'N/A'}
            </span>
            <span className={`text-xs font-bold ${realtimeStats.atsScore > 0 ? 'text-green-400' : 'text-neutral-500'}`}>
              {realtimeStats.atsScore > 0 ? 'Excellent' : 'No Resume'}
            </span>
          </div>
          <div className="mt-3 w-full bg-neutral-800 h-1.5 rounded-full overflow-hidden">
            <div className="bg-purple-500 h-full rounded-full transition-all" style={{ width: `${realtimeStats.atsScore}%` }} />
          </div>
        </div>
        <div className="glass-card p-6">
          <div className="flex justify-between items-start text-neutral-400">
            <span className="text-sm font-semibold">Total Recommendations</span>
            <Briefcase className="w-5 h-5 text-purple-400" />
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold">{realtimeStats.recsCount}</span>
            <span className="text-xs text-purple-400 font-bold">Discovered Roles</span>
          </div>
          <p className="text-xs text-neutral-500 mt-3">{realtimeStats.highMatches} highly compatible matches (&gt;90%)</p>
        </div>

        <div className="glass-card p-6">
          <div className="flex justify-between items-start text-neutral-400">
            <span className="text-sm font-semibold">Active Applications</span>
            <Layers className="w-5 h-5 text-purple-400" />
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold">{realtimeStats.activeApps}</span>
            <span className="text-xs text-indigo-400 font-bold">in Progress</span>
          </div>
          <p className="text-xs text-neutral-500 mt-3">Tailored matches awaiting submission</p>
        </div>

        <div className="glass-card p-6">
          <div className="flex justify-between items-start text-neutral-400">
            <span className="text-sm font-semibold">Applications Submitted</span>
            <Check className="w-5 h-5 text-green-400" />
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold">{realtimeStats.submittedApps}</span>
            <span className="text-xs text-green-400 font-bold">Submitted</span>
          </div>
          <p className="text-xs text-neutral-500 mt-3">Processed automatically by copilot</p>
        </div>
      </div>

      {/* Verification Panel */}
      <div className="glass-card p-6">
        <div className="flex flex-col md:flex-row md:items-center gap-2 mb-6 border-b border-white/5 pb-4">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-purple-400 shrink-0" />
            <h3 className="font-bold text-lg whitespace-nowrap">Contact Verification</h3>
          </div>
          <span className="text-xs text-neutral-500 md:ml-auto">Required for auto-apply & WhatsApp bot notifications</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
          {/* Email Verification (Read Only - Since they are on this screen, they are verified) */}
          <div className="p-5 rounded-xl bg-neutral-950/40 border border-white/5 space-y-3 flex flex-col justify-center">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-purple-400" />
              <span className="text-sm font-bold text-white">Email Verification</span>
              <span className="ml-auto px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 text-[10px] font-bold flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Verified</span>
            </div>
            <p className="text-xs text-neutral-500">Your email address is securely verified and linked to your account.</p>
          </div>

          {/* WhatsApp Verification */}
          <div className="p-5 rounded-xl bg-neutral-950/40 border border-white/5 space-y-3 flex flex-col justify-center">
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-green-400" />
              <span className="text-sm font-bold text-white">WhatsApp Verification</span>
              {phoneVerified && <span className="ml-auto px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 text-[10px] font-bold flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Verified</span>}
            </div>
            {!phoneVerified && (
              <>
                {!phoneOtpSent ? (
                  <div className="space-y-2">
                    <input placeholder="+91 9876543210" type="tel"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      className="w-full bg-neutral-900 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-green-500/50 transition"
                    />
                    <button
                      onClick={async () => {
                        setVerifyLoading('phone-send');
                        setVerifyMsg(null);
                        
                        // Auto-format the phone number to prepend +91 for 10-digit Indian numbers
                        let formattedPhone = phone.trim().replace(/[\s\-()]+/g, '');
                        if (/^\d{10}$/.test(formattedPhone)) {
                          formattedPhone = `+91${formattedPhone}`;
                        } else if (/^\d{12}$/.test(formattedPhone)) {
                          formattedPhone = `+${formattedPhone}`;
                        } else if (formattedPhone && !formattedPhone.startsWith('+')) {
                          formattedPhone = `+${formattedPhone}`;
                        }
                        setPhone(formattedPhone);

                        try {
                          const response = await fetch(`${API_BASE}/auth/send-whatsapp-otp`, { 
                            method: 'POST', 
                            headers: { 
                              'Authorization': `Bearer ${await getToken()}`, 
                              'Content-Type': 'application/json' 
                            }, 
                            body: JSON.stringify({ phone: formattedPhone }) 
                          });
                          if (!response.ok) {
                            setVerifyMsg(`Failed to send WhatsApp. Server returned status ${response.status}`);
                            setVerifyLoading(null);
                            setTimeout(() => setVerifyMsg(null), 5000);
                            return;
                          }
                          setPhoneOtpSent(true);
                          setVerifyMsg('WhatsApp code sent to your phone!');
                        } catch (err: any) {
                          console.error(err);
                          setVerifyMsg('Failed to send WhatsApp message.');
                        } finally {
                          setVerifyLoading(null);
                          setTimeout(() => setVerifyMsg(null), 5000);
                        }
                      }}
                      disabled={!phone || verifyLoading === 'phone-send'}
                      className="w-full py-2.5 rounded-xl bg-green-600 hover:bg-green-700 disabled:bg-neutral-800 disabled:text-neutral-500 text-white text-xs font-semibold transition flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" /> {verifyLoading === 'phone-send' ? 'Sending...' : 'Send WhatsApp OTP'}
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input placeholder="Enter phoneotp" type="text"
                      maxLength={6}
                      value={phoneOtp}
                      onChange={e => setPhoneOtp(e.target.value.replace(/\D/g, ''))}
                      className="flex-1 bg-neutral-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white text-center tracking-[6px] font-mono focus:outline-none focus:border-green-500/50"
                    />
                    <button
                      onClick={async () => {
                        setVerifyLoading('phone-verify');
                        setVerifyMsg(null);
                        try {
                          const response = await fetch(`${API_BASE}/auth/verify-whatsapp-otp`, { 
                            method: 'POST', 
                            headers: { 
                              'Authorization': `Bearer ${await getToken()}`, 
                              'Content-Type': 'application/json' 
                            }, 
                            body: JSON.stringify({ otp: phoneOtp }) 
                          });
                          const result = await response.json();
                          if (!response.ok || !result.verified) {
                            setVerifyMsg(result.message || 'Incorrect OTP code');
                            setVerifyLoading(null);
                            setTimeout(() => setVerifyMsg(null), 5000);
                            return;
                          }
                          setPhoneVerified(true);
                          localStorage.setItem('phoneVerified', 'true');
                          setVerifyMsg('WhatsApp verified successfully!');
                        } catch (err: any) {
                          console.error(err);
                          setVerifyMsg(err.message || 'Incorrect OTP code. Please try again.');
                        } finally {
                          setVerifyLoading(null);
                          setTimeout(() => setVerifyMsg(null), 5000);
                        }
                      }}
                      disabled={phoneOtp.length !== 6 || verifyLoading === 'phone-verify'}
                      className="px-4 py-2 rounded-xl bg-green-600 hover:bg-green-700 disabled:bg-neutral-800 disabled:text-neutral-500 text-white text-xs font-bold transition cursor-pointer"
                    >
                      {verifyLoading === 'phone-verify' ? '...' : 'Verify'}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Verification status toast */}
        {verifyMsg && (
          <div className="mt-4 p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs text-purple-300 flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            <span>{verifyMsg}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Preference Filters form */}
        <div className="glass-card p-4 md:p-8 lg:col-span-1 h-fit">
          <div className="flex items-center gap-2 mb-6 border-b border-white/5 pb-4">
            <Sliders className="w-5 h-5 text-purple-400" />
            <h3 className="font-bold text-lg">Job Discovery Filters</h3>
          </div>

          <form onSubmit={handleSaveFilters} className="space-y-6">
            {/* Target Job Role */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-neutral-400 block">Target Job Roles (Comma Separated)</label>
              <input placeholder="e.g. React Developer, Data Scientist" type="text"
                value={targetJobRole}
                onChange={(e) => setTargetJobRole(e.target.value)}
                className="w-full bg-neutral-900 border border-white/5 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-purple-500/50 transition"
              />
              <p className="text-[10px] text-neutral-500">Specify multiple roles to search across combinations of roles and locations.</p>
            </div>

            {/* Work Type */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-neutral-400 block">Work Preference</label>
              <div className="flex gap-2 flex-wrap">
                {['Remote', 'Hybrid', 'Onsite'].map(type => {
                  const active = workTypes.includes(type);
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => handleToggleWorkType(type)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                        active
                          ? 'bg-purple-600/20 border-purple-500/50 text-purple-300'
                          : 'bg-neutral-900 border-white/5 text-neutral-400 hover:text-white'
                      }`}
                    >
                      {type}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Target Locations */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-neutral-400 block">Target Locations (Comma Separated)</label>
              <input placeholder="e.g. Bengaluru, Mumbai" type="text"
                value={countries.join(', ')}
                onChange={(e) => setCountries(e.target.value.split(',').map(s => s.trim()))}
                className="w-full bg-neutral-900 border border-white/5 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-purple-500/50 transition"
              />
            </div>

            {/* Experience Level */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-neutral-400 block">Experience Level</label>
              <select
                value={experienceLevel}
                onChange={(e) => setExperienceLevel(e.target.value)}
                className="w-full bg-neutral-900 border border-white/5 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-purple-500/50 cursor-pointer"
              >
                <option value="Fresher">Fresher (0-1 years)</option>
                <option value="Junior">Junior (1-3 years)</option>
                <option value="Mid">Mid Level (3-5 years)</option>
                <option value="Senior">Senior (5+ years)</option>
              </select>
            </div>

            {/* Education Filter */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-neutral-400 block">Education Qualification</label>
              <select
                value={educationFilter}
                onChange={(e) => setEducationFilter(e.target.value)}
                className="w-full bg-neutral-900 border border-white/5 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-purple-500/50 cursor-pointer"
              >
                <option value="B.E./B.Tech">B.E./B.Tech</option>
                <option value="MCA/BCA">MCA/BCA</option>
                <option value="MBA/BBA">MBA/BBA</option>
                <option value="Any Graduate">Any Graduate</option>
              </select>
            </div>

            {/* Min Salary (Placed Last) */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-semibold">
                <label className="text-neutral-400">Minimum Annual Salary</label>
                <span className="text-purple-300">₹{(minSalary / 100000).toFixed(0)} Lakhs (LPA)</span>
              </div>
              <input
                type="range"
                min="300000"
                max="5000000"
                step="100000"
                value={minSalary}
                onChange={(e) => setMinSalary(Number(e.target.value))}
                className="w-full accent-purple-500 cursor-pointer"
              />
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={profileLoading || loading}
              className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:bg-neutral-800 disabled:text-neutral-500 disabled:cursor-not-allowed text-white text-sm font-semibold transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-purple-500/10"
            >
              {profileLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-purple-400" /> Initializing Filters...
                </>
              ) : loading ? (
                <span>Saving...</span>
              ) : saved ? (
                <>
                  <Check className="w-4 h-4 text-green-300" /> Filters Saved!
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" /> Save Filters
                </>
              )}
            </button>
          </form>
        </div>

        {/* AI Recommendations & Actions logs */}
        <div className="glass-card p-6 lg:col-span-2">
          <div className="flex justify-between items-center mb-6 border-b border-white/5 pb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-400" />
              <h3 className="font-bold text-lg">AI Decision engine suggestions</h3>
            </div>
          </div>

          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-purple-500/5 border border-purple-500/10 flex gap-4">
              <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-300 h-fit">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-white">ATS Scoring Engine</h4>
                <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                  Your uploaded resume is scanned and scored in real-time against matched jobs. Suggests keyword optimizations automatically to maximize your match score.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/10 flex gap-4">
              <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-300 h-fit">
                <Briefcase className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-white">Auto-Apply Scheduler</h4>
                <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                  Claude automatically custom-tailors and submits your application to any vacancy recommendation that exceeds your match score threshold.
                </p>
              </div>
            </div>

            {/* Live WhatsApp Alert Status */}
            <div className={`p-4 rounded-xl flex gap-4 border ${phoneVerified ? 'bg-green-500/5 border-green-500/10' : 'bg-yellow-500/5 border-yellow-500/10'}`}>
              <div className={`p-2.5 rounded-xl h-fit ${phoneVerified ? 'bg-green-500/10 text-green-400' : 'bg-yellow-500/10 text-yellow-400'}`}>
                <Phone className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-white">WhatsApp Bot Alerts</h4>
                <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                  {phoneVerified ? (
                    <>WhatsApp Auto-apply alert bot is configured on <strong className="text-white">{phone || 'your verified number'}</strong>. You will receive live updates when Claude submits cover letters and resumes.</>
                  ) : (
                    <>WhatsApp notifications offline. Please verify your phone number in the Contact Verification card above to receive instant mobile notifications of automated applies.</>
                  )}
                </p>
              </div>
            </div>



            {/* Indeed & Naukri Sync */}
            <div className="p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/10 flex gap-4">
              <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-300 h-fit">
                <Globe className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-white">Job Portal Sync Engine</h4>
                <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                  Scans search indexes across Indeed, Naukri, LinkedIn, Greenhouse, and Lever in real-time based on your target location, experience, and work mode filters.
                </p>
              </div>
            </div>

            {/* AI Resume Tailoring Engine */}
            <div className="p-4 rounded-xl bg-purple-500/5 border border-purple-500/10 flex gap-4">
              <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-300 h-fit">
                <Award className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-white">AI Resume Tailoring Engine</h4>
                <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                  Automatically custom-tailors your resume's professional summaries and bullet-point achievements to match the specific keywords and requirements of target jobs.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
