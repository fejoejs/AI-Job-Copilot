'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/FirebaseAuthContext';
import { 
  ShieldCheck, 
  FileText, 
  Search, 
  RefreshCw, 
  Play, 
  AlertTriangle, 
  CheckCircle2, 
  Award, 
  Upload,
  XCircle,
  X,
  Zap,
  TrendingUp,
  Briefcase,
  AlertCircle,
  Sliders,
  CornerDownRight
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface AtsFeedbackItem {
  type: 'critical' | 'warning' | 'suggestion';
  title: string;
  detail: string;
}

interface AtsResult {
  overallScore: number;
  keywordMatch: number;
  sectionHeaders: number;
  contactInfo: number;
  formatting: number;
  chronology: number;
  lengthDensity: number;
  feedback: AtsFeedbackItem[];
  strengths: string[];
  summary: string;
  skillCount: number;
  wordCount: number;
  metricBullets: number;
  totalBullets: number;
  isStandardFileName: boolean;
  jobTitleMatched: boolean;
}

export default function AtsPage() {
  const { getToken } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanStep, setScanStep] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  
  const [resumeName, setResumeName] = useState('');
  const [resumeId, setResumeId] = useState('');
  const [targetJobTitle, setTargetJobTitle] = useState('');
  const [atsResult, setAtsResult] = useState<AtsResult | null>(null);
  const [error, setError] = useState('');
  const [featureEnabled, setFeatureEnabled] = useState(true);

  const scannerSteps = [
    'Uploading and parsing resume document...',
    'Analyzing section structure and headers...',
    'Evaluating keyword density and skill coverage...',
    'Checking acronym + full-form matching maps...',
    'Verifying exact job title phrasing...',
    'Checking bullet point symbols and script fonts...',
    'Generating AI-powered personalized feedback...',
    'Finalizing MNC compliance scores...'
  ];

  // Restore states from localStorage on mount
  useEffect(() => {
    const initPage = async () => {
      try {
        const featRes = await fetch(`${API_BASE}/public/config/features`);
        if (featRes.ok) {
          const featData = await featRes.json();
          if (featData.feature_ats_enabled === false) {
            setFeatureEnabled(false);
            setLoading(false);
            return;
          }
        }
      } catch (e) {
        console.error('Failed to fetch features:', e);
      }

      const isScanning = localStorage.getItem('ats_scanning') === 'true';
      const cachedResult = localStorage.getItem('ats_result');
      const cachedResumeId = localStorage.getItem('ats_resume_id') || '';
      const cachedResumeName = localStorage.getItem('ats_resume_name') || '';
      const cachedJobTitle = localStorage.getItem('ats_target_job_title') || '';

      if (cachedResumeId) setResumeId(cachedResumeId);
      if (cachedResumeName) setResumeName(cachedResumeName);
      if (cachedJobTitle) setTargetJobTitle(cachedJobTitle);

      if (isScanning && cachedResumeId) {
        setScanning(true);
        setScanStep(2);
        setLoading(false); // Fix loading spinner bug: show parsing/scanning UI immediately
        pollResumeStatus(cachedResumeId, cachedJobTitle);
      } else if (cachedResult) {
        try {
          setAtsResult(JSON.parse(cachedResult));
        } catch (e) {
          console.error('Failed to parse cached ATS result:', e);
        }
        setLoading(false);
      } else {
        await fetchLatestResume();
      }
    };
    initPage();
  }, []);

  const fetchLatestResume = async () => {
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/resume/latest?scanner=true`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.originalFileName) {
          setResumeName(data.originalFileName);
          setResumeId(data._id || data.id);
          localStorage.setItem('ats_resume_id', data._id || data.id);
          localStorage.setItem('ats_resume_name', data.originalFileName);
        }
      }
    } catch (err) {
      console.error('Failed to load latest resume metadata:', err);
    } finally {
      setLoading(false);
    }
  };

  const pollResumeStatus = async (targetResumeId: string, jobTitle: string) => {
    let parsed = false;
    let attempts = 0;
    
    // Simulate step progress matching the background poll duration
    const progressInterval = setInterval(() => {
      attempts++;
      if (attempts < scannerSteps.length - 2) {
        setScanStep(attempts);
      }
    }, 2000);

    try {
      const token = await getToken();
      while (!parsed && attempts < 45) {
        await new Promise(r => setTimeout(r, 1500));
        try {
          const checkRes = await fetch(`${API_BASE}/resume/${targetResumeId}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (checkRes.ok) {
            const checkData = await checkRes.json();
            if (checkData.parsedProfile) {
              parsed = true;
            }
          }
        } catch (e) {
          console.warn('Polling status check failed:', e);
        }
      }

      clearInterval(progressInterval);

      if (parsed) {
        await runAtsAnalysis(targetResumeId, jobTitle);
      } else {
        setError('Resume parsing timed out. Please try clicking "Analyze Target" after a few seconds.');
        setScanning(false);
        localStorage.removeItem('ats_scanning');
      }
    } catch (err) {
      clearInterval(progressInterval);
      console.error('Polling status error:', err);
      setError('Connection interrupted during parsing check.');
      setScanning(false);
      localStorage.removeItem('ats_scanning');
    } finally {
      setLoading(false);
    }
  };

  const runAtsAnalysis = async (targetResumeId: string, jobTitle: string) => {
    setScanning(true);
    setError('');

    let step = 5;
    const interval = setInterval(() => {
      step++;
      if (step < scannerSteps.length - 1) {
        setScanStep(step);
      }
    }, 900);

    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/resume/${targetResumeId}/ats-analyze`, {
        method: 'POST',
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ targetJobTitle: jobTitle }),
      });

      clearInterval(interval);

      if (res.ok) {
        const data = await res.json();
        setScanStep(scannerSteps.length - 1);
        await new Promise(r => setTimeout(r, 600));
        setAtsResult(data);
        
        // Cache result and clear scanning state
        localStorage.setItem('ats_result', JSON.stringify(data));
        localStorage.removeItem('ats_scanning');
      } else {
        const errData = await res.json().catch(() => ({}));
        setError(errData.message || 'ATS analysis failed. Make sure resume is parsed and API keys are configured.');
        localStorage.removeItem('ats_scanning');
      }
    } catch (err) {
      clearInterval(interval);
      console.error('ATS analysis request failed:', err);
      setError('Failed to connect to API. Please check if the server is running.');
      localStorage.removeItem('ats_scanning');
    } finally {
      setScanning(false);
    }
  };

  const handleFileUpload = async (uploadedFile: File) => {
    setScanning(true);
    setScanStep(0);
    setAtsResult(null);
    setError('');

    // Write scanning state into localStorage so page switches do not stop it
    localStorage.setItem('ats_scanning', 'true');
    localStorage.setItem('ats_resume_name', uploadedFile.name);
    localStorage.setItem('ats_target_job_title', targetJobTitle);
    localStorage.removeItem('ats_result');

    const formData = new FormData();
    formData.append('file', uploadedFile);

    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/resume/upload-ats`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });

      if (res.ok) {
        const resData = await res.json();
        setResumeName(resData.originalFileName || uploadedFile.name);
        setResumeId(resData.resumeId);

        localStorage.setItem('ats_resume_id', resData.resumeId);
        localStorage.setItem('ats_resume_name', resData.originalFileName || uploadedFile.name);

        // Begin polling for parsing completion status
        await pollResumeStatus(resData.resumeId, targetJobTitle);
      } else {
        setError('Failed to upload file. Please try again.');
        setScanning(false);
        localStorage.removeItem('ats_scanning');
      }
    } catch (err) {
      console.error('Upload request failed:', err);
      setError('Upload failed. Check your connection.');
      setScanning(false);
      localStorage.removeItem('ats_scanning');
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) handleFileUpload(e.dataTransfer.files[0]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) handleFileUpload(e.target.files[0]);
  };

  const clearTargetResume = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    const targetResumeId = resumeId || localStorage.getItem('ats_resume_id');

    setResumeName('');
    setResumeId('');
    setAtsResult(null);
    setError('');
    setTargetJobTitle('');
    localStorage.removeItem('ats_resume_id');
    localStorage.removeItem('ats_resume_name');
    localStorage.removeItem('ats_scanning');
    localStorage.removeItem('ats_result');
    localStorage.removeItem('ats_target_job_title');

    if (targetResumeId) {
      try {
        const token = await getToken();
        await fetch(`${API_BASE}/resume/${targetResumeId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch (err) {
        console.error('Failed to delete resume from backend database:', err);
      }
    }
  };

  const getScoreBand = (score: number) => {
    if (score >= 85) return { category: 'Excellent', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' };
    if (score >= 70) return { category: 'Good', color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20' };
    if (score >= 50) return { category: 'Average', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' };
    return { category: 'Poor', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' };
  };

  const getScoreColor = (score: number, max: number) => {
    const ratio = score / max;
    if (ratio >= 0.85) return 'text-emerald-400';
    if (ratio >= 0.70) return 'text-purple-400';
    if (ratio >= 0.50) return 'text-amber-400';
    return 'text-red-400';
  };

  const getBarColor = (score: number, max: number) => {
    const ratio = score / max;
    if (ratio >= 0.85) return 'bg-gradient-to-r from-emerald-500 to-teal-500';
    if (ratio >= 0.70) return 'bg-gradient-to-r from-purple-500 to-indigo-500';
    if (ratio >= 0.50) return 'bg-gradient-to-r from-amber-500 to-orange-500';
    return 'bg-gradient-to-r from-red-500 to-rose-500';
  };

  const getFeedbackBadge = (type: string) => {
    if (type === 'critical') return 'bg-red-500/10 border-red-500/25 text-red-400';
    if (type === 'warning') return 'bg-amber-500/10 border-amber-500/25 text-amber-400';
    return 'bg-purple-500/10 border-purple-500/25 text-purple-400';
  };

  const isFileNameStandard = (name: string) => {
    return /^[a-zA-Z]+_[a-zA-Z]+_Resume\.(pdf|docx)$/i.test(name);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <RefreshCw className="w-8 h-8 text-purple-500 animate-spin" />
        <span className="text-sm text-zinc-400 font-medium">Loading ATS Checker...</span>
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
                <Sliders className="w-5 h-5 animate-bounce [animation-duration:3s]" />
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
                ATS Checker Offline
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
      
      {/* Page Title Header */}
      <div className="flex justify-between items-center gap-3 pb-4 border-b border-white/5">
        <div>
          <h1 className="text-[1.2rem] sm:text-xl md:text-2xl font-bold tracking-tight bg-gradient-to-r from-purple-400 via-indigo-300 to-indigo-400 bg-clip-text text-transparent flex items-center gap-2 whitespace-nowrap">
            <Award className="w-5 h-5 md:w-6 md:h-6 text-purple-500 shrink-0" />
            ATS Score Checker
          </h1>
          <p className="hidden md:block text-neutral-400 text-sm mt-1.5 leading-relaxed max-w-2xl">
            Check your resume score using standard guidelines to optimize for modern applicant tracking systems.
          </p>
        </div>
      </div>

      {/* Control Row: Upload Box & Analysis triggers */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
        
        {/* Upload box */}
        <div className="md:col-span-7">
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept=".pdf,.doc,.docx" 
            className="hidden" 
          />
          <div 
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`p-6 rounded-xl border border-dashed text-center flex flex-col items-center justify-center gap-3 transition cursor-pointer min-h-[140px] ${
              dragActive 
                ? 'border-purple-500 bg-purple-500/5' 
                : 'border-white/10 bg-zinc-950/25 hover:border-purple-500/30 hover:bg-zinc-900/10'
            }`}
          >
            <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Drag & Drop Resume</h3>
              <p className="text-[10px] text-zinc-500 mt-0.5 max-w-sm mx-auto">
                Accepts PDF or DOCX. Standard single-column templates score highest.
              </p>
            </div>
          </div>
        </div>

        {/* Selected target metadata and Analyze button */}
        <div className="md:col-span-5 flex flex-col justify-between">
          {resumeName ? (
            <div className="p-5 rounded-xl border border-white/5 bg-zinc-950/65 flex flex-col justify-between h-full gap-3">
              <div className="space-y-3">
                <div className="flex items-start gap-3 relative">
                  <div className="p-2.5 rounded-lg bg-purple-500/10 border border-purple-500/20 shrink-0">
                    <FileText className="w-5 h-5 text-purple-400" />
                  </div>
                  <div className="min-w-0 flex-1 pr-6">
                    <span className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider block">Target Document</span>
                    <h4 className="font-bold text-xs text-white truncate" title={resumeName}>{resumeName}</h4>
                    {isFileNameStandard(resumeName) ? (
                      <span className="text-[9px] text-emerald-400 font-semibold mt-0.5 block">✓ Standard naming convention</span>
                    ) : (
                      <span className="text-[9px] text-amber-400 font-semibold mt-0.5 block flex items-center gap-1">
                        <AlertCircle className="w-3 h-3 text-amber-400" />
                        Rename file to FirstName_LastName_Resume
                      </span>
                    )}
                  </div>
                  <button 
                    onClick={clearTargetResume}
                    className="absolute right-0 top-0 p-1 rounded-md text-zinc-500 hover:text-white hover:bg-white/5 transition"
                    title="Remove target resume"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Target Job Title Input Field */}
                <div className="space-y-1">
                  <label className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider block">Target Job Title (Optional)</label>
                  <div className="relative">
                    <input placeholder="Enter targetjobtitle" type="text"
                      value={targetJobTitle}
                      onChange={(e) => {
                        setTargetJobTitle(e.target.value);
                        localStorage.setItem('ats_target_job_title', e.target.value);
                      }}
                      className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-purple-500"
                    />
                    <Briefcase className="w-3.5 h-3.5 text-zinc-500 absolute right-3 top-2.5" />
                  </div>
                </div>
              </div>

              {!scanning && resumeId && (
                <button 
                  onClick={() => {
                    localStorage.setItem('ats_scanning', 'true');
                    runAtsAnalysis(resumeId, targetJobTitle);
                  }}
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition cursor-pointer shadow-md shadow-purple-500/10"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  Analyze Compatibility
                </button>
              )}
            </div>
          ) : (
            <div className="p-5 rounded-xl border border-dashed border-white/5 bg-zinc-950/20 flex flex-col items-center justify-center text-center gap-2 h-full min-h-[140px]">
              <ShieldCheck className="w-6 h-6 text-zinc-600" />
              <div className="max-w-[180px]">
                <h4 className="font-bold text-[11px] text-zinc-400">No Resume Selected</h4>
                <p className="text-[9px] text-zinc-600 mt-0.5">Please upload a document to proceed.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-3.5 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400 flex items-start gap-2 max-w-2xl">
          <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Audit Progress Loading state */}
      {scanning ? (
        <div className="p-10 rounded-2xl border border-white/[0.08] bg-zinc-950/80 flex flex-col items-center justify-center text-center gap-4 min-h-[260px]">
          <div className="relative flex items-center justify-center">
            <div className="w-14 h-14 rounded-full border-2 border-t-purple-500 border-r-indigo-500 border-zinc-800 animate-spin" />
            <Search className="w-4 h-4 text-purple-400 absolute" />
          </div>
          <div className="space-y-1">
            <h3 className="font-bold text-xs text-white">Running Compatibility Checks</h3>
            <p className="text-purple-400 text-[10px] font-semibold font-mono animate-pulse">{scannerSteps[scanStep]}</p>
          </div>
        </div>
      ) : atsResult ? (
        /* Restructured Diagnostics Results */
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
          
          {/* Row 1: Overall score & Category breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            
            {/* Overall Score Dial */}
            <div className="lg:col-span-4 p-5 rounded-xl border border-white/5 bg-zinc-950/45 flex flex-col items-center justify-center text-center gap-4 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-2xl" />
              
              <div className="relative w-28 h-28 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="42" stroke="rgba(255,255,255,0.02)" strokeWidth="6" fill="transparent" />
                  <circle cx="50" cy="50" r="42" stroke="url(#atsGrad)" strokeWidth="7" fill="transparent" 
                    strokeDasharray={`${2 * Math.PI * 42}`}
                    strokeDashoffset={`${2 * Math.PI * 42 * (1 - atsResult.overallScore / 100)}`}
                    strokeLinecap="round"
                    className="transition-all duration-1000"
                  />
                  <defs>
                    <linearGradient id="atsGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#c084fc" />
                      <stop offset="100%" stopColor="#6366f1" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute flex flex-col items-center justify-center">
                  <span className="text-3xl font-black text-white leading-none">{atsResult.overallScore}</span>
                  <span className="text-[8px] text-zinc-500 font-bold uppercase tracking-wider mt-1">/ 100 pts</span>
                </div>
              </div>
              
              <div className="space-y-2 z-10 w-full">
                <div className={`px-3 py-1 rounded-full text-[10px] font-extrabold border ${getScoreBand(atsResult.overallScore).bg} ${getScoreBand(atsResult.overallScore).color} tracking-wider uppercase inline-block`}>
                  Category: {getScoreBand(atsResult.overallScore).category}
                </div>
                
                {/* Filename alerting badge */}
                {!atsResult.isStandardFileName && (
                  <div className="mt-2 p-2 rounded-lg bg-amber-500/5 border border-amber-500/10 text-[9px] text-amber-400/80 leading-normal max-w-[220px] mx-auto text-left flex gap-1.5 items-start">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                    <span>Recommend renaming file to match naming conventions.</span>
                  </div>
                )}
              </div>
            </div>

            {/* Deterministic Rules Breakdown */}
            <div className="lg:col-span-8 p-5 rounded-xl border border-white/5 bg-zinc-950/45 flex flex-col justify-between gap-4">
              <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
                <h3 className="font-bold text-[11px] text-zinc-300 uppercase tracking-wider">100-Point Rules Engine Diagnostics</h3>
                <span className="text-[8px] text-zinc-500 font-bold uppercase">Weighted parameters</span>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3.5">
                {[
                  { 
                    label: '1. Keyword & Skills Match', 
                    val: atsResult.keywordMatch, 
                    max: 35, 
                    desc: 'Skills-weighted (1.5x) + synonym acronym maps' 
                  },
                  { 
                    label: '2. Standard Section Headers', 
                    val: atsResult.sectionHeaders, 
                    max: 15, 
                    desc: 'Deductions for creative headers' 
                  },
                  { 
                    label: '3. Contact Info Extractability', 
                    val: atsResult.contactInfo, 
                    max: 10, 
                    desc: 'Email, phone, and name placement' 
                  },
                  { 
                    label: '4. Formatting & Parseability', 
                    val: atsResult.formatting, 
                    max: 20, 
                    desc: 'Checks standard fonts & clean bullets' 
                  },
                  { 
                    label: '5. Date & Chronology Consistency', 
                    val: atsResult.chronology, 
                    max: 10, 
                    desc: 'Checks reverse order & formatting gaps' 
                  },
                  { 
                    label: '6. Length & Density', 
                    val: atsResult.lengthDensity, 
                    max: 10, 
                    desc: 'Word count limits & repetition checks' 
                  },
                ].map((item, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-[11px] font-semibold">
                      <span className="text-zinc-400">{item.label}</span>
                      <span className={getScoreColor(item.val, item.max)}>{item.val} / {item.max}</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-white/5 overflow-hidden">
                      <div className={`h-full ${getBarColor(item.val, item.max)} transition-all duration-700`} style={{ width: `${(item.val / item.max) * 100}%` }} />
                    </div>
                    <p className="text-[9px] text-zinc-600 leading-none">{item.desc}</p>
                  </div>
                ))}
              </div>

              {/* Stats information */}
              <div className="flex items-center gap-4 pt-2 border-t border-zinc-900 text-[9px] text-zinc-500">
                <span>Word count: <strong className="text-zinc-300">{atsResult.wordCount}</strong> words</span>
                <span>•</span>
                <span>Skills: <strong className="text-zinc-300">{atsResult.skillCount}</strong> found</span>
                <span>•</span>
                <span>Metrics: <strong className="text-zinc-300">{atsResult.metricBullets} / {atsResult.totalBullets}</strong> bullets</span>
                {targetJobTitle && (
                  <>
                    <span>•</span>
                    <span>
                      Job Title: {' '}
                      <strong className={atsResult.jobTitleMatched ? 'text-emerald-400' : 'text-amber-400'}>
                        {atsResult.jobTitleMatched ? 'Matched (+3 bonus)' : 'Not found'}
                      </strong>
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Row 2: Optimization tips & key strengths */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
            
            {/* Optimization Tips */}
            <div className="md:col-span-7 p-5 rounded-xl border border-white/5 bg-zinc-950/45 space-y-3.5">
              <h4 className="text-xs font-bold text-white flex items-center gap-2 border-b border-zinc-900 pb-2 uppercase tracking-wider">
                <TrendingUp className="w-4 h-4 text-purple-400" />
                Actionable Optimization Tips
                <span className="ml-auto text-[9px] text-purple-400 font-bold lowercase">AI generated</span>
              </h4>
              
              <div className="space-y-2.5">
                {atsResult.feedback.map((item, idx) => (
                  <div key={idx} className="p-3 rounded-lg bg-zinc-900/10 border border-white/5 flex gap-2.5 items-start">
                    <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase shrink-0 tracking-wider ${getFeedbackBadge(item.type)}`}>
                      {item.type}
                    </span>
                    <div className="space-y-0.5 text-xs">
                      <span className="font-bold text-zinc-200 block">{item.title}</span>
                      <p className="text-zinc-500 text-[10px] leading-relaxed">{item.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Strengths Card & AI Summary */}
            <div className="md:col-span-5 flex flex-col gap-5">
              
              {/* Strengths */}
              <div className="p-5 rounded-xl border border-white/5 bg-zinc-950/45 space-y-3 flex-1">
                <h4 className="text-xs font-bold text-white flex items-center gap-2 border-b border-zinc-900 pb-2 uppercase tracking-wider">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Key Strengths Detected
                </h4>
                <div className="space-y-2.5 text-xs text-zinc-300">
                  {atsResult.strengths.map((s, idx) => (
                    <div key={idx} className="flex gap-2 items-start">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                      <span className="leading-tight">{s}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Assessment Summary */}
              {atsResult.summary && (
                <div className="p-5 rounded-xl border border-purple-500/10 bg-purple-500/5 text-xs leading-relaxed space-y-2.5">
                  <span className="font-bold text-purple-400 text-[9px] uppercase tracking-wider flex items-center gap-1">
                    <Zap className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                    Overall Assessment Summary
                  </span>
                  <p className="text-zinc-300 italic">{atsResult.summary}</p>
                </div>
              )}

            </div>
          </div>

        </div>
      ) : (
        /* Onboarding guide */
        <div className="p-8 rounded-2xl border border-white/5 bg-zinc-950/20 flex flex-col items-center justify-center text-center gap-6 min-h-[260px]">
          <div className="space-y-2">
            <div className="p-3 rounded-full bg-purple-500/5 border border-purple-500/10 text-purple-400 w-12 h-12 flex items-center justify-center mx-auto">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-xs text-white uppercase tracking-wider">Start ATS Compatibility Audit</h3>
            <p className="text-[11px] text-zinc-500 max-w-sm mx-auto leading-relaxed">
              Upload any resume file to analyze formatting parameters and receive targeted optimization tips.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
