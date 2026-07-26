import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Newspaper, Calendar, Search, ArrowRight, Heart, MessageSquare, 
  Share2, X, Sparkles, Send, CheckCircle2, AlertTriangle, Clock, Eye, ShieldAlert, Loader2, LogOut, KeyRound, Check, Link2
} from 'lucide-react';
import { Article, Comment, User } from '../types';

const CATEGORY_LABELS: Record<string, { bn: string; en: string }> = {
  'All': { bn: 'প্রচ্ছদ', en: 'Home' },
  'Politics': { bn: 'রাজনীতি', en: 'Politics' },
  'Tech': { bn: 'বিজ্ঞান ও প্রযুক্তি', en: 'Tech' },
  'Business': { bn: 'বাণিজ্য', en: 'Business' },
  'Science': { bn: 'বিজ্ঞান', en: 'Science' },
  'Culture': { bn: 'বিনোদন ও সংস্কৃতি', en: 'Culture' },
  'Opinions': { bn: 'মতামত', en: 'Opinions' }
};

interface ReaderViewProps {
  onEnterAdmin: () => void;
  articles: Article[];
  setArticles: React.Dispatch<React.SetStateAction<Article[]>>;
  currentUser: User | null;
  onLogout: () => void;
  onTriggerAuth: () => void;
  token: string;
}

