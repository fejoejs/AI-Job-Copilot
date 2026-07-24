'use client';

import React, { useEffect, useState } from 'react';
import { useAuth, useUser } from '@/context/FirebaseAuthContext';
import { 
  User as UserIcon, 
  Mail, 
  Phone, 
  MapPin, 
  Bell, 
  CheckCircle, 
  AlertCircle, 
  Save, 
  RefreshCw, 
  Image as ImageIcon,
  Globe,
  Settings,
  Sparkles,
  X
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function SettingsPage() {
  const { getToken } = useAuth();
  const { user, isLoaded } = useUser();

  const [loading, setLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  
  // View/Edit Mode Toggle
  const [isEditMode, setIsEditMode] = useState(false);
  const [viewPhotoModal, setViewPhotoModal] = useState(false);

  // Profile Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');

  // Verifications
  const [emailVerified, setEmailVerified] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);

  // Notifications preferences
  const [emailNotificationsEnabled, setEmailNotificationsEnabled] = useState(true);
  const [whatsappNotificationsEnabled, setWhatsappNotificationsEnabled] = useState(true);
  const [notifyMatchThreshold, setNotifyMatchThreshold] = useState(85);

  // Extension Token State
  const [extensionToken, setExtensionToken] = useState('');
  const [tokenLoading, setTokenLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isLoaded && user) {
      setEmail(user.primaryEmailAddress?.emailAddress || '');
      fetchProfile();
      fetchExtensionToken();
    }
  }, [isLoaded, user]);

  const fetchExtensionToken = async () => {
    setTokenLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/user/extension-token`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setExtensionToken(data.token);
      } else {
        const errData = await res.json().catch(() => ({}));
        console.error('Failed to fetch extension token, server responded:', res.status, errData);
        setExtensionToken(`Error: ${errData.message || res.statusText || 'Server configuration error'}`);
      }
    } catch (err: any) {
      console.error('Failed to fetch extension token:', err);
      setExtensionToken(`Error: ${err.message}`);
    } finally {
      setTokenLoading(false);
    }
  };

  const fetchProfile = async () => {
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/user/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setName(data.name || user?.fullName || '');
        setPhone(data.phone || '');
        setLocation(data.location || '');
        setAvatarUrl(data.avatarUrl || user?.imageUrl || '');
        setEmailVerified(data.isEmailVerified);
        setPhoneVerified(data.isPhoneVerified);
        setEmailNotificationsEnabled(data.emailNotificationsEnabled !== false);
        setWhatsappNotificationsEnabled(data.whatsappNotificationsEnabled !== false);
        setNotifyMatchThreshold(data.notifyMatchThreshold || 85);
      }
    } catch (err) {
      console.error('Failed to fetch profile settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveLoading(true);
    setFeedback(null);
    try {
      const token = await getToken();
      
      // Run both Firebase Auth Update and Backend DB update in parallel for lightning speed!
      const firebaseUpdatePromise = (async () => {
        if (name || avatarUrl) {
          try {
            const { auth } = await import('@/lib/firebase');
            if (auth.currentUser) {
              const { updateProfile } = await import('firebase/auth');
              const updates: any = {};
              if (name) updates.displayName = name;
              if (avatarUrl) {
                updates.photoURL = avatarUrl;
                localStorage.setItem('userAvatarUrl', avatarUrl);
              }
              await updateProfile(auth.currentUser, updates);
              await auth.currentUser.reload(); // Force Firebase to refresh the user object
            }
          } catch (fbErr) {
            console.error("Failed to update Firebase profile:", fbErr);
          }
        }
      })();

      const backendUpdatePromise = fetch(`${API_BASE}/user/profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name,
          phone,
          location,
          avatarUrl,
          emailNotificationsEnabled,
          whatsappNotificationsEnabled,
          notifyMatchThreshold
        })
      });

      const [res] = await Promise.all([backendUpdatePromise, firebaseUpdatePromise]);


      if (res.ok) {
        setFeedback({ type: 'success', message: 'Profile settings updated successfully!' });
        window.dispatchEvent(new Event('profileUpdated'));
        setIsEditMode(false);
      } else {
        setFeedback({ type: 'error', message: 'Failed to update settings. Please try again.' });
      }
    } catch (err) {
      console.error('Failed to save profile settings:', err);
      setFeedback({ type: 'error', message: 'Network error. Please check your connection.' });
    } finally {
      setSaveLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <RefreshCw className="w-8 h-8 text-purple-500 animate-spin" />
        <span className="text-sm text-zinc-400">Loading Account Settings...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 flex-1 w-full text-zinc-100 relative z-10">
      {/* Header Banner */}
      <div className="p-6 rounded-2xl border border-white/5 bg-[#0c0c0e]/80 shadow-2xl backdrop-blur-xl flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex flex-col md:flex-row items-center gap-5 text-center md:text-left">
          <div className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-tr from-purple-600 to-indigo-600 rounded-full blur opacity-35 group-hover:opacity-60 transition duration-300" />
            <img 
              src={avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80'} 
              alt="Avatar" 
              className="relative w-20 h-20 rounded-full object-cover border border-white/10 shadow-lg transition duration-200 cursor-pointer hover:scale-105 hover:ring-2 hover:ring-purple-500/50"
              onClick={() => setViewPhotoModal(true)}
              onError={(e) => {
                e.currentTarget.src = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80';
              }}
            />
            
            {/* Always visible Camera Badge for Uploading New Image */}
            <label className="absolute bottom-0 right-0 p-1.5 bg-purple-600 hover:bg-purple-500 rounded-full cursor-pointer shadow-lg border-2 border-[#0c0c0e] transition-transform hover:scale-110" title="Change Profile Picture">
              <ImageIcon className="w-3.5 h-3.5 text-white" />
              <input 
                type="file" 
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    if (file.size > 2 * 1024 * 1024) {
                      alert('File size exceeds 2MB limit.');
                      return;
                    }
                    const reader = new FileReader();
                    reader.onload = (event) => {
                      if (event.target?.result) {
                        setAvatarUrl(event.target.result as string);
                        // Auto-save the new avatar immediately
                        handleSaveProfile(new Event('submit') as any);
                      }
                    };
                    reader.readAsDataURL(file);
                  }
                }}
                className="hidden"
              />
            </label>
          </div>
          <div>
            <div className="flex items-center gap-2 justify-center md:justify-start">
              <h2 className="font-bold text-lg text-white">{name || user?.fullName || 'User Profile'}</h2>
              <span className="text-[10px] bg-purple-500/10 border border-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                Account Active
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-1 flex items-center justify-center md:justify-start gap-1.5">
              <Mail className="w-3.5 h-3.5 text-zinc-500" />
              {email}
            </p>
          </div>
        </div>

        {/* Verification Status Banner tags */}
        <div className="flex flex-wrap gap-2.5 justify-center md:justify-end border-t md:border-t-0 border-white/5 pt-4 md:pt-0 w-full md:w-auto">
          <div className="flex items-center gap-2 p-2 px-3 rounded-xl bg-neutral-900/60 border border-white/5 text-[10px] font-bold text-zinc-300 uppercase tracking-wider">
            <Mail className="w-3.5 h-3.5 text-zinc-500" />
            <span>Email:</span>
            {emailVerified ? (
              <span className="text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">Verified</span>
            ) : (
              <span className="text-zinc-500 bg-zinc-950 px-2 py-0.5 rounded border border-white/5">Unverified</span>
            )}
          </div>
          <div className="flex items-center gap-2 p-2 px-3 rounded-xl bg-neutral-900/60 border border-white/5 text-[10px] font-bold text-zinc-300 uppercase tracking-wider">
            <Phone className="w-3.5 h-3.5 text-zinc-500" />
            <span>WhatsApp:</span>
            {phoneVerified ? (
              <span className="text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">Verified</span>
            ) : (
              <span className="text-zinc-500 bg-zinc-950 px-2 py-0.5 rounded border border-white/5">Unverified</span>
            )}
          </div>
        </div>
      </div>

      {feedback && (
        <div className={`p-4 rounded-2xl border flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300 ${
          feedback.type === 'success' 
            ? 'bg-emerald-950/20 border-emerald-500/20 text-emerald-300' 
            : 'bg-red-950/20 border-red-500/20 text-red-300'
        }`}>
          {feedback.type === 'success' ? <CheckCircle className="w-5 h-5 text-emerald-400" /> : <AlertCircle className="w-5 h-5 text-red-400" />}
          <span className="text-xs font-semibold">{feedback.message}</span>
        </div>
      )}

      <form onSubmit={handleSaveProfile} className="space-y-6">
        
        {/* Row 1: Personal Details Card (Full Width) */}
        <div className="p-6 md:p-8 rounded-2xl border border-white/5 bg-[#0c0c0e]/80 shadow-2xl backdrop-blur-xl space-y-6">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <UserIcon className="w-4 h-4 text-purple-400" />
              Personal Details
            </h2>
            <button
              type="button"
              onClick={() => setIsEditMode(!isEditMode)}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-zinc-900 border border-white/10 hover:bg-zinc-800 text-zinc-300 transition cursor-pointer flex items-center gap-1.5"
            >
              {isEditMode ? 'Cancel Edit' : 'Edit Profile'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex flex-col gap-1.5">
              <span className="font-bold text-[9px] text-zinc-400 uppercase tracking-widest">Full Name</span>
              <div className="relative">
                <UserIcon className="absolute left-4 top-3 w-3.5 h-3.5 text-zinc-500" />
                {isEditMode ? (
                  <input placeholder="Enter name" type="text" 
                    value={name} 
                    onChange={(e) => setName(e.target.value)} 
                    className="w-full bg-neutral-900 border border-white/5 rounded-xl pl-11 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-purple-500/50"
                    required
                  />
                ) : (
                  <div className="w-full bg-neutral-900/50 border border-transparent rounded-xl pl-11 pr-4 py-2.5 text-xs text-white">
                    {name || <span className="text-zinc-600">Not provided</span>}
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="font-bold text-[9px] text-zinc-400 uppercase tracking-widest">Phone Number (with WhatsApp)</span>
              <div className="relative">
                <Phone className="absolute left-4 top-3 w-3.5 h-3.5 text-zinc-500" />
                {isEditMode ? (
                  <input placeholder="Enter phone" type="text" 
                    value={phone} 
                    onChange={(e) => setPhone(e.target.value)} 
                    className="w-full bg-neutral-900 border border-white/5 rounded-xl pl-11 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-purple-500/50 font-mono"
                  />
                ) : (
                  <div className="w-full bg-neutral-900/50 border border-transparent rounded-xl pl-11 pr-4 py-2.5 text-xs text-white font-mono">
                    {phone || <span className="text-zinc-600">Not provided</span>}
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="font-bold text-[9px] text-zinc-400 uppercase tracking-widest">Location / Current City</span>
              <div className="relative">
                <MapPin className="absolute left-4 top-3 w-3.5 h-3.5 text-zinc-500" />
                {isEditMode ? (
                  <input placeholder="City, Country" type="text" 
                    value={location} 
                    onChange={(e) => setLocation(e.target.value)} 
                    className="w-full bg-neutral-900 border border-white/5 rounded-xl pl-11 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-purple-500/50"
                  />
                ) : (
                  <div className="w-full bg-neutral-900/50 border border-transparent rounded-xl pl-11 pr-4 py-2.5 text-xs text-white">
                    {location || <span className="text-zinc-600">Not provided</span>}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Row 2: 2-Column Grid for Preferences & Extension */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          
          {/* Left Column: Notification Preferences */}
          <div className="p-6 md:p-8 rounded-2xl border border-white/5 bg-[#0c0c0e]/80 shadow-2xl backdrop-blur-xl space-y-6 flex flex-col h-full justify-between">
            <div className="space-y-6">
              <h2 className="text-sm font-bold text-white flex items-center gap-2 border-b border-white/5 pb-3">
                <Bell className="w-4.5 h-4.5 text-purple-400" />
                Notification Preferences
              </h2>

              <div className="space-y-3.5">
                {/* Email Toggle */}
                <div 
                  onClick={() => setEmailNotificationsEnabled(!emailNotificationsEnabled)}
                  className="flex items-center justify-between p-4 rounded-xl bg-neutral-900/40 border border-white/5 hover:bg-neutral-900/60 transition cursor-pointer select-none"
                >
                  <div className="flex flex-col pr-4">
                    <span className="text-xs font-bold text-white">Email Match Alerts</span>
                    <span className="text-[10px] text-zinc-500 mt-0.5 leading-relaxed">Receive list updates and tailored job match notifications via email.</span>
                  </div>
                  <div className="relative inline-flex items-center">
                    <div className={`w-9 h-5 rounded-full transition-colors duration-200 border border-white/5 flex items-center px-0.5 ${emailNotificationsEnabled ? 'bg-purple-600 border-purple-500' : 'bg-neutral-800'}`}>
                      <div className={`w-3.5 h-3.5 bg-white rounded-full shadow-md transition-transform duration-200 ${emailNotificationsEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                    </div>
                  </div>
                </div>

                {/* WhatsApp Toggle */}
                <div 
                  onClick={() => setWhatsappNotificationsEnabled(!whatsappNotificationsEnabled)}
                  className="flex items-center justify-between p-4 rounded-xl bg-neutral-900/40 border border-white/5 hover:bg-neutral-900/60 transition cursor-pointer select-none"
                >
                  <div className="flex flex-col pr-4">
                    <span className="text-xs font-bold text-white">WhatsApp OTP & Match Alerts</span>
                    <span className="text-[10px] text-zinc-500 mt-0.5 leading-relaxed">Receive real-time match scores and verification OTP codes directly on WhatsApp.</span>
                  </div>
                  <div className="relative inline-flex items-center">
                    <div className={`w-9 h-5 rounded-full transition-colors duration-200 border border-white/5 flex items-center px-0.5 ${whatsappNotificationsEnabled ? 'bg-purple-600 border-purple-500' : 'bg-neutral-800'}`}>
                      <div className={`w-3.5 h-3.5 bg-white rounded-full shadow-md transition-transform duration-200 ${whatsappNotificationsEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Match Threshold Slider */}
              <div className="space-y-4 pt-2">
                <div className="flex justify-between items-center text-[9px] font-bold text-zinc-400 uppercase tracking-widest">
                  <span>Minimum Match Alert Threshold</span>
                  <span className="text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-md border border-purple-500/20 font-bold text-xs">{notifyMatchThreshold}% Match</span>
                </div>
                
                <div className="space-y-1.5">
                  <input 
                    type="range" 
                    min="50" 
                    max="100" 
                    value={notifyMatchThreshold} 
                    onChange={(e) => setNotifyMatchThreshold(Number(e.target.value))}
                    className="w-full accent-purple-500 cursor-pointer h-1.5 bg-neutral-900 rounded-lg appearance-none border border-white/5"
                  />
                  <div className="flex justify-between text-[8px] font-bold text-zinc-600 px-1">
                    <span>50% Match</span>
                    <span>75% (Recommended)</span>
                    <span>100% (Exact Only)</span>
                  </div>
                </div>
                
                {/* Info Box */}
                <div className="bg-purple-950/15 border border-purple-500/10 rounded-xl p-4 text-[10px] text-purple-300 leading-relaxed flex gap-2.5 items-start">
                  <Sparkles className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-bold text-purple-200">How Threshold Alerts Work:</p>
                    <p>
                      Our background agents compare jobs to your parsed resume. You will only receive notifications if the calculated matching accuracy meets or exceeds your configured percentage.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Chrome Extension Settings */}
          <div className="p-6 rounded-2xl border border-white/5 bg-[#0c0c0e]/80 shadow-2xl backdrop-blur-xl space-y-6 flex flex-col h-full justify-between">
            <div className="space-y-4">
              <h2 className="text-sm font-bold text-white flex items-center gap-2 border-b border-white/5 pb-3">
                <Globe className="w-4 h-4 text-purple-400" />
                AI Job Assistant Chrome Extension
              </h2>
              <p className="text-[10px] text-zinc-400 leading-relaxed">
                Passively sync job listings you view on LinkedIn, Indeed, and Naukri directly into your Job Copilot boards.
              </p>

              {/* Download Button */}
              <a 
                href="/chrome-extension.zip" 
                download="chrome-extension.zip"
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-white/10 bg-neutral-900 hover:bg-neutral-800 hover:border-purple-500/30 text-white font-bold text-xs transition duration-200 cursor-pointer shadow-lg shadow-black/30 text-center"
              >
                <Globe className="w-4 h-4 text-purple-400" />
                Download Extension Package (.zip)
              </a>

              {/* Installation Steps */}
              <div className="space-y-2 bg-neutral-900/50 border border-white/5 rounded-xl p-3.5 text-[10px] text-zinc-400 leading-relaxed">
                <p className="font-bold text-zinc-200">How to Install & Set Up:</p>
                <ol className="list-decimal pl-4 space-y-1.5 text-zinc-400">
                  <li>Click <strong className="text-purple-300">Download Extension Package</strong> above and extract the ZIP file.</li>
                  <li>Open Chrome and navigate to <code className="bg-neutral-950 px-1 py-0.5 rounded border border-white/5 text-purple-300">chrome://extensions/</code>.</li>
                  <li>Turn on <strong className="text-zinc-200">Developer Mode</strong> (top-right toggle).</li>
                  <li>Click <strong className="text-zinc-200">Load unpacked</strong> (top-left) and select the extracted folder.</li>
                  <li>Open the extension, paste the Access Token below, and click <strong className="text-zinc-200">Save Configuration</strong>!</li>
                </ol>
              </div>
            </div>

            <div className="space-y-3 pt-4 border-t border-white/5">
              <span className="font-bold text-[9px] text-zinc-400 uppercase tracking-widest block">Your Extension Access Token</span>
              <div className="flex gap-2.5">
                <input placeholder="Extension Token" type="text" 
                  readOnly 
                  value={tokenLoading ? 'Loading token...' : extensionToken || 'No token generated'} 
                  className="flex-1 bg-neutral-900 border border-white/5 rounded-xl px-4 py-2.5 text-xs text-zinc-400 focus:outline-none font-mono truncate"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (extensionToken) {
                      navigator.clipboard.writeText(extensionToken);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }
                  }}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs rounded-xl border border-white/5 transition flex items-center justify-center min-w-[80px] cursor-pointer"
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
          </div>

        </div>

        {/* Footer: Save Button (Full Width bottom block) */}
        <div className="flex justify-end pt-4 border-t border-white/5">
          <button 
            type="submit" 
            disabled={saveLoading}
            className="w-full md:w-auto flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider transition shadow-lg shadow-purple-500/15 cursor-pointer hover:scale-[1.01] duration-200"
          >
            {saveLoading ? <RefreshCw className="w-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save Settings Overrides
          </button>
        </div>

      </form>

      {/* Photo Viewer Modal */}
      {viewPhotoModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setViewPhotoModal(false)}>
          <button 
            type="button"
            onClick={() => setViewPhotoModal(false)}
            className="absolute top-6 right-6 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition"
          >
            <X className="w-6 h-6" />
          </button>
          <img 
            src={avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=800&h=800&q=80'} 
            alt="Profile View" 
            className="max-w-full max-h-[80vh] rounded-3xl object-contain shadow-2xl ring-4 ring-white/10"
            onClick={(e) => e.stopPropagation()}
            onError={(e) => {
              e.currentTarget.src = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=800&h=800&q=80';
            }}
          />
        </div>
      )}
    </div>
  );
}
