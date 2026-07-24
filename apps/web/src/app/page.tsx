'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, Bot, Cpu, Sparkles, Briefcase, FileText, CheckCircle, Shield, Zap, Layers, Clock, Activity } from 'lucide-react';
import { motion } from 'framer-motion';

import { useUser, useAuth } from '@/context/FirebaseAuthContext';

export default function LandingPage() {
  const { user, isLoaded, isSignedIn } = useUser();
  const { signOut } = useAuth();
  const isAdmin = user?.primaryEmailAddress?.emailAddress === 'jobcopilot.ai@gmail.com';

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { type: 'spring', stiffness: 100, damping: 15 }
    }
  };

  return (
    <div className="flex-1 bg-[#050508] text-white relative overflow-hidden flex flex-col justify-between min-h-screen">
      {/* Animated Floating Gradient Background Orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <style jsx global>{`
          @keyframes drift-slow {
            0% { transform: translate(0px, 0px) scale(1); }
            33% { transform: translate(40px, -60px) scale(1.15); }
            66% { transform: translate(-30px, 30px) scale(0.9); }
            100% { transform: translate(0px, 0px) scale(1); }
          }
          @keyframes drift-medium {
            0% { transform: translate(0px, 0px) scale(1); }
            50% { transform: translate(-50px, 50px) scale(1.2); }
            100% { transform: translate(0px, 0px) scale(1); }
          }
          .orb-1 { 
            animation: drift-slow 22s infinite ease-in-out;
            will-change: transform;
          }
          .orb-2 { 
            animation: drift-medium 18s infinite ease-in-out;
            will-change: transform;
          }
          .grid-overlay {
            background-image: 
              linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px);
            background-size: 50px 50px;
          }
        `}</style>

        {/* Subtle Grid Pattern Overlay */}
        <div className="absolute inset-0 grid-overlay opacity-30" />

        {/* Radial Lights */}
        <div 
          className="absolute top-[-10%] left-[-5%] w-[600px] h-[600px] rounded-full orb-1" 
          style={{ background: 'radial-gradient(circle, rgba(168, 85, 247, 0.15) 0%, transparent 70%)' }}
        />
        <div 
          className="absolute bottom-[-10%] right-[-5%] w-[650px] h-[650px] rounded-full orb-2" 
          style={{ background: 'radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, transparent 70%)' }}
        />
        <div 
          className="absolute top-[35%] left-[30%] w-[450px] h-[450px] rounded-full orb-1" 
          style={{ background: 'radial-gradient(circle, rgba(139, 92, 246, 0.12) 0%, transparent 70%)' }}
        />
      </div>

      {/* Header */}
      <header className="max-w-7xl mx-auto w-full px-6 py-6 flex justify-between items-center border-b border-white/5 relative z-10 backdrop-blur-sm bg-black/5">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-gradient-to-tr from-purple-500 to-indigo-500 shadow-md shadow-purple-500/10">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <span className="font-bold text-xl tracking-tight bg-gradient-to-r from-purple-400 via-violet-300 to-indigo-400 bg-clip-text text-transparent">
            AI Job Copilot
          </span>
        </div>
        <div className="flex gap-4 items-center">
          <div className="hidden md:flex items-center gap-6 relative z-10">
            {isLoaded ? (
              isSignedIn ? (
                <div className="flex items-center gap-4">
                  <Link href="/dashboard" className="text-sm font-semibold text-white hover:text-purple-400 transition">
                    Dashboard
                  </Link>
                  <button 
                    onClick={() => signOut()}
                    className="text-sm font-medium text-neutral-400 hover:text-white transition"
                  >
                    Sign Out
                  </button>
                </div>
              ) : (
                <>
                  <Link href="/login?tab=signin" className="text-sm font-semibold text-white hover:text-purple-400 transition">
                    Log in
                  </Link>
                  <Link href="/login?tab=signup" className="px-5 py-2.5 rounded-full bg-white text-black font-semibold text-sm hover:bg-neutral-200 transition">
                    Sign up
                  </Link>
                </>
              )
            ) : null}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-6 py-24 flex-1 flex flex-col justify-center items-center text-center relative z-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-500/5 border border-purple-500/20 text-xs font-semibold text-purple-300 mb-8"
        >
          <Sparkles className="w-3.5 h-3.5 text-purple-400 animate-pulse" /> 
          <span>Next Generation AI Application Suite</span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-[40px] sm:text-5xl md:text-8xl font-black tracking-tight max-w-5xl leading-[1.1] md:leading-[1.05]"
        >
          {/* Desktop Heading */}
          <span className="hidden md:block">
            Automate Your Job <br />
            <span className="text-gradient drop-shadow-md">Search And Apply</span>
          </span>
          {/* Mobile Heading */}
          <span className="block md:hidden">
            Automate Your <br />
            <span className="text-gradient drop-shadow-md">Job Search</span> <br />
            <span className="text-gradient drop-shadow-md">And Apply</span>
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-neutral-400 text-lg md:text-xl max-w-2xl mt-8 leading-relaxed font-medium"
        >
          Upload your resume, set your career filters, and let Claude AI semantically match, custom tailor credentials, and automate submissions on autopilot.
        </motion.p>

        {/* Call to Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="flex flex-col sm:flex-row gap-4 mt-12 justify-center w-full max-w-md relative z-20"
        >
          {isLoaded ? (
            !isSignedIn ? (
              <>
                <Link
                  href="/login?tab=signup"
                  className="px-8 py-4.5 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm transition-all hover:shadow-lg hover:shadow-purple-500/20 hover:scale-102 ai-glow text-center flex-1 cursor-pointer flex items-center justify-center gap-2 border border-purple-500/30"
                >
                  Get Started <Zap className="w-4 h-4 fill-white" />
                </Link>
                <Link
                  href="/login?tab=signin"
                  className="px-8 py-4.5 rounded-2xl bg-neutral-900/60 border border-white/5 hover:bg-neutral-800 text-white font-bold text-sm transition-all hover:scale-102 text-center flex-1 cursor-pointer hover:border-purple-500/20"
                >
                  Sign In / Register
                </Link>
              </>
            ) : (
              <Link
                href="/dashboard"
                className="px-8 py-4.5 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm transition-all hover:shadow-lg hover:shadow-purple-500/20 hover:scale-102 ai-glow text-center flex-1 cursor-pointer flex items-center justify-center gap-2 border border-purple-500/30"
              >
                Launch Dashboard <ArrowRight className="w-4 h-4" />
              </Link>
            )
          ) : null}
        </motion.div>

        {/* Features Preview Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 md:gap-8 mt-20 md:mt-28 w-full px-4 md:px-0"
        >
          {/* Card 1 */}
          <motion.div 
            variants={itemVariants}
            className="glass-card p-8 flex flex-col items-center text-center group border border-white/5"
          >
            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center mb-6 text-purple-400 group-hover:scale-110 group-hover:bg-purple-500/25 transition duration-300 border border-purple-500/10">
              <Cpu className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-lg text-white mb-2 group-hover:text-purple-300 transition">Save Time with High-Match Jobs</h3>
            <p className="text-neutral-400 text-sm leading-relaxed font-medium">
              Instantly filter out low-quality listings. Focus your energy only on highly matched jobs curated semantically for your profile.
            </p>
          </motion.div>

          {/* Card 2 */}
          <motion.div 
            variants={itemVariants}
            className="glass-card p-8 flex flex-col items-center text-center group border border-white/5"
          >
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center mb-6 text-indigo-400 group-hover:scale-110 group-hover:bg-indigo-500/25 transition duration-300 border border-indigo-500/10">
              <Sparkles className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-lg text-white mb-2 group-hover:text-indigo-300 transition">Pass the ATS Screening</h3>
            <p className="text-neutral-400 text-sm leading-relaxed font-medium">
              Get higher call-back rates. Pinpoint keyword gaps in your resume and automatically rewrite experience bullet points to match the target job.
            </p>
          </motion.div>

          {/* Card 3 */}
          <motion.div 
            variants={itemVariants}
            className="glass-card p-8 flex flex-col items-center text-center group border border-white/5"
          >
            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center mb-6 text-purple-400 group-hover:scale-110 group-hover:bg-purple-500/25 transition duration-300 border border-purple-500/10">
              <CheckCircle className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-lg text-white mb-2 group-hover:text-purple-300 transition">Land Interviews on Autopilot</h3>
            <p className="text-neutral-400 text-sm leading-relaxed font-medium">
              Apply to hundreds of target positions automatically. The copilot handles form submission pipelines while you prepare for interviews.
            </p>
          </motion.div>

          {/* Card 4 */}
          <motion.div 
            variants={itemVariants}
            className="glass-card p-8 flex flex-col items-center text-center group border border-white/5"
          >
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center mb-6 text-indigo-400 group-hover:scale-110 group-hover:bg-indigo-500/25 transition duration-300 border border-indigo-500/10">
              <Layers className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-lg text-white mb-2 group-hover:text-indigo-300 transition">Track Statuses in Real-Time</h3>
            <p className="text-neutral-400 text-sm leading-relaxed font-medium">
              Stay organized and never miss an update. Monitor submission statuses, interview schedules, and response histories in a single clean dashboard.
            </p>
          </motion.div>
        </motion.div>
      </main>

      <footer className="border-t border-white/5 py-8 text-center text-neutral-500 text-xs relative z-10 backdrop-blur-sm bg-black/10">
        <p>&copy; {new Date().getFullYear()} AI Job Copilot. All rights reserved.</p>
      </footer>
    </div>
  );
}
