'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/FirebaseAuthContext';
import { 
  Upload, 
  FileText, 
  CheckCircle, 
  AlertCircle, 
  RefreshCw, 
  Cpu, 
  Brain,
  X,
  Briefcase,
  ExternalLink
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function ResumePage() {
  const { getToken } = useAuth();
  
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [resumeId, setResumeId] = useState<string>('');
  const [resumeName, setResumeName] = useState<string>('');
  const [profile, setProfile] = useState<any>(null);
  const [atsScore, setAtsScore] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLatest();
  }, []);

  const fetchLatest = async () => {
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/resume/latest`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.parsedProfile) {
          setProfile(data.parsedProfile);
          setResumeId(data._id || data.id);
          setResumeName(data.originalFileName || 'Resume');
          setAtsScore(data.atsScore || 0);
        } else {
          setProfile(null);
        }
      } else {
        const errorData = await res.json().catch(() => ({}));
        if (res.status !== 404) {
          setError(errorData.message || 'Unable to load your resume. Please try again.');
        }
        setProfile(null);
      }
    } catch (err) {
      console.error('Failed to load latest resume profile:', err);
      setError('Connection failed. Please verify API server is running.');
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  const pollResumeStatus = async (targetResumeId: string) => {
    setParsing(true);
    let parsed = false;
    let attempts = 0;
    
    try {
      const token = await getToken();
      while (!parsed && attempts < 45) {
        await new Promise(r => setTimeout(r, 2000));
        attempts++;
        try {
          const checkRes = await fetch(`${API_BASE}/resume/${targetResumeId}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (checkRes.ok) {
            const checkData = await checkRes.json();
            if (checkData.parsedProfile) {
              if (checkData.parsedProfile.error) {
                setError(`Parsing failed: ${checkData.parsedProfile.message}`);
                parsed = false;
                break;
              }
              parsed = true;
              setProfile(checkData.parsedProfile);
              setResumeId(checkData._id || checkData.id);
              setResumeName(checkData.originalFileName || 'Resume');
              setAtsScore(checkData.atsScore || 0);
            }
          }
        } catch (e) {
          console.warn('Status poll attempt failed:', e);
        }
      }

      if (parsed) {
        setSuccess(true);
        localStorage.setItem('resumeUploaded', 'true');
        // Reload page to refresh active sidebar locks
        window.location.reload();
      } else {
        setError('Resume parsing timed out. Please try uploading again.');
      }
    } catch (err) {
      console.error('Error during parsing check:', err);
      setError('Connection interrupted during parsing.');
    } finally {
      setParsing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
      setSuccess(false);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setUploading(true);
    setError(null);
    setSuccess(false);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/resume/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!res.ok) {
        throw new Error('Upload failed on server.');
      }

      const resData = await res.json();
      setResumeId(resData.resumeId);
      setResumeName(resData.originalFileName || file.name);

      // Begin active status polling
      await pollResumeStatus(resData.resumeId);
    } catch (err) {
      console.error('Upload request failed:', err);
      setError(err instanceof Error ? err.message : 'Upload failed. Check your connection.');
    } finally {
      setUploading(false);
    }
  };

  const deleteResume = async () => {
    if (!resumeId) return;
    setLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/resume/${resumeId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        setProfile(null);
        setResumeId('');
        setResumeName('');
        setFile(null);
        localStorage.removeItem('resumeUploaded');
        // Reload to update sidebar locks
        window.location.reload();
      } else {
        setError('Failed to delete resume from server.');
      }
    } catch (err) {
      console.error('Failed to delete resume:', err);
      setError('Connection error during deletion.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <RefreshCw className="w-8 h-8 text-purple-500 animate-spin" />
        <span className="text-sm text-zinc-400 font-medium">Loading Resume Optimizer...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8 flex-1">
      <div>
        <h1 className="text-[1.3rem] sm:text-2xl md:text-3xl font-bold tracking-tight bg-gradient-to-r from-purple-400 via-indigo-300 to-indigo-400 bg-clip-text text-transparent whitespace-nowrap flex items-center gap-2">
          <FileText className="w-5 h-5 md:w-6 md:h-6 text-purple-400 shrink-0" />
          Resume Optimizer
        </h1>
        <p className="hidden md:block text-neutral-400 text-sm mt-1.5 leading-relaxed max-w-2xl">Upload your resume to extract structure <br className="block sm:hidden" /> and enable automatic tailoring.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Side: Upload & Target Metadata card */}
        <div className="space-y-6 lg:col-span-1">
          
          {/* Upload card */}
          <div className="glass-card p-6 h-fit">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <Upload className="w-5 h-5 text-purple-400" /> Upload Resume
            </h3>

            <form onSubmit={handleUpload} className="space-y-4">
              <div className="border border-dashed border-white/10 rounded-2xl p-8 flex flex-col items-center justify-center bg-neutral-950/40 relative group hover:border-purple-500/30 transition">
                <input
                  type="file"
                  accept=".pdf,.docx"
                  onChange={handleFileChange}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <FileText className="w-10 h-10 text-neutral-500 mb-3 group-hover:text-purple-400 transition" />
                <p className="text-xs font-semibold text-center text-neutral-300">
                  {file ? file.name : 'Select or drag PDF / DOCX'}
                </p>
                <p className="text-[10px] text-neutral-500 text-center mt-1">Max file size 5MB</p>
              </div>

              <button
                type="submit"
                disabled={!file || uploading || parsing}
                className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:bg-neutral-800 disabled:text-neutral-500 disabled:cursor-not-allowed text-white font-bold transition flex items-center justify-center gap-2 cursor-pointer"
              >
                {uploading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Uploading resume...
                  </>
                ) : parsing ? (
                  <>
                    <Cpu className="w-4 h-4 animate-spin" /> Claude parsing resume...
                  </>
                ) : (
                  'Upload and Parse Resume'
                )}
              </button>
            </form>

            {/* Status indicators */}
            {success && (
              <div className="mt-4 p-3 rounded-xl bg-green-500/10 border border-green-500/20 text-xs text-green-400 flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                <span>Resume parsed successfully!</span>
              </div>
            )}
            {error && (
              <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* Active Target Document Card with X delete button */}
          {resumeName && (
            <div className="p-5 rounded-xl border border-white/5 bg-zinc-950/65 flex items-start justify-between gap-3 relative">
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <div className="p-2.5 rounded-lg bg-purple-500/10 border border-purple-500/20 shrink-0">
                  <FileText className="w-5 h-5 text-purple-400" />
                </div>
                <div className="min-w-0 flex-1 pr-4">
                  <span className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider block">Active Optimizer Resume</span>
                  <h4 className="font-bold text-xs text-white truncate" title={resumeName}>{resumeName}</h4>
                  <span className="text-[9px] text-emerald-400 font-semibold mt-0.5 block">Used for job applications</span>
                  {atsScore > 0 && (
                    <div className="mt-3 pt-2 border-t border-white/5 space-y-1.5">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-zinc-400 font-medium">Accurate ATS Score</span>
                        <span className="text-purple-400 font-bold">{atsScore}%</span>
                      </div>
                      <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                        <div 
                          className="bg-gradient-to-r from-purple-500 to-indigo-500 h-full rounded-full transition-all duration-500" 
                          style={{ width: `${atsScore}%` }} 
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <button 
                onClick={deleteResume}
                className="p-1 rounded-md text-zinc-500 hover:text-white hover:bg-white/5 transition"
                title="Delete optimizer resume"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Right Side: Profile structured display */}
        <div className="glass-card p-6 lg:col-span-2 space-y-6">
          <div className="flex justify-between items-center border-b border-white/5 pb-4">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <Brain className="w-5 h-5 text-purple-400" /> Extracted Profile Schema
            </h3>
            {profile && (
              <span className="text-xs text-neutral-500">
                Candidate: <strong className="text-neutral-300">{profile.fullName}</strong>
              </span>
            )}
          </div>

          {!profile ? (
            <div className="text-center py-20 text-neutral-500 space-y-3">
              <Brain className="w-12 h-12 text-neutral-600 mx-auto animate-pulse" />
              <p className="text-sm">No resume profile loaded. Upload your resume to view structured data.</p>
            </div>
          ) : (
            <div className="space-y-6 text-sm">
              
              {/* Header Info */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-b border-white/5 pb-4 text-xs">
                <div>
                  <span className="text-neutral-500 block">Name</span>
                  <span className="font-bold text-white text-sm">{profile.fullName}</span>
                </div>
                <div>
                  <span className="text-neutral-500 block">Email</span>
                  <span className="font-semibold text-white">{profile.email}</span>
                </div>
                <div>
                  <span className="text-neutral-500 block">Phone</span>
                  <span className="font-semibold text-white">{profile.phone}</span>
                </div>
              </div>

              {/* Links & Profiles */}
              {profile.links && (profile.links.linkedin || profile.links.github || profile.links.portfolio || (profile.links.other && profile.links.other.length > 0)) && (
                <div className="border-b border-white/5 pb-4">
                  <h4 className="text-xs font-bold text-purple-400 uppercase tracking-wider mb-2">Links & Social Profiles</h4>
                  <div className="flex flex-wrap gap-4 text-xs">
                    {profile.links.linkedin && (
                      <a 
                        href={profile.links.linkedin.startsWith('http') ? profile.links.linkedin : `https://${profile.links.linkedin}`} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="text-indigo-400 hover:underline flex items-center gap-1 font-semibold"
                      >
                        LinkedIn <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    {profile.links.github && (
                      <a 
                        href={profile.links.github.startsWith('http') ? profile.links.github : `https://${profile.links.github}`} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="text-indigo-400 hover:underline flex items-center gap-1 font-semibold"
                      >
                        GitHub <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    {profile.links.portfolio && (
                      <a 
                        href={profile.links.portfolio.startsWith('http') ? profile.links.portfolio : `https://${profile.links.portfolio}`} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="text-indigo-400 hover:underline flex items-center gap-1 font-semibold"
                      >
                        Portfolio <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    {Array.isArray(profile.links.other) && profile.links.other.map((link: string, idx: number) => {
                      if (!link) return null;
                      return (
                        <a 
                          key={idx} 
                          href={link.startsWith('http') ? link : `https://${link}`} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="text-zinc-400 hover:underline flex items-center gap-1"
                        >
                          Link <ExternalLink className="w-3 h-3" />
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Summary */}
              <div>
                <h4 className="text-xs font-bold text-purple-400 uppercase tracking-wider mb-2">Professional Summary</h4>
                <p className="text-neutral-300 leading-relaxed bg-neutral-950/40 p-4 rounded-xl border border-white/5">
                  {profile.summary}
                </p>
              </div>

              {/* Skills */}
              <div>
                <h4 className="text-xs font-bold text-purple-400 uppercase tracking-wider mb-2">Technical Skills</h4>
                <div className="flex flex-wrap gap-2">
                  {Array.isArray(profile.skills) && profile.skills.map((skill: string) => (
                    <span key={skill} className="px-2.5 py-1 rounded-lg bg-neutral-900 border border-white/5 text-xs text-neutral-300">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>

              {/* Certifications */}
              {profile.certifications && profile.certifications.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-purple-400 uppercase tracking-wider mb-2">Certifications</h4>
                  <div className="flex flex-wrap gap-2">
                    {Array.isArray(profile.certifications) && profile.certifications.map((cert: string) => (
                      <span key={cert} className="px-2.5 py-1 rounded-lg bg-neutral-900 border border-purple-500/10 text-xs text-indigo-300 font-medium">
                        {cert}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Projects section */}
              {profile.projects && profile.projects.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-purple-400 uppercase tracking-wider mb-3">Projects</h4>
                  <div className="space-y-4">
                    {Array.isArray(profile.projects) && profile.projects.map((proj: any, idx: number) => (
                      <div key={idx} className="border-l-2 border-indigo-500/20 pl-4 space-y-1">
                        <div className="flex justify-between items-baseline flex-wrap">
                          <h5 className="font-bold text-white">{proj.title}</h5>
                          {proj.url && (
                            <a 
                              href={proj.url.startsWith('http') ? proj.url : `https://${proj.url}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[10px] text-purple-400 hover:underline flex items-center gap-1 shrink-0"
                            >
                              View Project <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          )}
                        </div>
                        <p className="text-neutral-400 text-xs mt-1">{proj.description}</p>
                        {proj.technologies && proj.technologies.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {Array.isArray(proj.technologies) && proj.technologies.map((tech: string) => (
                              <span key={tech} className="px-1.5 py-0.5 rounded bg-neutral-900 border border-white/5 text-[9px] text-neutral-400">
                                {tech}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Work Experience */}
              <div>
                <h4 className="text-xs font-bold text-purple-400 uppercase tracking-wider mb-3">Work Experience</h4>
                <div className="space-y-4">
                  {Array.isArray(profile.experience) && profile.experience.map((exp: any, i: number) => (
                    <div key={i} className="border-l-2 border-purple-500/20 pl-4 space-y-1">
                      <div className="flex justify-between items-baseline flex-wrap">
                        <h5 className="font-bold text-white">{exp.title}</h5>
                        <span className="text-xs text-neutral-500">{exp.startDate} - {exp.endDate}</span>
                      </div>
                      <p className="text-xs text-purple-300 font-semibold">{exp.company} &bull; {exp.location}</p>
                      <p className="text-neutral-400 text-xs mt-1">{exp.description}</p>
                      {exp.achievements && exp.achievements.length > 0 && (
                        <ul className="list-disc list-inside text-xs text-neutral-400 mt-2 space-y-1.5 pl-2">
                          {Array.isArray(exp.achievements) && exp.achievements.map((ach: string, idx: number) => (
                            <li key={idx} className="leading-relaxed">{ach}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Education */}
              {profile.education && profile.education.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-purple-400 uppercase tracking-wider mb-2">Education</h4>
                  <div className="space-y-2">
                    {Array.isArray(profile.education) && profile.education.map((edu: any, i: number) => (
                      <div key={i} className="text-xs">
                        <div className="flex justify-between items-baseline">
                          <strong className="text-white">{edu.degree}</strong>
                          <span className="text-neutral-500">{edu.graduationYear}</span>
                        </div>
                        <p className="text-neutral-400">{edu.institution} &bull; {edu.location}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
