'use client';

import React, { useEffect, useState } from 'react';
import { useAuth, useUser } from '@/context/FirebaseAuthContext';
import { 
  Sparkles, 
  FileText, 
  Briefcase, 
  AlertTriangle, 
  Check, 
  Copy, 
  Cpu, 
  Layers, 
  Award, 
  RefreshCw,
  Info,
  Sliders,
  CornerDownRight
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface TailoredAchievement {
  original: string;
  suggested: string;
  reasoning: string;
}

interface OptimizationResult {
  atsScore: number;
  keywordGaps: string[];
  tailoredSkills: string[];
  tailoredSummary: string;
  tailoredAchievements: TailoredAchievement[];
}

export default function ResumeTailorPage() {
  const { getToken } = useAuth();
  const { user, isLoaded: isUserLoaded } = useUser();

  const [loading, setLoading] = useState(true);
  const [optimizing, setOptimizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [featureEnabled, setFeatureEnabled] = useState(true);

  // Workspace Data
  const [latestResume, setLatestResume] = useState<any>(null);

  // Custom Inputs
  const [customTitle, setCustomTitle] = useState('');
  const [customDescription, setCustomDescription] = useState('');

  // Results State
  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  useEffect(() => {
    if (isUserLoaded && user) {
      loadWorkspaceData();
    }
  }, [isUserLoaded, user]);

  const loadWorkspaceData = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();

      try {
        const featRes = await fetch(`${API_BASE}/public/config/features`);
        if (featRes.ok) {
          const featData = await featRes.json();
          if (featData.feature_optimizer_enabled === false) {
            setFeatureEnabled(false);
            setLoading(false);
            return;
          }
        }
      } catch (err) {
        console.error('Failed to fetch features:', err);
      }

      // Fetch latest resume
      const resumeRes = await fetch(`${API_BASE}/resume/latest`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (resumeRes.ok) {
        const resumeData = await resumeRes.json();
        if (resumeData && resumeData.parsedProfile) {
          setLatestResume(resumeData);
        }
      }
    } catch (err) {
      console.error('Failed to load initial workspace data:', err);
      setError('Connection to backend API failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleOptimize = async () => {
    if (!latestResume) {
      alert('Please upload a resume first.');
      return;
    }

    if (!customTitle.trim() || !customDescription.trim()) {
      setError('Please enter both the Job Title and Job Description to run the AI optimizer.');
      return;
    }
    
    setOptimizing(true);
    setResult(null);
    setError(null);
    
    try {
      const token = await getToken();
      const bodyParams = {
        customJobTitle: customTitle,
        customJobDescription: customDescription,
      };

      const res = await fetch(`${API_BASE}/resume/${latestResume._id || latestResume.id}/optimize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(bodyParams),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'AI resume tailoring failed. Please try again.');
      }

      const data = await res.json();
      setResult(data);
    } catch (err: any) {
      console.error('Resume optimize error:', err);
      setError(err.message || 'Tailoring failed.');
    } finally {
      setOptimizing(false);
    }
  };

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const copyAllBullets = () => {
    if (!result) return;
    const allBullets = result.tailoredAchievements.map(a => `• ${a.suggested}`).join('\n');
    navigator.clipboard.writeText(allBullets);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5';
    if (score >= 60) return 'text-amber-400 border-amber-500/20 bg-amber-500/5';
    return 'text-red-400 border-red-500/20 bg-red-500/5';
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] gap-4">
        <RefreshCw className="w-8 h-8 text-purple-400 animate-spin" />
        <p className="text-neutral-400 text-sm">Loading tailoring workspace...</p>
      </div>
    );
  }

  if (!featureEnabled) {
    return (
      <div className="flex-1 w-full flex flex-col items-center justify-center min-h-[80vh] p-4 relative z-10 overflow-hidden">
        {/* Animated Background Glows */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] md:w-[500px] md:h-[500px] rounded-full bg-gradient-to-tr from-purple-600/10 to-indigo-600/10 blur-[80px] animate-[pulse_6s_ease-in-out_infinite] pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full bg-gradient-to-br from-fuchsia-500/10 to-purple-500/10 blur-[60px] animate-[pulse_4s_ease-in-out_infinite_reverse] pointer-events-none" />

        <div className="w-full max-w-sm relative group">
          {/* Animated Glow Border */}
          <div className="absolute -inset-[1px] bg-gradient-to-r from-purple-500/40 via-fuchsia-500/20 to-indigo-500/40 rounded-2xl blur-sm opacity-60 group-hover:opacity-100 transition duration-1000 animate-pulse" />
          
          <div className="relative bg-[#09090b]/90 border border-white/10 rounded-2xl p-6 text-center space-y-5 shadow-[0_0_60px_-15px_rgba(168,85,247,0.25)] backdrop-blur-3xl overflow-hidden">
            {/* Subtle Grid Background */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_10%,transparent_100%)] pointer-events-none" />

            {/* Central Icon Array */}
            <div className="relative mx-auto w-16 h-16 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border border-dashed border-purple-500/30 animate-[spin_30s_linear_infinite]" />
              <div className="absolute inset-1 rounded-full border border-dashed border-indigo-500/40 animate-[spin_15s_linear_infinite_reverse]" />
              <div className="absolute inset-2 rounded-full border border-white/5 bg-white/5 backdrop-blur-md shadow-inner" />
              <div className="relative p-2.5 rounded-full bg-gradient-to-tr from-purple-500/20 to-indigo-500/20 border border-purple-500/30 text-purple-400 shadow-[0_0_30px_-5px_rgba(168,85,247,0.4)] group-hover:scale-110 transition-transform duration-700">
                <Cpu className="w-5 h-5 animate-bounce [animation-duration:3s]" />
              </div>
            </div>

            <div className="space-y-2.5 relative z-10">
              <div className="flex justify-center">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-[9px] font-bold text-amber-400 uppercase tracking-widest shadow-[0_0_15px_-3px_rgba(245,158,11,0.2)] backdrop-blur-md">
                  <span className="w-1 h-1 rounded-full bg-amber-400 animate-ping absolute" />
                  <span className="w-1 h-1 rounded-full bg-amber-400 relative" />
                  System Status
                </span>
              </div>
              <h2 className="text-xl md:text-2xl font-black tracking-tighter text-white drop-shadow-sm">
                Optimizer Offline
              </h2>
              <p className="text-[11px] text-neutral-400 leading-relaxed max-w-[280px] mx-auto font-medium">
                Disabled by administrators for scheduled updates. Please check back shortly!
              </p>
            </div>

            {/* Premium Status Pills */}
            <div className="grid grid-cols-3 gap-2 pt-1 relative z-10">
              <div className="py-2 px-1 bg-black/40 border border-white/5 rounded-xl text-center space-y-1 hover:bg-white/5 transition-colors backdrop-blur-md group/pill">
                <div className="text-[8px] font-bold text-neutral-500 tracking-widest group-hover/pill:text-neutral-300 transition-colors">DATABASE</div>
                <div className="flex items-center justify-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                  <span className="text-[9px] font-extrabold text-emerald-400 uppercase tracking-wide">Synced</span>
                </div>
              </div>
              <div className="py-2 px-1 bg-gradient-to-b from-purple-900/20 to-indigo-900/10 border border-purple-500/30 rounded-xl text-center space-y-1 relative overflow-hidden backdrop-blur-md shadow-[0_0_20px_-8px_rgba(168,85,247,0.3)]">
                <div className="text-[8px] font-bold text-purple-300/70 tracking-widest">ENGINE</div>
                <div className="flex items-center justify-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse shadow-[0_0_8px_rgba(192,132,252,0.8)]" />
                  <span className="text-[9px] font-extrabold text-purple-300 uppercase tracking-wide">Updating</span>
                </div>
              </div>
              <div className="py-2 px-1 bg-black/40 border border-white/5 rounded-xl text-center space-y-1 hover:bg-white/5 transition-colors backdrop-blur-md group/pill">
                <div className="text-[8px] font-bold text-neutral-500 tracking-widest group-hover/pill:text-neutral-300 transition-colors">GATEWAY</div>
                <div className="flex items-center justify-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                  <span className="text-[9px] font-extrabold text-emerald-400 uppercase tracking-wide">Ready</span>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-center relative z-10">
              <a
                href="/dashboard"
                className="group/btn relative inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white text-black text-[11px] font-extrabold tracking-wide transition-all transform hover:-translate-y-0.5 hover:shadow-[0_8px_20px_-8px_rgba(255,255,255,0.4)] cursor-pointer overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-black/10 to-transparent -translate-x-[100%] group-hover/btn:translate-x-[100%] transition-transform duration-700" />
                <CornerDownRight className="w-3.5 h-3.5 transition-transform group-hover/btn:translate-x-1" />
                Return to Dashboard
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 flex-1 w-full text-zinc-100 relative z-10">
      {/* Title Header */}
      <div className="flex justify-between items-center gap-4 border-b border-white/5 pb-6">
        <div>
          <h1 className="text-[1.2rem] sm:text-xl md:text-2xl font-bold tracking-tight leading-tight bg-gradient-to-r from-purple-400 via-indigo-300 to-indigo-400 bg-clip-text text-transparent flex items-center gap-2">
            <Sparkles className="w-5 h-5 md:w-6 md:h-6 text-purple-400 animate-pulse shrink-0" />
            AI Resume Optimizer & Tailoring Suite
          </h1>
          <p className="hidden md:block text-neutral-400 text-sm mt-1.5 leading-relaxed max-w-2xl">
            Optimize your ATS score, discover missing keywords, <br className="block sm:hidden" /> and get customized work experience bullet rewrites.
          </p>
        </div>
        {latestResume && (
          <div className="flex items-center gap-3 bg-neutral-900/40 border border-white/5 px-4 py-2 rounded-xl text-xs backdrop-blur-xl">
            <FileText className="w-4 h-4 text-purple-400" />
            <div className="text-left">
              <p className="text-neutral-400 font-medium">Active Resume Profile</p>
              <p className="text-white font-bold max-w-[200px] truncate">{latestResume.originalFileName}</p>
            </div>
          </div>
        )}
      </div>

      {error && !result && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-5 py-4 rounded-xl flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <p className="text-xs font-semibold">{error}</p>
        </div>
      )}

      {/* Row 1: Target Job Selection Panel (Full Width Card) */}
      <div className="bg-[#0c0c0e]/80 border border-white/5 rounded-2xl p-6 backdrop-blur-xl space-y-6">
        <h2 className="text-sm font-bold text-white flex items-center gap-2 border-b border-white/5 pb-3">
          <Briefcase className="w-4 h-4 text-purple-400" />
          Target Job Details
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
          {/* Left Side: Input selectors */}
          <div className="md:col-span-7 space-y-3.5">
            <div>
              <span className="font-bold text-[9px] text-zinc-400 uppercase tracking-widest block mb-1.5">Job Title</span>
              <input placeholder="Enter customtitle" type="text" 
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)} 
                className="w-full bg-neutral-950 border border-white/5 rounded-xl px-4 py-2.5 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-purple-500/50"
              />
            </div>
            <div>
              <span className="font-bold text-[9px] text-zinc-400 uppercase tracking-widest block mb-1.5">Job Description</span>
              <textarea 
                rows={5}
                value={customDescription}
                onChange={(e) => setCustomDescription(e.target.value)} 
                className="w-full bg-neutral-950 border border-white/5 rounded-xl px-4 py-2.5 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-purple-500/50 resize-none font-sans"
              />
            </div>
          </div>

          {/* Right Side: Informational guidelines */}
          <div className="md:col-span-5 bg-neutral-900/40 border border-white/5 rounded-xl p-4.5 space-y-3 text-[10px] text-zinc-400 leading-relaxed self-stretch flex flex-col justify-center">
            <h3 className="font-bold text-zinc-200 flex items-center gap-1.5">
              <Info className="w-4 h-4 text-purple-400" />
              How AI Resume Tailoring Works:
            </h3>
            <ul className="list-disc pl-4 space-y-1.5 text-zinc-400">
              <li>Scans job requirements for core keywords and required tech skills.</li>
              <li>Compares credentials to compute an estimated ATS compliance score.</li>
              <li>Re-writes resume bullet points to map achievements directly to job requirements.</li>
              <li>Generates a custom tailored summary for your top sections.</li>
            </ul>
          </div>
        </div>

        {/* Optimize Button */}
        <div className="pt-2 border-t border-white/5 flex justify-end">
          <button
            onClick={handleOptimize}
            disabled={optimizing || !customTitle.trim() || !customDescription.trim()}
            className="w-full md:w-auto flex items-center justify-center gap-2 px-8 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider transition shadow-lg shadow-purple-500/15 cursor-pointer hover:scale-[1.01] duration-200"
          >
            {optimizing ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Analyzing Alignment...
              </>
            ) : (
              <>
                <Cpu className="w-3.5 h-3.5" />
                Analyze & Tailor Resume
              </>
            )}
          </button>
        </div>
      </div>

      {/* Row 2: Optimization Results Workspace (Full Width) */}
      <div className="space-y-6">
        
        {optimizing && (
          <div className="bg-[#0c0c0e]/40 border border-purple-500/10 rounded-2xl p-12 flex flex-col items-center justify-center text-center gap-6 min-h-[450px]">
            <div className="relative">
              <div className="w-16 h-16 rounded-full border border-purple-500/20 border-t-purple-500 animate-spin [animation-duration:1.5s]" />
              <Sparkles className="w-6 h-6 text-purple-400 absolute inset-0 m-auto animate-pulse" />
            </div>
            <div className="space-y-2 max-w-sm">
              <h3 className="text-white font-bold text-base">AI Tailoring Suite Engaged</h3>
              <p className="text-neutral-400 text-xs leading-relaxed">
                Comparing resume experiences against target qualifications, pinpointing gaps, and structuring optimized metrics bullet points...
              </p>
            </div>
          </div>
        )}

        {!result && !optimizing && (
          <div className="bg-[#0c0c0e]/40 border border-dashed border-white/5 rounded-2xl p-12 flex flex-col items-center justify-center text-center gap-4 min-h-[300px]">
            <div className="p-4 rounded-xl bg-neutral-900 border border-white/5">
              <Layers className="w-6 h-6 text-neutral-600" />
            </div>
            <div className="space-y-1">
              <h3 className="text-neutral-400 font-bold text-xs uppercase tracking-wider">No Optimization Results Active</h3>
              <p className="text-neutral-500 text-xs">Configure your target job above and click "Analyze & Tailor Resume".</p>
            </div>
          </div>
        )}

        {result && !optimizing && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Left Column: ATS Score & Keyword Lists (5-cols) */}
            <div className="lg:col-span-5 space-y-6">
              
              {/* ATS Ring Score Card */}
              <div className={`border rounded-2xl p-6 flex flex-col items-center text-center gap-5 backdrop-blur-xl ${getScoreColor(result.atsScore)}`}>
                <div className="relative flex items-center justify-center">
                  <svg className="w-24 h-24 transform -rotate-90">
                    <circle cx="48" cy="48" r="40" className="stroke-neutral-900 fill-none" strokeWidth="6" />
                    <circle 
                      cx="48" 
                      cy="48" 
                      r="40" 
                      className="stroke-current fill-none transition-all duration-1000" 
                      strokeWidth="6" 
                      strokeDasharray={251.2}
                      strokeDashoffset={251.2 - (251.2 * result.atsScore) / 100}
                    />
                  </svg>
                  <span className="absolute font-black text-xl text-white">{result.atsScore}%</span>
                </div>
                <div>
                  <h3 className="text-white font-bold text-sm uppercase tracking-wider">Estimated ATS Match</h3>
                  <p className="text-[10px] text-zinc-400 mt-1 leading-relaxed">Based on parsed skill coverage and achievement measurables.</p>
                </div>
                {result.atsScore >= 80 ? (
                  <span className="px-3.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold uppercase tracking-wider">High Alignment</span>
                ) : result.atsScore >= 60 ? (
                  <span className="px-3.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-bold uppercase tracking-wider">Medium Match</span>
                ) : (
                  <span className="px-3.5 py-1 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 text-[10px] font-bold uppercase tracking-wider">Action Needed</span>
                )}
              </div>

              {/* Keyword Gaps Card */}
              <div className="bg-[#0c0c0e]/80 border border-white/5 rounded-2xl p-6 backdrop-blur-xl space-y-4">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2 border-b border-white/5 pb-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  Identified Keyword Gaps
                </h3>
                <p className="text-[10px] text-zinc-400 leading-relaxed">These skills are missing or weak in your resume. Insert these terms naturally in your experience descriptions:</p>
                {result.keywordGaps.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {result.keywordGaps.map((g, idx) => (
                      <span key={`${g}-${idx}`} className="px-2.5 py-1 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-semibold">
                        {g}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-emerald-400 flex items-center gap-1.5 font-medium">
                    <Check className="w-4 h-4" /> No major keyword gaps found! Excellent skill overlap.
                  </p>
                )}
              </div>

              {/* Recommended Core Skills Card */}
              {result.tailoredSkills && result.tailoredSkills.length > 0 && (
                <div className="bg-[#0c0c0e]/80 border border-white/5 rounded-2xl p-6 backdrop-blur-xl space-y-4">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2 border-b border-white/5 pb-2.5">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    Recommended Core Skills
                  </h3>
                  <p className="text-[10px] text-zinc-400 leading-relaxed">Add these recommended key skills to your resume skill section to optimize for the ATS screening criteria:</p>
                  <div className="flex flex-wrap gap-2">
                    {result.tailoredSkills.map((s, idx) => (
                      <span key={`${s}-${idx}`} className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-semibold">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Summaries & Achievements (7-cols) */}
            <div className="lg:col-span-7 space-y-6">
              
              {/* Tailored Professional Summary Card */}
              <div className="bg-[#0c0c0e]/80 border border-white/5 rounded-2xl p-6 backdrop-blur-xl space-y-4">
                <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <FileText className="w-4 h-4 text-purple-400" />
                    Tailored Professional Summary
                  </h3>
                  <button
                    onClick={() => copyToClipboard(result.tailoredSummary, 999)}
                    className="text-neutral-400 hover:text-white p-1.5 rounded-lg bg-neutral-900/50 border border-white/5 transition hover:bg-neutral-950 cursor-pointer"
                  >
                    {copiedIndex === 999 ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <p className="text-xs text-neutral-300 leading-relaxed font-serif italic bg-neutral-950/60 p-4 rounded-xl border border-white/5">
                  "{result.tailoredSummary}"
                </p>
              </div>

              {/* Work Experience Bullet Rewrites Card */}
              <div className="bg-[#0c0c0e]/80 border border-white/5 rounded-2xl p-6 backdrop-blur-xl space-y-5">
                <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Award className="w-4 h-4 text-purple-400" />
                    Targeted Bullet-Point Rewrites
                  </h3>
                  {result.tailoredAchievements.length > 0 && (
                    <button
                      onClick={copyAllBullets}
                      className="px-3 py-1.5 rounded-xl bg-purple-600/10 border border-purple-500/20 text-purple-300 hover:bg-purple-600 hover:text-white transition text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      {copiedAll ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          Copied All!
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          Copy All Suggestions
                        </>
                      )}
                    </button>
                  )}
                </div>

                <div className="space-y-4">
                  {result.tailoredAchievements.map((item, idx) => (
                    <div key={idx} className="bg-neutral-950/50 border border-white/5 rounded-2xl p-5 space-y-4">
                      
                      {/* Original vs Suggested grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest">Original Achievement</span>
                          <p className="text-neutral-400 text-xs bg-neutral-900/30 p-3 rounded-xl border border-white/5">{item.original}</p>
                        </div>
                        <div className="space-y-1.5">
                          <span className="text-[9px] font-bold text-purple-400 uppercase tracking-widest flex items-center justify-between">
                            Optimized Suggestion
                            <button
                              onClick={() => copyToClipboard(item.suggested, idx)}
                              className="text-neutral-500 hover:text-white transition p-1 hover:bg-white/5 rounded cursor-pointer"
                            >
                              {copiedIndex === idx ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            </button>
                          </span>
                          <p className="text-white text-xs font-medium bg-purple-950/15 border border-purple-500/10 p-3 rounded-xl">{item.suggested}</p>
                        </div>
                      </div>

                      {/* Reasoning */}
                      <div className="bg-[#101014]/50 border border-dashed border-white/5 p-3 rounded-xl text-[10px] text-neutral-400 flex items-start gap-2.5">
                        <Sparkles className="w-3.5 h-3.5 text-purple-400 flex-shrink-0 mt-0.5" />
                        <span><strong>AI Reasoning:</strong> {item.reasoning}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>

          </div>
        )}

      </div>
    </div>
  );
}
