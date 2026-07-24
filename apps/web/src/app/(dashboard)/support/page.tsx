'use client';

import React, { useState, useEffect } from 'react';
import { useAuth, useUser } from '@/context/FirebaseAuthContext';
import { 
  HelpCircle, 
  Send, 
  RefreshCw, 
  CheckCircle, 
  MessageSquare, 
  User as UserIcon, 
  ShieldCheck, 
  Clock,
  ChevronDown,
  ChevronUp,
  Inbox,
  AlertCircle
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface SupportCase {
  _id: string;
  category: 'Bug' | 'Feature Request' | 'Query' | 'Suggestion';
  subject: string;
  message: string;
  status: 'Open' | 'Resolved';
  adminReply?: string;
  repliedAt?: string;
  createdAt: string;
}

export default function SupportPage() {
  const { getToken } = useAuth();
  const { user } = useUser();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form State
  const [category, setCategory] = useState<'Bug' | 'Feature Request' | 'Query' | 'Suggestion'>('Query');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  // Cases State
  const [cases, setCases] = useState<SupportCase[]>([]);
  const [expandedCaseId, setExpandedCaseId] = useState<string | null>(null);

  // FAQ Accordion State
  const [expandedFaqIdx, setExpandedFaqIdx] = useState<number | null>(0);

  const faqs = [
    {
      q: "How does the ATS score calculation work?",
      a: "The ATS Score Checker simulates parsing criteria used by multi-national corporations. It analyzes section headers, structural layout (column counts), formatting details, and checks skill keyword weights against industry standards to calculate a compatibility percentage."
    },
    {
      q: "How do I configure WhatsApp notifications?",
      a: "To receive automated updates via WhatsApp, verify your phone number on the settings page. The backend uses the WhatsApp Business API to dispatch template status alerts when the AI decision engine custom-tailors and submits applications."
    },
    {
      q: "Can I scan any resume with the ATS Checker?",
      a: "Yes! The Checker is unlocked. You can drag and drop any PDF or Word resume into the uploader zone to immediately scan it and view its diagnostic scoring profile."
    },
    {
      q: "What is the response time for support cases?",
      a: "Our engineering and customer assistance teams generally review and reply to all inquiries within 24 business hours (Monday to Friday, 9:00 - 18:00 IST)."
    }
  ];

  useEffect(() => {
    fetchCases();
    markNotificationsAsRead();
  }, []);

  const fetchCases = async () => {
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/support/my-tickets`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCases(data);
      }
    } catch (err) {
      console.error('Failed to load support requests:', err);
    } finally {
      setLoading(false);
    }
  };

  const markNotificationsAsRead = async () => {
    try {
      const token = await getToken();
      await fetch(`${API_BASE}/support/notifications/read`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (err) {
      console.error('Failed to dismiss notifications:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFeedbackMsg(null);

    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/support`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          category,
          subject,
          message,
          email: user?.primaryEmailAddress?.emailAddress || 'jobcopilot.ai@gmail.com'
        })
      });

      if (res.ok) {
        setFeedbackMsg({ type: 'success', text: 'Support request submitted successfully!' });
        setSubject('');
        setMessage('');
        await fetchCases();
      } else {
        setFeedbackMsg({ type: 'error', text: 'Failed to submit request. Please try again.' });
      }
    } catch (err) {
      console.error('Failed to submit support case:', err);
      setFeedbackMsg({ type: 'error', text: 'Network error. Please try again later.' });
    } finally {
      setSubmitting(false);
    }
  };

  const toggleFaq = (idx: number) => {
    setExpandedFaqIdx(prev => (prev === idx ? null : idx));
  };

  const toggleCase = (caseId: string) => {
    setExpandedCaseId(prev => (prev === caseId ? null : caseId));
  };

  return (
    <div className="space-y-8 flex-1 w-full relative z-10">
      {/* Header */}
      <div className="pb-4 border-b border-zinc-800/80 flex justify-between items-center">
        <div>
          <h1 className="text-[1.2rem] sm:text-xl md:text-2xl font-extrabold tracking-tight bg-gradient-to-r from-purple-400 via-indigo-300 to-indigo-400 bg-clip-text text-transparent flex items-center gap-2 whitespace-nowrap">
            <HelpCircle className="w-6 h-6 md:w-7 md:h-7 text-purple-500 shrink-0" />
            Help & Support Desk
          </h1>
          <p className="hidden md:block text-neutral-400 text-sm mt-1.5 leading-relaxed max-w-2xl">
            Browse frequently asked questions or submit an inquiry directly to the system administrators.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Section: Submit Support Request */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-5 rounded-2xl border border-white/[0.08] bg-zinc-950/90 backdrop-blur-xl space-y-4">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider border-b border-zinc-900 pb-2 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-purple-400" />
              Submit Inquiry
            </h2>

            {feedbackMsg && (
              <div className={`p-3 rounded-xl border text-xs ${
                feedbackMsg.type === 'success' 
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                  : 'bg-red-500/10 border-red-500/20 text-red-400'
              }`}>
                {feedbackMsg.text}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-zinc-400 text-xs font-semibold">Category Type</label>
                <select 
                  value={category} 
                  onChange={(e) => setCategory(e.target.value as any)}
                  className="bg-zinc-900 border border-white/5 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500 cursor-pointer"
                >
                  <option value="Query">🟢 General Query</option>
                  <option value="Bug">🚨 Bug Report</option>
                  <option value="Feature Request">💡 Feature Request</option>
                  <option value="Suggestion">✍️ Suggestion</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-zinc-400 text-xs font-semibold">Subject</label>
                <input placeholder="Enter subject" type="text" 
                  required 
                  value={subject} 
                  onChange={(e) => setSubject(e.target.value)} 
                  className="bg-zinc-900 border border-white/5 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-zinc-400 text-xs font-semibold">Message Description</label>
                <textarea 
                  required 
                  value={message} 
                  onChange={(e) => setMessage(e.target.value)} 
                  className="w-full h-32 bg-zinc-900 border border-white/5 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-purple-500 resize-none"
                />
              </div>

              <button 
                type="submit" 
                disabled={submitting}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold rounded-xl bg-purple-500 hover:bg-purple-600 disabled:opacity-50 text-white transition cursor-pointer shadow-md shadow-purple-500/10"
              >
                {submitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                Submit Support Request
              </button>
            </form>
          </div>
        </div>

        {/* Right Section: Interactive FAQs Accordion */}
        <div className="lg:col-span-7 space-y-4">
          <div className="p-5 rounded-2xl border border-white/[0.08] bg-zinc-950/90 backdrop-blur-xl space-y-3">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider border-b border-zinc-900 pb-2 flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-purple-400" />
              Frequently Asked Questions
            </h2>

            <div className="space-y-2 pt-1">
              {faqs.map((faq, idx) => {
                const isExpanded = expandedFaqIdx === idx;
                return (
                  <div 
                    key={idx} 
                    className="border border-white/5 rounded-xl overflow-hidden bg-zinc-900/15"
                  >
                    <button
                      onClick={() => toggleFaq(idx)}
                      className="w-full flex items-center justify-between p-3.5 text-left text-xs font-bold text-white hover:bg-white/[0.02] transition"
                    >
                      <span>{faq.q}</span>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-purple-400" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
                    </button>
                    {isExpanded && (
                      <div className="p-3.5 pt-0 border-t border-white/5 text-[11px] text-zinc-400 leading-relaxed bg-zinc-950/20">
                        {faq.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Section: Past Cases Inbox List */}
      <div className="p-5 rounded-2xl border border-white/[0.08] bg-zinc-950/90 backdrop-blur-xl space-y-4">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider border-b border-zinc-900 pb-2 flex items-center gap-2">
          <Inbox className="w-4 h-4 text-purple-400" />
          My Support History
        </h2>

        {cases.length === 0 ? (
          <div className="p-8 text-center text-zinc-500 text-xs flex flex-col items-center gap-2">
            <Inbox className="w-8 h-8 text-zinc-700" />
            No support cases submitted yet. Use the form above to submit an inquiry.
          </div>
        ) : (
          <div className="space-y-2">
            {cases.map((c) => {
              const isExpanded = expandedCaseId === c._id;
              return (
                <div 
                  key={c._id}
                  className={`border rounded-xl transition overflow-hidden bg-zinc-900/15 ${
                    isExpanded ? 'border-purple-500/20 bg-purple-500/[0.02]' : 'border-white/5'
                  }`}
                >
                  <button
                    onClick={() => toggleCase(c._id)}
                    className="w-full flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-3 text-left hover:bg-white/[0.01] transition"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase ${
                          c.category === 'Bug' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                          c.category === 'Feature Request' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                          c.category === 'Suggestion' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                          'bg-zinc-500/10 text-zinc-300 border border-white/5'
                        }`}>
                          {c.category}
                        </span>
                        <h4 className="font-bold text-xs text-white truncate max-w-[250px]">{c.subject}</h4>
                      </div>
                      <span className="text-[10px] text-zinc-500 block">
                        Case ID: <span className="font-mono">{c._id}</span> • Submitted: {new Date(c.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-auto">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        c.status === 'Resolved' 
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                          : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      }`}>
                        {c.status}
                      </span>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-purple-400" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="p-4 pt-0 border-t border-white/5 space-y-3 bg-zinc-950/20">
                      <div className="pt-3">
                        <span className="block text-[8px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Your Message</span>
                        <p className="text-xs text-zinc-300 whitespace-pre-wrap leading-relaxed">{c.message}</p>
                      </div>

                      {c.adminReply ? (
                        <div className="p-3 rounded-xl bg-purple-500/5 border border-purple-500/10 space-y-1">
                          <span className="block text-[8px] font-bold text-purple-400 uppercase tracking-wider">System Support Response</span>
                          <p className="text-xs text-zinc-200 whitespace-pre-wrap leading-relaxed">{c.adminReply}</p>
                          {c.repliedAt && (
                            <span className="block text-[9px] text-zinc-500 font-mono mt-1">
                              Replied on: {new Date(c.repliedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="p-3 rounded-xl bg-zinc-900/40 border border-white/5 flex items-center gap-2 text-[10px] text-zinc-500">
                          <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                          <span>In progress. An assistant will review this inquiry shortly.</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="pt-3 border-t border-white/5 text-[10px] text-zinc-500 flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 text-zinc-400" />
          <span>Support operates Monday to Friday, 09:00 - 18:00 IST. Urgent bug inquiries are automatically flagged for prioritised routing.</span>
        </div>
      </div>
    </div>
  );
}