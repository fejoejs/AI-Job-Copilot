'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/FirebaseAuthContext';
import { Globe, ArrowRight, Check, X, ShieldAlert, RefreshCw, Briefcase, MapPin, DollarSign, LayoutGrid, List } from 'lucide-react';

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

interface ExternalJob {
  _id: string;
  title: string;
  company: string;
  location?: string;
  salary?: string;
  shortDescription?: string;
  url: string;
  sourcePlatform: 'LinkedIn' | 'Indeed' | 'Naukri';
  lastSeenAt: string;
}

export default function ExternalBoardsPage() {
  const { getToken, user, loading: authLoading } = useAuth();
  const [jobs, setJobs] = useState<ExternalJob[]>([]);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'All' | 'Naukri' | 'LinkedIn' | 'Indeed'>('All');
  const [layoutMode, setLayoutMode] = useState<'grid' | 'list'>('list');

  const fetchJobs = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/external-board/list`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setJobs(data || []);
      } else {
        setError('Failed to fetch sourced jobs. Please try again.');
      }
    } catch (err) {
      console.error('Failed to load external jobs:', err);
      setError('Connection failed. Verify the server is active.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && user) {
      fetchJobs();
    }
  }, [authLoading, user]);

  // When user switches back to this tab, we keep the pending state active so they see the ✓ / ✗ prompts
  useEffect(() => {
    const handleFocus = () => {
      // Prompt remains visible on focus
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  const handleApplyClick = async (job: ExternalJob) => {
    try {
      const token = await getToken();
      await fetch(`${API_BASE}/external-board/${job._id}/mark-pending`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      setPendingIds(prev => {
        const next = new Set(prev);
        next.add(job._id);
        return next;
      });
      window.open(job.url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      console.error('Failed to mark job as pending:', err);
    }
  };

  const confirmApplied = async (id: string) => {
    try {
      const token = await getToken();
      await fetch(`${API_BASE}/external-board/${id}/confirm-applied`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      setPendingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setJobs(prev => prev.filter(j => j._id !== id));
    } catch (err) {
      console.error('Failed to confirm job application:', err);
    }
  };

  const confirmNotApplied = async (id: string) => {
    try {
      const token = await getToken();
      await fetch(`${API_BASE}/external-board/${id}/confirm-not-applied`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      setPendingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch (err) {
      console.error('Failed to cancel job application status:', err);
    }
  };

  const getPlatformBadgeColor = (platform: string) => {
    switch (platform) {
      case 'LinkedIn':
        return 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
      case 'Indeed':
        return 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20';
      case 'Naukri':
        return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
      default:
        return 'bg-neutral-800 text-neutral-400 border border-white/5';
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <RefreshCw className="w-8 h-8 text-purple-500 animate-spin" />
        <span className="text-sm text-zinc-400 font-medium">Loading External Boards...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8 flex-1 w-full">
      <div className="flex justify-between items-start flex-wrap gap-4">
        <div>
          <h1 className="text-[1.2rem] sm:text-2xl md:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-purple-400 via-indigo-300 to-indigo-400 bg-clip-text text-transparent flex items-center gap-2 whitespace-nowrap">
            <Globe className="w-6 h-6 md:w-8 md:h-8 text-purple-400 shrink-0" />
            External Sourced Jobs
          </h1>
          <p className="hidden md:block text-neutral-400 text-sm mt-1.5 leading-relaxed max-w-2xl">
            Jobs discovered passively by you and other users browsing LinkedIn, Indeed, and Naukri.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-zinc-900 border border-white/5 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setLayoutMode('list')}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                layoutMode === 'list' 
                  ? 'bg-purple-500/20 text-purple-400' 
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
              title="Compact List View"
              aria-label="List View"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setLayoutMode('grid')}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                layoutMode === 'grid' 
                  ? 'bg-purple-500/20 text-purple-400' 
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
              title="Grid Cards View"
              aria-label="Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
          <button 
            type="button"
            onClick={fetchJobs}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900 border border-white/5 hover:bg-zinc-800 text-xs font-semibold transition cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh Pool
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-red-950/10 border border-red-500/20 text-xs text-red-400">
          {error}
        </div>
      )}

      {/* Platform Filter Tabs */}
      <div className="flex gap-2 border-b border-white/5 pb-px overflow-x-auto scrollbar-hide">
        {(['All', 'Naukri', 'LinkedIn', 'Indeed'] as const).map(tab => {
          const isActive = activeTab === tab;
          const count = tab === 'All' 
            ? jobs.length 
            : jobs.filter(j => j.sourcePlatform === tab).length;
          
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 px-4 text-xs font-semibold border-b-2 transition-all cursor-pointer relative whitespace-nowrap ${
                isActive 
                  ? 'border-purple-500 text-purple-400 font-bold' 
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {tab === 'All' ? 'All Platforms' : tab}
              <span className={`ml-2 px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                isActive 
                  ? 'bg-purple-500/20 text-purple-300' 
                  : 'bg-zinc-900 text-zinc-500'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {(() => {
        const filteredJobs = activeTab === 'All'
          ? jobs
          : jobs.filter(j => j.sourcePlatform === activeTab);

        if (filteredJobs.length === 0) {
          return (
            <div className="text-center py-24 glass-card space-y-4">
              <Briefcase className="w-16 h-16 text-zinc-700 mx-auto animate-pulse" />
              <div>
                <h3 className="text-base font-bold text-white uppercase tracking-wider">
                  No {activeTab !== 'All' ? activeTab : ''} jobs matched
                </h3>
                <p className="text-xs text-neutral-500 mt-1 max-w-md mx-auto">
                  Match recommendations from passive Chrome Extension browsing will appear here. Build/verify the Chrome Extension and browse jobs on LinkedIn/Indeed/Naukri.
                </p>
              </div>
            </div>
          );
        }

        if (layoutMode === 'list') {
          return (
            <div className="space-y-3">
              {filteredJobs.map(job => (
                <div 
                  key={job._id} 
                  className="glass-card p-4 flex flex-col md:grid md:grid-cols-[100px_3fr_2fr_160px] items-start md:items-center justify-between gap-4 hover:border-purple-500/20 transition-all duration-300 animate-in fade-in slide-in-from-bottom-2 duration-200"
                >
                  {/* Column 1: Platform Badge */}
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 w-[80px] text-center ${getPlatformBadgeColor(job.sourcePlatform)}`}>
                    {job.sourcePlatform}
                  </span>

                  {/* Column 2: Title & Company */}
                  <div className="min-w-0 pr-2">
                    <h3 className="font-bold text-sm text-white truncate leading-snug">{job.title}</h3>
                    <p className="text-xs text-purple-400/90 font-semibold truncate mt-0.5">{job.company}</p>
                  </div>

                  {/* Column 3: Location */}
                  <div className="flex items-center gap-2 text-xs text-zinc-400 min-w-0 w-full md:w-auto">
                    <MapPin className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                    <span className="truncate">{job.location || 'Remote'}</span>
                  </div>

                  {/* Column 4: Actions & Seen Date */}
                  <div className="flex items-center gap-3 justify-end w-full md:w-auto border-t md:border-t-0 border-white/5 pt-3 md:pt-0 shrink-0">
                    <span className="text-[10px] text-zinc-500 font-medium hidden lg:inline">
                      Seen {new Date(job.lastSeenAt).toLocaleDateString()}
                    </span>

                    {pendingIds.has(job._id) ? (
                      <div className="flex items-center gap-2 bg-zinc-900 border border-white/10 p-1.5 rounded-xl">
                        <span className="text-[10px] font-bold text-zinc-400 px-1.5">Did you apply?</span>
                        <button 
                          onClick={() => confirmApplied(job._id)}
                          className="p-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg border border-emerald-500/20 transition cursor-pointer"
                          title="Confirmed Applied"
                          aria-label="Confirm Applied"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => confirmNotApplied(job._id)}
                          className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg border border-red-500/20 transition cursor-pointer"
                          title="Not Applied"
                          aria-label="Cancel Pending State"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button 
                        onClick={() => handleApplyClick(job)}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition cursor-pointer shadow-lg shadow-purple-500/10 hover:shadow-purple-500/20"
                      >
                        Apply
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          );
        }

        return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredJobs.map(job => (
              <div key={job._id} className="glass-card p-6 flex flex-col justify-between h-full hover:border-purple-500/30 transition-all duration-300 animate-in fade-in slide-in-from-bottom-2 duration-200">
                <div className="space-y-4">
                  <div className="flex justify-between items-start gap-3">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${getPlatformBadgeColor(job.sourcePlatform)}`}>
                      {job.sourcePlatform}
                    </span>
                    <span className="text-[10px] text-zinc-500 font-medium">
                      Seen {new Date(job.lastSeenAt).toLocaleDateString()}
                    </span>
                  </div>

                  <div>
                    <h3 className="font-bold text-base text-white line-clamp-1 leading-snug">{job.title}</h3>
                    <p className="text-xs font-semibold text-purple-400/90 mt-1">{job.company}</p>
                  </div>

                  <div className="space-y-2 border-t border-white/5 pt-3">
                    {job.location && (
                      <div className="flex items-center gap-2 text-xs text-zinc-400">
                        <MapPin className="w-3.5 h-3.5 text-zinc-500" />
                        <span>{job.location}</span>
                      </div>
                    )}
                    {job.salary && (
                      <div className="flex items-center gap-2 text-xs text-zinc-400 font-mono">
                        <DollarSign className="w-3.5 h-3.5 text-zinc-500" />
                        <span>{job.salary}</span>
                      </div>
                    )}
                  </div>

                  {job.shortDescription && (
                    <div className="text-xs text-neutral-400 bg-neutral-950/40 p-3 rounded-xl border border-white/5 leading-relaxed font-sans line-clamp-3 overflow-hidden whitespace-pre-wrap">
                      {formatDescription(job.shortDescription)}
                    </div>
                  )}
                </div>

                <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-end">
                  {pendingIds.has(job._id) ? (
                    <div className="flex items-center gap-2 bg-zinc-900 border border-white/10 p-1.5 rounded-xl animate-in fade-in zoom-in-95 duration-200">
                      <span className="text-[10px] font-bold text-zinc-400 px-2">Did you apply?</span>
                      <button 
                        onClick={() => confirmApplied(job._id)}
                        className="p-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg border border-emerald-500/20 transition cursor-pointer"
                        title="Confirmed Applied"
                        aria-label="Confirm Applied"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={() => confirmNotApplied(job._id)}
                        className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg border border-red-500/20 transition cursor-pointer"
                        title="Not Applied"
                        aria-label="Cancel Pending State"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={() => handleApplyClick(job)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition cursor-pointer shadow-lg shadow-purple-500/10 hover:shadow-purple-500/20"
                    >
                      Apply on {job.sourcePlatform}
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );
}
