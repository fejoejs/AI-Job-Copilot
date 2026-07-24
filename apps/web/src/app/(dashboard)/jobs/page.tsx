'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/FirebaseAuthContext';
import { 
  Sparkles, Briefcase, Check, X, Zap, HelpCircle, RefreshCw, Loader2, 
  ExternalLink, MapPin, Building2, Clock, DollarSign, Award, Tag, Globe
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function decodeHtmlEntities(str: string): string {
  if (!str) return '';
  return str
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&middot;/g, '•')
    .replace(/&bull;/g, '•')
    .replace(/&rsquo;/g, "'")
    .replace(/&ldquo;/g, '"')
    .replace(/&rdquo;/g, '"')
    .replace(/&ndash;/g, '-')
    .replace(/&mdash;/g, '—')
    .replace(/&lt;br\s*\/?[&gt;]/gi, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .trim();
}

function formatDescription(text: string) {
  if (!text) return null;
  const decoded = decodeHtmlEntities(text);
  
  // If it contains obvious HTML tags, render as HTML
  if (/<(ul|li|p|br|b|strong|i|em|h[1-6])[^>]*>/i.test(decoded)) {
    return (
      <div 
        className="prose prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-li:marker:text-purple-500 prose-ul:list-disc prose-ul:pl-5 space-y-3"
        dangerouslySetInnerHTML={{ __html: decoded }} 
      />
    );
  }

  // Otherwise, smartly format plaintext into paragraphs and bullet lists
  const paragraphs = decoded.split(/(?:\r?\n){2,}/);
  return (
    <div className="space-y-4">
      {paragraphs.map((p, i) => {
        // Detect if this paragraph is actually a list
        const isList = p.includes('\n-') || p.includes('\n*') || p.includes('\n•') || /^[*-•]/.test(p.trim());
        if (isList) {
          const lines = p.split(/\r?\n/).filter(l => l.trim().length > 0);
          return (
            <ul key={i} className="list-disc pl-5 space-y-1.5 marker:text-purple-500">
              {lines.map((line, j) => {
                const cleaned = line.replace(/^[\s*-•]+/, '').trim();
                return cleaned ? <li key={j}>{cleaned}</li> : null;
              })}
            </ul>
          );
        }
        return <p key={i} className="leading-relaxed whitespace-pre-wrap">{p.trim()}</p>;
      })}
    </div>
  );
}

interface JobData {
  _id: string;
  title: string;
  company: string;
  description: string;
  location: string;
  workType: string;
  source: string;
  url?: string;
  salaryString?: string;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  salaryPeriod?: string;
  companyUrl?: string;
  applyUrl?: string;
  companyLogoUrl?: string;
  requiredSkills?: string[];
  preferredSkills?: string[];
  experienceLevel?: string;
  requiredExperienceYears?: number;
  employmentType?: string;
  industry?: string;
  benefits?: string[];
  postedDate?: string;
  createdAt?: string;
}

interface MatchData {
  matchScore: number;
  recommendation: 'Apply' | 'Skip';
  reasoning: string;
  pros: string[];
  cons: string[];
  missingSkills: string[];
  decisionScore: number;
}

interface JobItem {
  job: JobData;
  match: MatchData | null;
}

function timeAgo(dateStr?: string): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Today';
  if (days === 1) return '1 day ago';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  return `${Math.floor(days / 30)} months ago`;
}

function displayLocation(job: JobData): string {
  if (job.location?.trim()) return job.location.trim();
  return job.workType === 'Remote' ? 'Remote' : 'Location not specified';
}

function formatSalary(job: JobData): string {
  const isINR = job.salaryCurrency === 'INR' || (job.salaryMin && job.salaryMin > 150000);
  if (isINR) {
    if (job.salaryMin) {
      const minLpa = (job.salaryMin / 100000).toFixed(0);
      const maxLpa = job.salaryMax ? (job.salaryMax / 100000).toFixed(0) : null;
      return maxLpa ? `₹${minLpa} - ₹${maxLpa} LPA` : `₹${minLpa} LPA`;
    }
  }
  if (job.salaryMin) {
    const minStr = job.salaryMin.toLocaleString();
    const maxStr = job.salaryMax ? job.salaryMax.toLocaleString() : null;
    const currency = job.salaryCurrency === 'EUR' ? '€' : '$';
    return maxStr ? `${currency}${minStr} - ${currency}${maxStr} /yr` : `${currency}${minStr} /yr`;
  }
  if (job.salaryString) {
    return job.salaryString;
  }
  return '';
}