export default function ReaderView({ 
  onEnterAdmin, 
  articles, 
  setArticles, 
  currentUser, 
  onLogout, 
  onTriggerAuth,
  token 
}: ReaderViewProps) {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeArticle, setActiveArticle] = useState<Article | null>(null);

  const publishedArticles = articles.filter(a => a.status === 'published');
  const currentArticleIndex = activeArticle ? publishedArticles.findIndex(a => a.id === activeArticle.id) : -1;
  const prevArticle = activeArticle && currentArticleIndex > 0 ? publishedArticles[currentArticleIndex - 1] : null;
  const nextArticle = activeArticle && currentArticleIndex >= 0 && currentArticleIndex < publishedArticles.length - 1 ? publishedArticles[currentArticleIndex + 1] : null;

  // Compute Related Articles (same category first, exclude active article, fallback to any other published articles if none)
  const relatedArticles = activeArticle
    ? publishedArticles.filter(art => art.category === activeArticle.category && art.id !== activeArticle.id)
    : [];
  const fallbackRelatedArticles = (activeArticle && relatedArticles.length === 0)
    ? publishedArticles.filter(art => art.id !== activeArticle.id)
    : relatedArticles;
  const limitedRelatedArticles = fallbackRelatedArticles.slice(0, 3);
  
  // Backend Search States
  const [searchResults, setSearchResults] = useState<Article[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // Newsletter Subscribe
  const [email, setEmail] = useState('');
  const [subscribedMsg, setSubscribedMsg] = useState<string | null>(null);
  const [subscribing, setSubscribing] = useState(false);

  // Footer Newsletter Subscribe
  const [footerEmail, setFooterEmail] = useState('');
  const [footerSubscribedMsg, setFooterSubscribedMsg] = useState<string | null>(null);
  const [footerSubscribing, setFooterSubscribing] = useState(false);

  // Active Reading states
  const [activeComments, setActiveComments] = useState<Comment[]>([]);
  const [newCommentBody, setNewCommentBody] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [commentFeedback, setCommentFeedback] = useState<{ text: string; isError: boolean } | null>(null);
  
  // Advertisement State
  const [ads, setAds] = useState<any[]>([]);
  const [viewedAdIds, setViewedAdIds] = useState<Set<number>>(new Set());

  // Right Column Tabs (Latest / Most Read)
  const [rightColTab, setRightColTab] = useState<'latest' | 'popular'>('latest');

  // Copy URL state
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedDetail, setCopiedDetail] = useState(false);

  // Auto News Sync State
  const [isSyncingNews, setIsSyncingNews] = useState(false);
  const [newsSyncMsg, setNewsSyncMsg] = useState<string | null>(null);

  const handleTriggerNewsSync = async () => {
    setIsSyncingNews(true);
    setNewsSyncMsg(null);
    try {
      const res = await fetch('/api/news-fetcher/sync', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setNewsSyncMsg(`✓ ${data.addedCount}টি নতুন খবর পরিমার্জিত শিরোনাম সহ যুক্ত হয়েছে`);
        // Refresh articles list
        const articlesRes = await fetch('/api/articles');
        if (articlesRes.ok) {
          const freshArticles = await articlesRes.json();
          setArticles(freshArticles);
        }
      } else {
        setNewsSyncMsg('সংবাদ সিঙ্ক ব্যর্থ হয়েছে');
      }
    } catch (err) {
      setNewsSyncMsg('সার্ভার যোগাযোগে সমস্যা হয়েছে');
    } finally {
      setIsSyncingNews(false);
      setTimeout(() => setNewsSyncMsg(null), 4000);
    }
  };

  // Tracking duration on open article
  const readTimerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);

  // Synchronize activeArticle with URL Hash for back/forward navigation and deep linking
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash.startsWith('#/article/')) {
        const id = hash.replace('#/article/', '');
        const found = articles.find(a => String(a.id) === id);
        if (found) {
          if (!activeArticle || String(activeArticle.id) !== id) {
            openArticle(found, false);
          }
        } else {
          setActiveArticle(null);
        }
      } else {
        if (activeArticle) {
          setActiveArticle(null);
        }
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    if (articles && articles.length > 0) {
      handleHashChange();
    }

    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [articles, activeArticle]);

  // Fetch advertisements
  const fetchAds = async () => {
    try {
      const res = await fetch('/api/ads');
      if (res.ok) {
        const data = await res.json();
        setAds(data.filter((ad: any) => ad.status === 'active'));
      }
    } catch (err) {
      console.error("Failed to load active sponsor banners", err);
    }
  };

  useEffect(() => {
    fetchAds();
  }, [articles]);

  // Debounced site-wide keyword search on title and body content
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/articles/search?q=${encodeURIComponent(searchQuery)}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.filter((a: Article) => a.status === 'published'));
        }
      } catch (err) {
        console.error("Backend site-wide search failed:", err);
      } finally {
        setIsSearching(false);
      }
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  // Load article comments and log impression
  const openArticle = async (article: Article, updateHash = true) => {
    if (updateHash) {
      window.location.hash = `#/article/${article.id}`;
    }
    setActiveArticle(article);
    setNewCommentBody('');
    setCommentFeedback(null);
    setCopiedDetail(false);
    window.scrollTo(0, 0);
    
    // Log view impression
    try {
      fetch('/api/analytics/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          articleId: article.id,
          eventType: 'view',
          device: window.innerWidth < 768 ? 'Mobile' : 'Desktop',
          country: 'BD'
        })
      });

      // Update views locally
      setArticles(prev => prev.map(a => a.id === article.id ? { ...a, views: (a.views || 0) + 1 } : a));

      // Fetch comments
      const res = await fetch('/api/comments');
      if (res.ok) {
        const commentsList: Comment[] = await res.json();
        setActiveComments(commentsList.filter(c => c.articleId === article.id && c.status === 'approved'));
      }
    } catch (e) {
      console.error("Error opening article telemetry:", e);
    }

    // Start timer for complete-read calculation
    startTimeRef.current = Date.now();
    if (readTimerRef.current) clearTimeout(readTimerRef.current);
    
    // Deem "Read Complete" after 20 seconds of having the modal active
    readTimerRef.current = setTimeout(() => {
      try {
        fetch('/api/analytics/event', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            articleId: article.id,
            eventType: 'read_complete',
            durationSeconds: Math.floor((Date.now() - startTimeRef.current) / 1000),
            device: window.innerWidth < 768 ? 'Mobile' : 'Desktop',
            country: 'BD'
          })
        });

        // Update reads locally
        setArticles(prev => prev.map(a => a.id === article.id ? { ...a, reads: (a.reads || 0) + 1 } : a));
        setActiveArticle(prev => prev ? { ...prev, reads: (prev.reads || 0) + 1 } : null);
      } catch (e) {
        console.error(e);
      }
    }, 20000);
  };

  const closeArticle = () => {
    if (readTimerRef.current) {
      clearTimeout(readTimerRef.current);
      readTimerRef.current = null;
    }
    window.location.hash = '#/';
    setActiveArticle(null);
    window.scrollTo(0, 0);
  };

  const handleGoHome = () => {
    setSelectedCategory('All');
    setSearchQuery('');
    closeArticle();
  };

  // Like Article
  const handleLikeArticle = async (article: Article) => {
    try {
      await fetch('/api/analytics/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          articleId: article.id,
          eventType: 'like',
          device: window.innerWidth < 768 ? 'Mobile' : 'Desktop',
          country: 'BD'
        })
      });

      setArticles(prev => prev.map(a => a.id === article.id ? { ...a, likes: (a.likes || 0) + 1 } : a));
      setActiveArticle(prev => prev ? { ...prev, likes: (prev.likes || 0) + 1 } : null);
    } catch (e) {
      console.error(e);
    }
  };

  // Submit comment
  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentBody.trim() || !activeArticle || !currentUser) return;

    setCommentSubmitting(true);
    setCommentFeedback(null);

    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          articleId: activeArticle.id,
          content: newCommentBody
        })
      });

      if (!res.ok) throw new Error('Comment registry offline or unauthorized.');

      const newComment: Comment = await res.json();
      
      if (newComment.status === 'flagged') {
        setCommentFeedback({
          text: `🚨 এআই সেফটি শিল্ড দ্বারা অবরুদ্ধ: "${newComment.flagReason || 'নীতিমালা পরিপন্থী শব্দ ব্যবহার করা হয়েছে'}"। সম্পাদকীয় পর্যালোচনার জন্য অপেক্ষমাণ।`,
          isError: true
        });
      } else {
        setCommentFeedback({
          text: '✓ মন্তব্যটি সফলভাবে অনুমোদিত এবং প্রকাশিত হয়েছে!',
          isError: false
        });
        setActiveComments(prev => [...prev, newComment]);
        setNewCommentBody('');
      }

    } catch (err: any) {
      setCommentFeedback({ text: 'Failed to post comment. Your session might be expired.', isError: true });
    } finally {
      setCommentSubmitting(false);
    }
  };

  // Newsletter signup
  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes('@')) return;

    setSubscribing(true);
    setSubscribedMsg(null);

    try {
      const res = await fetch('/api/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to dispatch subscription.');
      }

      setSubscribedMsg('✓ ধন্যবাদ! আপনার ডিজিটাল সাবস্ক্রিপশনটি সক্রিয় করা হয়েছে।');
      setEmail('');
    } catch (err: any) {
      setSubscribedMsg(err.message || 'সাবস্ক্রিপশন সম্পন্ন করতে ত্রুটি হয়েছে।');
    } finally {
      setSubscribing(false);
    }
  };

  // Footer Newsletter signup
  const handleFooterSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!footerEmail.trim() || !footerEmail.includes('@')) return;

    setFooterSubscribing(true);
    setFooterSubscribedMsg(null);

    try {
      const res = await fetch('/api/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: footerEmail })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to dispatch subscription.');
      }

      setFooterSubscribedMsg('✓ ধন্যবাদ! আপনার ডিজিটাল সাবস্ক্রিপশনটি সক্রিয় করা হয়েছে।');
      setFooterEmail('');
    } catch (err: any) {
      setFooterSubscribedMsg(err.message || 'সাবস্ক্রিপশন সম্পন্ন করতে ত্রুটি হয়েছে।');
    } finally {
      setFooterSubscribing(false);
    }
  };

  // Ad Tracking Telemetry
  const handleAdView = (adId: number) => {
    if (viewedAdIds.has(adId)) return;
    setViewedAdIds(prev => {
      const updated = new Set(prev);
      updated.add(adId);
      return updated;
    });
    try {
      fetch(`/api/ads/${adId}/view`, { method: 'POST' });
    } catch (e) {
      console.error("Ad view analytics error", e);
    }
  };

  const handleAdClick = async (ad: any) => {
    try {
      await fetch(`/api/ads/${ad.id}/click`, { method: 'POST' });
    } catch (e) {
      console.error("Ad click analytics error", e);
    }
    window.open(ad.linkUrl, '_blank', 'noopener,noreferrer');
  };

  // Ad slot renderer
  const RenderAdSlot = ({ slot, className = "" }: { slot: 'top-banner' | 'sidebar' | 'mid-list' | 'bottom-banner', className?: string }) => {
    const targetAds = ads.filter(ad => ad.slot === slot);
    if (targetAds.length === 0) return null;
    
    // Pick the first active ad for this slot
    const ad = targetAds[0];
    
    // Register the impression once
    useEffect(() => {
      handleAdView(ad.id);
    }, [ad.id]);

    return (
      <div className={`flex flex-col items-center bg-stone-100 border border-stone-200 p-2 text-center rounded transition-all hover:bg-stone-200 ${className}`}>
        <span className="text-[8px] font-mono font-bold tracking-widest text-stone-400 uppercase mb-1 block">বিজ্ঞাপন</span>
        <button 
          onClick={() => handleAdClick(ad)}
          className="w-full relative group overflow-hidden block cursor-pointer"
        >
          <img 
            src={ad.imageUrl} 
            alt={ad.title} 
            className="w-full object-cover max-h-56 rounded transition-all group-hover:opacity-95"
          />
          <div className="absolute inset-0 bg-stone-900/10 opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
        <span className="text-[9px] font-mono text-stone-400 mt-1 truncate max-w-full italic">বিজ্ঞাপনদাতা: {ad.title}</span>
      </div>
    );
  };

  // Categories list
  const categories = ['All', 'Politics', 'Tech', 'Business', 'Science', 'Culture', 'Opinions'];

  // Filter & Search articles
  const filteredArticles = searchResults !== null
    ? (selectedCategory === 'All' ? searchResults : searchResults.filter(art => art.category === selectedCategory))
    : articles
        .filter(art => art.status === 'published')
        .filter(art => selectedCategory === 'All' || art.category === selectedCategory)
        .filter(art => {
          const query = searchQuery.toLowerCase();
          return art.title.toLowerCase().includes(query) || 
                 art.subtitle.toLowerCase().includes(query) ||
                 art.content.toLowerCase().includes(query);
        });

  // Hot Ticker Feed (Pulling top 3 latest published items)
  const hotTickerArticles = articles.filter(a => a.status === 'published').slice(0, 3);
  const [tickerIdx, setTickerIdx] = useState(0);

  useEffect(() => {
    if (hotTickerArticles.length === 0) return;
    const timer = setInterval(() => {
      setTickerIdx(prev => (prev + 1) % hotTickerArticles.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [hotTickerArticles.length]);

  // Tabbed widgets lists: Latest & Popular
  const latestArticles = [...articles]
    .filter(a => a.status === 'published')
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  const popularArticles = [...articles]
    .filter(a => a.status === 'published')
    .sort((a, b) => (b.views || 0) - (a.views || 0))
    .slice(0, 5);

  // Main Lead Story & grid listings
  const featuredArticle = filteredArticles[0];
  const secondaryArticles = filteredArticles.slice(1, 4);
  const remainingArticles = filteredArticles.slice(4);

  // Dynamic date string
  const getFormattedDate = () => {
    const options: Intl.DateTimeFormatOptions = { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };
    return new Date().toLocaleDateString('en-US', options);
  };

  const getFormattedBengaliDate = () => {
    const options: Intl.DateTimeFormatOptions = { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };
    return "আজ: " + new Date().toLocaleDateString('bn-BD', options);
  };

  // Clipboard share action helper
  const handleCopyLink = (art: Article, isDetail = false) => {
    const url = `${window.location.origin}/article/${art.id}`;
    navigator.clipboard.writeText(url);
    if (isDetail) {
      setCopiedDetail(true);
      setTimeout(() => setCopiedDetail(false), 2000);
    } else {
      setCopiedId(art.id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-[#FCFCFA] text-stone-900 font-sans flex flex-col selection:bg-rose-600 selection:text-white">
      
      {/* Front-Page Editorial Header (Prothom Alo Inspired) */}
      <header className="max-w-7xl w-full mx-auto px-4 lg:px-6 pt-3 space-y-4">
        
        {/* Top Utility Rail */}
        <div className="flex justify-between items-center text-[10px] font-mono tracking-wider text-stone-500 uppercase border-b border-stone-200 pb-2">
          <div className="flex items-center gap-3 font-serif">
            <button 
              onClick={handleGoHome} 
              className="font-extrabold text-rose-600 tracking-widest text-[11px] cursor-pointer hover:text-rose-700 transition-colors"
            >
              দৈনিক কথা প্রকাশ
            </button>
            <span className="text-stone-300">|</span>
            <span className="text-stone-600 font-bold">{getFormattedBengaliDate()}</span>
            <span className="hidden md:inline text-stone-300">|</span>
            <span className="hidden md:inline text-stone-500 font-medium">ঢাকা, বাংলাদেশ</span>
          </div>

          {/* Interactive Session HUD */}
          <div className="flex items-center gap-3">
            {/* Hourly Prothom Alo & Ittefaq Auto-Sync Badge */}
            <div className="hidden sm:flex items-center gap-1.5 bg-stone-100 border border-stone-200 px-2 py-0.5 rounded text-[9px] font-serif text-stone-600">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span>ঘণ্টায় খবর সিঙ্ক (প্রথম আলো ও ইত্তেফাক)</span>
              <button
                onClick={handleTriggerNewsSync}
                disabled={isSyncingNews}
                title="প্রথম আলো এবং ইত্তেফাক থেকে নতুন সংবাদ সরাসরি সিঙ্ক করুন"
                className="ml-1 text-rose-700 hover:text-rose-900 font-bold underline cursor-pointer disabled:opacity-50"
              >
                {isSyncingNews ? 'সিঙ্ক হচ্ছে...' : 'এখন সিঙ্ক করুন'}
              </button>
            </div>

            {newsSyncMsg && (
              <span className="text-[10px] font-serif font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 animate-fade-in">
                {newsSyncMsg}
              </span>
            )}

            {currentUser ? (
              <div className="flex items-center gap-2.5">
                <span className="flex items-center gap-1.5 text-stone-600 text-[11px]">
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>লগইন আছেন: <strong className="text-stone-900">{currentUser.name}</strong></span>
                </span>
                
                {(currentUser.role === 'Admin' || currentUser.role === 'Editor') && (
                  <button
                    onClick={onEnterAdmin}
                    className="bg-rose-600 hover:bg-rose-700 text-white px-2.5 py-1 rounded text-[9px] font-bold tracking-wider transition-all uppercase cursor-pointer shadow-xs"
                  >
                    নিউজরুম হাব &rarr;
                  </button>
                )}

                <button
                  onClick={onLogout}
                  className="text-stone-400 hover:text-stone-950 font-bold transition-all uppercase flex items-center gap-1 cursor-pointer"
                  title="Logout session"
                >
                  <LogOut className="w-3.5 h-3.5 text-stone-500" />
                  <span className="text-[10px]">প্রস্থান</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={onTriggerAuth}
                  className="bg-stone-200 hover:bg-stone-300 text-stone-800 px-3 py-1 rounded text-[10px] font-bold tracking-wide transition-all uppercase cursor-pointer"
                >
                  লগইন
                </button>
                <button
                  onClick={onTriggerAuth}
                  className="bg-stone-950 hover:bg-stone-800 text-white px-3 py-1 rounded text-[10px] font-bold tracking-wide transition-all uppercase cursor-pointer shadow-xs"
                >
                  নিবন্ধন
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Brand Giant Header (Exactly formatted like Prothom Alo) */}
        <div className="flex flex-col items-center py-6 border-b border-stone-200">
          <button 
            onClick={handleGoHome}
            className="flex flex-col md:flex-row items-center gap-4 md:gap-5 hover:opacity-90 active:scale-[0.99] transition-all text-left cursor-pointer focus:outline-hidden group"
          >
            {/* Prothom Alo iconic red circle badge layout with custom brand initial */}
            <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-rose-600 flex items-center justify-center text-white font-serif font-black text-2xl md:text-3xl shadow-sm border-2 border-white select-none relative shrink-0 group-hover:scale-105 transition-transform">
              ক
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-400 rounded-full border border-white flex items-center justify-center text-[8px] text-stone-950 font-bold">★</span>
            </div>
            <div className="text-center md:text-left space-y-0.5">
              <h1 className="font-serif text-4xl md:text-6xl font-black tracking-tight text-stone-950 leading-none group-hover:text-rose-700 transition-colors">
                দৈনিক কথা প্রকাশ পত্রিকা।
              </h1>
              <p className="text-xs md:text-sm font-serif font-bold text-stone-500 tracking-wider">
                দৈনিক কথা প্রকাশ <span className="text-rose-600 mx-1.5">•</span> সত্যের সন্ধানে নির্ভীক সাংবাদিকতা
              </p>
            </div>
          </button>
        </div>

        {/* Double Border Info bar */}
        <div className="py-2.5 border-b border-double border-stone-300 flex flex-col sm:flex-row justify-between items-center text-xs text-stone-700 gap-2 font-serif">
          <div className="flex items-center gap-1.5 font-bold text-stone-900">
            <Calendar className="w-3.5 h-3.5 text-rose-600" />
            <span>{getFormattedBengaliDate()}</span>
          </div>
          <div className="text-center italic uppercase font-black text-[9px] tracking-widest text-stone-400">
            ডিজিটাল সংস্করণ • ঢাকা • নিউ ইয়র্ক • লন্ডন
          </div>
          <div className="flex items-center gap-3 font-mono text-[10px] text-stone-500">
            <span>বর্ষ ১২৬... সংখ্যা ১৪৫</span>
            <span className="font-bold text-stone-900 uppercase">মূল্য সৌজন্যমূলক</span>
          </div>
        </div>

        {/* Active Breaking News Flash Ticker */}
        {hotTickerArticles.length > 0 && (
          <div className="bg-rose-50 border border-rose-100 rounded-md p-2 flex items-center gap-3 overflow-hidden shadow-2xs">
            <span className="bg-rose-600 text-white text-[9px] font-bold font-serif px-2.5 py-1 rounded shrink-0 animate-pulse tracking-wider">
              ব্রেকিং নিউজ
            </span>
            <div className="flex-grow min-w-0">
              <AnimatePresence mode="wait">
                <motion.div
                  key={tickerIdx}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.3 }}
                  onClick={() => openArticle(hotTickerArticles[tickerIdx])}
                  className="text-xs font-bold text-stone-900 cursor-pointer hover:text-[#0056b3] truncate font-serif flex items-center gap-1.5"
                >
                  <span className="text-rose-600 font-sans">•</span>
                  <span>{hotTickerArticles[tickerIdx].title}</span>
                  <span className="text-[10px] text-stone-400 font-normal italic"> - "{hotTickerArticles[tickerIdx].subtitle}"</span>
                </motion.div>
              </AnimatePresence>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-rose-500 shrink-0" />
          </div>
        )}

      </header>

      {/* Top Banner Ad slot (Dynamic sponsored placement) */}
      <section className="max-w-7xl w-full mx-auto px-4 lg:px-6 pt-4">
        <RenderAdSlot slot="top-banner" />
      </section>

      {/* Categories Bar & Site Search (Styled Exactly like Prothom Alo Horizontal Text Navigation) */}
      <section className="max-w-7xl w-full mx-auto px-4 lg:px-6 py-1 flex flex-col md:flex-row justify-between items-center border-b border-stone-200 gap-4 mt-2">
        
        {/* Category Horizontal list - Underline animations on hover/active */}
        <div className="flex items-center gap-6 overflow-x-auto w-full md:w-auto pb-3 md:pb-0 scrollbar-none select-none py-2">
          {categories.map((cat) => {
            const label = CATEGORY_LABELS[cat] || { bn: cat, en: cat };
            const isActive = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`text-[15px] font-serif font-bold cursor-pointer transition-all shrink-0 pb-1.5 relative group flex items-baseline gap-1 ${
                  isActive 
                    ? 'text-rose-600 font-extrabold' 
                    : 'text-stone-700 hover:text-rose-600'
                }`}
              >
                <span>{label.bn}</span>
                {isActive && (
                  <motion.div 
                    layoutId="activeCategoryBorder"
                    className="absolute bottom-0 left-0 right-0 h-[3px] bg-rose-600"
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Site Search Field */}
        <div className="relative w-full md:w-72 pb-2 md:pb-0">
          <Search className={`absolute left-3 top-2.5 w-4 h-4 ${isSearching ? 'text-stone-400 animate-spin' : 'text-stone-400'}`} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="অনুসন্ধান করুন..."
            className="w-full text-xs font-serif pl-9 pr-8 py-2.5 bg-stone-100 border border-stone-200 rounded-md outline-none focus:ring-1 focus:ring-rose-500"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-3 text-stone-400 hover:text-stone-700 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </section>

      {/* Primary Newspaper Content Layout (High-Density Bento Grid) */}
      <main className="max-w-7xl w-full mx-auto px-4 lg:px-6 py-6 md:py-8 flex-grow space-y-10">
        
        {activeArticle ? (
          /* Inline full page article details */
          <div className="bg-[#FCFCFA] p-4 md:p-8 rounded-lg border border-stone-200 space-y-8 select-text">
            
            {/* Navigation back and header banner info */}
            <div className="border-b border-stone-200 pb-4 flex justify-between items-center">
              <button
                onClick={closeArticle}
                className="flex items-center gap-2 text-sm font-bold font-serif text-stone-600 hover:text-rose-600 transition-colors cursor-pointer"
              >
                <ArrowRight className="w-5 h-5 text-rose-600 shrink-0 rotate-180" />
                <span>প্রচ্ছদে ফিরে যান</span>
              </button>
              <div className="text-[10px] font-serif text-stone-400 tracking-widest font-black uppercase hidden sm:block">
                দৈনিক কথা প্রকাশ পত্রিকা আর্কাইভ
              </div>
            </div>

            {/* Main Newspaper Article content sheet */}
            <div className="space-y-8">
              {/* Header Metadata */}
              <div className="space-y-4 max-w-3xl mx-auto">
                <div className="inline-block bg-rose-50 text-rose-700 text-xs font-serif font-black uppercase px-3 py-1 rounded border border-rose-100 tracking-wider">
                  {CATEGORY_LABELS[activeArticle.category]?.bn || activeArticle.category}
                </div>
                
                <h1 className="font-serif text-3xl md:text-5xl font-black tracking-tight leading-tight text-stone-950">
                  {activeArticle.title}
                </h1>

                <p className="font-serif text-stone-600 text-base md:text-xl leading-relaxed italic border-l-4 border-rose-500 pl-4 py-1.5 bg-stone-50 pr-2 rounded-r">
                  "{activeArticle.subtitle}"
                </p>

                {/* High-Fidelity Author & Date Info */}
                <div className="flex flex-col sm:flex-row justify-between sm:items-center py-4 border-t border-b border-stone-200 gap-3 text-xs text-stone-600 font-serif">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-rose-600 text-white flex items-center justify-center font-bold font-serif text-base shadow-xs">
                      {activeArticle.author.slice(0, 1)}
                    </div>
                    <div>
                      <span className="font-extrabold text-stone-900 block text-sm">{activeArticle.author}</span>
                      <span className="text-stone-400 text-[10px] block">বিশেষ সংবাদদাতা</span>
                    </div>
                  </div>
                  <div className="flex flex-col sm:items-end text-stone-500 text-[11px] font-sans">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-stone-400" />
                      <span>প্রকাশিত: {new Date(activeArticle.date).toLocaleDateString('bn-BD', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                    </span>
                    <span className="text-stone-400 text-[10px] mt-0.5">আপডেট করা হয়েছে: {new Date(activeArticle.date).toLocaleDateString('bn-BD')} {new Date(activeArticle.date).toLocaleTimeString('bn-BD')}</span>
                  </div>
                </div>
              </div>

              {/* Cover Image with Newspaper Caption */}
              <div className="w-full rounded-md bg-stone-100 border border-stone-200 overflow-hidden max-w-3xl mx-auto shadow-sm">
                <img 
                  src={activeArticle.image} 
                  alt={activeArticle.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-auto max-h-[480px] object-cover mx-auto"
                />
                <div className="bg-stone-50 p-3 border-t border-stone-100 text-xs text-stone-500 font-serif italic flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-600 shrink-0" />
                  <span>ছবি: সংগৃহীত - "{activeArticle.title}"</span>
                </div>
              </div>

              {/* Content Body Copy */}
              <div 
                className="font-serif text-[18px] md:text-[20px] text-stone-900 leading-relaxed md:leading-loose space-y-6 max-w-3xl mx-auto prose prose-stone prose-lg text-justify"
                dangerouslySetInnerHTML={{ __html: activeArticle.content }}
              />

              {/* Mid-Article Sponsor Slot */}
              <div className="my-8 max-w-3xl mx-auto">
                <RenderAdSlot slot="mid-list" className="bg-stone-100 p-4 rounded border border-stone-200" />
              </div>

              {/* Spectacular Social Sharing Row & Applaud action */}
              <div className="border-t border-b border-stone-200 py-6 max-w-3xl mx-auto space-y-4">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                  {/* Applaud / Like */}
                  <button
                    onClick={() => handleLikeArticle(activeArticle)}
                    className="flex items-center justify-center gap-2 px-5 py-2.5 bg-rose-50 hover:bg-rose-100 rounded-full text-xs font-bold font-sans transition-all cursor-pointer text-rose-700 shadow-2xs border border-rose-100"
                  >
                    <Heart className="w-4 h-4 text-rose-600 fill-rose-600" />
                    <span>ভালো লেগেছে ({activeArticle.likes || 0})</span>
                  </button>

                  {/* Copy Link button */}
                  <button
                    onClick={() => handleCopyLink(activeArticle, true)}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-800 hover:text-stone-950 rounded-full text-xs font-semibold font-mono tracking-wide transition-all cursor-pointer border border-stone-200"
                  >
                    {copiedDetail ? <Check className="w-4 h-4 text-emerald-600" /> : <Link2 className="w-4 h-4 text-stone-500" />}
                    <span>{copiedDetail ? 'লিঙ্ক কপি হয়েছে!' : 'স্থায়ী লিঙ্ক কপি করুন'}</span>
                  </button>
                </div>

                {/* All Social Sharing Links */}
                <div className="bg-stone-50 p-4 rounded-lg space-y-3 border border-stone-200">
                  <span className="text-[10px] font-mono font-bold tracking-widest text-stone-500 uppercase block">
                    প্রতিবেদনটি শেয়ার করুন
                  </span>
                  
                  <div className="flex flex-wrap gap-2.5">
                    {/* Facebook */}
                    <a
                      href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(`${window.location.origin}/article/${activeArticle.id}`)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="bg-[#1877F2] text-white font-sans text-[11px] font-bold px-4 py-2.5 rounded-md hover:opacity-90 flex items-center gap-1.5 transition-all shadow-2xs"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>ফেসবুকে শেয়ার করুন</span>
                    </a>

                    {/* Twitter / X */}
                    <a
                      href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(`${window.location.origin}/article/${activeArticle.id}`)}&text=${encodeURIComponent(activeArticle.title)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="bg-stone-900 text-white font-sans text-[11px] font-bold px-4 py-2.5 rounded-md hover:opacity-90 flex items-center gap-1.5 transition-all shadow-2xs"
                    >
                      <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                      </svg>
                      <span>এক্স (টুইটার)</span>
                    </a>

                    {/* WhatsApp */}
                    <a
                      href={`https://api.whatsapp.com/send?text=${encodeURIComponent(activeArticle.title + ' - ' + `${window.location.origin}/article/${activeArticle.id}`)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="bg-[#25D366] text-white font-sans text-[11px] font-bold px-4 py-2.5 rounded-md hover:opacity-90 flex items-center gap-1.5 transition-all shadow-2xs"
                    >
                      <MessageSquare className="w-3.5 h-3.5 fill-current text-white" />
                      <span>হোয়াটসঅ্যাপ</span>
                    </a>

                    {/* LinkedIn */}
                    <a
                      href={`https://www.linkedin.com/shareArticle?mini=true&url=${encodeURIComponent(`${window.location.origin}/article/${activeArticle.id}`)}&title=${encodeURIComponent(activeArticle.title)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="bg-[#0077B5] text-white font-sans text-[11px] font-bold px-4 py-2.5 rounded-md hover:opacity-90 flex items-center gap-1.5 transition-all shadow-2xs"
                    >
                      <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                        <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.779-1.75-1.75s.784-1.75 1.75-1.75 1.75.779 1.75 1.75-.784 1.75-1.75 1.75zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                      </svg>
                      <span>লিঙ্কডইন</span>
                    </a>
                  </div>
                </div>
              </div>

              {/* Prev and Next Articles */}
              {(prevArticle || nextArticle) && (
                <div className="border-t border-b border-stone-200 py-6 max-w-3xl mx-auto">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {prevArticle ? (
                      <button
                        onClick={() => openArticle(prevArticle)}
                        className="flex flex-col items-start p-4 bg-stone-50 hover:bg-stone-100 rounded-lg border border-stone-200 text-left transition-all group cursor-pointer"
                      >
                        <span className="text-[10px] font-serif text-stone-400 font-bold tracking-wider uppercase mb-1 flex items-center gap-1">
                          &larr; পূর্ববর্তী খবর
                        </span>
                        <span className="text-stone-500 text-xs font-serif font-black uppercase mb-1">
                          {CATEGORY_LABELS[prevArticle.category]?.bn || prevArticle.category}
                        </span>
                        <span className="font-serif font-bold text-stone-800 group-hover:text-rose-600 text-sm line-clamp-2 transition-colors">
                          {prevArticle.title}
                        </span>
                      </button>
                    ) : (
                      <div className="hidden sm:block" />
                    )}

                    {nextArticle ? (
                      <button
                        onClick={() => openArticle(nextArticle)}
                        className="flex flex-col items-end p-4 bg-stone-50 hover:bg-stone-100 rounded-lg border border-stone-200 text-right transition-all group cursor-pointer"
                      >
                        <span className="text-[10px] font-serif text-stone-400 font-bold tracking-wider uppercase mb-1 flex items-center gap-1">
                          পরবর্তী খবর &rarr;
                        </span>
                        <span className="text-stone-500 text-xs font-serif font-black uppercase mb-1">
                          {CATEGORY_LABELS[nextArticle.category]?.bn || nextArticle.category}
                        </span>
                        <span className="font-serif font-bold text-stone-800 group-hover:text-rose-600 text-sm line-clamp-2 transition-colors">
                          {nextArticle.title}
                        </span>
                      </button>
                    ) : (
                      <div className="hidden sm:block" />
                    )}
                  </div>
                </div>
              )}

              {/* Related Articles Section (Requested by user) */}
              {limitedRelatedArticles.length > 0 && (
                <div className="border-t border-stone-200 pt-8 pb-2 max-w-3xl mx-auto space-y-6">
                  <div className="flex items-center justify-between border-b border-rose-600 pb-1.5">
                    <h3 className="font-serif text-lg font-black text-stone-950 flex items-center gap-2">
                      <Newspaper className="w-5 h-5 text-rose-600" />
                      <span>আরও পড়ুন ({CATEGORY_LABELS[activeArticle.category]?.bn || activeArticle.category})</span>
                    </h3>
                    <span className="text-xs font-serif text-stone-400 font-bold hidden sm:inline">সম্পর্কিত খবরসমূহ</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                    {limitedRelatedArticles.map(art => (
                      <article
                        key={art.id}
                        onClick={() => openArticle(art)}
                        className="cursor-pointer group flex flex-row sm:flex-col gap-3 sm:gap-2 bg-stone-50/40 hover:bg-stone-50 p-2.5 rounded border border-stone-100 hover:border-stone-200 transition-all shadow-3xs"
                      >
                        <div className="w-24 h-16 sm:w-full sm:h-28 shrink-0 overflow-hidden rounded bg-stone-200 border border-stone-100 relative">
                          <img
                            src={art.image}
                            alt={art.title}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover group-hover:scale-101 transition-transform duration-300"
                          />
                        </div>
                        <div className="space-y-1 flex-grow">
                          <div className="text-[9px] font-serif font-bold text-rose-600 uppercase tracking-wider">
                            {CATEGORY_LABELS[art.category]?.bn || art.category}
                          </div>
                          <h4 className="font-serif text-xs md:text-sm font-bold text-stone-900 group-hover:text-rose-600 transition-colors line-clamp-2 leading-snug">
                            {art.title}
                          </h4>
                          <div className="flex items-center gap-2 text-[9px] text-stone-400 font-mono pt-1">
                            <span>{new Date(art.date).toLocaleDateString('bn-BD')}</span>
                            <span>•</span>
                            <span>{art.views || 0} পঠিত</span>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              )}

              {/* Commenting Board */}
              <div className="border-t border-stone-200 pt-8 max-w-3xl mx-auto space-y-6">
                <h3 className="font-serif text-lg font-black text-stone-950 flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-rose-600" />
                  <span>পাঠক মন্তব্য ({activeComments.length})</span>
                </h3>

                <div className="space-y-4">
                  {activeComments.length === 0 ? (
                    <p className="text-xs text-stone-400 font-mono italic">মন্তব্য করার প্রথম সুযোগটি আপনার। এই প্রতিবেদন সম্বন্ধে মতামত দিন।</p>
                  ) : (
                    activeComments.map(com => (
                      <div key={com.id} className="bg-stone-50 p-4 rounded-md border border-stone-200 space-y-2">
                        <div className="flex justify-between items-center text-[11px] font-mono">
                          <span className="font-black text-stone-800 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span>{com.author}</span>
                          </span>
                          <span className="text-stone-400">{new Date(com.date).toLocaleDateString('bn-BD')}</span>
                        </div>
                        <p className="text-sm text-stone-700 leading-relaxed font-sans">"{com.content}"</p>
                      </div>
                    ))
                  )}
                </div>

                {!currentUser ? (
                  <div className="bg-stone-50 border border-stone-200 p-6 rounded-lg text-center space-y-3">
                    <ShieldAlert className="w-8 h-8 text-stone-400 mx-auto animate-pulse" />
                    <h4 className="font-serif font-bold text-stone-800">মতামত প্রকাশ করতে সাইন-ইন করুন</h4>
                    <p className="text-xs text-stone-500 max-w-sm mx-auto font-serif leading-relaxed">
                      গঠনমূলক আলোচনা বজায় রাখতে কেবল নিবন্ধিত ব্যবহারকারীরাই মন্তব্য প্রদান করতে পারেন।
                    </p>
                    <button
                      type="button"
                      onClick={onTriggerAuth}
                      className="bg-[#015ca7] hover:bg-[#004884] text-white text-xs font-serif font-bold tracking-wider py-2.5 px-5 rounded transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-sm"
                    >
                      <KeyRound className="w-3.5 h-3.5 text-white" />
                      <span>মন্তব্য করতে লগইন করুন</span>
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmitComment} className="space-y-4 pt-4 border-t border-stone-200 bg-stone-50 p-5 rounded-md border border-stone-200">
                    <div className="flex items-center gap-2 text-xs font-serif text-stone-500 tracking-wider">
                      <Sparkles className="w-3.5 h-3.5 text-rose-600 animate-pulse" />
                      <span>রিয়েল-টাইম এআই সুরক্ষা শিল্ড সক্রিয়</span>
                    </div>

                    <div className="text-xs font-serif text-stone-600">
                      মন্তব্যকারী: <strong className="text-stone-900">{currentUser.name}</strong> <span className="bg-rose-100 text-rose-800 px-1.5 py-0.2 rounded text-[9px] font-bold ml-1">{currentUser.role}</span>
                    </div>

                    <div>
                      <textarea
                        value={newCommentBody}
                        onChange={(e) => setNewCommentBody(e.target.value)}
                        rows={3}
                        placeholder="আপনার সুচিন্তিত মতামত লিখুন..."
                        className="w-full text-sm font-sans p-2.5 border border-stone-200 bg-white rounded mt-1 outline-none focus:ring-1 focus:ring-rose-500"
                        required
                      />
                    </div>

                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                      <button
                        type="submit"
                        disabled={commentSubmitting}
                        className="bg-stone-900 hover:bg-stone-800 text-white font-sans text-xs font-bold tracking-wider uppercase px-5 py-2.5 rounded shadow-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                      >
                        {commentSubmitting ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>সুরক্ষা যাচাই করা হচ্ছে...</span>
                          </>
                        ) : (
                          <>
                            <Send className="w-3 h-3" />
                            <span>মন্তব্য প্রকাশ করুন</span>
                          </>
                        )}
                      </button>
                      
                      <span className="text-[10px] text-stone-400 font-serif max-w-xs">
                        * অবমাননাকর শব্দ, স্প্যাম এবং ক্ষতিকর কন্টেন্ট স্বয়ংক্রিয়ভাবে ব্লক করা হবে।
                      </span>
                    </div>

                    {commentFeedback && (
                      <div className={`p-2.5 rounded text-xs font-mono border ${
                        commentFeedback.isError 
                          ? 'bg-red-50 text-red-700 border-red-100 flex items-start gap-1.5' 
                          : 'bg-emerald-50 text-emerald-800 border-emerald-100'
                      }`}>
                        {commentFeedback.isError && <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />}
                        <span>{commentFeedback.text}</span>
                      </div>
                    )}
                  </form>
                )}
              </div>
            </div>
          </div>
        ) : filteredArticles.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-stone-200 rounded-lg space-y-3">
            <Search className="w-10 h-10 text-stone-300 mx-auto" />
            <h3 className="font-serif text-lg font-bold">কোনো সামঞ্জস্যপূর্ণ নিবন্ধ পাওয়া যায়নি</h3>
            <p className="text-xs text-stone-500 font-serif">অনুসন্ধান বা ক্যাটাগরি ফিল্টারে কোনো তথ্য মেলেনি।</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Left Content Column (8/12 - Main News Feed) */}
            <div className="lg:col-span-8 space-y-8">
              
              {/* Main Headline Lead Story block */}
              {featuredArticle && selectedCategory === 'All' && !searchQuery && (
                <div className="border-b border-stone-200 pb-8 space-y-4">
                  <article 
                    onClick={() => openArticle(featuredArticle)}
                    className="cursor-pointer group space-y-4"
                  >
                    <div className="aspect-video md:aspect-[16/9] overflow-hidden rounded bg-stone-200 border border-stone-100 relative shadow-sm">
                      <img 
                        src={featuredArticle.image} 
                        alt={featuredArticle.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-101 transition-transform duration-500"
                      />
                      <span className="absolute top-3 left-3 bg-rose-600 text-white text-[10px] font-bold font-serif px-2.5 py-0.5 rounded shadow-sm">
                        প্রধান খবর
                      </span>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-3 text-[10px] font-serif text-stone-500 uppercase">
                        <span className="text-rose-600 font-bold">{CATEGORY_LABELS[featuredArticle.category]?.bn || featuredArticle.category}</span>
                        <span>•</span>
                        <span>লেখক: {featuredArticle.author}</span>
                      </div>
                      
                      <h2 className="font-serif text-2xl md:text-4xl font-black tracking-tight text-stone-950 leading-tight group-hover:text-rose-600 transition-colors">
                        {featuredArticle.title}
                      </h2>
                      
                      <p className="font-serif text-stone-600 text-sm leading-relaxed italic border-l-2 border-rose-500 pl-3 py-0.5">
                        "{featuredArticle.subtitle}"
                      </p>
                      
                      <p className="text-xs text-stone-500 leading-relaxed line-clamp-3 font-sans">
                        {featuredArticle.content.replace(/<[^>]*>/g, '')}
                      </p>
                    </div>
                  </article>

                  {/* Share actions bar inside listing */}
                  <div className="pt-2 flex justify-between items-center text-[10px] font-mono text-stone-400">
                    <span className="flex items-center gap-3">
                      <span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5" /> {featuredArticle.views || 0}</span>
                      <span className="flex items-center gap-1"><Heart className="w-3.5 h-3.5 text-rose-500" /> {featuredArticle.likes || 0}</span>
                      <span>•</span>
                    <span>{new Date(featuredArticle.date).toLocaleDateString('bn-BD')}</span>
                    </span>

                    <div className="flex items-center gap-2">
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleCopyLink(featuredArticle); }}
                        className="p-1 hover:text-stone-900 rounded bg-stone-100 hover:bg-stone-200 transition-all flex items-center gap-1"
                        title="Copy article share link"
                      >
                        {copiedId === featuredArticle.id ? <Check className="w-3 h-3 text-emerald-600" /> : <Link2 className="w-3 h-3" />}
                        <span>{copiedId === featuredArticle.id ? 'লিঙ্ক কপি হয়েছে' : 'লিঙ্ক কপি করুন'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Dynamic Sponsor Placement - Mid List banner */}
              {selectedCategory === 'All' && !searchQuery && (
                <RenderAdSlot slot="mid-list" className="my-4" />
              )}

              {/* Grid of Secondary articles (Prothom Alo high-density horizontal row) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6">
                {(selectedCategory !== 'All' || searchQuery ? filteredArticles : secondaryArticles).map((art, idx) => (
                  <article 
                    key={art.id}
                    onClick={() => openArticle(art)}
                    className="flex flex-col justify-between border-b border-stone-200 pb-6 cursor-pointer group space-y-3"
                  >
                    <div className="space-y-2.5">
                      <div className="aspect-[16/10] w-full overflow-hidden rounded bg-stone-200 border border-stone-100 relative">
                        <img 
                          src={art.image} 
                          alt={art.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover group-hover:scale-101 transition-transform duration-500"
                        />
                      </div>

                      <div className="flex items-center gap-3 text-[10px] font-serif text-stone-500">
                        <span className="text-rose-600 font-bold">{CATEGORY_LABELS[art.category]?.bn || art.category}</span>
                        <span>•</span>
                        <span>লেখক: {art.author}</span>
                      </div>

                      <h3 className="font-serif text-lg font-bold tracking-tight text-stone-950 leading-tight group-hover:text-rose-600 transition-colors">
                        {art.title}
                      </h3>

                      <p className="text-xs text-stone-500 leading-relaxed font-serif italic line-clamp-2">
                        "{art.subtitle}"
                      </p>
                    </div>

                    <div className="pt-2 flex justify-between items-center text-[10px] font-mono text-stone-400">
                      <span>{new Date(art.date).toLocaleDateString('bn-BD')}</span>
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-0.5"><Eye className="w-3 h-3" /> {art.views || 0}</span>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleCopyLink(art); }}
                          className="hover:text-stone-900 transition-all"
                          title="Copy Link"
                        >
                          {copiedId === art.id ? <span className="text-emerald-600 font-bold text-[10px]">কপি হয়েছে</span> : <Link2 className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>

              {/* Remaining / Third-Tier Feed rows */}
              {selectedCategory === 'All' && !searchQuery && remainingArticles.length > 0 && (
                <div className="space-y-6 pt-4">
                  <h4 className="font-serif font-black text-xs uppercase tracking-wider text-stone-400 border-b border-stone-200 pb-2">
                    অন্যান্য খবর
                  </h4>
                  <div className="divide-y divide-stone-200">
                    {remainingArticles.map(art => (
                      <div 
                        key={art.id}
                        onClick={() => openArticle(art)}
                        className="py-4 cursor-pointer group flex gap-4 items-start"
                      >
                        <div className="w-24 h-16 rounded overflow-hidden bg-stone-100 shrink-0 border">
                          <img src={art.image} alt={art.title} className="w-full h-full object-cover" />
                        </div>
                        <div className="min-w-0 space-y-1">
                          <span className="text-[10px] font-serif text-rose-600 font-bold">{CATEGORY_LABELS[art.category]?.bn || art.category}</span>
                          <h5 className="font-serif text-sm font-bold text-stone-950 leading-snug group-hover:text-rose-600 group-hover:underline truncate">
                            {art.title}
                          </h5>
                          <p className="text-xs text-stone-500 truncate">{art.subtitle}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>

            {/* Right Widget Sidebar Column (4/12 - Real-time Engagement & Ad Placements) */}
            <div className="lg:col-span-4 space-y-8 lg:sticky lg:top-4">
              
              {/* Tabbed Widget (Latest / Most Read) - Essential Bengali News Portal Feature */}
              <div className="bg-white border border-stone-200 rounded-lg overflow-hidden shadow-xs">
                
                {/* Tabs Selector Bar */}
                <div className="grid grid-cols-2 text-center border-b border-stone-200 select-none">
                  <button
                    onClick={() => setRightColTab('latest')}
                    className={`py-3 text-xs font-serif font-bold tracking-wide uppercase transition-all border-r border-stone-200 cursor-pointer ${
                      rightColTab === 'latest'
                        ? 'bg-rose-50 text-rose-600 border-b-2 border-b-rose-600'
                        : 'bg-stone-50 text-stone-500 hover:bg-stone-100'
                    }`}
                  >
                    সর্বশেষ
                  </button>
                  <button
                    onClick={() => setRightColTab('popular')}
                    className={`py-3 text-xs font-serif font-bold tracking-wide uppercase transition-all cursor-pointer ${
                      rightColTab === 'popular'
                        ? 'bg-rose-50 text-rose-600 border-b-2 border-b-rose-600'
                        : 'bg-stone-50 text-stone-500 hover:bg-stone-100'
                    }`}
                  >
                    সর্বাধিক পঠিত
                  </button>
                </div>

                {/* Tabbed Contents (Numbered List layout - Prothom Alo classic) */}
                <div className="p-4 space-y-4">
                  {(rightColTab === 'latest' ? latestArticles : popularArticles).map((art, idx) => (
                    <div 
                      key={art.id}
                      onClick={() => openArticle(art)}
                      className="flex items-start gap-3.5 pb-3 border-b border-stone-100 last:border-b-0 last:pb-0 cursor-pointer group"
                    >
                      <span className="font-serif text-2xl font-black text-stone-300 leading-none shrink-0 group-hover:text-rose-600 transition-colors">
                        {idx + 1}
                      </span>
                      <div className="min-w-0 space-y-0.5">
                        <span className="text-[10px] font-serif text-rose-600 font-bold">{CATEGORY_LABELS[art.category]?.bn || art.category}</span>
                        <h4 className="font-serif text-xs font-bold text-stone-900 leading-snug group-hover:underline">
                          {art.title}
                        </h4>
                        <span className="text-[10px] font-serif text-stone-400 block">{new Date(art.date).toLocaleDateString('bn-BD')} • {art.views || 0} বার পঠিত</span>
                      </div>
                    </div>
                  ))}
                  
                  {(rightColTab === 'latest' ? latestArticles : popularArticles).length === 0 && (
                    <p className="text-xs text-stone-400 italic text-center font-serif py-4">এখনো কোনো প্রকাশনা নেই।</p>
                  )}
                </div>
              </div>

              {/* Sidebar Vertical Ad Placement */}
              <RenderAdSlot slot="sidebar" />

              {/* Dynamic Opinion Block */}
              <div className="bg-stone-900 text-white p-5 rounded-lg border border-stone-800 space-y-4">
                <div className="border-b border-stone-800 pb-2">
                  <h4 className="font-serif font-black text-sm tracking-wide uppercase text-amber-400 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span>সম্পাদকীয় কলাম</span>
                  </h4>
                  <p className="text-[11px] text-stone-400 font-serif">আধুনিক সংস্কৃতি এবং বৈশ্বিক পরিবর্তনের সুচিন্তিত চিন্তাভাবনা।</p>
                </div>
                
                <div className="space-y-4">
                  {articles.filter(a => a.category === 'Opinions' && a.status === 'published').slice(0, 2).map(op => (
                    <div 
                      key={op.id} 
                      onClick={() => openArticle(op)}
                      className="cursor-pointer group space-y-1"
                    >
                      <h5 className="font-serif text-xs font-bold leading-snug group-hover:text-amber-400 transition-colors">
                        "{op.title}"
                      </h5>
                      <span className="text-[10px] font-serif text-stone-400 block">— {op.author}</span>
                    </div>
                  ))}
                  {articles.filter(a => a.category === 'Opinions' && a.status === 'published').length === 0 && (
                    <p className="text-[11px] text-stone-500 italic font-serif">কোনো মতামত কলাম পাওয়া যায়নি।</p>
                  )}
                </div>
              </div>

              {/* Premium investigative subscription box */}
              <div className="bg-white border border-stone-200 p-5 rounded-lg shadow-xs space-y-3.5">
                <span className="text-[10px] font-serif font-bold text-rose-600 uppercase tracking-widest block">ডিজিটাল সাবস্ক্রিপশন</span>
                <h4 className="font-serif text-base font-bold text-stone-950">সাপ্তাহিক নিউজলেটার গ্রহণ করুন</h4>
                <p className="text-xs text-stone-500 font-serif leading-relaxed">
                  নিরপেক্ষ স্বাধীন সাংবাদিকতাকে সমর্থন করুন। আমাদের কিউরেটেড সারাংশগুলো সরাসরি আপনার ইমেইলে পান।
                </p>

                <form onSubmit={handleSubscribe} className="space-y-2">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="আপনার-ইমেইল@ডোমেইন.কম"
                    className="w-full text-xs font-serif p-2.5 bg-stone-50 border border-stone-200 rounded outline-none focus:ring-1 focus:ring-rose-500"
                  />
                  <button
                    type="submit"
                    disabled={subscribing}
                    className="w-full bg-stone-950 hover:bg-stone-800 text-white font-bold font-serif text-xs py-2.5 rounded cursor-pointer transition-all disabled:opacity-50"
                  >
                    {subscribing ? 'নিবন্ধিত হচ্ছে...' : 'সাবস্ক্রাইব করুন'}
                  </button>
                </form>

                {subscribedMsg && (
                  <p className={`text-[10px] font-serif text-center ${subscribedMsg.includes('ধন্যবাদ') ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {subscribedMsg}
                  </p>
                )}
              </div>

            </div>

          </div>
        )}

      </main>

      {/* Footer (Ad Placement & Info Links) */}
      <footer className="bg-stone-950 text-stone-400 border-t border-stone-900 mt-12 py-12 shrink-0">
        
        {/* Bottom Banner Ad slot */}
        <div className="max-w-7xl mx-auto px-4 lg:px-6 pb-8 border-b border-stone-900">
          <RenderAdSlot slot="bottom-banner" />
        </div>

        <div className="max-w-7xl w-full mx-auto px-4 lg:px-6 pt-8 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
          
          <div className="lg:col-span-4 space-y-4">
            <h4 className="font-serif text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-rose-600 text-white text-xs font-serif font-black flex items-center justify-center animate-pulse">ক</span>
              <span>দৈনিক কথা প্রকাশ পত্রিকা।</span>
            </h4>
            <p className="text-xs text-stone-500 leading-relaxed font-serif">
              দৈনিক কথা প্রকাশ পত্রিকা হলো একটি উচ্চ-মানের বিশ্বস্ত সংবাদ পরিবেশক মাধ্যম, যা বস্তুনিষ্ঠ ও স্বাধীন সাংবাদিকতার মাধ্যমে সমাজের প্রতিটি সত্য ও তথ্যনিষ্ঠ খবর সবার মাঝে ছড়িয়ে দিতে প্রতিশ্রুতিবদ্ধ।
            </p>
            <div className="text-[10px] font-serif text-stone-600">
              © ২০২৬ দৈনিক কথা প্রকাশ পত্রিকা। সর্বস্বত্ব সংরক্ষিত।
            </div>
          </div>

          <div className="lg:col-span-2 space-y-2">
            <span className="text-[10px] font-serif font-bold text-stone-200 uppercase tracking-wider block">বিভাগসমূহ</span>
            <ul className="text-xs space-y-1.5 font-serif">
              <li><button onClick={() => setSelectedCategory('Politics')} className="hover:text-white cursor-pointer block text-left">রাজনীতি</button></li>
              <li><button onClick={() => setSelectedCategory('Tech')} className="hover:text-white cursor-pointer block text-left">বিজ্ঞান ও প্রযুক্তি</button></li>
              <li><button onClick={() => setSelectedCategory('Business')} className="hover:text-white cursor-pointer block text-left">বাণিজ্য</button></li>
              <li><button onClick={() => setSelectedCategory('Science')} className="hover:text-white cursor-pointer block text-left">বিজ্ঞান</button></li>
            </ul>
          </div>

          <div className="lg:col-span-2 space-y-2">
            <span className="text-[10px] font-serif font-bold text-stone-200 uppercase tracking-wider block">নিবন্ধকরণ পোর্টাল</span>
            <ul className="text-xs space-y-1.5 font-serif text-[11px]">
              <li><button onClick={onTriggerAuth} className="hover:text-white text-left block cursor-pointer">প্রকাশক অনুমোদন (লগইন)</button></li>
              <li><button onClick={onEnterAdmin} className="hover:text-white text-left block cursor-pointer">নিউজরুম ম্যানেজমেন্ট ড্যাশবোর্ড</button></li>
              <li><a href="/api/db/info" target="_blank" className="hover:text-white block">এসকিউএল ডেটাবেস সংযোগ তথ্য</a></li>
            </ul>
          </div>

          {/* Elegant Newsletter Signup Column (Requested by user) */}
          <div className="lg:col-span-4 space-y-3.5 bg-stone-900/40 p-5 rounded-lg border border-stone-900/60">
            <span className="text-[10px] font-serif font-bold text-rose-500 uppercase tracking-widest block">খবরের চিঠি (নিউজলেটার)</span>
            <h4 className="font-serif text-sm font-bold text-white">দৈনিক গুরুত্বপূর্ণ খবরের ইমেইল আপডেট</h4>
            <p className="text-xs text-stone-400 font-serif leading-relaxed">
              সারা দিনের সবথেকে গুরুত্বপূর্ণ খবরের সারাংশ এবং বিশ্লেষণ পেতে আজই আমাদের নিউজলেটারে ফ্রিতে সাবস্ক্রাইব করুন।
            </p>

            <form onSubmit={handleFooterSubscribe} className="flex gap-1.5 pt-1">
              <input
                type="email"
                required
                value={footerEmail}
                onChange={(e) => setFooterEmail(e.target.value)}
                placeholder="আপনার ইমেইল..."
                className="flex-grow text-xs font-serif p-2.5 bg-stone-900 border border-stone-800 rounded text-stone-200 outline-none focus:ring-1 focus:ring-rose-500 placeholder-stone-600 font-semibold"
              />
              <button
                type="submit"
                disabled={footerSubscribing}
                className="bg-rose-700 hover:bg-rose-800 text-white font-bold font-serif text-xs px-4 rounded cursor-pointer transition-all disabled:opacity-50 flex items-center justify-center shrink-0 min-w-[70px]"
              >
                {footerSubscribing ? '...' : 'যুক্ত হোন'}
              </button>
            </form>

            {footerSubscribedMsg && (
              <p className={`text-[11px] font-serif mt-1 ${footerSubscribedMsg.includes('ধন্যবাদ') ? 'text-emerald-400' : 'text-rose-400'}`}>
                {footerSubscribedMsg}
              </p>
            )}
          </div>

        </div>
      </footer>

      {/* Floating Article Full Reading Overlay (With Integrated Social Sharing Suite) */}
      <AnimatePresence>
        {false && activeArticle && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-55 flex justify-center overflow-y-auto py-0 md:py-8 select-text"
          >
            <motion.div 
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 200 }}
              className="w-full max-w-4xl bg-[#FCFCFA] min-h-screen md:min-h-0 md:rounded-lg shadow-2xl flex flex-col relative border border-stone-200"
            >
              
              {/* Prothom Alo Style Article Top Navigation */}
              <div className="sticky top-0 bg-[#FCFCFA]/95 backdrop-blur-md border-b border-stone-200 px-4 md:px-8 py-3.5 flex justify-between items-center z-10 shrink-0">
                <button
                  onClick={closeArticle}
                  className="flex items-center gap-2 text-sm font-bold font-serif text-stone-600 hover:text-rose-600 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5 text-rose-600 shrink-0" />
                  <span>বন্ধ করুন</span>
                </button>
                <div className="text-[10px] font-serif text-stone-400 tracking-widest font-black uppercase hidden sm:block">
                  দৈনিক কথা প্রকাশ পত্রিকা আর্কাইভ
                </div>
              </div>

              {/* Main Newspaper Article Sheet */}
              <div className="p-4 md:p-12 space-y-8 flex-grow">
                
                {/* Header Metadata */}
                <div className="space-y-4 max-w-3xl mx-auto">
                  <div className="inline-block bg-rose-50 text-rose-700 text-xs font-serif font-black uppercase px-3 py-1 rounded border border-rose-100 tracking-wider">
                    {CATEGORY_LABELS[activeArticle.category]?.bn || activeArticle.category}
                  </div>
                  
                  <h1 className="font-serif text-3xl md:text-5xl font-black tracking-tight leading-tight text-stone-950">
                    {activeArticle.title}
                  </h1>

                  <p className="font-serif text-stone-600 text-base md:text-xl leading-relaxed italic border-l-4 border-rose-500 pl-4 py-1.5 bg-stone-50 pr-2 rounded-r">
                    "{activeArticle.subtitle}"
                  </p>

                  {/* High-Fidelity Author & Date Info */}
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center py-4 border-t border-b border-stone-200 gap-3 text-xs text-stone-600 font-serif">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-full bg-rose-600 text-white flex items-center justify-center font-bold font-serif text-base shadow-xs">
                        {activeArticle.author.slice(0, 1)}
                      </div>
                      <div>
                        <span className="font-extrabold text-stone-900 block text-sm">{activeArticle.author}</span>
                        <span className="text-stone-400 text-[10px] block">বিশেষ সংবাদদাতা</span>
                      </div>
                    </div>
                    <div className="flex flex-col sm:items-end text-stone-500 text-[11px] font-sans">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-stone-400" />
                        <span>প্রকাশিত: {new Date(activeArticle.date).toLocaleDateString('bn-BD', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                      </span>
                      <span className="text-stone-400 text-[10px] mt-0.5">আপডেট করা হয়েছে: {new Date(activeArticle.date).toLocaleDateString('bn-BD')} {new Date(activeArticle.date).toLocaleTimeString('bn-BD')}</span>
                    </div>
                  </div>
                </div>

                {/* Cover Image with Newspaper Caption */}
                <div className="w-full rounded-md bg-stone-100 border border-stone-200 overflow-hidden max-w-3xl mx-auto shadow-sm">
                  <img 
                    src={activeArticle.image} 
                    alt={activeArticle.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-auto max-h-[480px] object-cover"
                  />
                  <div className="bg-stone-50 p-3 border-t border-stone-100 text-xs text-stone-500 font-serif italic flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-600 shrink-0" />
                    <span>ছবি: সংগৃহীত - "{activeArticle.title}"</span>
                  </div>
                </div>

                {/* Content Body Copy (Noto Serif Bengali with gorgeous typography) */}
                <div 
                  className="font-serif text-[18px] md:text-[20px] text-stone-900 leading-relaxed md:leading-loose space-y-6 max-w-3xl mx-auto prose prose-stone prose-lg text-justify"
                  dangerouslySetInnerHTML={{ __html: activeArticle.content }}
                />

                {/* Mid-Article Sponsor Slot */}
                <div className="my-8 max-w-3xl mx-auto">
                  <RenderAdSlot slot="mid-list" className="bg-stone-100 p-4 rounded border border-stone-200" />
                </div>

                {/* Spectacular Social Sharing Row & Applaud action (Highly comprehensive sharing suite) */}
                <div className="border-t border-b border-stone-200 py-6 max-w-3xl mx-auto space-y-4">
                  
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                    
                    {/* Applaud / Like */}
                    <button
                      onClick={() => handleLikeArticle(activeArticle)}
                      className="flex items-center justify-center gap-2 px-5 py-2.5 bg-rose-50 hover:bg-rose-100 rounded-full text-xs font-bold font-sans transition-all cursor-pointer text-rose-700 shadow-2xs border border-rose-100"
                    >
                      <Heart className="w-4 h-4 text-rose-600 fill-rose-600" />
                      <span>ভালো লেগেছে ({activeArticle.likes || 0})</span>
                    </button>

                    {/* Copy Link button */}
                    <button
                      onClick={() => handleCopyLink(activeArticle, true)}
                      className="flex items-center justify-center gap-2 px-4 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-800 hover:text-stone-950 rounded-full text-xs font-semibold font-mono tracking-wide transition-all cursor-pointer border border-stone-200"
                    >
                      {copiedDetail ? <Check className="w-4 h-4 text-emerald-600" /> : <Link2 className="w-4 h-4 text-stone-500" />}
                      <span>{copiedDetail ? 'লিঙ্ক কপি হয়েছে!' : 'স্থায়ী লিঙ্ক কপি করুন'}</span>
                    </button>
                    
                  </div>

                  {/* All Social Sharing Links - Explicitly requested by user */}
                  <div className="bg-stone-50 p-4 rounded-lg space-y-3 border border-stone-200">
                    <span className="text-[10px] font-mono font-bold tracking-widest text-stone-500 uppercase block">
                      প্রতিবেদনটি শেয়ার করুন
                    </span>
                    
                    <div className="flex flex-wrap gap-2.5">
                      {/* Facebook */}
                      <a
                        href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(`${window.location.origin}/article/${activeArticle.id}`)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="bg-[#1877F2] text-white font-sans text-[11px] font-bold px-4 py-2.5 rounded-md hover:opacity-90 flex items-center gap-1.5 transition-all shadow-2xs"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span>ফেসবুকে শেয়ার করুন</span>
                      </a>

                      {/* Twitter / X */}
                      <a
                        href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(`${window.location.origin}/article/${activeArticle.id}`)}&text=${encodeURIComponent(activeArticle.title)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="bg-stone-900 text-white font-sans text-[11px] font-bold px-4 py-2.5 rounded-md hover:opacity-90 flex items-center gap-1.5 transition-all shadow-2xs"
                      >
                        <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                        </svg>
                        <span>এক্স (টুইটার)</span>
                      </a>

                      {/* WhatsApp */}
                      <a
                        href={`https://api.whatsapp.com/send?text=${encodeURIComponent(activeArticle.title + ' - ' + `${window.location.origin}/article/${activeArticle.id}`)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="bg-[#25D366] text-white font-sans text-[11px] font-bold px-4 py-2.5 rounded-md hover:opacity-90 flex items-center gap-1.5 transition-all shadow-2xs"
                      >
                        <MessageSquare className="w-3.5 h-3.5 fill-current text-white" />
                        <span>হোয়াটসঅ্যাপ</span>
                      </a>

                      {/* LinkedIn */}
                      <a
                        href={`https://www.linkedin.com/shareArticle?mini=true&url=${encodeURIComponent(`${window.location.origin}/article/${activeArticle.id}`)}&title=${encodeURIComponent(activeArticle.title)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="bg-[#0077B5] text-white font-sans text-[11px] font-bold px-4 py-2.5 rounded-md hover:opacity-90 flex items-center gap-1.5 transition-all shadow-2xs"
                      >
                        <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                          <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.779-1.75-1.75s.784-1.75 1.75-1.75 1.75.779 1.75 1.75-.784 1.75-1.75 1.75zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                        </svg>
                        <span>লিঙ্কডইন</span>
                      </a>
                    </div>
                  </div>

                </div>

                {/* নিবন্ধ নেভিগেশন (পরবর্তী ও পূর্ববর্তী খবর) */}
                {(prevArticle || nextArticle) && (
                  <div className="border-t border-b border-stone-200 py-6 max-w-3xl mx-auto">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {prevArticle ? (
                        <button
                          onClick={() => openArticle(prevArticle)}
                          className="flex flex-col items-start p-4 bg-stone-50 hover:bg-stone-100 rounded-lg border border-stone-200 text-left transition-all group cursor-pointer"
                        >
                          <span className="text-[10px] font-serif text-stone-400 font-bold tracking-wider uppercase mb-1 flex items-center gap-1">
                            &larr; পূর্ববর্তী খবর
                          </span>
                          <span className="text-stone-500 text-xs font-serif font-black uppercase mb-1">
                            {CATEGORY_LABELS[prevArticle.category]?.bn || prevArticle.category}
                          </span>
                          <span className="font-serif font-bold text-stone-800 group-hover:text-rose-600 text-sm line-clamp-2 transition-colors">
                            {prevArticle.title}
                          </span>
                        </button>
                      ) : (
                        <div className="hidden sm:block" />
                      )}

                      {nextArticle ? (
                        <button
                          onClick={() => openArticle(nextArticle)}
                          className="flex flex-col items-end p-4 bg-stone-50 hover:bg-stone-100 rounded-lg border border-stone-200 text-right transition-all group cursor-pointer"
                        >
                          <span className="text-[10px] font-serif text-stone-400 font-bold tracking-wider uppercase mb-1 flex items-center gap-1">
                            পরবর্তী খবর &rarr;
                          </span>
                          <span className="text-stone-500 text-xs font-serif font-black uppercase mb-1">
                            {CATEGORY_LABELS[nextArticle.category]?.bn || nextArticle.category}
                          </span>
                          <span className="font-serif font-bold text-stone-800 group-hover:text-rose-600 text-sm line-clamp-2 transition-colors">
                            {nextArticle.title}
                          </span>
                        </button>
                      ) : (
                        <div className="hidden sm:block" />
                      )}
                    </div>
                  </div>
                )}

                {/* Commenting Board */}
                <div className="border-t border-stone-200 pt-8 max-w-3xl mx-auto space-y-6">
                  <h3 className="font-serif text-lg font-black text-stone-950 flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-rose-600" />
                    <span>পাঠক মন্তব্য ({activeComments.length})</span>
                  </h3>

                  {/* List comments */}
                  <div className="space-y-4">
                    {activeComments.length === 0 ? (
                      <p className="text-xs text-stone-400 font-mono italic">মন্তব্য করার প্রথম সুযোগটি আপনার। এই প্রতিবেদন সম্বন্ধে মতামত দিন।</p>
                    ) : (
                      activeComments.map(com => (
                        <div key={com.id} className="bg-stone-50 p-4 rounded-md border border-stone-200 space-y-2">
                          <div className="flex justify-between items-center text-[11px] font-mono">
                            <span className="font-black text-stone-800 flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span>{com.author}</span>
                            </span>
                            <span className="text-stone-400">{new Date(com.date).toLocaleDateString('bn-BD')}</span>
                          </div>
                          <p className="text-sm text-stone-700 leading-relaxed font-sans">"{com.content}"</p>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Comment input form - requires login session */}
                  {!currentUser ? (
                    <div className="bg-stone-50 border border-stone-200 p-6 rounded-lg text-center space-y-3">
                      <ShieldAlert className="w-8 h-8 text-stone-400 mx-auto animate-pulse" />
                      <h4 className="font-serif font-bold text-stone-800">মতামত প্রকাশ করতে সাইন-ইন করুন</h4>
                      <p className="text-xs text-stone-500 max-w-sm mx-auto font-serif leading-relaxed">
                        গঠনমূলক আলোচনা বজায় রাখতে কেবল নিবন্ধিত ব্যবহারকারীরাই মন্তব্য প্রদান করতে পারেন।
                      </p>
                      <button
                        type="button"
                        onClick={onTriggerAuth}
                        className="bg-[#015ca7] hover:bg-[#004884] text-white text-xs font-serif font-bold tracking-wider py-2.5 px-5 rounded transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-sm"
                      >
                        <KeyRound className="w-3.5 h-3.5 text-white" />
                        <span>মন্তব্য করতে লগইন করুন</span>
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleSubmitComment} className="space-y-4 pt-4 border-t border-stone-200 bg-stone-50 p-5 rounded-md border border-stone-200">
                      <div className="flex items-center gap-2 text-xs font-serif text-stone-500 tracking-wider">
                        <Sparkles className="w-3.5 h-3.5 text-rose-600 animate-pulse" />
                        <span>রিয়েল-টাইম এআই সুরক্ষা শিল্ড সক্রিয়</span>
                      </div>

                      <div className="text-xs font-serif text-stone-600">
                        মন্তব্যকারী: <strong className="text-stone-900">{currentUser.name}</strong> <span className="bg-rose-100 text-rose-800 px-1.5 py-0.2 rounded text-[9px] font-bold ml-1">{currentUser.role}</span>
                      </div>

                      <div>
                        <textarea
                          value={newCommentBody}
                          onChange={(e) => setNewCommentBody(e.target.value)}
                          rows={3}
                          placeholder="আপনার সুচিন্তিত মতামত লিখুন..."
                          className="w-full text-sm font-sans p-2.5 border border-stone-200 bg-white rounded mt-1 outline-none focus:ring-1 focus:ring-rose-500"
                          required
                        />
                      </div>

                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                        <button
                          type="submit"
                          disabled={commentSubmitting}
                          className="bg-stone-900 hover:bg-stone-800 text-white font-sans text-xs font-bold tracking-wider uppercase px-5 py-2.5 rounded shadow-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                        >
                          {commentSubmitting ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>সুরক্ষা যাচাই করা হচ্ছে...</span>
                            </>
                          ) : (
                            <>
                              <Send className="w-3 h-3" />
                              <span>মন্তব্য প্রকাশ করুন</span>
                            </>
                          )}
                        </button>
                        
                        <span className="text-[10px] text-stone-400 font-serif max-w-xs">
                          * অবমাননাকর শব্দ, স্প্যাম এবং ক্ষতিকর কন্টেন্ট স্বয়ংক্রিয়ভাবে ব্লক করা হবে।
                        </span>
                      </div>

                      {commentFeedback && (
                        <div className={`p-2.5 rounded text-xs font-mono border ${
                          commentFeedback.isError 
                            ? 'bg-red-50 text-red-700 border-red-100 flex items-start gap-1.5' 
                            : 'bg-emerald-50 text-emerald-800 border-emerald-100'
                        }`}>
                          {commentFeedback.isError && <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />}
                          <span>{commentFeedback.text}</span>
                        </div>
                      )}
                    </form>
                  )}
                </div>

              </div>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
