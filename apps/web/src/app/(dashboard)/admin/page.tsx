'use client';

import React, { useEffect, useState } from 'react';
import { useAuth, useUser } from '@/context/FirebaseAuthContext';
import { 
  ShieldAlert, 
  Settings, 
  Cpu, 
  MessageSquare, 
  Mail, 
  Database, 
  Users, 
  Save, 
  Trash2, 
  ShieldCheck, 
  RefreshCw, 
  Lock, 
  CheckCircle, 
  XCircle,
  HelpCircle,
  Send,
  Clock,
  ChevronDown,
  ChevronUp,
  Sliders,
  AlertTriangle
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface DBUser {
  _id: string;
  email: string;
  name?: string;
  phone?: string;
  role: 'user' | 'admin';
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  createdAt: string;
}

interface ConfigItem {
  key: string;
  value: string;
  description?: string;
}

interface Ticket {
  _id: string;
  userId: string;
  email: string;
  subject: string;
  message: string;
  category: 'Bug' | 'Feature Request' | 'Query' | 'Suggestion';
  status: 'Open' | 'Resolved';
  adminReply?: string;
  repliedAt?: string;
  createdAt: string;
}

export default function AdminPage() {
  const { getToken } = useAuth();
  const { user, isLoaded } = useUser();
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState<'ai' | 'whatsapp' | 'email' | 'jobboards' | 'active-apis' | 'users' | 'tickets' | 'db-actions' | 'scraper-health' | 'features'>('ai');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Custom Confirm Modal State
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    isDanger?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
  }>({
    isOpen: false, title: '', message: '', onConfirm: () => {}, onCancel: () => {}
  });

  const confirmAction = async (title: string, message: string, isDanger = false): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmDialog({
        isOpen: true,
        title,
        message,
        isDanger,
        onConfirm: () => {
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
          resolve(true);
        },
        onCancel: () => {
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
          resolve(false);
        }
      });
    });
  };
  
  // Database management states
  const [dbStats, setDbStats] = useState<any>(null);
  const [storageStats, setStorageStats] = useState<any>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [browseResults, setBrowseResults] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [browseSource, setBrowseSource] = useState<'tier1-3' | 'external-board'>('tier1-3');
  const [browsePage, setBrowsePage] = useState(1);

  // Scraper Health logs states
  const [scraperStats, setScraperStats] = useState<any>(null);
  const [scraperLoading, setScraperLoading] = useState(false);

  const [staleHours, setStaleHours] = useState(24);
  const [closedDays, setClosedDays] = useState(30);
  const [purgeCompanySlug, setPurgeCompanySlug] = useState('');
  const [purgePlatformSelected, setPurgePlatformSelected] = useState<'LinkedIn' | 'Indeed' | 'Naukri'>('LinkedIn');

  const fetchScraperStats = async () => {
    setScraperLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/admin/db/scraper-stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setScraperStats(await res.json());
      }
    } catch (err) {
      console.error('Failed to fetch scraper statistics logs:', err);
    } finally {
      setScraperLoading(false);
    }
  };

  const handleTriggerScraper = async () => {
    if (!(await confirmAction('Trigger Scraper', 'Are you sure you want to trigger background scraper crawls immediately? This consumes API credits.', false))) return;
    setActionLoading('trigger-scraper');
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/admin/db/scraper-trigger`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        showFeedback('success', 'Background scraper crawls triggered successfully! Log results will populate in a few moments.');
        fetchScraperStats();
      } else {
        showFeedback('error', 'Failed to trigger background crawl.');
      }
    } catch (err) {
      console.error(err);
      showFeedback('error', 'Network error.');
    } finally {
      setActionLoading(null);
    }
  };

  const fetchDbAll = async () => {
    setStatsLoading(true);
    try {
      const token = await getToken();
      const [statsRes, storageRes] = await Promise.all([
        fetch(`${API_BASE}/admin/db/stats`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE}/admin/db/storage-stats`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      if (statsRes.ok) {
        setDbStats(await statsRes.json());
      }
      if (storageRes.ok) {
        setStorageStats(await storageRes.json());
      }
    } catch (err) {
      console.error('Failed to load database stats:', err);
    } finally {
      setStatsLoading(false);
    }
  };

  const browseJobs = async (page = 1) => {
    setBrowsePage(page);
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/admin/db/jobs?search=${encodeURIComponent(searchTerm)}&source=${browseSource}&page=${page}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setBrowseResults(await res.json());
      }
    } catch (err) {
      console.error('Failed to browse jobs:', err);
    }
  };

  const deleteOneJob = async (id: string) => {
    if (!(await confirmAction('Delete Job', 'Delete this job permanently?', true))) return;
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/admin/db/job/${id}?source=${browseSource}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        showFeedback('success', 'Job deleted successfully.');
        browseJobs(browsePage);
        fetchDbAll();
      } else {
        showFeedback('error', 'Failed to delete job.');
      }
    } catch (err) {
      console.error(err);
      showFeedback('error', 'Network error.');
    }
  };

  useEffect(() => {
    if (activeTab === 'db-actions') {
      fetchDbAll();
      browseJobs(1);
    }
    if (activeTab === 'scraper-health') {
      fetchScraperStats();
    }
  }, [activeTab, browseSource]);

  // Configurations state
  const [configs, setConfigs] = useState<{ [key: string]: string }>({
    ANTHROPIC_API_KEY: '',
    GEMINI_API_KEY: '',
    GROQ_API_KEY: '',
    WHATSAPP_ACCESS_TOKEN: '',
    WHATSAPP_PHONE_NUMBER_ID: '',
    WHATSAPP_BUSINESS_ACCOUNT_ID: '',
    SMTP_HOST: '',
    SMTP_PORT: '587',
    SMTP_USER: '',
    SMTP_PASS: '',
    EMAIL_FROM_ADDRESS: '',
    ADZUNA_API_ID: '',
    ADZUNA_API_KEY: '',
    JSEARCH_API_KEY: '',
    JOOBLE_API_KEY: '',
    CAREERJET_API_KEY: '',
    feature_ats_enabled: 'true',
    feature_optimizer_enabled: 'true',
  });

  const [apiIntegrations, setApiIntegrations] = useState<any[]>([]);

  // Users & Tickets state
  const [users, setUsers] = useState<DBUser[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [replyTexts, setReplyTexts] = useState<{ [key: string]: string }>({});
  const [expandedTicketId, setExpandedTicketId] = useState<string | null>(null);

  useEffect(() => {
    if (isLoaded && user) {
      // Fetch data immediately. The backend AdminGuard will protect the endpoints.
      // If the backend returns 403 Forbidden, we'll know they aren't an admin.
      fetchData();
    }
  }, [isLoaded, user]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = await getToken();
      
      // Fetch configurations
      const configRes = await fetch(`${API_BASE}/admin/config`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (configRes.status === 403 || configRes.status === 401) {
        setIsAdmin(false);
        setLoading(false);
        return; // Stop loading if not admin
      }
      
      setIsAdmin(true);
      
      if (configRes.ok) {
        const configData: ConfigItem[] = await configRes.json();
        const configMap = { ...configs };
        configData.forEach(item => {
          configMap[item.key] = item.value;
        });
        setConfigs(configMap);
      }

      // Fetch users, tickets, and integrations in parallel to massively speed up page load!
      const [usersRes, ticketsRes, integrationsRes] = await Promise.all([
        fetch(`${API_BASE}/admin/users`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE}/admin/tickets`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE}/job/integrations`, { headers: { Authorization: `Bearer ${token}` } })
      ]);

      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setUsers(usersData);
      }

      if (ticketsRes.ok) {
        const ticketsData = await ticketsRes.json();
        setTickets(ticketsData);
      }

      if (integrationsRes.ok) {
        const integrationsData = await integrationsRes.json();
        setApiIntegrations(integrationsData);
      }
    } catch (err) {
      console.error('Failed to load admin data:', err);
      showFeedback('error', 'Failed to retrieve admin details. Please check the backend connectivity.');
    } finally {
      setLoading(false);
    }
  };

  const refreshIntegrations = async () => {
    try {
      const token = await getToken();
      const integrationsRes = await fetch(`${API_BASE}/job/integrations`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (integrationsRes.ok) {
        const integrationsData = await integrationsRes.json();
        setApiIntegrations(integrationsData);
      }
    } catch (err) {
      console.error('Failed to refresh integrations:', err);
    }
  };

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 5000);
  };

  const saveConfig = async (key: string) => {
    setActionLoading(key);
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/admin/config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ key, value: configs[key] })
      });
      if (res.ok) {
        showFeedback('success', `Saved ${key} config override successfully!`);
        await refreshIntegrations();
      } else {
        showFeedback('error', `Failed to save ${key}. Server returned ${res.status}`);
      }
    } catch (err) {
      console.error(err);
      showFeedback('error', `Network error saving ${key}.`);
    } finally {
      setActionLoading(null);
    }
  };

  const saveConfigGroup = async (keys: string[], groupName: string) => {
    setActionLoading(groupName);
    try {
      const token = await getToken();
      const savePromises = keys.map(key => 
        fetch(`${API_BASE}/admin/config`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ key, value: configs[key] || '' })
        })
      );
      
      const results = await Promise.all(savePromises);
      const allSuccess = results.every(res => res.ok);
      
      if (allSuccess) {
        showFeedback('success', `${groupName} settings updated successfully!`);
        await refreshIntegrations();
      } else {
        showFeedback('error', `Some overrides in ${groupName} failed to save.`);
      }
    } catch (err) {
      console.error(err);
      showFeedback('error', `Network error saving ${groupName}.`);
    } finally {
      setActionLoading(null);
    }
  };

  const toggleFeature = async (key: string, currentValue: string) => {
    const newValue = currentValue === 'false' ? 'true' : 'false';
    setConfigs(prev => ({ ...prev, [key]: newValue }));
    
    setActionLoading(key);
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/admin/config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ key, value: newValue, description: `${key} toggle flag` })
      });
      if (res.ok) {
        showFeedback('success', `Global feature status for ${key === 'feature_ats_enabled' ? 'ATS checker' : 'AI optimizer'} updated successfully!`);
      } else {
        showFeedback('error', `Failed to save toggle state. Backend status ${res.status}`);
        setConfigs(prev => ({ ...prev, [key]: currentValue }));
      }
    } catch (err) {
      console.error(err);
      showFeedback('error', 'Network failure updating toggle status.');
      setConfigs(prev => ({ ...prev, [key]: currentValue }));
    } finally {
      setActionLoading(null);
    }
  };

  const updateUserRole = async (userId: string, newRole: 'user' | 'admin') => {
    setActionLoading(`role-${userId}`);
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/admin/users/${userId}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ role: newRole })
      });
      if (res.ok) {
        setUsers(users.map(u => u._id === userId ? { ...u, role: newRole } : u));
        showFeedback('success', 'User role updated successfully!');
      } else {
        showFeedback('error', 'Failed to update user role.');
      }
    } catch (err) {
      console.error(err);
      showFeedback('error', 'Network error updating role.');
    } finally {
      setActionLoading(null);
    }
  };

  const deleteUser = async (userId: string) => {
    if (!(await confirmAction('Delete User', 'Are you absolutely sure you want to delete this user? All their resume profiles and applications will be lost!', true))) {
      return;
    }
    setActionLoading(`delete-${userId}`);
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setUsers(users.filter(u => u._id !== userId));
        showFeedback('success', 'User wiped out from database.');
      } else {
        showFeedback('error', 'Failed to delete user.');
      }
    } catch (err) {
      console.error(err);
      showFeedback('error', 'Network error deleting user.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReplySubmit = async (ticketId: string) => {
    const replyText = replyTexts[ticketId];
    if (!replyText || !replyText.trim()) return;

    setActionLoading(`reply-${ticketId}`);
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/admin/tickets/${ticketId}/reply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ reply: replyText })
      });

      if (res.ok) {
        showFeedback('success', 'Reply submitted and ticket marked as resolved.');
        // Refresh support tickets list
        const ticketsRes = await fetch(`${API_BASE}/admin/tickets`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (ticketsRes.ok) {
          const ticketsData = await ticketsRes.json();
          setTickets(ticketsData);
        }
        setReplyTexts(prev => ({ ...prev, [ticketId]: '' }));
      } else {
        showFeedback('error', 'Failed to submit reply.');
      }
    } catch (err) {
      console.error(err);
      showFeedback('error', 'Network error submitting reply.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleInputChange = (key: string, value: string) => {
    setConfigs(prev => ({ ...prev, [key]: value }));
  };

  if (!isLoaded || loading) {
    return (
      <div className="flex flex-col justify-center items-center h-[70vh] gap-4">
        <RefreshCw className="w-10 h-10 text-purple-500 animate-spin" />
        <p className="text-zinc-400 text-sm animate-pulse">Loading Admin Control Panel...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="max-w-md mx-auto mt-20 p-4 md:p-8 rounded-3xl border border-red-500/20 bg-red-950/10 backdrop-blur-xl flex flex-col items-center text-center gap-4 shadow-xl shadow-red-950/20">
        <div className="p-4 rounded-full bg-red-500/10 border border-red-500/20">
          <ShieldAlert className="w-10 h-10 text-red-500 animate-bounce" />
        </div>
        <h2 className="text-xl font-bold text-white">Security Violation</h2>
        <p className="text-red-200/80 text-sm">
          Access Denied. You do not possess the required administrator credentials to view this page.
        </p>
        <div className="text-xs text-zinc-500 flex items-center gap-1.5 mt-2 bg-zinc-950/50 px-3 py-1.5 rounded-full border border-white/5">
          <Lock className="w-3.5 h-3.5" />
          Unauthorized: {user?.primaryEmailAddress?.emailAddress || 'Anonymous'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 flex-1 w-full relative z-10 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 pb-4 border-b border-zinc-800">
        <div>
          <h1 className="text-[1.1rem] sm:text-xl md:text-2xl font-extrabold tracking-tight bg-gradient-to-r from-purple-400 via-indigo-300 to-indigo-400 bg-clip-text text-transparent flex items-center gap-2 whitespace-nowrap">
            <ShieldCheck className="w-6 h-6 md:w-7 md:h-7 text-purple-500 shrink-0" />
            Admin System Management
          </h1>
          <p className="hidden md:block text-neutral-400 text-sm mt-1.5 leading-relaxed max-w-2xl">
            Global overrides for API gateways, SMTP servers, notification channels, and active user directory list.
          </p>
        </div>
        <button 
          onClick={fetchData}
          className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-xl border border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10 transition cursor-pointer"
        >
          <RefreshCw className="w-3 h-3" />
          Refresh Registry
        </button>
      </div>

      {/* Floating Status Notification */}
      {feedback && (
        <div className={`p-3 rounded-xl border flex items-center gap-2 animate-in fade-in slide-in-from-top-4 duration-300 ${
          feedback.type === 'success' 
            ? 'bg-emerald-950/20 border-emerald-500/20 text-emerald-300' 
            : 'bg-red-950/20 border-red-500/20 text-red-300'
        }`}>
          {feedback.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
          <span className="text-xs font-medium">{feedback.message}</span>
        </div>
      )}

      <div className="space-y-3">
        {/* Navigation Tabs */}
        <div className="w-full grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
        <button
          onClick={() => setActiveTab('ai')}
          className={`flex items-center justify-start text-left gap-2 px-3 py-2.5 text-xs font-semibold rounded-xl transition cursor-pointer w-full ${
            activeTab === 'ai' 
              ? 'bg-gradient-to-tr from-purple-500 to-indigo-500 text-white shadow-lg shadow-purple-500/20' 
              : 'bg-zinc-900/40 border border-white/5 text-zinc-400 hover:text-white hover:bg-white/10 hover:border-white/10'
          }`}
        >
          <Cpu className="w-3.5 h-3.5" />
          AI & Models Config
        </button>
        <button
          onClick={() => setActiveTab('features')}
          className={`flex items-center justify-start text-left gap-2 px-3 py-2.5 text-xs font-semibold rounded-xl transition cursor-pointer w-full ${
            activeTab === 'features' 
              ? 'bg-gradient-to-tr from-purple-500 to-indigo-500 text-white shadow-lg shadow-purple-500/20' 
              : 'bg-zinc-900/40 border border-white/5 text-zinc-400 hover:text-white hover:bg-white/10 hover:border-white/10'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          Feature Toggles
        </button>
        <button
          onClick={() => setActiveTab('whatsapp')}
          className={`flex items-center justify-start text-left gap-2 px-3 py-2.5 text-xs font-semibold rounded-xl transition cursor-pointer w-full ${
            activeTab === 'whatsapp' 
              ? 'bg-gradient-to-tr from-purple-500 to-indigo-500 text-white shadow-lg shadow-purple-500/20' 
              : 'bg-zinc-900/40 border border-white/5 text-zinc-400 hover:text-white hover:bg-white/10 hover:border-white/10'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          WhatsApp Setup
        </button>
        <button
          onClick={() => setActiveTab('email')}
          className={`flex items-center justify-start text-left gap-2 px-3 py-2.5 text-xs font-semibold rounded-xl transition cursor-pointer w-full ${
            activeTab === 'email' 
              ? 'bg-gradient-to-tr from-purple-500 to-indigo-500 text-white shadow-lg shadow-purple-500/20' 
              : 'bg-zinc-900/40 border border-white/5 text-zinc-400 hover:text-white hover:bg-white/10 hover:border-white/10'
          }`}
        >
          <Mail className="w-3.5 h-3.5" />
          Email Config (SMTP)
        </button>
        <button
          onClick={() => setActiveTab('jobboards')}
          className={`flex items-center justify-start text-left gap-2 px-3 py-2.5 text-xs font-semibold rounded-xl transition cursor-pointer w-full ${
            activeTab === 'jobboards' 
              ? 'bg-gradient-to-tr from-purple-500 to-indigo-500 text-white shadow-lg shadow-purple-500/20' 
              : 'bg-zinc-900/40 border border-white/5 text-zinc-400 hover:text-white hover:bg-white/10 hover:border-white/10'
          }`}
        >
          <Database className="w-3.5 h-3.5" />
          API Credentials Setup
        </button>
        <button
          onClick={() => setActiveTab('active-apis')}
          className={`flex items-center justify-start text-left gap-2 px-3 py-2.5 text-xs font-semibold rounded-xl transition cursor-pointer w-full ${
            activeTab === 'active-apis' 
              ? 'bg-gradient-to-tr from-purple-500 to-indigo-500 text-white shadow-lg shadow-purple-500/20' 
              : 'bg-zinc-900/40 border border-white/5 text-zinc-400 hover:text-white hover:bg-white/10 hover:border-white/10'
          }`}
        >
          <CheckCircle className="w-3.5 h-3.5" />
          Active APIs Registry
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center justify-start text-left gap-2 px-3 py-2.5 text-xs font-semibold rounded-xl transition cursor-pointer w-full ${
            activeTab === 'users' 
              ? 'bg-gradient-to-tr from-purple-500 to-indigo-500 text-white shadow-lg shadow-purple-500/20' 
              : 'bg-zinc-900/40 border border-white/5 text-zinc-400 hover:text-white hover:bg-white/10 hover:border-white/10'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          User Directory
        </button>
        <button
          onClick={() => setActiveTab('tickets')}
          className={`flex items-center justify-start text-left gap-2 px-3 py-2.5 text-xs font-semibold rounded-xl transition cursor-pointer w-full ${
            activeTab === 'tickets' 
              ? 'bg-gradient-to-tr from-purple-500 to-indigo-500 text-white shadow-lg shadow-purple-500/20' 
              : 'bg-zinc-900/40 border border-white/5 text-zinc-400 hover:text-white hover:bg-white/10 hover:border-white/10'
          }`}
        >
          <HelpCircle className="w-3.5 h-3.5" />
          Support Tickets
          {tickets.filter(t => t.status === 'Open').length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[9px] bg-red-500 text-white font-bold animate-pulse">
              {tickets.filter(t => t.status === 'Open').length}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('db-actions')}
          className={`flex items-center justify-start text-left gap-2 px-3 py-2.5 text-xs font-semibold rounded-xl transition cursor-pointer w-full ${
            activeTab === 'db-actions' 
              ? 'bg-gradient-to-tr from-purple-500 to-indigo-500 text-white shadow-lg shadow-purple-500/20' 
              : 'bg-zinc-900/40 border border-white/5 text-zinc-400 hover:text-white hover:bg-white/10 hover:border-white/10'
          }`}
        >
          <Database className="w-3.5 h-3.5" />
          Database Actions
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('scraper-health')}
          className={`flex items-center justify-start text-left gap-2 px-3 py-2.5 text-xs font-semibold rounded-xl transition cursor-pointer w-full ${
            activeTab === 'scraper-health' 
              ? 'bg-gradient-to-tr from-purple-500 to-indigo-500 text-white shadow-lg shadow-purple-500/20' 
              : 'bg-zinc-900/40 border border-white/5 text-zinc-400 hover:text-white hover:bg-white/10 hover:border-white/10'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          Scraper Health & Logs
        </button>
      </div>

      {/* Tabs Content */}
      <div className="w-full rounded-2xl border border-white/[0.08] bg-zinc-950/90 backdrop-blur-xl p-4 md:p-5 shadow-2xl relative overflow-hidden">
        {/* Subtle highlight orb inside tab container */}
        <div className="absolute top-[-50px] right-[-50px] w-64 h-64 rounded-full bg-purple-500/5 blur-[80px] pointer-events-none" />

        {/* Tab: Feature Toggles */}
        {activeTab === 'features' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold flex items-center gap-2 border-b border-zinc-800 pb-2.5">
              <Sliders className="w-5 h-5 text-purple-400" />
              Global Feature Toggles
            </h2>
            <p className="text-zinc-400 text-xs">
              Enable or disable core application modules globally. If a feature is turned off, normal users will see a maintenance message when trying to access that workspace.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
              {/* ATS Checker Toggle */}
              <div className="p-4.5 rounded-xl border border-white/5 bg-zinc-950/20 flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="font-bold text-xs text-white uppercase tracking-wider">
                    ATS Score Checker
                  </h3>
                  <p className="text-[10px] text-zinc-500 leading-relaxed max-w-[280px]">
                    Controls user access to the ATS Score Checker page. Toggle off to set the page under maintenance.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={actionLoading === 'feature_ats_enabled'}
                  onClick={() => toggleFeature('feature_ats_enabled', configs.feature_ats_enabled || 'true')}
                  className="relative inline-flex items-center cursor-pointer select-none"
                >
                  <div className={`w-10 h-5.5 rounded-full transition-colors duration-200 border border-white/5 flex items-center px-0.5 ${configs.feature_ats_enabled !== 'false' ? 'bg-purple-600 border-purple-500' : 'bg-neutral-800'}`}>
                    <div className={`w-4 h-4 bg-white rounded-full shadow-md transition-transform duration-200 ${configs.feature_ats_enabled !== 'false' ? 'translate-x-4.5' : 'translate-x-0'}`} />
                  </div>
                </button>
              </div>

              {/* AI Resume Optimizer Toggle */}
              <div className="p-4.5 rounded-xl border border-white/5 bg-zinc-950/20 flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="font-bold text-xs text-white uppercase tracking-wider">
                    AI Resume Optimizer
                  </h3>
                  <p className="text-[10px] text-zinc-500 leading-relaxed max-w-[280px]">
                    Controls user access to the AI Resume Tailor & Optimizer page. Toggle off to set the page under maintenance.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={actionLoading === 'feature_optimizer_enabled'}
                  onClick={() => toggleFeature('feature_optimizer_enabled', configs.feature_optimizer_enabled || 'true')}
                  className="relative inline-flex items-center cursor-pointer select-none"
                >
                  <div className={`w-10 h-5.5 rounded-full transition-colors duration-200 border border-white/5 flex items-center px-0.5 ${configs.feature_optimizer_enabled !== 'false' ? 'bg-purple-600 border-purple-500' : 'bg-neutral-800'}`}>
                    <div className={`w-4 h-4 bg-white rounded-full shadow-md transition-transform duration-200 ${configs.feature_optimizer_enabled !== 'false' ? 'translate-x-4.5' : 'translate-x-0'}`} />
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 1: AI Configurations */}
        {activeTab === 'ai' && (
          <div className="space-y-3">
            <h2 className="text-xl font-bold flex items-center gap-2 border-b border-zinc-800 pb-2.5">
              <Cpu className="w-5 h-5 text-purple-400" />
              AI Large Language Model Configuration
            </h2>
            <p className="text-zinc-400 text-xs">
              Specify active API gateways. The AI pipeline evaluates <strong>Claude</strong> first, falling back automatically to <strong>Google Gemini</strong> or <strong>Groq Llama 3</strong> to safeguard system continuity and reduce API costs.
            </p>

            <div className="p-4 rounded-xl border border-white/5 bg-zinc-950/20 space-y-3 mt-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Anthropic Claude */}
                <div className="flex flex-col gap-1.5">
                  <span className="font-semibold text-xs flex items-center gap-1.5 text-zinc-300">
                    Anthropic API Key (Claude)
                    <span className="px-2 py-0.5 text-[9px] rounded-md bg-purple-500/10 border border-purple-500/20 text-purple-300 font-normal">Primary letter/tailor</span>
                  </span>
                  <input placeholder="••••••••" type="password" 
                    value={configs.ANTHROPIC_API_KEY} 
                    onChange={(e) => handleInputChange('ANTHROPIC_API_KEY', e.target.value)} autoComplete="new-password" 
                    className="w-full bg-zinc-900 border border-white/5 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500 font-mono"
                  />
                  <span className="text-[9px] text-zinc-500">Claude 3.5 Sonnet is designated for cover letters and customizations.</span>
                </div>

                {/* Gemini Flash */}
                <div className="flex flex-col gap-1.5">
                  <span className="font-semibold text-xs flex items-center gap-1.5 text-zinc-300">
                    Google Gemini API Key
                    <span className="px-2 py-0.5 text-[9px] rounded-md bg-purple-500/10 border border-purple-500/20 text-purple-300 font-normal">Primary Parser / Fallback</span>
                  </span>
                  <input placeholder="••••••••" type="password" 
                    value={configs.GEMINI_API_KEY} 
                    onChange={(e) => handleInputChange('GEMINI_API_KEY', e.target.value)} autoComplete="new-password" 
                    className="w-full bg-zinc-900 border border-white/5 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500 font-mono"
                  />
                  <span className="text-[9px] text-zinc-500">Gemini 1.5 Flash handles initial resume parsing and chat assistance.</span>
                </div>

                {/* Groq Llama 3 */}
                <div className="flex flex-col gap-1.5 md:col-span-2">
                  <span className="font-semibold text-xs flex items-center gap-1.5 text-zinc-300">
                    Groq API Key
                    <span className="px-2 py-0.5 text-[9px] rounded-md bg-purple-500/10 border border-purple-500/20 text-purple-300 font-normal">Free Backup Gateway</span>
                  </span>
                  <input placeholder="••••••••" type="password" 
                    value={configs.GROQ_API_KEY} 
                    onChange={(e) => handleInputChange('GROQ_API_KEY', e.target.value)} autoComplete="new-password" 
                    className="w-full bg-zinc-900 border border-white/5 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500 font-mono"
                  />
                  <span className="text-[9px] text-zinc-500">Llama-3-70b-8192 is used as a fast backup router for parser workloads.</span>
                </div>
              </div>

              <div className="flex justify-end pt-2 border-t border-white/5">
                <button 
                  onClick={() => saveConfigGroup(['ANTHROPIC_API_KEY', 'GEMINI_API_KEY', 'GROQ_API_KEY'], 'AI & Models')}
                  disabled={actionLoading === 'AI & Models'}
                  className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-xl bg-purple-500 hover:bg-purple-600 disabled:opacity-50 text-white transition cursor-pointer shadow-md hover:shadow-purple-500/10 shrink-0"
                >
                  {actionLoading === 'AI & Models' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Save AI Configurations
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: WhatsApp Setup */}
        {activeTab === 'whatsapp' && (
          <div className="space-y-3">
            <h2 className="text-xl font-bold flex items-center gap-2 border-b border-zinc-800 pb-2.5">
              <MessageSquare className="w-5 h-5 text-purple-400" />
              WhatsApp Cloud Business API Configurations
            </h2>
            <p className="text-zinc-400 text-xs">
              Configure parameters to dispatch template OTP messages and match score notifications directly to users.
            </p>

            <div className="p-4 rounded-xl border border-white/5 bg-zinc-950/20 space-y-3 mt-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* WhatsApp Token */}
                <div className="flex flex-col gap-1.5 md:col-span-2">
                  <span className="font-semibold text-xs text-zinc-300">WhatsApp Access Token</span>
                  <input placeholder="••••••••" type="password" 
                    value={configs.WHATSAPP_ACCESS_TOKEN} 
                    onChange={(e) => handleInputChange('WHATSAPP_ACCESS_TOKEN', e.target.value)} autoComplete="new-password" 
                    className="w-full bg-zinc-900 border border-white/5 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500 font-mono"
                  />
                </div>

                {/* Phone ID */}
                <div className="flex flex-col gap-1.5">
                  <span className="font-semibold text-xs text-zinc-300">WhatsApp Phone Number ID</span>
                  <input placeholder="Enter configs.whatsapp_phone_number_id" type="text" 
                    value={configs.WHATSAPP_PHONE_NUMBER_ID} 
                    onChange={(e) => handleInputChange('WHATSAPP_PHONE_NUMBER_ID', e.target.value)} 
                    className="w-full bg-zinc-900 border border-white/5 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500 font-mono"
                  />
                </div>

                {/* Business ID */}
                <div className="flex flex-col gap-1.5">
                  <span className="font-semibold text-xs text-zinc-300">WhatsApp Business Account ID</span>
                  <input placeholder="Enter configs.whatsapp_business_account_id" type="text" 
                    value={configs.WHATSAPP_BUSINESS_ACCOUNT_ID} 
                    onChange={(e) => handleInputChange('WHATSAPP_BUSINESS_ACCOUNT_ID', e.target.value)} 
                    className="w-full bg-zinc-900 border border-white/5 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500 font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2 border-t border-white/5">
                <button 
                  onClick={() => saveConfigGroup(['WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_BUSINESS_ACCOUNT_ID'], 'WhatsApp Setup')}
                  disabled={actionLoading === 'WhatsApp Setup'}
                  className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-xl bg-purple-500 hover:bg-purple-600 disabled:opacity-50 text-white transition cursor-pointer shadow-md hover:shadow-purple-500/10 shrink-0"
                >
                  {actionLoading === 'WhatsApp Setup' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Save WhatsApp Settings
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: SMTP Mail configurations */}
        {activeTab === 'email' && (
          <div className="space-y-3">
            <h2 className="text-xl font-bold flex items-center gap-2 border-b border-zinc-800 pb-2.5">
              <Mail className="w-5 h-5 text-purple-400" />
              Nodemailer SMTP Configuration
            </h2>
            <p className="text-zinc-400 text-xs">
              Overrides for dispatching email validation verification OTP codes and matched applications updates.
            </p>

            <div className="p-4 rounded-xl border border-white/5 bg-zinc-950/20 space-y-3 mt-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Host */}
                <div className="flex flex-col gap-1.5">
                  <span className="font-semibold text-xs text-zinc-300">SMTP Host Server</span>
                  <input placeholder="Enter configs.smtp_host" type="text" value={configs.SMTP_HOST} onChange={(e) => handleInputChange('SMTP_HOST', e.target.value)} className="w-full bg-zinc-900 border border-white/5 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500" />
                </div>

                {/* Port */}
                <div className="flex flex-col gap-1.5">
                  <span className="font-semibold text-xs text-zinc-300">SMTP Port</span>
                  <input placeholder="Enter configs.smtp_port" type="text" value={configs.SMTP_PORT} onChange={(e) => handleInputChange('SMTP_PORT', e.target.value)} className="w-full bg-zinc-900 border border-white/5 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500" />
                </div>

                {/* User */}
                <div className="flex flex-col gap-1.5">
                  <span className="font-semibold text-xs text-zinc-300">SMTP User Logins</span>
                  <input placeholder="Enter configs.smtp_user" type="text" value={configs.SMTP_USER} onChange={(e) => handleInputChange('SMTP_USER', e.target.value)} autoComplete="off" className="w-full bg-zinc-900 border border-white/5 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500" />
                </div>

                {/* Password */}
                <div className="flex flex-col gap-1.5">
                  <span className="font-semibold text-xs text-zinc-300">SMTP App Password</span>
                  <input placeholder="••••••••" type="password" value={configs.SMTP_PASS} onChange={(e) => handleInputChange('SMTP_PASS', e.target.value)} autoComplete="new-password" className="w-full bg-zinc-900 border border-white/5 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500" />
                </div>

                {/* Sender Address */}
                <div className="flex flex-col gap-1.5 md:col-span-2">
                  <span className="font-semibold text-xs text-zinc-300">Authorized Sender Address (EMAIL_FROM_ADDRESS)</span>
                  <input placeholder="user@example.com" type="email" value={configs.EMAIL_FROM_ADDRESS} onChange={(e) => handleInputChange('EMAIL_FROM_ADDRESS', e.target.value)} className="w-full bg-zinc-900 border border-white/5 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500" />
                </div>
              </div>

              <div className="flex justify-end pt-2 border-t border-white/5">
                <button 
                  onClick={() => saveConfigGroup(['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'EMAIL_FROM_ADDRESS'], 'SMTP Email')}
                  disabled={actionLoading === 'SMTP Email'}
                  className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-xl bg-purple-500 hover:bg-purple-600 disabled:opacity-50 text-white transition cursor-pointer shadow-md hover:shadow-purple-500/10 shrink-0"
                >
                  {actionLoading === 'SMTP Email' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Save Email Settings
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Scrapers & Job Search API configurations */}
        {activeTab === 'jobboards' && (
          <div className="space-y-3">
            <h2 className="text-xl font-bold flex items-center gap-2 border-b border-zinc-800 pb-2.5">
              <Database className="w-5 h-5 text-purple-400" />
              Scraper Engine & Job Search API Credentials
            </h2>
            <p className="text-zinc-400 text-xs">
              Configure target job search API credentials and keys to enable active crawling pipelines.
            </p>

            <div className="p-4 rounded-xl border border-white/5 bg-zinc-950/20 space-y-3 mt-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Adzuna ID */}
                <div className="flex flex-col gap-1.5">
                  <span className="font-semibold text-xs text-zinc-300">Adzuna Application ID</span>
                  <input placeholder="Enter configs.adzuna_api_id" type="text" value={configs.ADZUNA_API_ID} onChange={(e) => handleInputChange('ADZUNA_API_ID', e.target.value)} autoComplete="off" className="w-full bg-zinc-900 border border-white/5 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500" />
                </div>

                {/* Adzuna Key */}
                <div className="flex flex-col gap-1.5">
                  <span className="font-semibold text-xs text-zinc-300">Adzuna Publisher Key</span>
                  <input placeholder="••••••••" type="password" value={configs.ADZUNA_API_KEY} onChange={(e) => handleInputChange('ADZUNA_API_KEY', e.target.value)} autoComplete="new-password" className="w-full bg-zinc-900 border border-white/5 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500" />
                </div>

                 {/* JSearch API Key */}
                <div className="flex flex-col gap-1.5 md:col-span-2">
                  <span className="font-semibold text-xs text-zinc-300">JSearch API Key</span>
                  <input placeholder="••••••••" type="password" value={configs.JSEARCH_API_KEY} onChange={(e) => handleInputChange('JSEARCH_API_KEY', e.target.value)} autoComplete="new-password" className="w-full bg-zinc-900 border border-white/5 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500 font-mono" />
                </div>

                {/* Jooble API Key */}
                <div className="flex flex-col gap-1.5">
                  <span className="font-semibold text-xs text-zinc-300">Jooble API Key</span>
                  <input placeholder="••••••••" type="password" value={configs.JOOBLE_API_KEY} onChange={(e) => handleInputChange('JOOBLE_API_KEY', e.target.value)} autoComplete="new-password" className="w-full bg-zinc-900 border border-white/5 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500 font-mono" />
                </div>

                {/* Careerjet API Key */}
                <div className="flex flex-col gap-1.5">
                  <span className="font-semibold text-xs text-zinc-300">Careerjet API Key</span>
                  <input placeholder="••••••••" type="password" value={configs.CAREERJET_API_KEY} onChange={(e) => handleInputChange('CAREERJET_API_KEY', e.target.value)} autoComplete="new-password" className="w-full bg-zinc-900 border border-white/5 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500 font-mono" />
                </div>
              </div>

              <div className="flex justify-end pt-2 border-t border-white/5">
                <button 
                  onClick={() => saveConfigGroup(['ADZUNA_API_ID', 'ADZUNA_API_KEY', 'JSEARCH_API_KEY', 'JOOBLE_API_KEY', 'CAREERJET_API_KEY'], 'Discovery & Storage')}
                  disabled={actionLoading === 'Discovery & Storage'}
                  className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-xl bg-purple-500 hover:bg-purple-600 disabled:opacity-50 text-white transition cursor-pointer shadow-md hover:shadow-purple-500/10 shrink-0"
                >
                  {actionLoading === 'Discovery & Storage' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Save Integrations Settings
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab: Active APIs Registry */}
        {activeTab === 'active-apis' && (
          <div className="space-y-4">
            <div className="border-b border-zinc-800 pb-3">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-400" />
                Active APIs & Gateways Registry
              </h2>
              <p className="text-zinc-400 text-xs mt-1">
                Real-time check for all integrated job sources, scrapers, search engines, and remote feed gateways.
              </p>
            </div>

            {/* Premium Status Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {apiIntegrations.map((api, idx) => (
                <div 
                  key={idx} 
                  className="p-4 rounded-2xl border bg-zinc-950/40 hover:bg-zinc-950/65 transition-all duration-300 relative overflow-hidden flex flex-col justify-between gap-4 border-white/5 hover:border-white/10"
                >
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <h4 className="font-extrabold text-sm text-white tracking-wide">{api.name}</h4>
                      <span className="text-[10px] text-purple-400 font-semibold tracking-wider uppercase mt-0.5 block">
                        {api.type}
                      </span>
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                      api.active 
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                        : 'bg-zinc-800 text-zinc-400 border border-white/5'
                    }`}>
                      {api.active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed font-medium">
                    {api.desc}
                  </p>
                </div>
              ))}
              {apiIntegrations.length === 0 && (
                <div className="col-span-full py-8 text-center text-zinc-500">
                  No registered integrations found.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 5: User Directory */}
        {activeTab === 'users' && (
          <div className="space-y-3">
            <h2 className="text-xl font-bold flex items-center gap-2 border-b border-zinc-800 pb-2.5">
              <Users className="w-5 h-5 text-purple-400" />
              Registered Application Directory
            </h2>
            <p className="text-zinc-400 text-xs">
              List of all users currently registered in the database, allowing system administration role mappings.
            </p>

            <div className="overflow-x-auto w-full border border-white/5 rounded-2xl bg-zinc-900/35">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-zinc-950/40 border-b border-zinc-800 text-zinc-400 font-semibold">
                    <th className="py-2 px-2.5">Email</th>
                    <th className="py-2 px-2.5">Name</th>
                    <th className="py-2 px-2.5">Phone Number</th>
                    <th className="py-2 px-2.5">Role</th>
                    <th className="py-2 px-2.5">Verification</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {users.map(u => (
                    <tr key={u._id} className="hover:bg-white/[0.02] transition">
                      <td className="py-2 px-2.5 font-medium text-white max-w-[140px] truncate" title={u.email}>{u.email}</td>
                      <td className="py-2 px-2.5 text-zinc-300 max-w-[120px] truncate" title={u.name || ''}>{u.name || '—'}</td>
                      <td className="py-2 px-2.5 text-zinc-300">{u.phone || '—'}</td>
                      <td className="py-2 px-2.5">
                        <select
                          value={u.role}
                          onChange={(e) => updateUserRole(u._id, e.target.value as 'user' | 'admin')}
                          disabled={actionLoading === `role-${u._id}`}
                          className="bg-zinc-900 border border-white/5 rounded-xl px-2.5 py-1 text-xs text-white focus:outline-none focus:border-purple-500 font-semibold cursor-pointer"
                        >
                          <option value="user">🟢 User</option>
                          <option value="admin">🛡️ Admin</option>
                        </select>
                      </td>
                      <td className="py-2 px-2.5">
                        <div className="flex flex-col gap-0.5 text-[10px]">
                          <span className={u.isEmailVerified ? 'text-emerald-400' : 'text-zinc-500'}>
                            • Email: {u.isEmailVerified ? 'Verified' : 'Unverified'}
                          </span>
                          <span className={u.isPhoneVerified ? 'text-emerald-400' : 'text-zinc-500'}>
                            • Phone: {u.isPhoneVerified ? 'Verified' : 'Unverified'}
                          </span>
                        </div>
                      </td>
                      <td className="py-2 px-2.5 text-right">
                        <button
                          onClick={() => deleteUser(u._id)}
                          disabled={actionLoading === `delete-${u._id}`}
                          className="p-1.5 text-xs font-semibold rounded-lg bg-red-500/10 hover:bg-red-500/20 disabled:opacity-50 text-red-400 border border-red-500/20 transition cursor-pointer"
                          title="Delete User Account"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-zinc-500">
                        No registered users found in database.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 6: Support Tickets */}
        {activeTab === 'tickets' && (
          <div className="space-y-3">
            <h2 className="text-xl font-bold flex items-center gap-2 border-b border-zinc-800 pb-2.5">
              <HelpCircle className="w-5 h-5 text-purple-400" />
              User Queries & Support Tickets
            </h2>
            <p className="text-zinc-400 text-xs">
              Review issues or suggestions submitted by app users, and reply to resolve support tickets.
            </p>

            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
              {tickets.map(t => {
                const isExpanded = expandedTicketId === t._id;
                return (
                  <div 
                    key={t._id} 
                    className={`rounded-2xl border transition-all duration-300 ${
                      isExpanded 
                        ? 'bg-zinc-950/85 border-purple-500/30 shadow-lg shadow-purple-500/5' 
                        : 'bg-zinc-900/40 border-white/5 hover:border-white/10 hover:bg-zinc-900/60'
                    }`}
                  >
                    {/* Accordion Row Header */}
                    <div 
                      onClick={() => setExpandedTicketId(isExpanded ? null : t._id)}
                      className="p-4 flex items-center justify-between gap-4 cursor-pointer select-none"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase shrink-0 ${
                          t.category === 'Bug' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                          t.category === 'Feature Request' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                          t.category === 'Suggestion' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                          'bg-violet-500/10 text-violet-400 border border-violet-500/20'
                        }`}>
                          {t.category}
                        </span>
                        <h3 className="font-semibold text-sm text-white truncate" title={t.subject}>
                          {t.subject}
                        </h3>
                      </div>
                      
                      <div className="flex items-center gap-2 shrink-0">
                        {t.status === 'Resolved' ? (
                          <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold uppercase">
                            Resolved
                          </span>
                        ) : (
                          <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full font-bold uppercase animate-pulse">
                            Open
                          </span>
                        )}
                        
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-zinc-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-zinc-400" />
                        )}
                      </div>
                    </div>

                    {/* Collapsible Content */}
                    {isExpanded && (
                      <div className="px-4 pb-5 pt-1 border-t border-white/5 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="text-[10px] text-zinc-500 font-mono">
                          From: <span className="text-purple-400 font-semibold">{t.email}</span> • {new Date(t.createdAt).toLocaleString()}
                        </div>
                        
                        {/* User Message */}
                        <div className="relative pl-6 border-l border-purple-500/20 py-1">
                          <div className="absolute left-[-5px] top-2.5 w-2.5 h-2.5 rounded-full bg-purple-500" />
                          <div className="p-3.5 rounded-xl bg-zinc-900 border border-white/5 text-xs text-zinc-300">
                            <p className="whitespace-pre-wrap">{t.message}</p>
                          </div>
                        </div>

                        {/* Admin Action/Response */}
                        <div className="relative pl-6 border-l border-indigo-500/20 py-1">
                          <div className="absolute left-[-5px] top-2.5 w-2.5 h-2.5 rounded-full bg-indigo-500" />
                          {t.status === 'Open' ? (
                            <div className="space-y-3 pt-2">
                              <textarea
                                value={replyTexts[t._id] || ''}
                                onChange={(e) => setReplyTexts(prev => ({ ...prev, [t._id]: e.target.value }))}
                                rows={3}
                                className="w-full bg-zinc-900 border border-white/5 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-purple-500 resize-none"
                              />
                              <button
                                onClick={() => handleReplySubmit(t._id)}
                                disabled={actionLoading === `reply-${t._id}`}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white font-semibold text-xs transition cursor-pointer"
                              >
                                <Send className="w-3.5 h-3.5" />
                                Send Reply & Resolve
                              </button>
                            </div>
                          ) : (
                            <div className="p-3.5 rounded-xl bg-purple-950/15 border border-purple-500/10 text-xs text-zinc-300">
                              <span className="font-bold text-purple-400 text-[10px] uppercase tracking-wider block mb-1">Admin Reply</span>
                              <p className="whitespace-pre-wrap">{t.adminReply}</p>
                              {t.repliedAt && (
                                <span className="text-[9px] text-zinc-500 font-mono block mt-2">
                                  Replied at {new Date(t.repliedAt).toLocaleString()}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {tickets.length === 0 && (
                <div className="p-8 text-center text-zinc-500 bg-zinc-900/10 border border-white/5 rounded-2xl">
                  No support tickets found in system.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 8: Database Stats & Actions */}
        {activeTab === 'db-actions' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-b border-zinc-800 pb-3">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2 text-white">
                  <Database className="w-5 h-5 text-purple-400" />
                  Database Administration & Maintenance
                </h2>
                <p className="text-zinc-400 text-xs mt-1">
                  View storage usage (MB), perform bulk cleanup operations, and manage individual job listings.
                </p>
              </div>
              <button
                type="button"
                onClick={fetchDbAll}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border border-white/5 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 transition cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${statsLoading ? 'animate-spin' : ''}`} />
                Reload Storage Data
              </button>
            </div>

            {/* Storage stats overview cards */}
            {storageStats && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl border border-white/5 bg-zinc-950/40">
                  <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Total Data Size</span>
                  <span className="text-2xl font-extrabold text-white">{storageStats.totalDataSizeMB} <span className="text-xs font-medium text-zinc-500">MB</span></span>
                </div>
                <div className="p-4 rounded-2xl border border-white/5 bg-zinc-950/40">
                  <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Total Allocated Storage</span>
                  <span className="text-2xl font-extrabold text-white">{storageStats.totalStorageSizeMB} <span className="text-xs font-medium text-zinc-500">MB</span></span>
                  <span className="text-[9px] text-zinc-500 block mt-1">Free tier limit: 512.00 MB</span>
                </div>
                <div className="p-4 rounded-2xl border border-white/5 bg-zinc-950/40">
                  <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Total Index Size</span>
                  <span className="text-2xl font-extrabold text-white">{storageStats.totalIndexSizeMB} <span className="text-xs font-medium text-zinc-500">MB</span></span>
                </div>
              </div>
            )}

            {/* Collection metrics table */}
            {storageStats && (
              <div className="border border-white/5 rounded-2xl bg-zinc-950/20 overflow-hidden">
                <div className="px-4 py-3 bg-zinc-950/40 border-b border-white/5">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">Per-Collection Storage Breakdown</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-white/5 text-zinc-400 font-bold bg-zinc-950/10">
                        <th className="p-3">Collection</th>
                        <th className="p-3">Documents</th>
                        <th className="p-3">Data Size (MB)</th>
                        <th className="p-3">Storage Size (MB)</th>
                        <th className="p-3">Index Size (MB)</th>
                        <th className="p-3">Avg Doc Size</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-zinc-300 font-medium">
                      {storageStats.collections.map((c: any) => (
                        <tr key={c.key} className="hover:bg-white/[0.02] transition-colors">
                          <td className="p-3 font-mono text-purple-400">{c.collection}</td>
                          <td className="p-3 font-bold">{c.documentCount.toLocaleString()}</td>
                          <td className="p-3">{c.dataSizeMB} MB</td>
                          <td className="p-3">{c.storageSizeMB} MB</td>
                          <td className="p-3">{c.indexSizeMB} MB</td>
                          <td className="p-3 font-mono text-[10px]">{c.avgDocSizeKB} KB</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Document counts detail list */}
            {dbStats && (
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider block">Real-time Document Counts</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3.5 rounded-xl border border-white/5 bg-zinc-900/20">
                    <span className="text-[10px] text-zinc-500 font-bold block">External Board Jobs</span>
                    <span className="text-xl font-bold text-white block mt-0.5">{dbStats.externalBoardJobs}</span>
                  </div>
                  <div className="p-3.5 rounded-xl border border-white/5 bg-zinc-900/20">
                    <span className="text-[10px] text-zinc-500 font-bold block">Pending Confirmations</span>
                    <span className="text-xl font-bold text-white block mt-0.5">{dbStats.pendingConfirmations}</span>
                  </div>
                  <div className="p-3.5 rounded-xl border border-white/5 bg-zinc-900/20">
                    <span className="text-[10px] text-zinc-500 font-bold block">Pending Digests</span>
                    <span className="text-xl font-bold text-white block mt-0.5">{dbStats.pendingDigests}</span>
                  </div>
                  <div className="p-3.5 rounded-xl border border-white/5 bg-zinc-900/20">
                    <span className="text-[10px] text-zinc-500 font-bold block">Job Board (Tier 1-3)</span>
                    <span className="text-xl font-bold text-white block mt-0.5">{dbStats.tier1to3Jobs}</span>
                  </div>
                  <div className="p-3.5 rounded-xl border border-white/5 bg-zinc-900/20">
                    <span className="text-[10px] text-zinc-500 font-bold block">Closed Tier 1-3 Jobs</span>
                    <span className="text-xl font-bold text-white block mt-0.5">{dbStats.closedTier1to3Jobs}</span>
                  </div>
                  <div className="p-3.5 rounded-xl border border-white/5 bg-zinc-900/20 relative overflow-hidden">
                    <span className="text-[10px] text-emerald-500 font-extrabold block uppercase tracking-wider">Applications</span>
                    <span className="text-xl font-bold text-zinc-400 block mt-0.5">{dbStats.applications}</span>
                    <span className="absolute top-1 right-1 px-1.5 py-0.5 rounded text-[8px] bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20">
                      SECURED & READONLY
                    </span>
                  </div>
                  <div className="p-3.5 rounded-xl border border-white/5 bg-zinc-900/20">
                    <span className="text-[10px] text-zinc-500 font-bold block">Already-Expired External</span>
                    <span className={`text-xl font-bold block mt-0.5 ${dbStats.alreadyExpiredExternalJobs > 0 ? 'text-amber-400 animate-pulse' : 'text-white'}`}>
                      {dbStats.alreadyExpiredExternalJobs}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Bulk Cleanup Actions */}
            <div className="space-y-4 pt-4 border-t border-zinc-900">
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider block">Bulk Cleanup Actions</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Expired jobs cleanup */}
                <div className="p-4 rounded-xl border border-white/5 bg-zinc-950 flex flex-col justify-between gap-3">
                  <div className="space-y-1">
                    <span className="text-sm font-bold text-white block">Expired External Board Jobs</span>
                    <p className="text-xs text-zinc-500">Deletes jobs from the external board collection where the application deadline has passed or the job is marked as closed by the scraper.</p>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!(await confirmAction('Delete Expired Jobs', 'Are you sure you want to delete all expired external board jobs?', true))) return;
                      setActionLoading('expired-external');
                      try {
                        const token = await getToken();
                        const res = await fetch(`${API_BASE}/admin/db/cleanup/expired-external-jobs`, {
                          method: 'POST',
                          headers: { Authorization: `Bearer ${token}` }
                        });
                        if (res.ok) {
                          const data = await res.json();
                          showFeedback('success', `Cleaned up ${data.deletedCount} expired external board jobs.`);
                          fetchDbAll();
                        } else {
                          showFeedback('error', 'Failed to run cleanup.');
                        }
                      } catch (err) {
                        console.error(err);
                        showFeedback('error', 'Network error.');
                      } finally {
                        setActionLoading(null);
                      }
                    }}
                    disabled={actionLoading !== null}
                    className="py-2.5 bg-purple-600/10 hover:bg-purple-600/20 border border-purple-500/20 text-purple-400 text-xs font-bold rounded-xl transition cursor-pointer"
                  >
                    {actionLoading === 'expired-external' ? 'Clearing...' : 'Wipe Expired Jobs'}
                  </button>
                </div>

                {/* Job Board Closed Jobs cleanup */}
                <div className="p-4 rounded-xl border border-white/5 bg-zinc-950 flex flex-col justify-between gap-3">
                  <div className="space-y-1">
                    <span className="text-sm font-bold text-white block">Closed Job Board Jobs</span>
                    <p className="text-xs text-zinc-500">Deletes jobs from the Main Job Board (Tier 1-3) that have been marked as closed or expired.</p>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!(await confirmAction('Delete Closed Jobs', 'Are you sure you want to delete all closed/expired jobs from the Main Job Board?', true))) return;
                      setActionLoading('closed-tier1-3');
                      try {
                        const token = await getToken();
                        const res = await fetch(`${API_BASE}/admin/db/cleanup/closed-jobs`, {
                          method: 'POST',
                          headers: { 
                            Authorization: `Bearer ${token}`,
                            'Content-Type': 'application/json'
                          },
                          body: JSON.stringify({ olderThanDays: 0 })
                        });
                        if (res.ok) {
                          const data = await res.json();
                          showFeedback('success', `Cleaned up ${data.deletedCount} closed Job Board jobs.`);
                          fetchDbAll();
                        } else {
                          showFeedback('error', 'Failed to run cleanup.');
                        }
                      } catch (err) {
                        console.error(err);
                        showFeedback('error', 'Network error.');
                      } finally {
                        setActionLoading(null);
                      }
                    }}
                    disabled={actionLoading !== null}
                    className="py-2.5 bg-purple-600/10 hover:bg-purple-600/20 border border-purple-500/20 text-purple-400 text-xs font-bold rounded-xl transition cursor-pointer"
                  >
                    {actionLoading === 'closed-tier1-3' ? 'Clearing...' : 'Wipe Closed Jobs'}
                  </button>
                </div>

                {/* Wipe All Tier 1-3 Jobs */}
                <div className="p-4 rounded-xl border border-red-500/20 bg-red-950/5 flex flex-col justify-between gap-3">
                  <div className="space-y-1">
                    <span className="text-sm font-bold text-red-400 flex items-center gap-1.5">
                      <Trash2 className="w-4 h-4" />
                      Wipe All Tier 1-3 Jobs
                    </span>
                    <p className="text-xs text-zinc-500">Permanently delete ALL job listings from the Main Job Board (Tier 1-3).</p>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!(await confirmAction('Delete Tier 1-3 Jobs', 'WARNING: Are you absolutely sure you want to delete ALL Tier 1-3 jobs from the database?', true))) return;
                      setActionLoading('wipe-tier1-3');
                      try {
                        const token = await getToken();
                        const res = await fetch(`${API_BASE}/admin/db/cleanup/all-jobs?source=tier1-3`, {
                          method: 'POST',
                          headers: { Authorization: `Bearer ${token}` }
                        });
                        if (res.ok) {
                          const data = await res.json();
                          showFeedback('success', `Deleted ${data.deletedCount} Tier 1-3 jobs.`);
                          fetchDbAll();
                        } else {
                          showFeedback('error', 'Wipe failed.');
                        }
                      } catch (err) {
                        console.error(err);
                        showFeedback('error', 'Network error.');
                      } finally {
                        setActionLoading(null);
                      }
                    }}
                    disabled={actionLoading !== null}
                    className="py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition cursor-pointer"
                  >
                    {actionLoading === 'wipe-tier1-3' ? 'Wiping...' : 'Wipe All Tier 1-3 Jobs'}
                  </button>
                </div>

                {/* Wipe All External Board Jobs */}
                <div className="p-4 rounded-xl border border-red-500/20 bg-red-950/5 flex flex-col justify-between gap-3">
                  <div className="space-y-1">
                    <span className="text-sm font-bold text-red-400 flex items-center gap-1.5">
                      <Trash2 className="w-4 h-4" />
                      Wipe All External Board Jobs
                    </span>
                    <p className="text-xs text-zinc-500">Permanently delete ALL passively sourced external board job listings.</p>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!(await confirmAction('Delete External Jobs', 'WARNING: Are you absolutely sure you want to delete ALL External Board jobs from the database?', true))) return;
                      setActionLoading('wipe-external');
                      try {
                        const token = await getToken();
                        const res = await fetch(`${API_BASE}/admin/db/cleanup/all-jobs?source=external-board`, {
                          method: 'POST',
                          headers: { Authorization: `Bearer ${token}` }
                        });
                        if (res.ok) {
                          const data = await res.json();
                          showFeedback('success', `Deleted ${data.deletedCount} External Board jobs.`);
                          fetchDbAll();
                        } else {
                          showFeedback('error', 'Wipe failed.');
                        }
                      } catch (err) {
                        console.error(err);
                        showFeedback('error', 'Network error.');
                      } finally {
                        setActionLoading(null);
                      }
                    }}
                    disabled={actionLoading !== null}
                    className="py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition cursor-pointer"
                  >
                    {actionLoading === 'wipe-external' ? 'Wiping...' : 'Wipe All External Jobs'}
                  </button>
                </div>
              </div>
            </div>

            {/* Browse & Individual Delete Jobs Section */}
            <div className="space-y-4 pt-4 border-t border-zinc-900">
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider block">Browse & Delete Individual Listings</h3>
              
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="w-full sm:w-1/3">
                  <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block mb-1">Target Collection</label>
                  <select
                    value={browseSource}
                    onChange={e => setBrowseSource(e.target.value as any)}
                    className="w-full bg-zinc-900 border border-white/5 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500 cursor-pointer"
                  >
                    <option value="tier1-3">Main Job Board (Tier 1-3)</option>
                    <option value="external-board">External Boards (Tier 4)</option>
                  </select>
                </div>

                <div className="flex-1">
                  <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block mb-1">Search Keywords</label>
                  <div className="flex gap-2">
                    <input placeholder="Enter searchterm" type="text"
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && browseJobs(1)}
                      className="flex-1 bg-zinc-900 border border-white/5 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                    />
                    <button
                      type="button"
                      onClick={() => browseJobs(1)}
                      className="px-4 py-2 text-xs font-bold rounded-xl bg-purple-600 hover:bg-purple-700 text-white transition cursor-pointer shadow-lg shadow-purple-500/15"
                    >
                      Search
                    </button>
                  </div>
                </div>
              </div>

              {/* Browse Results Table */}
              {browseResults && browseResults.results ? (
                <div className="space-y-3">
                  <div className="border border-white/5 rounded-2xl bg-zinc-950/20 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-white/5 text-zinc-400 font-bold bg-zinc-950/10">
                            <th className="p-3">Job Title</th>
                            <th className="p-3">Company</th>
                            <th className="p-3">Source / Slug</th>
                            <th className="p-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-zinc-300 font-medium">
                          {browseResults.results.map((job: any) => (
                            <tr key={job._id} className="hover:bg-white/[0.02] transition-colors">
                              <td className="p-3 font-bold max-w-xs truncate">{job.title}</td>
                              <td className="p-3 text-purple-400 font-semibold">{job.company}</td>
                              <td className="p-3 font-mono text-[10px]">{job.sourcePlatform || job.source || job.companySlug || 'Main'}</td>
                              <td className="p-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => deleteOneJob(job._id)}
                                  className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg border border-red-500/20 transition cursor-pointer"
                                  title="Delete Listing permanently"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}

                          {browseResults.results.length === 0 && (
                            <tr>
                              <td colSpan={4} className="p-8 text-center text-zinc-500 font-semibold">
                                No job listings match your search parameters.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Pagination */}
                  {browseResults.total > browseResults.pageSize && (
                    <div className="flex justify-between items-center text-xs text-zinc-400 py-2">
                      <span>
                        Showing {((browsePage - 1) * browseResults.pageSize) + 1} - {Math.min(browsePage * browseResults.pageSize, browseResults.total)} of {browseResults.total} jobs
                      </span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={browsePage === 1}
                          onClick={() => browseJobs(browsePage - 1)}
                          className="px-3 py-1.5 rounded-xl border border-white/5 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                        >
                          Previous
                        </button>
                        <button
                          type="button"
                          disabled={browsePage * browseResults.pageSize >= browseResults.total}
                          onClick={() => browseJobs(browsePage + 1)}
                          className="px-3 py-1.5 rounded-xl border border-white/5 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-8 text-center text-zinc-500 bg-zinc-900/10 border border-white/5 rounded-2xl">
                  Click Search to populate matching job lists.
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'scraper-health' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-b border-zinc-800 pb-3">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2 text-white">
                  <Clock className="w-5 h-5 text-purple-400" />
                  Scraper Health & Logs
                </h2>
                <p className="text-zinc-400 text-xs mt-1">
                  Monitor search aggregator call quotas, check evolutionary scraper runs, and inspect AI key token health.
                </p>
              </div>
              <button
                type="button"
                onClick={handleTriggerScraper}
                disabled={actionLoading === 'trigger-scraper'}
                className="px-4 py-2 bg-gradient-to-tr from-purple-500 to-indigo-500 text-white rounded-xl text-xs font-bold hover:shadow-lg hover:shadow-purple-500/20 transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {actionLoading === 'trigger-scraper' ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Triggering Crawl...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3.5 h-3.5" />
                    Trigger Scraper Run
                  </>
                )}
              </button>
            </div>

            {scraperLoading && !scraperStats ? (
              <div className="flex justify-center items-center py-12">
                <RefreshCw className="w-6 h-6 text-purple-400 animate-spin" />
              </div>
            ) : scraperStats ? (
              <div className="space-y-6">
                
                {/* Daily limits metrics widgets */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                  
                  {Object.entries({
                    JSEARCH: { limit: 15, title: 'JSearch Queries' },
                    ADZUNA: { limit: 50, title: 'Adzuna Queries' },
                    Gemini: { limit: 1500, title: 'Gemini Requests' },
                    Anthropic: { limit: 100, title: 'Claude Requests' },
                    Groq: { limit: 14400, title: 'Groq Requests' }
                  }).map(([key, info]) => {
                    const usageObj = scraperStats.apiStats[key] || { success: 0, failed: 0 };
                    const totalUsed = usageObj.success + usageObj.failed;
                    const percent = Math.min(100, Math.round((totalUsed / info.limit) * 100));
                    
                    return (
                      <div key={key} className="bg-zinc-900/50 border border-white/5 p-4 rounded-2xl space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-zinc-400">{info.title}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-bold bg-zinc-950 text-purple-300 border border-white/5">
                            Today
                          </span>
                        </div>
                        
                        <div className="space-y-1">
                          <div className="flex justify-between items-baseline">
                            <span className="text-lg font-black text-white">{totalUsed}</span>
                            <span className="text-[10px] text-zinc-500">/ {info.limit} limit</span>
                          </div>
                          
                          <div className="w-full h-1.5 bg-zinc-950 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${
                                percent > 85 ? 'bg-red-500' : percent > 50 ? 'bg-amber-500' : 'bg-purple-500'
                              }`} 
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        </div>
                        
                        <div className="flex justify-between text-[9px] font-semibold">
                          <span className="text-emerald-400">✔ {usageObj.success} ok</span>
                          <span className="text-red-400">✖ {usageObj.failed} err</span>
                        </div>
                      </div>
                    );
                  })}
                  
                </div>

                {/* Scraper crawl runs logs table */}
                <div className="border border-white/5 rounded-2xl bg-zinc-900/30 overflow-hidden">
                  <div className="p-4 border-b border-white/5 bg-zinc-900/10">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Crawl Runtime logs</h3>
                  </div>
                  
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-white/5 bg-zinc-950/40 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                          <th className="p-3">Platform</th>
                          <th className="p-3">Start Time</th>
                          <th className="p-3">Duration</th>
                          <th className="p-3">Status</th>
                          <th className="p-3 text-right">Jobs Parsed</th>
                          <th className="p-3 text-right">Jobs Saved</th>
                          <th className="p-3">Error Context</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 text-xs">
                        {scraperStats.crawlLogs.length > 0 ? (
                          scraperStats.crawlLogs.map((log: any) => {
                            const durationSec = Math.round((new Date(log.endTime).getTime() - new Date(log.startTime).getTime()) / 1000);
                            
                            return (
                              <tr key={log._id} className="hover:bg-white/[0.02] transition">
                                <td className="p-3 font-bold text-white">{log.platform}</td>
                                <td className="p-3 text-zinc-400">{new Date(log.startTime).toLocaleString()}</td>
                                <td className="p-3 text-zinc-400 font-mono">{durationSec}s</td>
                                <td className="p-3">
                                  {log.status === 'success' ? (
                                    <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase">Success</span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-bold uppercase">Failed</span>
                                  )}
                                </td>
                                <td className="p-3 text-right font-mono text-zinc-300">{log.jobsParsed}</td>
                                <td className="p-3 text-right font-mono text-zinc-300">{log.jobsSaved}</td>
                                <td className="p-3 text-red-400 max-w-[200px] truncate" title={log.errorMessage}>
                                  {log.errorMessage || '-'}
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan={7} className="p-6 text-center text-zinc-500">
                              No background scraper runs logged yet. Try triggering a crawl above!
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            ) : (
              <div className="p-8 text-center text-zinc-500 bg-zinc-900/10 border border-white/5 rounded-2xl">
                Failed to load scraper statistics.
              </div>
            )}
          </div>
        )}
      </div>
      </div>

      {/* Custom Confirm Modal */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-zinc-950 border border-white/10 shadow-2xl rounded-2xl p-6 max-w-sm w-full relative overflow-hidden transform transition-all animate-in zoom-in-95 duration-200">
            {/* Top gradient line */}
            <div className={`absolute top-0 left-0 w-full h-1 ${confirmDialog.isDanger ? 'bg-gradient-to-r from-red-500 to-rose-500' : 'bg-gradient-to-r from-purple-500 to-indigo-500'}`} />
            
            <div className="flex items-start gap-4">
              <div className={`p-3 rounded-2xl shrink-0 ring-1 ${confirmDialog.isDanger ? 'bg-red-500/10 ring-red-500/30' : 'bg-purple-500/10 ring-purple-500/30'}`}>
                {confirmDialog.isDanger ? (
                  <AlertTriangle className="w-6 h-6 text-red-400" />
                ) : (
                  <HelpCircle className="w-6 h-6 text-purple-400" />
                )}
              </div>
              <div className="flex-1 mt-1">
                <h3 className="text-lg font-bold text-white mb-2">{confirmDialog.title}</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">{confirmDialog.message}</p>
              </div>
            </div>
            
            <div className="mt-8 flex justify-end gap-3">
              <button 
                onClick={confirmDialog.onCancel}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-zinc-400 hover:text-white hover:bg-white/5 transition"
              >
                Cancel
              </button>
              <button 
                onClick={confirmDialog.onConfirm}
                className={`px-4 py-2 rounded-xl text-sm font-bold text-white shadow-lg transition-all ${
                  confirmDialog.isDanger 
                    ? 'bg-red-600 hover:bg-red-500 shadow-red-500/20 hover:shadow-red-500/40' 
                    : 'bg-purple-600 hover:bg-purple-500 shadow-purple-500/20 hover:shadow-purple-500/40'
                }`}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