const SOURCE_COLORS: Record<string, string> = {
  Greenhouse: 'bg-green-500/10 text-green-400 border-green-500/20',
  Lever: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  Ashby: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  Workday: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  Rippling: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
  JSearch: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  Adzuna: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  LinkedIn: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  Indeed: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
  Jooble: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  Careerjet: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  Workable: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  SmartRecruiters: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
  Recruitee: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
  Teamtailor: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  'Remote OK': 'bg-pink-500/10 text-pink-400 border-pink-500/20',
  Jobicy: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
  Remotive: 'bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20',
  'We Work Remotely': 'bg-amber-600/10 text-amber-500 border-amber-600/20',
  Himalayas: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
};

const EXP_COLORS: Record<string, string> = {
  Intern: 'bg-teal-500/10 text-teal-400',
  Junior: 'bg-emerald-500/10 text-emerald-400',
  Mid: 'bg-purple-500/10 text-purple-400',
  Senior: 'bg-amber-500/10 text-amber-400',
};

export default function JobsPage() {
  const { getToken } = useAuth();
  
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [selectedJob, setSelectedJob] = useState<JobItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [customizingId, setCustomizingId] = useState<string | null>(null);
  const [matchingId, setMatchingId] = useState<string | null>(null);
  const [tailoredStatus, setTailoredStatus] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const fetchJobs = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/job/dashboard`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setJobs(data || []);
        if (data && data.length > 0) {
          const stillExists = data.find((j: any) => j.job._id === selectedJob?.job._id);
          setSelectedJob(stillExists || data[0]);
        } else {
          setSelectedJob(null);
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        setError(errData.message || 'Failed to fetch recommendation queue from backend.');
      }
    } catch (err) {
      console.error('Failed to load recommendation matches:', err);
      setError('Failed to connect to API. Verify backend server is online.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  const handleCalculateMatch = async (jobId: string) => {
    setMatchingId(jobId);
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/job/${jobId}/match`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        let attempts = 0;
        let matchFound = false;
        while (attempts < 8 && !matchFound) {
          await new Promise(r => setTimeout(r, 2500));
          attempts++;
          const checkRes = await fetch(`${API_BASE}/job/dashboard`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (checkRes.ok) {
            const checkData = await checkRes.json();
            setJobs(checkData || []);
            const updatedJob = checkData.find((j: any) => j.job._id === jobId);
            if (updatedJob && updatedJob.match) {
              setSelectedJob(updatedJob);
              matchFound = true;
            }
          }
        }
        if (!matchFound) {
          setError('AI match score is processing in the background. Please wait and refresh.');
        }
      } else {
        setError('Failed to trigger compatibility calculation.');
      }
    } catch (err) {
      console.error('Match trigger error:', err);
      setError('Failed to connect to API to trigger matching.');
    } finally {
      setMatchingId(null);
    }
  };

  const handleApplyTailor = async (jobId: string) => {
    setCustomizingId(jobId);
    setError(null);
    try {
      const token = await getToken();
      const appRes = await fetch(`${API_BASE}/application`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ jobId })
      });
      if (!appRes.ok) {
        const errData = await appRes.json().catch(() => ({}));
        throw new Error(errData.message || 'Failed to create application record.');
      }
      const appData = await appRes.json();
      const applicationId = appData._id || appData.id;

      setTailoredStatus(prev => ({ ...prev, [jobId]: 'tailoring' }));
      const tailorRes = await fetch(`${API_BASE}/application/${applicationId}/tailor`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (tailorRes.ok) {
        setTailoredStatus(prev => ({ ...prev, [jobId]: 'done' }));
        setTimeout(() => { window.location.href = '/applications'; }, 1200);
      } else {
        throw new Error('AI tailoring queue request failed.');
      }
    } catch (err) {
      console.error('Tailor request failed:', err);
      setError(err instanceof Error ? err.message : 'Tailoring failed.');
      setTailoredStatus(prev => ({ ...prev, [jobId]: 'error' }));
    } finally {
      setCustomizingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <RefreshCw className="w-8 h-8 text-purple-500 animate-spin" />
        <span className="text-sm text-zinc-400 font-medium">Loading your personalized job matches...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8 flex-1">
      <div className="flex justify-between items-start gap-4">
        <div>
          <h1 className="text-[1.2rem] sm:text-2xl md:text-3xl font-bold tracking-tight bg-gradient-to-r from-purple-400 via-indigo-300 to-indigo-400 bg-clip-text text-transparent whitespace-nowrap">Recommendation Board</h1>
          <p className="hidden md:block text-neutral-400 text-sm mt-1.5 leading-relaxed max-w-2xl">Genuine listings crawled from Adzuna, JSearch, Greenhouse, Lever &amp; more — personalized to your profile.</p>
        </div>
        <button
          onClick={fetchJobs}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-white/5 bg-zinc-950/40 hover:bg-zinc-900 text-xs text-indigo-300 font-semibold transition cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400 flex items-center gap-2 animate-fade-in">
          <HelpCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {jobs.length === 0 ? (
        <div className="text-center py-24 glass-card space-y-4">
          <Briefcase className="w-16 h-16 text-zinc-700 mx-auto animate-pulse" />
          <div>
            <h3 className="text-base font-bold text-white uppercase tracking-wider">No matches found</h3>
            <p className="text-xs text-neutral-500 mt-2 max-w-lg mx-auto leading-relaxed">
              Set your <strong>Target Job Role</strong> in the Dashboard preferences and save filters to trigger a personalized job crawl. 
              Jobs are crawled from Adzuna and JSearch based on your role, location, and experience preferences.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* ─── List Panel ─── */}
          <div className="lg:col-span-1 glass-card p-4 space-y-3 h-fit overflow-y-auto max-h-[75vh]">
            <h3 className="font-bold text-xs uppercase tracking-wider text-neutral-400 px-2 pb-2 border-b border-white/5">
              Recommendation Queue ({jobs.length})
            </h3>
            {jobs.map((item) => (
              <div 
                key={item.job._id}
                onClick={() => setSelectedJob(item)}
                className={`p-3.5 rounded-xl border transition cursor-pointer text-left ${
                  selectedJob?.job._id === item.job._id 
                    ? 'border-purple-500 bg-purple-500/5' 
                    : 'border-white/5 bg-zinc-950/20 hover:border-white/10'
                }`}
              >
                <div className="flex justify-between items-start gap-2">
                  <div className="flex items-start gap-2 min-w-0">
                    {item.job.companyLogoUrl && (
                      <img 
                        src={item.job.companyLogoUrl} 
                        alt={item.job.company} 
                        className="w-7 h-7 rounded-lg object-contain bg-white/5 p-0.5 shrink-0"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    )}
                    <div className="min-w-0">
                      <h4 className="font-bold text-xs text-white truncate">{item.job.title}</h4>
                      <p className="text-[10px] text-neutral-400 font-medium truncate">{item.job.company}</p>
                    </div>
                  </div>
                  {item.match ? (
                    <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold shrink-0 ${
                      item.match.matchScore >= 85 
                        ? 'bg-emerald-500/10 text-emerald-400' 
                        : item.match.matchScore >= 70 
                          ? 'bg-purple-500/10 text-purple-400' 
                          : 'bg-amber-500/10 text-amber-400'
                    }`}>
                      {item.match.matchScore}%
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-[10px] font-extrabold shrink-0 bg-neutral-800 text-neutral-500">
                      Pending
                    </span>
                  )}
                </div>
                <div className="flex justify-between items-center text-[9px] text-neutral-500 mt-3 pt-2 border-t border-white/5 gap-2">
                  <span className="flex items-center gap-1 min-w-0 truncate">
                    <MapPin className="w-2.5 h-2.5 shrink-0" />
                    <span className="truncate">{displayLocation(item.job)} &bull; {item.job.workType}</span>
                  </span>
                  {formatSalary(item.job) && (
                    <span className="shrink-0 text-emerald-400 font-bold">
                      {formatSalary(item.job)}
                    </span>
                  )}
                  <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold border shrink-0 ${SOURCE_COLORS[item.job.source] || 'bg-neutral-800 text-neutral-400 border-white/5'}`}>
                    {item.job.source}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* ─── Details Panel ─── */}
          <div className="lg:col-span-2 glass-card p-6 space-y-6">
            {selectedJob ? (
              <div className="space-y-6">
                
                {/* Header */}
                <div className="border-b border-white/5 pb-5">
                  <div className="flex justify-between items-start flex-wrap gap-4">
                    <div className="flex gap-3 items-start">
                      {selectedJob.job.companyLogoUrl && (
                        <img 
                          src={selectedJob.job.companyLogoUrl} 
                          alt={selectedJob.job.company} 
                          className="w-12 h-12 rounded-xl object-contain bg-white/5 p-1 shrink-0"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      )}
                      <div>
                        <h2 className="font-bold text-xl text-white">{selectedJob.job.title}</h2>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-xs text-purple-400 font-semibold">{selectedJob.job.company}</span>
                          {selectedJob.job.companyUrl && (
                            <a 
                              href={selectedJob.job.companyUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-0.5 transition"
                            >
                              <Globe className="w-2.5 h-2.5" /> Company Website
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="flex gap-2 flex-wrap">
                      {selectedJob.job.applyUrl && (
                        <a
                          href={selectedJob.job.applyUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-2 border border-white/10 bg-zinc-950/40 hover:bg-zinc-900 text-white font-bold text-xs rounded-lg transition flex items-center gap-1.5"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          Apply on Site
                        </a>
                      )}
                      <button
                        onClick={() => handleApplyTailor(selectedJob.job._id)}
                        disabled={customizingId !== null || tailoredStatus[selectedJob.job._id] === 'done'}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-neutral-800 text-white font-bold text-xs rounded-lg transition flex items-center gap-1.5 cursor-pointer shadow-md shadow-purple-500/10"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-purple-200" />
                        {customizingId === selectedJob.job._id 
                          ? 'Customizing...' 
                          : tailoredStatus[selectedJob.job._id] === 'done' 
                            ? 'Added to Applications!' 
                            : 'Optimize & Apply'}
                      </button>
                    </div>
                  </div>

                  {/* Meta badges row */}
                  <div className="flex flex-wrap gap-2 mt-4">
                    <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-900 border border-white/5 text-[10px] text-neutral-300 font-semibold">
                      <MapPin className="w-3 h-3 text-neutral-500" /> {displayLocation(selectedJob.job)}
                    </span>
                    <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-900 border border-white/5 text-[10px] text-neutral-300 font-semibold">
                      <Building2 className="w-3 h-3 text-neutral-500" /> {selectedJob.job.workType}
                    </span>
                    {selectedJob.job.experienceLevel && (
                      <span className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold ${EXP_COLORS[selectedJob.job.experienceLevel] || 'bg-neutral-800 text-neutral-400'}`}>
                        <Award className="w-3 h-3" /> {selectedJob.job.experienceLevel}
                        {selectedJob.job.requiredExperienceYears ? ` (${selectedJob.job.requiredExperienceYears}+ yrs)` : ''}
                      </span>
                    )}
                    {selectedJob.job.employmentType && (
                      <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-900 border border-white/5 text-[10px] text-neutral-300 font-semibold">
                        <Briefcase className="w-3 h-3 text-neutral-500" /> {selectedJob.job.employmentType}
                      </span>
                    )}
                    {selectedJob.job.industry && (
                      <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-900 border border-white/5 text-[10px] text-neutral-300 font-semibold">
                        <Tag className="w-3 h-3 text-neutral-500" /> {selectedJob.job.industry}
                      </span>
                    )}
                    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border ${SOURCE_COLORS[selectedJob.job.source] || 'bg-neutral-800 text-neutral-400 border-white/5'}`}>
                      via {selectedJob.job.source}
                    </span>
                    {(selectedJob.job.postedDate || selectedJob.job.createdAt) && (
                      <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-900 border border-white/5 text-[10px] text-neutral-400 font-semibold">
                        <Clock className="w-3 h-3" /> {timeAgo(selectedJob.job.postedDate || selectedJob.job.createdAt)}
                      </span>
                    )}
                  </div>

                  {/* Salary */}
                  {formatSalary(selectedJob.job) && (
                    <div className="mt-3 flex items-center gap-1.5">
                      <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-xs text-emerald-300 font-bold">
                        {formatSalary(selectedJob.job)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Required Skills */}
                {selectedJob.job.requiredSkills && selectedJob.job.requiredSkills.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">Required Skills</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedJob.job.requiredSkills.map((skill, i) => (
                        <span key={i} className="px-2.5 py-1 rounded-lg bg-purple-500/10 border border-purple-500/20 text-[10px] text-purple-300 font-semibold">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Preferred Skills */}
                {selectedJob.job.preferredSkills && selectedJob.job.preferredSkills.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">Preferred Skills</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedJob.job.preferredSkills.map((skill, i) => (
                        <span key={i} className="px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-[10px] text-indigo-300 font-semibold">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Benefits */}
                {selectedJob.job.benefits && selectedJob.job.benefits.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">Benefits</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedJob.job.benefits.map((b, i) => (
                        <span key={i} className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-300 font-semibold capitalize">
                          {b.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* AI Compatibility Section */}
                {selectedJob.match ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in">
                    <div className="p-4 rounded-xl border border-white/5 bg-zinc-950/40 space-y-3">
                      <h4 className="text-xs font-bold text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Zap className="w-4 h-4 text-purple-400" /> AI Compatibility Assessment
                      </h4>
                      <p className="text-xs text-neutral-300 leading-relaxed">
                        {selectedJob.match.reasoning}
                      </p>
                      <div className="pt-2 flex items-center gap-6 text-xs">
                        <div>
                          <span className="text-neutral-500 block text-[9px] uppercase tracking-wider">Fit Score</span>
                          <strong className="text-lg text-white font-bold">{selectedJob.match.matchScore}%</strong>
                        </div>
                        <div>
                          <span className="text-neutral-500 block text-[9px] uppercase tracking-wider">Action</span>
                          <strong className={`text-xs uppercase font-extrabold ${selectedJob.match.recommendation === 'Apply' ? 'text-emerald-400' : 'text-amber-400'}`}>
                            {selectedJob.match.recommendation}
                          </strong>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl border border-white/5 bg-zinc-950/40 space-y-3">
                      <h4 className="text-xs font-bold text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Check className="w-4 h-4 text-emerald-400" /> Key Alignments
                      </h4>
                      <ul className="space-y-1.5 text-xs text-neutral-300">
                        {selectedJob.match.pros.map((pro, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <span className="text-emerald-400 shrink-0 mt-0.5">✓</span>
                            <span>{pro}</span>
                          </li>
                        ))}
                      </ul>
                      {selectedJob.match.cons.length > 0 && (
                        <>
                          <h4 className="text-xs font-bold text-purple-400 uppercase tracking-wider pt-2 flex items-center gap-1.5">
                            <X className="w-3.5 h-3.5 text-amber-500" /> Considerations
                          </h4>
                          <ul className="space-y-1.5 text-xs text-neutral-300">
                            {selectedJob.match.cons.map((con, i) => (
                              <li key={i} className="flex items-start gap-1.5">
                                <span className="text-amber-500 shrink-0 mt-0.5">!</span>
                                <span>{con}</span>
                              </li>
                            ))}
                          </ul>
                        </>
                      )}
                      {selectedJob.match.missingSkills.length > 0 && (
                        <>
                          <h4 className="text-xs font-bold text-red-400 uppercase tracking-wider pt-2">Missing Skills</h4>
                          <div className="flex flex-wrap gap-1">
                            {selectedJob.match.missingSkills.map((skill, i) => (
                              <span key={i} className="px-2 py-0.5 rounded bg-red-500/10 border border-red-500/20 text-[10px] text-red-300 font-semibold">
                                {skill}
                              </span>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="p-6 rounded-xl border border-dashed border-purple-500/20 bg-purple-500/5 text-center space-y-3 animate-fade-in">
                    <Zap className="w-8 h-8 text-purple-400 mx-auto animate-pulse" />
                    <div>
                      <h4 className="font-bold text-sm text-white">AI Compatibility Score Pending</h4>
                      <p className="text-xs text-neutral-400 mt-1 max-w-md mx-auto">
                        Evaluate how well your resume matches this job and discover missing skills.
                      </p>
                    </div>
                    <button
                      onClick={() => handleCalculateMatch(selectedJob.job._id)}
                      disabled={matchingId !== null}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-neutral-800 text-white font-bold text-xs rounded-lg transition inline-flex items-center gap-1.5 cursor-pointer shadow-md shadow-purple-500/10"
                    >
                      {matchingId === selectedJob.job._id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5 text-purple-200" />
                      )}
                      {matchingId === selectedJob.job._id ? 'Analyzing Resume Alignment...' : 'Calculate Compatibility'}
                    </button>
                  </div>
                )}

                {/* Job Description */}
                <div>
                  <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">Job Description</h4>
                  <div className="text-xs text-neutral-300 bg-neutral-950/40 p-5 rounded-xl border border-white/5 max-h-[400px] overflow-y-auto font-sans">
                    {formatDescription(selectedJob.job.description)}
                  </div>
                </div>

              </div>
            ) : (
              <div className="text-center py-24 text-neutral-500 flex flex-col items-center justify-center gap-3">
                <Briefcase className="w-12 h-12 text-neutral-600 animate-pulse" />
                <p className="text-sm">Select a job from the queue to inspect details.</p>
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
