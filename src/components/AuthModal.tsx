import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Mail, Lock, User as UserIcon, Shield, CheckCircle2, AlertCircle } from 'lucide-react';
import { User, AuthResponse } from '../types';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (user: User, token: string) => void;
  isInline?: boolean;
}

export default function AuthModal({ isOpen, onClose, onAuthSuccess, isInline = false }: AuthModalProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'Admin' | 'Editor' | 'Reader'>('Reader');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    const url = isLogin ? '/api/auth/login' : '/api/auth/register';
    const payload = isLogin 
      ? { email, password } 
      : { name, email, password, role };

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'অনুমোদন ব্যর্থ হয়েছে।');
      }

      setSuccess(isLogin ? "স্বাগতম! আপনার সেশন সফলভাবে অনুমোদিত হয়েছে।" : "অ্যাকাউন্ট সফলভাবে তৈরি করা হয়েছে! আপনাকে স্বাগতম।");
      
      // Save session details
      setTimeout(() => {
        onAuthSuccess(data.user, data.token);
        onClose();
        // Reset form
        setName('');
        setEmail('');
        setPassword('');
        setSuccess(null);
      }, 1000);

    } catch (err: any) {
      console.error(err);
      setError(err.message || 'সংযোগ অফলাইন অথবা অনুমোদন প্রত্যাখ্যাত হয়েছে।');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (roleName: 'Admin' | 'Editor' | 'Reader') => {
    setIsLogin(true);
    let quickEmail = '';
    let quickPassword = '';

    if (roleName === 'Admin') {
      quickEmail = 'admin@chronicle.com';
      quickPassword = 'adminpassword';
    } else if (roleName === 'Editor') {
      quickEmail = 'editor@chronicle.com';
      quickPassword = 'editorpassword';
    } else {
      quickEmail = 'reader@chronicle.com';
      quickPassword = 'readerpassword';
    }

    setEmail(quickEmail);
    setPassword(quickPassword);
  };

  if (!isOpen) return null;

  const content = (
    <motion.div
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.95, opacity: 0 }}
      className="bg-stone-50 border border-stone-200 rounded-xl shadow-2xl w-full max-w-md overflow-hidden relative text-stone-900 mx-auto"
    >
      {/* Header decoration */}
      <div className="h-1.5 bg-stone-950 w-full" />

      {/* Close Button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-1.5 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-all cursor-pointer"
        title="ফিরে যান"
      >
        <X className="w-5 h-5" />
      </button>

      <div className="p-6 md:p-8 space-y-6">
        <div className="text-center space-y-1">
          <h2 className="font-serif text-2xl font-bold tracking-tight text-stone-950 italic">
            {isLogin ? "নিবন্ধকরণ পোর্টাল লগইন" : "পোর্টালে নিবন্ধন করুন"}
          </h2>
          <p className="text-xs text-stone-500 font-serif">
            {isLogin ? "সাবস্ক্রাইব করতে, মন্তব্য করতে এবং আপনার নিউজরুম ড্যাশবোর্ড পরিচালনা করতে লগইন করুন।" : "আপনার অ্যাকাউন্টের ভূমিকা অনুযায়ী পোর্টাল অ্যাক্সেস পেতে প্রয়োজনীয় তথ্য দিয়ে নিবন্ধন সম্পন্ন করুন।"}
          </p>
        </div>

        {/* Quick testing badges */}
        {isLogin && (
          <div className="bg-stone-100 p-3.5 rounded-lg border border-stone-200 space-y-2">
            <span className="text-[10px] font-serif font-bold text-stone-500 uppercase tracking-wider block">
              ⚡ দ্রুত ডেমো অ্যাকাউন্ট পরীক্ষা করুন
            </span>
            <div className="grid grid-cols-3 gap-1.5 font-serif">
              <button
                type="button"
                onClick={() => handleQuickLogin('Admin')}
                className="bg-white border border-stone-200 hover:border-stone-800 text-[11px] py-1 rounded shadow-xs cursor-pointer text-stone-800 transition-colors"
              >
                অ্যাডমিন
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('Editor')}
                className="bg-white border border-stone-200 hover:border-stone-800 text-[11px] py-1 rounded shadow-xs cursor-pointer text-stone-800 transition-colors"
              >
                সম্পাদক
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('Reader')}
                className="bg-white border border-stone-200 hover:border-stone-800 text-[11px] py-1 rounded shadow-xs cursor-pointer text-stone-800 transition-colors"
              >
                সাধারণ পাঠক
              </button>
            </div>
          </div>
        )}

        {/* Auth Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          
          {!isLogin && (
            <div>
              <label className="text-[11px] font-serif font-bold text-stone-500 tracking-wider block">আপনার পুরো নাম</label>
              <div className="relative mt-1">
                <UserIcon className="absolute left-3 top-3 w-4 h-4 text-stone-400" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="উদা: সাজিদ রহমান"
                  className="w-full text-xs font-serif pl-10 pr-4 py-2.5 bg-white border border-stone-200 rounded-lg outline-stone-800"
                />
              </div>
            </div>
          )}

          <div>
            <label className="text-[11px] font-serif font-bold text-stone-500 tracking-wider block">ইমেইল ঠিকানা</label>
            <div className="relative mt-1">
              <Mail className="absolute left-3 top-3 w-4 h-4 text-stone-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="উদা: sajid@domain.com"
                className="w-full text-xs font-serif pl-10 pr-4 py-2.5 bg-white border border-stone-200 rounded-lg outline-stone-800"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-serif font-bold text-stone-500 tracking-wider block">নিরাপত্তা পাসওয়ার্ড</label>
            <div className="relative mt-1">
              <Lock className="absolute left-3 top-3 w-4 h-4 text-stone-400" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full text-xs font-sans pl-10 pr-4 py-2.5 bg-white border border-stone-200 rounded-lg outline-stone-800"
              />
            </div>
          </div>

          {!isLogin && (
            <div>
              <label className="text-[11px] font-serif font-bold text-stone-500 tracking-wider block mb-1">
                ব্যবহারকারীর ভূমিকা নির্ধারণ করুন
              </label>
              <div className="grid grid-cols-3 gap-2 font-serif">
                {(['Admin', 'Editor', 'Reader'] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={`py-2 text-[12px] font-bold rounded-lg border transition-all cursor-pointer ${
                      role === r 
                        ? 'bg-stone-900 border-stone-900 text-white' 
                        : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-100'
                    }`}
                  >
                    {r === 'Admin' ? 'অ্যাডমিন' : r === 'Editor' ? 'সম্পাদক' : 'পাঠক'}
                  </button>
                ))}
              </div>
              <span className="text-[10px] text-stone-400 font-serif mt-1 block">
                * অ্যাডমিন সম্পূর্ণ নিয়ন্ত্রণ পান; সম্পাদক নতুন নিবন্ধ তৈরি ও সম্পাদনা করতে পারেন; পাঠক শুধুমাত্র মন্তব্য করতে পারেন।
              </span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-stone-950 hover:bg-stone-800 text-white font-serif text-xs font-bold tracking-widest uppercase py-3 rounded-lg cursor-pointer transition-colors disabled:opacity-50 mt-2 shadow-xs flex items-center justify-center gap-1.5"
          >
            {loading ? (
              <>
                <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>যাচাই করা হচ্ছে...</span>
              </>
            ) : (
              <span>{isLogin ? "লগইন করুন" : "নিবন্ধন করুন"}</span>
            )}
          </button>
        </form>

        {/* Feedback blocks */}
        {error && (
          <div className="p-3 rounded-lg bg-red-50 text-red-700 border border-red-100 text-xs font-mono flex items-start gap-1.5">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="p-3 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-100 text-xs font-mono flex items-start gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
            <span>{success}</span>
          </div>
        )}

        {/* Switch toggle */}
        <div className="text-center">
          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setError(null);
              setSuccess(null);
            }}
            className="text-xs text-stone-600 hover:text-stone-950 font-serif italic hover:underline cursor-pointer"
          >
            {isLogin ? "কোনো অ্যাকাউন্ট নেই? নিবন্ধন করুন" : "ইতিমধ্যে অ্যাকাউন্ট আছে? লগইন করুন"}
          </button>
        </div>

      </div>
    </motion.div>
  );

  if (isInline) {
    return (
      <div className="w-full max-w-md select-none">
        {content}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-55 p-4 select-none">
      {content}
    </div>
  );
}
