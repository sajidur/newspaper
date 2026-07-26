import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Newspaper, Users, BarChart3, Mail, MessageSquare, Plus, Sparkles, 
  Trash2, Eye, ThumbsUp, Send, Loader2, CheckCircle2, AlertTriangle, 
  RefreshCw, Check, X, FileText, ArrowUpRight, Share2, Search, UserCheck, ShieldAlert,
  Database, Info
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend
} from 'recharts';
import { Article, Subscription, Comment, Newsletter, AnalyticsSummary, User, Category } from '../types';
import SocialShareModal from './SocialShareModal';
import WysiwygEditor from './WysiwygEditor';

const CATEGORY_LABELS: Record<string, { bn: string; en: string }> = {
  'Politics': { bn: 'রাজনীতি', en: 'Politics' },
  'Tech': { bn: 'বিজ্ঞান ও প্রযুক্তি', en: 'Tech' },
  'Business': { bn: 'বাণিজ্য', en: 'Business' },
  'Science': { bn: 'বিজ্ঞান', en: 'Science' },
  'Culture': { bn: 'বিনোদন ও সংস্কৃতি', en: 'Culture' },
  'Opinions': { bn: 'মতামত', en: 'Opinions' }
};

interface AdminDashboardProps {
  onBackToReader: () => void;
  articles: Article[];
  setArticles: React.Dispatch<React.SetStateAction<Article[]>>;
  currentUser: User;
  token: string;
}

type TabType = 'analytics' | 'articles' | 'newsletter' | 'comments' | 'subscriptions' | 'advertisements' | 'news_fetcher';

export default function AdminDashboard({ 
  onBackToReader, 
  articles, 
  setArticles, 
  currentUser, 
  token 
}: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabType>('analytics');
  
  // States
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [newsletters, setNewsletters] = useState<Newsletter[]>([]);
  const [loading, setLoading] = useState<{ [key: string]: boolean }>({});
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [dbStatus, setDbStatus] = useState<{ isMysql: boolean; dbFile?: string; error?: string | null } | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [newCatName, setNewCatName] = useState('');
  const [newCatSlug, setNewCatSlug] = useState('');
  const [showAddCatModal, setShowAddCatModal] = useState(false);
  const [isAddingCat, setIsAddingCat] = useState(false);

  // News Auto-Fetcher States
  const [newsFetcherStatus, setNewsFetcherStatus] = useState<any>(null);
  const [isSyncingNewsFetcher, setIsSyncingNewsFetcher] = useState(false);

  // Active Social Share Modal Article
  const [socialShareArticle, setSocialShareArticle] = useState<Article | null>(null);

  // New Article Form
  const [newTitle, setNewTitle] = useState('');
  const [newSubtitle, setNewSubtitle] = useState('');
  const [newCategory, setNewCategory] = useState('Tech');
  const [newContent, setNewContent] = useState('');
  const [newAuthor, setNewAuthor] = useState(currentUser?.name || 'Staff Writer');
  const [newImage, setNewImage] = useState('');
  const [isDraft, setIsDraft] = useState(false);

  // Gemini Article Draft Generator Inputs
  const [aiTopic, setAiTopic] = useState('');
  const [aiTone, setAiTone] = useState('Journalistic, Objective');
  const [aiCategory, setAiCategory] = useState('Tech');

  // Newsletter Builder State
  const [selectedArticleIds, setSelectedArticleIds] = useState<string[]>([]);
  const [newsletterSubject, setNewsletterSubject] = useState('');
  const [newsletterContent, setNewsletterContent] = useState('');

  // Subscriptions Manual Email
  const [manualEmail, setManualEmail] = useState('');

  // Advertisements State
  const [ads, setAds] = useState<any[]>([]);
  const [adTitle, setAdTitle] = useState('');
  const [adImageUrl, setAdImageUrl] = useState('');
  const [adLinkUrl, setAdLinkUrl] = useState('');
  const [adSlot, setAdSlot] = useState<'top-banner' | 'sidebar' | 'mid-list' | 'bottom-banner'>('top-banner');
  const [adStatus, setAdStatus] = useState<'active' | 'inactive'>('active');
  const [isAdSubmitting, setIsAdSubmitting] = useState(false);

  // Fetch all administrative data
  const fetchAdminData = async () => {
    try {
      setLoading(prev => ({ ...prev, data: true }));
      const headers = { 'Authorization': `Bearer ${token}` };
      
      const [analyticsRes, commentsRes, subsRes, newsRes, articlesRes, adsRes, dbRes, categoriesRes, newsFetcherRes] = await Promise.all([
        fetch('/api/analytics', { headers }),
        fetch('/api/comments'),
        fetch('/api/subscriptions', { headers }),
        fetch('/api/newsletters', { headers }),
        fetch('/api/articles'),
        fetch('/api/ads'),
        fetch('/api/db/info'),
        fetch('/api/categories'),
        fetch('/api/news-fetcher/status')
      ]);

      if (analyticsRes.ok) setAnalytics(await analyticsRes.json());
      if (commentsRes.ok) setComments(await commentsRes.json());
      if (subsRes.ok) setSubscriptions(await subsRes.json());
      if (newsRes.ok) setNewsletters(await newsRes.json());
      if (articlesRes.ok) setArticles(await articlesRes.json());
      if (adsRes.ok) setAds(await adsRes.json());
      if (dbRes.ok) setDbStatus(await dbRes.json());
      if (categoriesRes.ok) setCategories(await categoriesRes.json());
      if (newsFetcherRes.ok) setNewsFetcherStatus(await newsFetcherRes.json());
      
    } catch (err) {
      console.error('Failed to load dashboard data', err);
      setErrorMsg('Failed to connect to the publishing backend services.');
    } finally {
      setLoading(prev => ({ ...prev, data: false }));
    }
  };

  const handleManualNewsFetcherSync = async () => {
    setIsSyncingNewsFetcher(true);
    try {
      const res = await fetch('/api/news-fetcher/sync', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        triggerToast(`অটো সংবাদ সিঙ্ক সফল! ${data.addedCount}টি নতুন খবর পরিমার্জিত শিরোনাম সহ প্রকাশিত হয়েছে।`, 'success');
        fetchAdminData();
      } else {
        triggerToast('সংবাদ সিঙ্ক সম্পন্ন করা যায়নি।', 'error');
      }
    } catch (err) {
      triggerToast('সার্ভার যোগাযোগে সমস্যা দেখা দিয়েছে।', 'error');
    } finally {
      setIsSyncingNewsFetcher(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
    // Simulate real-time reader fluctuation
    const interval = setInterval(() => {
      if (activeTab === 'analytics' && analytics) {
        setAnalytics(prev => {
          if (!prev) return null;
          const fluctuation = Math.random() > 0.5 ? 1 : -1;
          const newActive = Math.max(2, prev.activeReadersNow + fluctuation);
          return { ...prev, activeReadersNow: newActive };
        });
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [activeTab]);

  const triggerToast = (msg: string, type: 'success' | 'error' = 'success') => {
    if (type === 'success') {
      setSuccessMsg(msg);
      setTimeout(() => setSuccessMsg(null), 4000);
    } else {
      setErrorMsg(msg);
      setTimeout(() => setErrorMsg(null), 4000);
    }
  };

  // AI-Powered Article Draft Generator
  const handleGenerateAiDraft = async () => {
    if (!aiTopic.trim()) {
      triggerToast('Please provide an article topic or premise.', 'error');
      return;
    }
    
    try {
      setLoading(prev => ({ ...prev, generator: true }));
      const res = await fetch('/api/articles/generate', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ topic: aiTopic, category: aiCategory, tone: aiTone })
      });

      if (!res.ok) throw new Error('AI drafting service failed.');

      const data = await res.json();
      setNewTitle(data.title);
      setNewSubtitle(data.subtitle);
      setNewCategory(aiCategory);
      setNewContent(data.content);
      setNewAuthor(data.author);
      setNewImage(data.image);
      
      triggerToast('Gemini has successfully structured a high-fidelity news draft!', 'success');
    } catch (err: any) {
      console.error(err);
      triggerToast('AI draft engine returned an offline error.', 'error');
    } finally {
      setLoading(prev => ({ ...prev, generator: false }));
    }
  };

  // Publish/Create Column
  const handlePublishArticle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) {
      triggerToast('Title and content are required to publish.', 'error');
      return;
    }

    try {
      setLoading(prev => ({ ...prev, publish: true }));
      
      const payload = {
        title: newTitle.trim(),
        subtitle: newSubtitle.trim(),
        category: newCategory,
        content: newContent,
        author: newAuthor.trim(),
        image: newImage.trim(),
        status: isDraft ? 'draft' : 'published'
      };

      const res = await fetch('/api/articles', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to publish article.');
      }

      const published: Article = await res.json();
      setArticles(prev => [published, ...prev]);
      
      // Reset Form
      setNewTitle('');
      setNewSubtitle('');
      setNewCategory('Tech');
      setNewContent('');
      setNewAuthor(currentUser?.name || 'Staff Writer');
      setNewImage('');
      setIsDraft(false);

      triggerToast(isDraft ? 'Draft saved offline successfully.' : 'Article successfully published on live front pages!', 'success');
      fetchAdminData(); // Sync analytics
    } catch (err: any) {
      console.error(err);
      triggerToast(err.message || 'Database rejected the article column row.', 'error');
    } finally {
      setLoading(prev => ({ ...prev, publish: false }));
    }
  };

  // Add custom category
  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) {
      triggerToast('দয়া করে ক্যাটাগরির নাম লিখুন।', 'error');
      return;
    }

    const slug = newCatSlug.trim() || newCatName.trim().toLowerCase()
      .replace(/[^a-zA-Z0-9-]/g, '-')
      .replace(/--+/g, '-')
      .replace(/^-+|-+$/g, '');

    try {
      setIsAddingCat(true);
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: newCatName.trim(), slug })
      });

      if (!res.ok) {
        throw new Error('Failed to create category');
      }

      const created = await res.json();
      setCategories(prev => [...prev, created]);
      setNewCatName('');
      setNewCatSlug('');
      setShowAddCatModal(false);
      triggerToast('নতুন ক্যাটাগরি সফলভাবে যুক্ত করা হয়েছে!', 'success');
      
      // Select the new category by default
      setNewCategory(created.name);
    } catch (err: any) {
      console.error(err);
      triggerToast('ক্যাটাগরি যুক্ত করতে সমস্যা হয়েছে।', 'error');
    } finally {
      setIsAddingCat(false);
    }
  };

  // Toggle Publish Status
  const toggleArticleStatus = async (art: Article) => {
    try {
      const nextStatus = art.status === 'published' ? 'draft' : 'published';
      const res = await fetch(`/api/articles/${art.id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: nextStatus })
      });

      if (!res.ok) throw new Error('Status modify failed');
      const updated = await res.json();

      setArticles(prev => prev.map(a => a.id === art.id ? updated : a));
      triggerToast(`Article row successfully changed to ${nextStatus}.`, 'success');
    } catch (e) {
      triggerToast('Database status modify failed.', 'error');
    }
  };

  // Delete Column (Admin Only)
  const handleDeleteArticle = async (id: string) => {
    if (currentUser.role !== 'Admin') {
      triggerToast('Only administrators possess permissions to purge files.', 'error');
      return;
    }
    if (!confirm('Are you absolutely sure you want to permanently purge this column file from databases?')) return;

    try {
      const res = await fetch(`/api/articles/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) throw new Error('Purge command rejected.');
      
      setArticles(prev => prev.filter(a => a.id !== id));
      triggerToast('Article permanently purged from archives.', 'success');
      fetchAdminData(); // Sync analytics
    } catch (err) {
      triggerToast('Database purge error.', 'error');
    }
  };

  // AI-Powered Newsletter Compiler
  const handleCompileNewsletter = async () => {
    if (selectedArticleIds.length === 0) return;

    try {
      setLoading(prev => ({ ...prev, newsletter: true }));
      const res = await fetch('/api/newsletters/generate', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ articleIds: selectedArticleIds })
      });

      if (!res.ok) throw new Error('Compilation pipeline errored.');
      const data = await res.json();

      setNewsletterSubject(data.subject);
      setNewsletterContent(data.content);
      triggerToast('Gemini successfully compiled today\'s premium newsletter brief!', 'success');
    } catch (e) {
      triggerToast('Failed to compile newsletter via AI.', 'error');
    } finally {
      setLoading(prev => ({ ...prev, newsletter: false }));
    }
  };

  // Send Newsletter to subscribers
  const handleSendNewsletter = async () => {
    if (!newsletterSubject.trim() || !newsletterContent.trim()) {
      triggerToast('Subject and body content cannot be empty.', 'error');
      return;
    }

    try {
      setLoading(prev => ({ ...prev, sendNews: true }));
      const res = await fetch('/api/newsletters/send', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          subject: newsletterSubject,
          content: newsletterContent,
          articleIds: selectedArticleIds
        })
      });

      if (!res.ok) throw new Error('Delivery failed.');
      const data = await res.json();

      setNewsletters(prev => [data.newsletter, ...prev]);
      
      // Reset
      setNewsletterSubject('');
      setNewsletterContent('');
      setSelectedArticleIds([]);

      triggerToast(data.message || 'Newsletter successfully dispatched!', 'success');
    } catch (e) {
      triggerToast('Failed to send newsletter. Active subscribers might be zero.', 'error');
    } finally {
      setLoading(prev => ({ ...prev, sendNews: false }));
    }
  };

  // Approve Comment
  const handleApproveComment = async (id: string) => {
    if (currentUser.role !== 'Admin' && currentUser.role !== 'Editor') {
      triggerToast('Insufficient moderation access.', 'error');
      return;
    }
    try {
      const res = await fetch(`/api/comments/${id}/approve`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error();
      
      setComments(prev => prev.map(c => c.id === id ? { ...c, status: 'approved', flagReason: undefined } : c));
      triggerToast('Comment successfully approved and released to the column boards.', 'success');
    } catch (e) {
      triggerToast('Comment approve error.', 'error');
    }
  };

  // Flag/Reject Comment
  const handleRejectComment = async (id: string) => {
    if (currentUser.role !== 'Admin' && currentUser.role !== 'Editor') {
      triggerToast('Insufficient moderation access.', 'error');
      return;
    }
    const reason = prompt('Specify flag reason or category restriction:', 'Violated respectful community standards');
    if (reason === null) return;

    try {
      const res = await fetch(`/api/comments/${id}/reject`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ reason: reason || 'Flagged manually by Editor' })
      });
      if (!res.ok) throw new Error();

      setComments(prev => prev.map(c => c.id === id ? { ...c, status: 'flagged', flagReason: reason || 'Flagged' } : c));
      triggerToast('Comment successfully flagged and restricted from columns.', 'success');
    } catch (e) {
      triggerToast('Comment reject error.', 'error');
    }
  };

  // Delete Comment (Admin Only)
  const handleDeleteComment = async (id: string) => {
    if (currentUser.role !== 'Admin') {
      triggerToast('Only Admin users can delete comment database entries.', 'error');
      return;
    }
    if (!confirm('Are you sure you want to permanently delete this comment record?')) return;

    try {
      const res = await fetch(`/api/comments/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error();

      setComments(prev => prev.filter(c => c.id !== id));
      triggerToast('Comment permanently deleted from logs.', 'success');
    } catch (e) {
      triggerToast('Comment delete error.', 'error');
    }
  };

  // Manual subscriber entry
  const handleAddManualSub = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualEmail.trim()) return;

    try {
      const res = await fetch('/api/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: manualEmail })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed');
      }

      triggerToast('Subscriber successfully registered manually.', 'success');
      setManualEmail('');
      fetchAdminData(); // Sync lists
    } catch (err: any) {
      triggerToast(err.message || 'Failed to add subscriber.', 'error');
    }
  };

  // Toggle manual subscriber status
  const handleToggleSubscriber = async (sub: Subscription) => {
    try {
      const url = sub.status === 'active' 
        ? '/api/subscriptions/unsubscribe' 
        : '/api/subscriptions';

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: sub.email })
      });

      if (!res.ok) throw new Error();
      triggerToast(`Subscriber status updated successfully.`, 'success');
      fetchAdminData();
    } catch (e) {
      triggerToast('Subscriber toggle failed.', 'error');
    }
  };

  // Advertisement Management Handlers
  const handleCreateAd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adTitle.trim() || !adImageUrl.trim() || !adLinkUrl.trim()) {
      triggerToast('All fields are required to register an advertisement.', 'error');
      return;
    }
    try {
      setIsAdSubmitting(true);
      const res = await fetch('/api/ads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: adTitle.trim(),
          imageUrl: adImageUrl.trim(),
          linkUrl: adLinkUrl.trim(),
          slot: adSlot,
          status: adStatus
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Ad creation failed');
      }

      const newAd = await res.json();
      setAds(prev => [newAd, ...prev]);
      setAdTitle('');
      setAdImageUrl('');
      setAdLinkUrl('');
      setAdSlot('top-banner');
      setAdStatus('active');
      triggerToast('Advertisement successfully posted and live!', 'success');
    } catch (err: any) {
      triggerToast(err.message || 'Failed to save advertisement.', 'error');
    } finally {
      setIsAdSubmitting(false);
    }
  };

  const handleToggleAdStatus = async (ad: any) => {
    try {
      const nextStatus = ad.status === 'active' ? 'inactive' : 'active';
      const res = await fetch(`/api/ads/${ad.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: nextStatus })
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setAds(prev => prev.map(item => item.id === ad.id ? updated : item));
      triggerToast(`Ad status successfully toggled to ${nextStatus}.`, 'success');
    } catch (e) {
      triggerToast('Failed to modify advertisement status.', 'error');
    }
  };

  const handleDeleteAd = async (id: string) => {
    if (!confirm('Are you sure you want to permanently delete this advertisement slot?')) return;
    try {
      const res = await fetch(`/api/ads/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error();
      setAds(prev => prev.filter(item => item.id !== id));
      triggerToast('Advertisement permanently removed.', 'success');
    } catch (e) {
      triggerToast('Failed to remove advertisement.', 'error');
    }
  };

  // Theme configuration for Recharts visual consistency
  const COLORS = ['#1c1917', '#78716c', '#d6d3d1', '#a8a29e', '#e7e5e4'];

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900 font-sans flex flex-col">
      
      {/* Toast Feedback notifications */}
      <div className="fixed bottom-5 right-5 z-55 flex flex-col gap-2 pointer-events-none select-none">
        <AnimatePresence>
          {successMsg && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className="bg-stone-900 border border-stone-850 text-stone-100 px-4 py-3 rounded shadow-xl flex items-center gap-2.5 max-w-sm font-medium"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="text-xs font-mono">{successMsg}</span>
            </motion.div>
          )}

          {errorMsg && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className="bg-red-950 border border-red-900 text-red-200 px-4 py-3 rounded shadow-xl flex items-center gap-2.5 max-w-sm font-medium"
            >
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span className="text-xs font-mono">{errorMsg}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Admin Top Header Bar */}
      <header className="bg-stone-900 text-white py-4 px-6 flex flex-col md:flex-row justify-between items-center border-b border-stone-800 gap-4 shadow-md shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-stone-800 rounded">
            <Newspaper className="w-6 h-6 text-stone-200" />
          </div>
          <div>
            <h1 className="font-serif text-xl tracking-wider uppercase font-bold flex items-center gap-2">
              দৈনিক কথা প্রকাশ <span className="font-sans text-xs bg-stone-850 border border-stone-750 px-2 py-0.5 rounded tracking-normal font-mono text-amber-500 font-bold">{currentUser.role === 'Admin' ? 'অ্যাডমিন' : 'সম্পাদক'} প্যানেল</span>
            </h1>
            <p className="text-xs text-stone-400 font-sans">সক্রিয় সেশন: লগইনকারী - {currentUser.name}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchAdminData}
            disabled={loading.data}
            className="p-2 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded transition-all cursor-pointer flex items-center gap-1.5 text-xs font-mono"
            title="ডাটাবেজ রিফ্রেশ করুন"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading.data ? 'animate-spin' : ''}`} />
            <span>ডাটাবেজ সিঙ্ক</span>
          </button>
          
          <button
            onClick={onBackToReader}
            className="bg-stone-100 hover:bg-white text-stone-900 font-sans px-4 py-2 rounded text-xs font-semibold tracking-wide flex items-center gap-1 shadow-xs hover:shadow-md transition-all cursor-pointer"
          >
            <span>প্যানেল বন্ধ করুন</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex-grow flex flex-col lg:flex-row max-w-7xl w-full mx-auto p-4 lg:p-6 gap-6 overflow-hidden">
        
        {/* Sidebar Navigation */}
        <nav className="w-full lg:w-64 shrink-0 flex flex-row lg:flex-col overflow-x-auto lg:overflow-x-visible gap-1.5 border-b lg:border-b-0 lg:border-r border-stone-200 pb-3 lg:pb-0 lg:pr-4 select-none">
          <button
            onClick={() => setActiveTab('analytics')}
            className={`flex items-center gap-3 px-4 py-3 rounded text-sm font-semibold tracking-wide whitespace-nowrap transition-all duration-150 cursor-pointer w-full text-left ${
              activeTab === 'analytics' 
                ? 'bg-stone-900 text-white shadow-sm' 
                : 'text-stone-600 hover:bg-stone-200 hover:text-stone-900'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>বিশ্লেষণ ড্যাশবোর্ড</span>
          </button>
          
          <button
            onClick={() => setActiveTab('articles')}
            className={`flex items-center gap-3 px-4 py-3 rounded text-sm font-semibold tracking-wide whitespace-nowrap transition-all duration-150 cursor-pointer w-full text-left ${
              activeTab === 'articles' 
                ? 'bg-stone-900 text-white shadow-sm' 
                : 'text-stone-600 hover:bg-stone-200 hover:text-stone-900'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>কন্টেন্ট ক্রিয়েটর ও আপলোড</span>
          </button>
          
          <button
            onClick={() => setActiveTab('newsletter')}
            className={`flex items-center gap-3 px-4 py-3 rounded text-sm font-semibold tracking-wide whitespace-nowrap transition-all duration-150 cursor-pointer w-full text-left ${
              activeTab === 'newsletter' 
                ? 'bg-stone-900 text-white shadow-sm' 
                : 'text-stone-600 hover:bg-stone-200 hover:text-stone-900'
            }`}
          >
            <Mail className="w-4 h-4" />
            <span>নিউজলেটার কম্পাইলার</span>
          </button>
          
          <button
            onClick={() => setActiveTab('comments')}
            className={`flex items-center gap-3 px-4 py-3 rounded text-sm font-semibold tracking-wide whitespace-nowrap transition-all duration-150 cursor-pointer w-full text-left ${
              activeTab === 'comments' 
                ? 'bg-stone-900 text-white shadow-sm' 
                : 'text-stone-600 hover:bg-stone-200 hover:text-stone-900'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>মন্তব্য মডারেশন</span>
            {comments.filter(c => c.status === 'pending' || c.status === 'flagged').length > 0 && (
              <span className="ml-auto bg-stone-700 text-white text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full shrink-0">
                {comments.filter(c => c.status === 'pending' || c.status === 'flagged').length}
              </span>
            )}
          </button>
          
          <button
            onClick={() => setActiveTab('subscriptions')}
            className={`flex items-center gap-3 px-4 py-3 rounded text-sm font-semibold tracking-wide whitespace-nowrap transition-all duration-150 cursor-pointer w-full text-left ${
              activeTab === 'subscriptions' 
                ? 'bg-stone-900 text-white shadow-sm' 
                : 'text-stone-600 hover:bg-stone-200 hover:text-stone-900'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>গ্রাহক ও সাবস্ক্রিপশন</span>
          </button>

          <button
            onClick={() => setActiveTab('advertisements')}
            className={`flex items-center gap-3 px-4 py-3 rounded text-sm font-semibold tracking-wide whitespace-nowrap transition-all duration-150 cursor-pointer w-full text-left ${
              activeTab === 'advertisements' 
                ? 'bg-stone-900 text-white shadow-sm' 
                : 'text-stone-600 hover:bg-stone-200 hover:text-stone-900'
            }`}
          >
            <Share2 className="w-4 h-4 text-rose-500" />
            <span className="flex items-center gap-1">
              <span>বিজ্ঞাপন ও স্পন্সরশিপ</span>
              <span className="bg-rose-100 text-rose-800 text-[9px] px-1.5 py-0.2 rounded-full font-bold">লাইভ</span>
            </span>
          </button>

          <button
            onClick={() => setActiveTab('news_fetcher')}
            className={`flex items-center gap-3 px-4 py-3 rounded text-sm font-semibold tracking-wide whitespace-nowrap transition-all duration-150 cursor-pointer w-full text-left ${
              activeTab === 'news_fetcher' 
                ? 'bg-stone-900 text-white shadow-sm' 
                : 'text-stone-600 hover:bg-stone-200 hover:text-stone-900'
            }`}
          >
            <RefreshCw className="w-4 h-4 text-emerald-500" />
            <span className="flex items-center gap-1.5">
              <span>অটো খবর সিঙ্ক (Prothom Alo & Ittefaq)</span>
              <span className="bg-emerald-100 text-emerald-800 text-[9px] px-1.5 py-0.2 rounded-full font-bold shrink-0">প্রতি ঘণ্টায়</span>
            </span>
          </button>
        </nav>

        {/* Workspace Display Area */}
        <main className="flex-grow min-w-0 overflow-y-auto">
          {/* Database Connection Status Banner */}
          {dbStatus && (
            <div className={`mb-6 p-4 rounded-lg border flex flex-col md:flex-row md:items-start justify-between gap-4 shadow-xs ${
              dbStatus.isMysql 
                ? 'bg-emerald-50/80 border-emerald-100 text-emerald-950' 
                : 'bg-amber-50/80 border-amber-100 text-amber-950'
            }`}>
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded mt-0.5 shrink-0 ${
                  dbStatus.isMysql ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    {dbStatus.isMysql ? 'ডাটাবেজ সংযোগ: সফল (MySQL Active)' : 'ডাটাবেজ সংযোগ: ফলব্যাক মোড (JSON Fallback Active)'}
                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide ${
                      dbStatus.isMysql ? 'bg-emerald-200 text-emerald-900' : 'bg-amber-200 text-amber-900'
                    }`}>
                      {dbStatus.isMysql ? 'সংযুক্ত' : 'লোকাল ফাইল'}
                    </span>
                  </h4>
                  <p className="text-xs text-stone-600 mt-1 max-w-2xl leading-relaxed">
                    {dbStatus.isMysql 
                      ? 'অ্যাপ্লিকেশনটি সফলভাবে ক্লাউড MySQL ডাটাবেজের সাথে সংযুক্ত রয়েছে। আপনার কন্টেন্ট, ব্যবহারকারী এবং সাবস্ক্রিপশন ডাটাবেজ টেবিলে সংরক্ষিত হচ্ছে।'
                      : 'পরিবেশের MySQL ডাটাবেজ কনফিগারেশন নেই অথবা সংযোগ করা যায়নি। সিস্টেম স্বয়ংক্রিয়ভাবে একটি লোকাল JSON ডাটাবেজ ফাইলে কাজ করছে। ডাটাবেজে ডাটা না দেখতে পাওয়ার কারণ এটি।'
                    }
                  </p>
                  {!dbStatus.isMysql && dbStatus.error && (
                    <div className="mt-2 text-[11px] font-mono bg-amber-100/50 border border-amber-200/80 p-2 rounded text-amber-900 overflow-x-auto max-w-full">
                      <strong>ত্রুটির বিবরণ (MySQL Error):</strong> {dbStatus.error}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 md:self-start md:mt-1">
                <span className="text-[10px] font-mono text-stone-400 bg-stone-200/50 px-2 py-1 rounded">
                  সংগ্রহস্থল: {dbStatus.isMysql ? 'MySQL Server' : 'data/db.json'}
                </span>
              </div>
            </div>
          )}

          <AnimatePresence mode="wait">
            {activeTab === 'analytics' && (
              <motion.div
                key="analytics"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                {/* Micro KPIs */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white border border-stone-200 p-4.5 rounded-lg shadow-xs flex flex-col justify-between">
                    <span className="text-[10px] font-mono font-bold text-stone-400 uppercase tracking-widest">মোট ইমপ্রেশন / ভিউ</span>
                    <h3 className="font-serif text-2xl font-bold text-stone-950 mt-1">{analytics?.totalViews || '০'}</h3>
                    <p className="text-[9px] text-stone-400 font-mono mt-2 flex items-center gap-1">
                      <span className="text-emerald-500 font-bold">&#x25B2; ১৪.২%</span> গত সপ্তাহ থেকে বৃদ্ধি
                    </p>
                  </div>
                  <div className="bg-white border border-stone-200 p-4.5 rounded-lg shadow-xs flex flex-col justify-between">
                    <span className="text-[10px] font-mono font-bold text-stone-400 uppercase tracking-widest">সম্পূর্ণ পঠিত নিবন্ধ</span>
                    <h3 className="font-serif text-2xl font-bold text-stone-950 mt-1">{analytics?.totalReads || '০'}</h3>
                    <p className="text-[9px] text-stone-400 font-mono mt-2 flex items-center gap-1">
                      <span className="text-stone-500 font-bold">&#x25B2; ৮%</span> রিড কমপ্লিশন অনুপাত
                    </p>
                  </div>
                  <div className="bg-white border border-stone-200 p-4.5 rounded-lg shadow-xs flex flex-col justify-between">
                    <span className="text-[10px] font-mono font-bold text-stone-400 uppercase tracking-widest">সক্রিয় সদস্য সংখ্যা</span>
                    <h3 className="font-serif text-2xl font-bold text-stone-950 mt-1">{analytics?.totalSubscribers || '০'}</h3>
                    <p className="text-[9px] text-stone-400 font-mono mt-2 flex items-center gap-1">
                      <span className="text-emerald-500 font-bold">&#x25B2; ৩২</span> ডাটাবেজে সংরক্ষিত
                    </p>
                  </div>
                  <div className="bg-white border border-stone-200 p-4.5 rounded-lg shadow-xs flex flex-col justify-between">
                    <span className="text-[10px] font-mono font-bold text-amber-600 uppercase tracking-widest">বর্তমানে অনলাইন পাঠক</span>
                    <h3 className="font-serif text-2xl font-bold text-amber-700 animate-pulse mt-1">{analytics?.activeReadersNow || '০'}</h3>
                    <p className="text-[9px] text-stone-400 font-mono mt-2 flex items-center gap-1">
                      <span className="inline-block w-2 h-2 rounded-full bg-amber-500 animate-ping" /> রিয়েল-টাইম পাঠক সংখ্যা
                    </p>
                  </div>
                </div>

                {/* Primary charts */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  
                  {/* Visitor & Subscription Timeline */}
                  <div className="bg-white border border-stone-200 p-5 rounded-lg shadow-xs lg:col-span-8">
                    <h4 className="font-serif text-sm font-bold text-stone-900 border-b border-stone-100 pb-2">সাপ্তাহিক পাঠক বৃদ্ধির গ্রাফ</h4>
                    <div className="h-72 mt-4 text-xs">
                      {analytics?.visitorTimeline ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={analytics.visitorTimeline}>
                            <defs>
                              <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#1c1917" stopOpacity={0.2}/>
                                <stop offset="95%" stopColor="#1c1917" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7e5e4" />
                            <XAxis dataKey="date" stroke="#a8a29e" />
                            <YAxis stroke="#a8a29e" />
                            <Tooltip contentStyle={{ background: '#1c1917', color: '#fff', borderRadius: '4px' }} />
                            <Area type="monotone" dataKey="views" stroke="#1c1917" strokeWidth={2} fillOpacity={1} fill="url(#colorViews)" name="পেইজ ভিউ" />
                          </AreaChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-full flex items-center justify-center text-stone-400 font-mono">গ্রাফ লোড হচ্ছে...</div>
                      )}
                    </div>
                  </div>

                  {/* Device breakdown Pie */}
                  <div className="bg-white border border-stone-200 p-5 rounded-lg shadow-xs lg:col-span-4 flex flex-col justify-between">
                    <h4 className="font-serif text-sm font-bold text-stone-900 border-b border-stone-100 pb-2">ডিভাইস ব্যবহারের অনুপাত</h4>
                    <div className="h-48 mt-4">
                      {analytics?.deviceBreakdown ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={analytics.deviceBreakdown}
                              cx="50%"
                              cy="50%"
                              innerRadius={50}
                              outerRadius={70}
                              paddingAngle={3}
                              dataKey="value"
                            >
                              {analytics.deviceBreakdown.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-full flex items-center justify-center text-stone-400 font-mono">লোড হচ্ছে...</div>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-3 gap-1.5 text-center mt-3 border-t border-stone-100 pt-3">
                      {analytics?.deviceBreakdown.map((item, idx) => {
                        const deviceNames: Record<string, string> = {
                          'Mobile': 'মোবাইল',
                          'Desktop': 'ডেস্কটপ',
                          'Tablet': 'ট্যাবলেট'
                        };
                        return (
                          <div key={item.name}>
                            <span className="text-[10px] font-mono text-stone-400 uppercase tracking-tight block">
                              {deviceNames[item.name] || item.name}
                            </span>
                            <strong className="text-xs text-stone-800 font-mono font-bold">{item.value}%</strong>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                </div>

                {/* Popular articles listing */}
                <div className="bg-white border border-stone-200 p-5 rounded-lg shadow-xs">
                  <h4 className="font-serif text-sm font-bold text-stone-900 border-b border-stone-100 pb-2">সেরা জনপ্রিয় কলাম ও নিবন্ধসমূহ</h4>
                  
                  <div className="overflow-x-auto mt-3">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-stone-200 text-stone-400 text-[10px] font-mono uppercase tracking-wider">
                          <th className="py-2.5">নিবন্ধ শিরোনাম</th>
                          <th className="py-2.5 text-center">ভিউ সংখ্যা</th>
                          <th className="py-2.5 text-center">সম্পূর্ণ পড়ার সংখ্যা</th>
                          <th className="py-2.5 text-right">রিড কমপ্লিশন রেট</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {analytics?.popularArticles.map((art, idx) => {
                          const ratio = art.views > 0 ? Math.round((art.reads / art.views) * 100) : 0;
                          return (
                            <tr key={art.articleId} className="hover:bg-stone-50 transition-colors">
                              <td className="py-3 flex items-center gap-3">
                                <span className="text-xs font-mono font-bold text-stone-300 w-4">০{idx + 1}</span>
                                <span className="font-serif text-sm font-semibold text-stone-800">{art.title}</span>
                              </td>
                              <td className="py-3 text-center font-mono text-xs text-stone-600 font-bold">{art.views}</td>
                              <td className="py-3 text-center font-mono text-xs text-stone-600">{art.reads}</td>
                              <td className="py-3 text-right">
                                <span className="text-xs font-mono font-bold text-stone-900">{ratio}%</span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

              </motion.div>
            )}

            {activeTab === 'articles' && (
              <motion.div
                key="articles"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="grid grid-cols-1 lg:grid-cols-3 gap-6"
              >
                {/* AI & Manual content writing pane */}
                <div className="bg-white border border-stone-200 p-5 rounded-lg shadow-xs space-y-5 lg:col-span-1 self-start">
                  
                  {/* Gemini Generator Console */}
                  <div className="bg-stone-50 p-4 rounded-lg border border-stone-200 space-y-3">
                    <div className="flex items-center gap-1.5 text-xs font-mono text-stone-600 uppercase tracking-widest font-bold">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-pulse shrink-0" />
                      <span>Gemini এআই ড্রাফটিং রুম</span>
                    </div>
                    <p className="text-[11px] text-stone-500 font-sans leading-relaxed">
                      নিচে যেকোনো বিষয় বা শিরোনাম লিখুন এবং Gemini এআই-কে দিয়ে একটি আকর্ষণীয় সাংবাদিকতা খসড়া তৈরি করে নিন।
                    </p>

                    <div className="space-y-2.5 pt-2">
                      <div>
                        <label className="text-[9px] font-mono text-stone-400 block uppercase font-bold">খসড়ার বিষয়বস্তু</label>
                        <input
                          type="text"
                          value={aiTopic}
                          onChange={(e) => setAiTopic(e.target.value)}
                          placeholder="যেমন: ঢাকার যানজট নিরসনে নতুন এলিভেটেড এক্সপ্রেসওয়ে"
                          className="w-full text-xs font-sans p-2 border border-stone-200 bg-white rounded mt-1 outline-stone-800"
                        />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[9px] font-mono text-stone-400 block uppercase font-bold">ক্যাটাগরি</label>
                          <select
                            value={aiCategory}
                            onChange={(e) => setAiCategory(e.target.value)}
                            className="w-full text-xs font-sans p-1.5 border border-stone-200 bg-white rounded mt-1 outline-stone-800"
                          >
                            {categories.length > 0 ? (
                              categories.map(cat => (
                                <option key={cat.id} value={cat.name}>
                                  {CATEGORY_LABELS[cat.name]?.bn || cat.name}
                                </option>
                              ))
                            ) : (
                              <>
                                <option value="Politics">রাজনীতি</option>
                                <option value="Tech">বিজ্ঞান ও প্রযুক্তি</option>
                                <option value="Opinions">মতামত</option>
                                <option value="Business">বাণিজ্য</option>
                                <option value="Culture">বিনোদন ও সংস্কৃতি</option>
                                <option value="Science">বিজ্ঞান</option>
                              </>
                            )}
                          </select>
                        </div>
                        <div>
                          <label className="text-[9px] font-mono text-stone-400 block uppercase font-bold">টোন / ভঙ্গি</label>
                          <select
                            value={aiTone}
                            onChange={(e) => setAiTone(e.target.value)}
                            className="w-full text-xs font-sans p-1.5 border border-stone-200 bg-white rounded mt-1 outline-stone-800"
                          >
                            <option value="Journalistic, Objective">সাংবাদিকতাসুলভ, নিরপেক্ষ</option>
                            <option value="Critical, Hard-Hitting">তথ্যবহুল ও বিশ্লেষণাত্মক</option>
                            <option value="Editorial, Narrative">সম্পাদকীয় বর্ণনাধর্মী</option>
                            <option value="Opinionated, Deep">ব্যক্তিগত গভীর মতামত</option>
                          </select>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleGenerateAiDraft}
                        disabled={loading.generator || !aiTopic.trim()}
                        className="w-full bg-stone-900 hover:bg-stone-800 text-white font-mono text-[10px] font-bold uppercase tracking-wider py-2 rounded shadow-xs cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5 transition-colors"
                      >
                        {loading.generator ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>খসড়া লেখা হচ্ছে...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>এআই দিয়ে খসড়া লিখুন</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  <hr className="border-stone-200" />

                  {/* Manual / Final Form review */}
                  <form onSubmit={handlePublishArticle} className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-serif text-sm font-bold text-stone-900">নিবন্ধ প্রকাশনা ডেস্ক</h3>
                      
                      {/* Quick demo filler */}
                      <button
                        type="button"
                        onClick={() => {
                          const templates = [
                            {
                              title: 'বিজ্ঞান ও প্রযুক্তির নতুন দিগন্ত: বাংলাদেশে এআই বিপ্লব',
                              subtitle: 'কৃত্রিম বুদ্ধিমত্তার মাধ্যমে বদলে যাচ্ছে দেশের ফ্রিল্যান্সিং ও সেবা খাত',
                              category: 'Tech',
                              content: '<h2>প্রযুক্তির অমিত সম্ভাবনা</h2><p>বাংলাদেশ তথ্যপ্রযুক্তি খাতে দ্রুত এগিয়ে চলেছে। সম্প্রতি বিভিন্ন দেশীয় স্টার্টআপ কৃত্রিম বুদ্ধিমত্তা বা আর্টিফিশিয়াল ইন্টেলিজেন্স ব্যবহার করে জীবনযাত্রাকে সহজ করার উদ্যোগ নিয়েছে। ফ্রিল্যান্সাররা এখন এআই টুলস ব্যবহার করে দ্বিগুণ গতিতে কাজ সম্পন্ন করছেন।</p><h3>সেবা খাতে পরিবর্তন</h3><p>গ্রাহকসেবা থেকে শুরু করে শিক্ষা ও চিকিৎসায় এআই প্রযুক্তির ব্যবহার সময়ের সাথে সাথে বাড়ছে। বিশেষজ্ঞদের মতে, আগামী ৫ বছরে তথ্যপ্রযুক্তি খাতে কাজের পরিধি বহুগুণ বৃদ্ধি পাবে।</p>',
                              image: 'https://images.unsplash.com/photo-1546410531-bb4caa6b424d?w=800&auto=format&fit=crop'
                            },
                            {
                              title: 'জলবায়ু পরিবর্তনের প্রভাব এবং উপকূলীয় অঞ্চলের জীববৈচিত্র্য রক্ষা',
                              subtitle: 'জলবায়ু ঝুঁকি মোকাবেলায় নতুন পরিবেশবান্ধব মডেলের প্রস্তাবনা',
                              category: 'Science',
                              content: '<h2>পরিবেশ ও আমাদের ভবিষ্যৎ</h2><p>বৈশ্বিক তাপমাত্রা বৃদ্ধির ফলে সবচেয়ে বেশি ঝুঁকিতে রয়েছে বাংলাদেশের উপকূলীয় অঞ্চল। সুন্দরবনের জীববৈচিত্র্য আজ হুমকির মুখে। এই অবস্থায় বিজ্ঞানীদের প্রস্তাবিত পরিবেশবান্ধব নতুন মডেল দুর্যোগের ক্ষয়ক্ষতি অনেকাংশেই কমাতে সক্ষম হবে বলে আশা করা হচ্ছে।</p><h3>নবায়নযোগ্য শক্তির প্রসার</h3><p>উপকূলীয় অঞ্চলে সৌর শক্তি ও বায়ু বিদ্যুতের উৎপাদন বৃদ্ধির মাধ্যমে গ্রিনহাউস গ্যাসের নিঃসরণ কমিয়ে আনা সম্ভব। পরিবেশবিদরা সবাইকে এগিয়ে আসার আহ্বান জানিয়েছেন।</p>',
                              image: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&auto=format&fit=crop'
                            },
                            {
                              title: 'দেশীয় কুটির ও হস্তশিল্পের বৈশ্বিক উত্থান: বাড়ছে রপ্তানি আয়',
                              subtitle: 'বাংলাদেশি ঐতিহ্যবাহী পণ্যের কদর বাড়ছে ইউরোপ ও আমেরিকার বাজারে',
                              category: 'Business',
                              content: '<h2>ঐতিহ্য ও বাণিজ্যের মেলবন্ধন</h2><p>আমাদের দেশের গ্রামীণ নারীদের হাতে তৈরি নকশিকাঁথা, পাটের ব্যাগ ও মাটির জিনিসপত্র এখন বিদেশের মাটিতে বিপুল জনপ্রিয়। উদ্যোক্তারা উন্নত ই-কমার্স সেবার সাহায্য নিয়ে সরাসরি আন্তর্জাতিক ক্রেতাদের কাছে পৌঁছাতে পারছেন।</p><h3>রপ্তানি বৃদ্ধির সুযোগ</h3><p>সরকারি সহযোগিতা এবং সহজ শর্তে ব্যাংক ঋণ পেলে এ খাতের উদ্যোক্তারা আরও বড় পরিসরে কাজ করতে পারবেন, যা দেশের অর্থনীতিকে আরও সমৃদ্ধ করবে।</p>',
                              image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&auto=format&fit=crop'
                            }
                          ];
                          const chosen = templates[Math.floor(Math.random() * templates.length)];
                          setNewTitle(chosen.title);
                          setNewSubtitle(chosen.subtitle);
                          setNewCategory(chosen.category);
                          setNewContent(chosen.content);
                          setNewImage(chosen.image);
                          triggerToast('খসড়া ডেমো তথ্য সফলভাবে পূরণ করা হয়েছে!', 'success');
                        }}
                        className="text-[11px] bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 px-2 py-1 rounded transition-colors font-serif font-semibold cursor-pointer"
                      >
                        ⚡ কুইক ডেমো তথ্য পূরণ
                      </button>
                    </div>

                    <div>
                      <label className="text-[10px] font-mono text-stone-400 uppercase tracking-widest block font-bold">প্রধান শিরোনাম (Headline Title)</label>
                      <input
                        type="text"
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        placeholder="আকর্ষণীয় প্রধান শিরোনাম লিখুন..."
                        required
                        className="w-full text-xs font-sans p-2 border border-stone-200 rounded mt-1 outline-stone-800 font-semibold"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-mono text-stone-400 uppercase tracking-widest block font-bold">উপ-শিরোনাম / সারসংক্ষেপ (Summary Subtitle)</label>
                      <input
                        type="text"
                        value={newSubtitle}
                        onChange={(e) => setNewSubtitle(e.target.value)}
                        placeholder="নিবন্ধের এক লাইনের আকর্ষণীয় সারসংক্ষেপ..."
                        className="w-full text-xs font-sans p-2 border border-stone-200 rounded mt-1 outline-stone-800"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-mono text-stone-400 uppercase tracking-widest block font-bold">নিবন্ধের বিভাগ</label>
                          <button
                            type="button"
                            onClick={() => setShowAddCatModal(true)}
                            className="text-[9px] text-rose-700 hover:text-rose-900 font-bold flex items-center gap-0.5 font-sans cursor-pointer"
                            title="নতুন ক্যাটাগরি তৈরি করুন"
                          >
                            <Plus className="w-2.5 h-2.5" /> নতুন বিভাগ
                          </button>
                        </div>
                        <select
                          value={newCategory}
                          onChange={(e) => setNewCategory(e.target.value)}
                          className="w-full text-xs font-sans p-2 border border-stone-200 bg-white rounded mt-1 outline-stone-800"
                        >
                          {categories.length > 0 ? (
                            categories.map(cat => (
                              <option key={cat.id} value={cat.name}>
                                {CATEGORY_LABELS[cat.name]?.bn || cat.name}
                              </option>
                            ))
                          ) : (
                            <>
                              <option value="Politics">রাজনীতি</option>
                              <option value="Tech">বিজ্ঞান ও প্রযুক্তি</option>
                              <option value="Business">বাণিজ্য</option>
                              <option value="Science">বিজ্ঞান</option>
                              <option value="Culture">বিনোদন ও সংস্কৃতি</option>
                              <option value="Opinions">মতামত</option>
                            </>
                          )}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-mono text-stone-400 uppercase tracking-widest block font-bold">প্রতিবেদক / লেখকের নাম</label>
                        <input
                          type="text"
                          value={newAuthor}
                          onChange={(e) => setNewAuthor(e.target.value)}
                          className="w-full text-xs font-sans p-2 border border-stone-200 rounded mt-1 outline-stone-800"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-mono text-stone-400 uppercase tracking-widest block font-bold">ফিচার্ড কভার ছবি (Unsplash URL)</label>
                      <input
                        type="text"
                        value={newImage}
                        onChange={(e) => setNewImage(e.target.value)}
                        placeholder="https://images.unsplash.com/photo-..."
                        className="w-full text-xs font-sans p-2 border border-stone-200 rounded mt-1 outline-stone-800"
                      />
                      
                      {/* Quick Cover Presets */}
                      <div className="mt-1.5 space-y-1">
                        <span className="text-[10px] text-stone-500 font-serif block">অথবা নিচের যেকোনো একটি সুন্দর ছবি বেছে নিন:</span>
                        <div className="grid grid-cols-5 gap-1.5">
                          {[
                            { url: 'https://images.unsplash.com/photo-1596436889106-be35e843f974?w=800&auto=format&fit=crop', name: 'বাংলাদেশ' },
                            { url: 'https://images.unsplash.com/photo-1546410531-bb4caa6b424d?w=800&auto=format&fit=crop', name: 'শিক্ষা/টেক' },
                            { url: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&auto=format&fit=crop', name: 'বিজ্ঞান' },
                            { url: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&auto=format&fit=crop', name: 'বাণিজ্য' },
                            { url: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=800&auto=format&fit=crop', name: 'রাজনীতি' }
                          ].map((imgOpt, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => {
                                setNewImage(imgOpt.url);
                                triggerToast(`"${imgOpt.name}" ছবি সিলেক্ট করা হয়েছে!`, 'success');
                              }}
                              className={`relative h-10 rounded overflow-hidden border-2 transition-all cursor-pointer ${
                                newImage === imgOpt.url ? 'border-rose-600 scale-95' : 'border-stone-200 hover:border-stone-400'
                              }`}
                              title={imgOpt.name}
                            >
                              <img src={imgOpt.url} alt={imgOpt.name} className="w-full h-full object-cover shadow-2xs" />
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Integrated WYSIWYG editor */}
                    <div>
                      <label className="text-[10px] font-mono text-stone-400 uppercase tracking-widest block font-bold mb-1">নিবন্ধের বিস্তারিত কনটেন্ট</label>
                      <WysiwygEditor 
                        value={newContent} 
                        onChange={setNewContent} 
                        token={token} 
                        placeholder="এখানে খবরের মূল বিবরণ লিখুন..."
                      />
                    </div>

                    <div className="flex items-center justify-between border-t border-stone-100 pt-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="isDraft"
                          checked={isDraft}
                          onChange={(e) => setIsDraft(e.target.checked)}
                          className="w-3.5 h-3.5 text-stone-900 border-stone-300 rounded focus:ring-0 outline-none cursor-pointer"
                        />
                        <label htmlFor="isDraft" className="text-xs text-stone-500 font-medium cursor-pointer select-none">খসড়া (Draft) হিসেবে রাখুন</label>
                      </div>

                      <button
                        type="submit"
                        disabled={loading.publish}
                        className="bg-stone-900 hover:bg-stone-800 text-white font-sans text-xs font-bold tracking-wider uppercase px-4 py-2 rounded shadow-xs transition-colors cursor-pointer flex items-center gap-1"
                      >
                        {loading.publish ? (
                          <>
                            <Loader2 className="w-3 animate-spin" />
                            <span>প্রক্রিয়াকরণ হচ্ছে...</span>
                          </>
                        ) : (
                          <>
                            <Plus className="w-3.5 h-3.5" />
                            <span>{isDraft ? 'খসড়া সংরক্ষণ করুন' : 'নিবন্ধ প্রকাশ করুন'}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>

                {/* Published Content Registry */}
                <div className="bg-white border border-stone-200 p-5 rounded-lg shadow-xs lg:col-span-2 space-y-4">
                  <h3 className="font-serif text-lg font-bold text-stone-900 border-b border-stone-100 pb-2">প্রকাশিত নিবন্ধ আর্কাইভ ও রেজিস্ট্রি</h3>
                  
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-stone-200 text-stone-400 text-[10px] font-mono uppercase tracking-wider">
                          <th className="py-2.5">শিরোনাম ও বিভাগ</th>
                          <th className="py-2.5">তারিখ</th>
                          <th className="py-2.5 text-center">অবস্থা</th>
                          <th className="py-2.5 text-center">ভিউ সংখ্যা</th>
                          <th className="py-2.5 text-right">পদক্ষেপ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {articles.map((art) => (
                          <tr key={art.id} className="text-stone-800 hover:bg-stone-50 transition-colors">
                            <td className="py-3">
                              <p className="font-serif font-semibold text-sm text-stone-900 max-w-sm truncate">{art.title}</p>
                              <span className="text-[9px] font-mono font-bold bg-stone-100 text-stone-500 px-1.5 py-0.5 rounded mr-2 uppercase">
                                {CATEGORY_LABELS[art.category]?.bn || art.category}
                              </span>
                              <span className="text-[10px] text-stone-400 font-sans">লেখক: {art.author}</span>
                            </td>
                            <td className="py-3 text-xs font-mono text-stone-500">
                              {new Date(art.date).toLocaleDateString('bn-BD')}
                            </td>
                            <td className="py-3 text-center">
                              <button
                                onClick={() => toggleArticleStatus(art)}
                                className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded uppercase tracking-wider cursor-pointer ${
                                  art.status === 'published' 
                                    ? 'bg-emerald-100 text-emerald-800' 
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {art.status === 'published' ? 'প্রকাশিত' : 'খসড়া'}
                              </button>
                            </td>
                            <td className="py-3 text-center font-mono text-xs font-bold text-stone-600">
                              {art.views || 0}
                            </td>
                            <td className="py-3 text-right">
                              <div className="flex justify-end gap-1.5">
                                <button
                                  onClick={() => setSocialShareArticle(art)}
                                  className="p-1.5 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded transition-colors cursor-pointer"
                                  title="এআই ক্যাম্পেইন শেয়ার"
                                >
                                  <Share2 className="w-3.5 h-3.5" />
                                </button>

                                {/* Article deletion restricted to Admin role */}
                                {currentUser.role === 'Admin' ? (
                                  <button
                                    onClick={() => handleDeleteArticle(art.id)}
                                    className="p-1.5 text-red-400 hover:text-red-700 hover:bg-red-50 rounded transition-colors cursor-pointer"
                                    title="নিবন্ধ মুছে ফেলুন (কেবল অ্যাডমিন)"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                ) : (
                                  <button
                                    disabled
                                    className="p-1.5 text-stone-300 rounded cursor-not-allowed opacity-35"
                                    title="মুছুন (অ্যাডমিন পারমিশন প্রয়োজন)"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'newsletter' && (
              <motion.div
                key="newsletter"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="grid grid-cols-1 lg:grid-cols-3 gap-6"
              >
                {/* Compiler selection pane */}
                <div className="bg-white border border-stone-200 p-5 rounded-lg shadow-xs space-y-4 lg:col-span-1">
                  <div>
                    <h3 className="font-serif text-lg font-bold text-stone-900">ক্যাম্পেইন ডিসপ্যাচার (নিউজলেটার)</h3>
                    <p className="text-xs text-stone-500 mt-1">আজকের প্রকাশিত নিবন্ধগুলো সিলেক্ট করুন এবং Gemini এআই-কে দিয়ে স্বয়ংক্রিয়ভাবে একটি চমৎকার সমন্বিত নিউজলেটার ডাইজেস্ট তৈরি করে নিন।</p>
                  </div>

                  <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                    <label className="text-[10px] font-mono text-stone-400 uppercase tracking-widest block font-bold">প্রকাশিত নিবন্ধসমূহ সিলেক্ট করুন</label>
                    {articles.filter(a => a.status === 'published').map(art => (
                      <div key={art.id} className="flex items-start gap-2.5 p-2 bg-stone-50 border border-stone-200 rounded">
                        <input
                          type="checkbox"
                          checked={selectedArticleIds.includes(art.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedArticleIds(prev => [...prev, art.id]);
                            } else {
                              setSelectedArticleIds(prev => prev.filter(id => id !== art.id));
                            }
                          }}
                          className="w-3.5 h-3.5 text-stone-900 border-stone-300 rounded mt-1"
                        />
                        <div>
                          <p className="font-serif text-xs font-semibold text-stone-800 leading-tight">{art.title}</p>
                          <span className="text-[9px] font-mono text-stone-400 uppercase tracking-wider">
                            {CATEGORY_LABELS[art.category]?.bn || art.category} • লেখক: {art.author}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={handleCompileNewsletter}
                    disabled={loading.newsletter || selectedArticleIds.length === 0}
                    className="w-full bg-stone-900 hover:bg-stone-800 text-white font-semibold font-sans py-2.5 rounded text-xs tracking-wider uppercase transition-all shadow-xs hover:shadow-md flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {loading.newsletter ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Gemini দিয়ে নিউজলেটার তৈরি হচ্ছে...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Gemini দিয়ে নিউজলেটার কম্পাইল করুন</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Newsletter Preview Panel */}
                <div className="bg-white border border-stone-200 p-5 rounded-lg shadow-xs lg:col-span-2 space-y-4">
                  <h3 className="font-serif text-lg font-bold text-stone-900 border-b border-stone-100 pb-2">ক্যাম্পেইন এডিটিং এবং প্রিভিউ</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] font-mono text-stone-400 uppercase tracking-widest block font-bold">ইমেইল সাবজেক্ট লাইন (Subject Line)</label>
                      <input
                        type="text"
                        value={newsletterSubject}
                        onChange={(e) => setNewsletterSubject(e.target.value)}
                        placeholder="এআই নিউজলেটার কম্পাইল করলে সাবজেক্ট এখানে স্বয়ংক্রিয়ভাবে তৈরি হবে..."
                        className="w-full text-xs font-sans p-2.5 border border-stone-200 rounded mt-1.5 outline-stone-800 font-semibold"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-mono text-stone-400 uppercase tracking-widest block font-bold">ক্যাম্পেইন ইমেইল বডি কনটেন্ট</label>
                      <textarea
                        value={newsletterContent}
                        onChange={(e) => setNewsletterContent(e.target.value)}
                        rows={12}
                        placeholder="এখানে নিউজলেটারের মূল বিবরণ বা চিঠি থাকবে..."
                        className="w-full text-xs font-sans p-3 border border-stone-200 rounded mt-1.5 outline-stone-800 leading-relaxed"
                      />
                    </div>

                    <div className="flex justify-end">
                      <button
                        onClick={handleSendNewsletter}
                        disabled={loading.sendNews || !newsletterSubject || !newsletterContent}
                        className="bg-stone-950 hover:bg-stone-800 text-white font-sans text-xs font-bold tracking-widest uppercase px-5 py-3 rounded-lg shadow-xs hover:shadow-md transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {loading.sendNews ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>পাঠকদের কাছে পাঠানো হচ্ছে...</span>
                          </>
                        ) : (
                          <>
                            <Send className="w-3.5 h-3.5" />
                            <span>সব পাঠককে ব্রডকাস্ট ইমেইল পাঠান</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'comments' && (
              <motion.div
                key="comments"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-white border border-stone-200 p-5 rounded-lg shadow-xs space-y-4"
              >
                <div className="border-b border-stone-100 pb-2 flex justify-between items-center">
                  <div>
                    <h3 className="font-serif text-lg font-bold text-stone-900">মন্তব্য মডারেশন ও নিয়ন্ত্রণ কন্ট্রোল</h3>
                    <p className="text-xs text-stone-500 mt-1">পাঠকদের জমা দেওয়া মতামত ও মন্তব্য পর্যালোচনা করুন। ক্ষতিকর শব্দ বা স্প্যাম শনাক্ত করতে স্বয়ংক্রিয় এআই ফিল্টার সক্রিয় রয়েছে।</p>
                  </div>
                  <span className="text-xs text-emerald-600 font-mono flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" /> সক্রিয়
                  </span>
                </div>

                {/* Comment moderation restricted to Admin/Editor roles, deletion to Admin only */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-stone-200 text-stone-400 text-[10px] font-mono uppercase tracking-wider">
                        <th className="py-2.5">মন্তব্যকারী ও বক্তব্য</th>
                        <th className="py-2.5">সংশ্লিষ্ট নিবন্ধ</th>
                        <th className="py-2.5">অবস্থা ও এআই লগ</th>
                        <th className="py-2.5 text-right">পদক্ষেপ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {comments.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-8 text-center text-xs text-stone-400 font-mono italic">
                            কোনো মন্তব্য বা প্রতিক্রিয়া পাওয়া যায়নি।
                          </td>
                        </tr>
                      ) : (
                        comments.map((com) => (
                          <tr key={com.id} className="text-stone-800 hover:bg-stone-50 transition-all">
                            <td className="py-3">
                              <p className="font-semibold text-xs text-stone-900">{com.author}</p>
                              <p className="text-xs text-stone-600 mt-1 max-w-lg font-sans italic">"{com.content}"</p>
                              <span className="text-[9px] text-stone-400 font-mono">{new Date(com.date).toLocaleString('bn-BD')}</span>
                            </td>
                            <td className="py-3 max-w-xs truncate text-xs font-serif font-semibold text-stone-700">
                              {com.articleTitle}
                            </td>
                            <td className="py-3">
                              <div className="flex flex-col gap-1.5 items-start">
                                <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                                  com.status === 'approved' 
                                    ? 'bg-emerald-100 text-emerald-800' 
                                    : com.status === 'pending'
                                    ? 'bg-stone-200 text-stone-800'
                                    : 'bg-red-100 text-red-800'
                                }`}>
                                  {com.status === 'approved' ? 'অনুমোদিত' : com.status === 'pending' ? 'অপেক্ষমাণ' : 'প্রত্যাখ্যাত'}
                                </span>
                                {com.isAiModerated && (
                                  <span className="text-[8px] font-mono font-bold uppercase tracking-widest text-amber-600 flex items-center gap-1">
                                    <Sparkles className="w-2.5 h-2.5 shrink-0" />
                                    <span>AI দ্বারা পরীক্ষিত</span>
                                  </span>
                                )}
                                {com.flagReason && (
                                  <p className="text-[10px] text-red-500 font-mono max-w-xs leading-tight">কারণ: {com.flagReason}</p>
                                )}
                              </div>
                            </td>
                            <td className="py-3 text-right">
                              <div className="flex justify-end gap-1.5">
                                {com.status !== 'approved' && (
                                  <button
                                    onClick={() => handleApproveComment(com.id)}
                                    className="p-1 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded transition-colors cursor-pointer"
                                    title="অনুমোদন করুন"
                                  >
                                    <Check className="w-4 h-4" />
                                  </button>
                                )}
                                {com.status !== 'flagged' && (
                                  <button
                                    onClick={() => handleRejectComment(com.id)}
                                    className="p-1 text-red-400 hover:text-red-700 hover:bg-red-50 rounded transition-colors cursor-pointer"
                                    title="প্রত্যাখ্যান করুন"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                )}

                                {/* Comment deletion restricted to Admin role */}
                                {currentUser.role === 'Admin' ? (
                                  <button
                                    onClick={() => handleDeleteComment(com.id)}
                                    className="p-1 text-stone-400 hover:text-stone-900 hover:bg-stone-100 rounded transition-colors cursor-pointer"
                                    title="মন্তব্যটি চিরতরে মুছে ফেলুন (অ্যাডমিন)"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                ) : (
                                  <button
                                    disabled
                                    className="p-1 text-stone-200 rounded cursor-not-allowed opacity-35"
                                    title="মুছুন (অ্যাডমিন পারমিশন প্রয়োজন)"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}

            {activeTab === 'subscriptions' && (
              <motion.div
                key="subscriptions"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="grid grid-cols-1 lg:grid-cols-3 gap-6"
              >
                {/* Manual subscriber form */}
                <div className="bg-white border border-stone-200 p-5 rounded-lg shadow-xs space-y-4 lg:col-span-1 self-start">
                  <h3 className="font-serif text-lg font-bold text-stone-900">ম্যানুয়াল এন্ট্রি কনসোল</h3>
                  <p className="text-xs text-stone-500">ম্যানুয়ালি সাবস্ক্রিপশন ইমেল যুক্ত করুন বা অভ্যন্তরীণ বিতরণ তালিকা পরিচালনা করুন।</p>

                  <form onSubmit={handleAddManualSub} className="space-y-3">
                    <div>
                      <label className="text-[10px] font-mono text-stone-400 uppercase tracking-widest block font-bold">গ্রাহকের ইমেইল (Subscriber Email)</label>
                      <input
                        type="email"
                        value={manualEmail}
                        onChange={(e) => setManualEmail(e.target.value)}
                        placeholder="reader@domain.com"
                        className="w-full text-xs font-sans p-2.5 border border-stone-200 rounded mt-1.5 outline-stone-800"
                        required
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full bg-stone-900 hover:bg-stone-800 text-white font-semibold font-sans py-2.5 rounded text-xs tracking-wider uppercase transition-all shadow-xs hover:shadow-md flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>ইমেল রেজিস্টার করুন</span>
                    </button>
                  </form>
                </div>

                {/* Subscribers list */}
                <div className="bg-white border border-stone-200 p-5 rounded-lg shadow-xs lg:col-span-2 space-y-4">
                  <h3 className="font-serif text-lg font-bold text-stone-900 border-b border-stone-100 pb-2">সক্রিয় ইমেল সাবস্ক্রাইবার ডিরেক্টরি</h3>
                  
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-stone-200 text-stone-400 text-[10px] font-mono uppercase tracking-wider">
                          <th className="py-2.5">ইমেইল ঠিকানা</th>
                          <th className="py-2.5">নিবন্ধনের তারিখ</th>
                          <th className="py-2.5 text-center">অবস্থা</th>
                          <th className="py-2.5 text-right">পদক্ষেপ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {subscriptions.map(sub => (
                          <tr key={sub.id} className="text-stone-800 hover:bg-stone-50 transition-colors">
                            <td className="py-3 font-medium text-xs">
                              {sub.email}
                            </td>
                            <td className="py-3 font-mono text-xs text-stone-500">
                              {new Date(sub.date).toLocaleString('bn-BD')}
                            </td>
                            <td className="py-3 text-center">
                              <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                                sub.status === 'active' 
                                  ? 'bg-emerald-100 text-emerald-800' 
                                  : 'bg-stone-200 text-stone-600'
                              }`}>
                                {sub.status === 'active' ? 'সক্রিয়' : 'নিষ্ক্রিয়'}
                              </span>
                            </td>
                            <td className="py-3 text-right">
                              <button
                                onClick={() => handleToggleSubscriber(sub)}
                                className={`text-[10px] font-sans font-semibold px-2 py-1 rounded border tracking-wide cursor-pointer transition-colors ${
                                  sub.status === 'active'
                                    ? 'border-red-200 text-red-600 hover:bg-red-50'
                                    : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'
                                }`}
                              >
                                {sub.status === 'active' ? 'সাবস্ক্রিপশন বাতিল' : 'পুনরায় সক্রিয় করুন'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'advertisements' && (
              <motion.div
                key="advertisements"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="grid grid-cols-1 lg:grid-cols-3 gap-6"
              >
                {/* Create/Register Ad Form */}
                <div className="bg-white border border-stone-200 p-5 rounded-lg shadow-xs space-y-4 lg:col-span-1 self-start">
                  <div className="border-b border-stone-100 pb-2">
                    <h3 className="font-serif text-base font-bold text-stone-900">বিজ্ঞাপন ব্যানার যুক্ত করুন</h3>
                    <p className="text-xs text-stone-500 mt-0.5">নির্ধারিত স্লটে দেখানোর জন্য একটি নতুন স্পন্সর ব্যানার বা বিজ্ঞাপন পোস্ট করুন।</p>
                  </div>

                  <form onSubmit={handleCreateAd} className="space-y-4">
                    <div>
                      <label className="text-[10px] font-mono text-stone-400 uppercase tracking-widest block font-bold">ক্যাম্পেইন / স্পন্সরের নাম</label>
                      <input
                        type="text"
                        value={adTitle}
                        onChange={(e) => setAdTitle(e.target.value)}
                        placeholder="যেমন: গুগল ক্লাউড বাংলাদেশ"
                        className="w-full text-xs font-sans p-2.5 border border-stone-200 rounded mt-1.5 outline-stone-800"
                        required
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-mono text-stone-400 uppercase tracking-widest block font-bold">বিজ্ঞাপন ছবির লিংক (Image URL)</label>
                      <input
                        type="url"
                        value={adImageUrl}
                        onChange={(e) => setAdImageUrl(e.target.value)}
                        placeholder="যেমন: https://images.unsplash.com/photo-..."
                        className="w-full text-xs font-mono p-2.5 border border-stone-200 rounded mt-1.5 outline-stone-800"
                        required
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-mono text-stone-400 uppercase tracking-widest block font-bold">অ্যাকশন লিংক (Target Action Link)</label>
                      <input
                        type="url"
                        value={adLinkUrl}
                        onChange={(e) => setAdLinkUrl(e.target.value)}
                        placeholder="যেমন: https://cloud.google.com"
                        className="w-full text-xs font-mono p-2.5 border border-stone-200 rounded mt-1.5 outline-stone-800"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-mono text-stone-400 uppercase tracking-widest block font-bold">বিজ্ঞাপন স্লট</label>
                        <select
                          value={adSlot}
                          onChange={(e: any) => setAdSlot(e.target.value)}
                          className="w-full text-xs font-sans p-2 border border-stone-200 rounded mt-1.5 bg-white outline-stone-800"
                        >
                          <option value="top-banner">উপরের ব্যানার (Top)</option>
                          <option value="sidebar">সাইডবার স্লট (Sidebar)</option>
                          <option value="mid-list">তালিকার মাঝে (Mid)</option>
                          <option value="bottom-banner">নিচের ব্যানার (Bottom)</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] font-mono text-stone-400 uppercase tracking-widest block font-bold">অবস্থা</label>
                        <select
                          value={adStatus}
                          onChange={(e: any) => setAdStatus(e.target.value)}
                          className="w-full text-xs font-sans p-2 border border-stone-200 rounded mt-1.5 bg-white outline-stone-800"
                        >
                          <option value="active">সক্রিয় (On)</option>
                          <option value="inactive">নিষ্ক্রিয় (Off)</option>
                        </select>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isAdSubmitting}
                      className="w-full bg-stone-900 hover:bg-stone-800 text-white font-semibold font-sans py-2.5 rounded text-xs tracking-wider uppercase transition-all shadow-xs hover:shadow-md flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      {isAdSubmitting ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>পোস্ট হচ্ছে...</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5" />
                          <span>বিজ্ঞাপন চালু করুন</span>
                        </>
                      )}
                    </button>
                  </form>
                </div>

                {/* Ads Analytics & List */}
                <div className="bg-white border border-stone-200 p-5 rounded-lg shadow-xs lg:col-span-2 space-y-4">
                  <div className="border-b border-stone-100 pb-2 flex justify-between items-center">
                    <div>
                      <h3 className="font-serif text-lg font-bold text-stone-900">সক্রিয় বিজ্ঞাপন ব্যানার রেজিস্ট্রি</h3>
                      <p className="text-xs text-stone-500 mt-1">ভিউ সংখ্যা, ক্লিক সংখ্যা এবং CTR (ক্লিক-থ্রু-রেট) পরিসংখ্যান রিয়েল-টাইমে ট্র্যাক করুন।</p>
                    </div>
                    <span className="text-xs bg-rose-100 text-rose-800 font-bold px-2 py-0.5 rounded-full font-mono uppercase text-[9px]">স্পন্সর ড্যাশবোর্ড সক্রিয়</span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-stone-200 text-stone-400 text-[10px] font-mono uppercase tracking-wider">
                          <th className="py-2.5">স্পন্সর ও ব্যানার</th>
                          <th className="py-2.5 text-center">প্লেসমেন্ট স্লট</th>
                          <th className="py-2.5 text-center">পরিসংখ্যান</th>
                          <th className="py-2.5 text-center">CTR হার</th>
                          <th className="py-2.5 text-right">পদক্ষেপ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {ads.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-8 text-center text-xs text-stone-400 font-mono italic">
                              ডাটাবেজে কোনো বিজ্ঞাপন ব্যানার পাওয়া যায়নি।
                            </td>
                          </tr>
                        ) : (
                          ads.map(ad => {
                            const views = ad.views || 0;
                            const clicks = ad.clicks || 0;
                            const ctr = views > 0 ? ((clicks / views) * 100).toFixed(1) : '0.0';
                            
                            const slotNames: Record<string, string> = {
                              'top-banner': 'উপরের ব্যানার',
                              'sidebar': 'সাইডবার স্লট',
                              'mid-list': 'তালিকার মাঝে',
                              'bottom-banner': 'নিচের ব্যানার'
                            };

                            return (
                              <tr key={ad.id} className="text-stone-800 hover:bg-stone-50 transition-colors">
                                <td className="py-3">
                                  <div className="flex items-center gap-3">
                                    <div className="w-16 h-10 rounded border border-stone-200 overflow-hidden shrink-0 bg-stone-100">
                                      <img src={ad.imageUrl} alt={ad.title} className="w-full h-full object-cover" />
                                    </div>
                                    <div className="min-w-0">
                                      <p className="font-semibold text-xs text-stone-900 truncate max-w-xs">{ad.title}</p>
                                      <a href={ad.linkUrl} target="_blank" rel="noreferrer" className="text-[10px] text-stone-400 font-mono hover:underline truncate block max-w-xs">{ad.linkUrl}</a>
                                    </div>
                                  </div>
                                </td>
                                <td className="py-3 text-center">
                                  <span className="text-[10px] font-mono font-bold bg-stone-100 text-stone-700 px-2 py-0.5 rounded uppercase">
                                    {slotNames[ad.slot] || ad.slot}
                                  </span>
                                </td>
                                <td className="py-3 text-center">
                                  <div className="text-xs font-mono font-semibold">
                                    <span className="text-stone-500" title="ভিউ">{views} ভিউ</span>
                                    <span className="mx-1 text-stone-300">/</span>
                                    <span className="text-stone-800" title="ক্লিক">{clicks} ক্লিক</span>
                                  </div>
                                </td>
                                <td className="py-3 text-center">
                                  <span className="text-xs font-mono font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
                                    {ctr}%
                                  </span>
                                </td>
                                <td className="py-3 text-right">
                                  <div className="flex justify-end gap-2">
                                    <button
                                      onClick={() => handleToggleAdStatus(ad)}
                                      className={`text-[10px] font-sans font-semibold px-2 py-1 rounded border transition-colors ${
                                        ad.status === 'active'
                                          ? 'border-emerald-200 text-emerald-600 bg-emerald-50 hover:bg-emerald-100'
                                          : 'border-stone-200 text-stone-500 bg-stone-50 hover:bg-stone-100'
                                      }`}
                                    >
                                      {ad.status === 'active' ? 'সক্রিয়' : 'নিষ্ক্রিয়'}
                                    </button>
                                    <button
                                      onClick={() => handleDeleteAd(ad.id)}
                                      className="p-1 text-stone-400 hover:text-stone-900 hover:bg-stone-100 rounded transition-colors"
                                      title="বিজ্ঞাপন মুছুন"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}

            {/* TAB 7: Automated Hourly News Fetcher (Prothom Alo & Ittefaq) */}
            {activeTab === 'news_fetcher' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                {/* Header & Status Card */}
                <div className="bg-white border border-stone-200 rounded-lg p-6 shadow-xs space-y-4">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-stone-100 pb-4">
                    <div>
                      <h2 className="font-serif text-xl font-bold text-stone-900 flex items-center gap-2">
                        <RefreshCw className="w-5 h-5 text-emerald-600 animate-spin-slow" />
                        <span>স্বয়ংক্রিয় সংবাদ সংগ্রাহক ও পরিমার্জন ইঞ্জিন</span>
                      </h2>
                      <p className="text-xs text-stone-500 font-sans mt-1">
                        প্রতি ১ ঘণ্টা পর পর স্বয়ংক্রিয়ভাবে প্রথম আলো (<code className="text-rose-700 bg-rose-50 px-1 rounded">prothomalo.com</code>) ও দৈনিক ইত্তেফাক (<code className="text-rose-700 bg-rose-50 px-1 rounded">ittefaq.com.bd</code>) থেকে সর্বশেষ খবর সংগ্রহ এবং শিরোনামে পরিমার্জন পরিবর্ধন করে দৈনিক কথা প্রকাশে সংবাদের পোস্ট করা হয়।
                      </p>
                    </div>

                    <button
                      onClick={handleManualNewsFetcherSync}
                      disabled={isSyncingNewsFetcher}
                      className="bg-emerald-700 hover:bg-emerald-800 text-white px-5 py-2.5 rounded text-xs font-serif font-bold transition-all shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50 shrink-0"
                    >
                      <RefreshCw className={`w-4 h-4 ${isSyncingNewsFetcher ? 'animate-spin' : ''}`} />
                      <span>{isSyncingNewsFetcher ? 'সংবাদ সিঙ্ক হচ্ছে...' : 'এখনই সংবাদ সিঙ্ক রান করুন'}</span>
                    </button>
                  </div>

                  {/* Operational Status Metrics */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
                    <div className="bg-stone-50 border border-stone-200 p-4 rounded-lg">
                      <div className="text-[10px] font-mono font-bold text-stone-400 uppercase tracking-widest">সিঙ্ক বিরতি (Interval)</div>
                      <div className="text-lg font-serif font-black text-stone-900 mt-1 flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span>প্রতি ১ ঘণ্টায় (Hourly)</span>
                      </div>
                      <div className="text-[11px] text-stone-500 mt-1 font-serif">সক্রিয় ব্যাকগ্রাউন্ড ক্রন জব</div>
                    </div>

                    <div className="bg-stone-50 border border-stone-200 p-4 rounded-lg">
                      <div className="text-[10px] font-mono font-bold text-stone-400 uppercase tracking-widest">সর্বশেষ সিঙ্ক (Last Sync)</div>
                      <div className="text-sm font-mono font-bold text-stone-900 mt-1">
                        {newsFetcherStatus?.lastRunTimestamp ? new Date(newsFetcherStatus.lastRunTimestamp).toLocaleTimeString('bn-BD') : 'একটু আগে (সার্ভার স্টার্ট)'}
                      </div>
                      <div className="text-[11px] text-stone-500 mt-1 font-serif">
                        {newsFetcherStatus?.lastRunTimestamp ? new Date(newsFetcherStatus.lastRunTimestamp).toLocaleDateString('bn-BD') : 'আজ'}
                      </div>
                    </div>

                    <div className="bg-stone-50 border border-stone-200 p-4 rounded-lg">
                      <div className="text-[10px] font-mono font-bold text-stone-400 uppercase tracking-widest">শিরোনাম পরিমার্জন ইঞ্জিন</div>
                      <div className="text-sm font-serif font-bold text-stone-900 mt-1 flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-amber-500" />
                        <span>এআই ও বাংলা সমার্থক ইঞ্জিন</span>
                      </div>
                      <div className="text-[11px] text-stone-500 mt-1 font-serif">মূল ভাব ঠিক রেখে শব্দ বা রূপ পরিবর্তন</div>
                    </div>

                    <div className="bg-stone-50 border border-stone-200 p-4 rounded-lg">
                      <div className="text-[10px] font-mono font-bold text-stone-400 uppercase tracking-widest">উৎস্য ওয়েবসাইট (Sources)</div>
                      <div className="text-xs font-mono font-bold text-stone-900 mt-1 flex flex-col gap-0.5">
                        <span className="text-rose-700">✓ প্রথম আলো (prothomalo.com)</span>
                        <span className="text-rose-700">✓ দৈনিক ইত্তেফাক (ittefaq.com.bd)</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Live Sync History & Logs */}
                <div className="bg-white border border-stone-200 rounded-lg p-6 shadow-xs space-y-4">
                  <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                    <h3 className="font-serif text-base font-bold text-stone-900 flex items-center gap-2">
                      <Database className="w-4 h-4 text-stone-600" />
                      <span>সর্বশেষ সিঙ্ক লগে নতুন সংবাদ (News Processing History)</span>
                    </h3>
                    <span className="text-xs font-mono text-stone-400">সর্বশেষ সংগৃহীত সংবাদের রেকর্ড</span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-stone-200 text-[10px] font-mono uppercase text-stone-400 tracking-wider">
                          <th className="py-2.5 px-3">সময়</th>
                          <th className="py-2.5 px-3">উৎস্য (Source)</th>
                          <th className="py-2.5 px-3">মূল শিরোনাম (Original Title)</th>
                          <th className="py-2.5 px-3">পরিমার্জিত নতুন শিরোনাম (Reworded)</th>
                          <th className="py-2.5 px-3 text-center">স্ট্যাটাস</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100 font-serif text-xs">
                        {(!newsFetcherStatus?.logs || newsFetcherStatus.logs.length === 0) ? (
                          <tr>
                            <td colSpan={5} className="py-8 text-center text-stone-400 font-serif">
                              এখনো কোনো নতুন খবর সিঙ্ক রেকর্ড পাওয়া যায়নি। ব্যাকগ্রাউন্ডে প্রতি ১ ঘণ্টায় প্রথম আলো ও ইত্তেফাক চেক করে স্বয়ংক্রিয়ভাবে সংবাদ পোস্ট হবে।
                            </td>
                          </tr>
                        ) : (
                          newsFetcherStatus.logs.map((log: any) => (
                            <tr key={log.id} className="hover:bg-stone-50/60 transition-colors">
                              <td className="py-3 px-3 font-mono text-[10px] text-stone-400 whitespace-nowrap">
                                {new Date(log.timestamp).toLocaleTimeString('bn-BD')}
                              </td>
                              <td className="py-3 px-3 font-bold text-rose-700 whitespace-nowrap">
                                {log.source}
                              </td>
                              <td className="py-3 px-3 text-stone-500 max-w-xs line-clamp-2 leading-relaxed">
                                {log.originalTitle}
                              </td>
                              <td className="py-3 px-3 font-bold text-stone-900 max-w-xs line-clamp-2 leading-relaxed">
                                {log.rewordedTitle}
                              </td>
                              <td className="py-3 px-3 text-center whitespace-nowrap">
                                {log.status === 'added' ? (
                                  <span className="text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
                                    ✓ প্রকাশিত
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-mono font-bold bg-stone-100 text-stone-500 px-2 py-0.5 rounded" title={log.reason}>
                                    ডুপ্লিকেট (এরই মধ্যে প্রকাশিত)
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

      </div>

      {/* Campaign Share Modal Overlay */}
      {socialShareArticle && (
        <SocialShareModal 
          article={socialShareArticle} 
          onClose={() => setSocialShareArticle(null)}
          token={token}
        />
      )}

      {/* Category Addition Modal Overlay */}
      {showAddCatModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white border border-stone-200 rounded-lg max-w-sm w-full p-6 shadow-xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-stone-100 pb-2">
              <h3 className="font-serif text-base font-bold text-stone-900">নতুন ক্যাটাগরি যুক্ত করুন</h3>
              <button 
                onClick={() => {
                  setShowAddCatModal(false);
                  setNewCatName('');
                  setNewCatSlug('');
                }}
                className="text-stone-400 hover:text-stone-900 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddCategory} className="space-y-4">
              <div>
                <label className="text-[10px] font-mono text-stone-400 uppercase tracking-widest block font-bold">ক্যাটাগরি নাম (Name)</label>
                <input
                  type="text"
                  required
                  value={newCatName}
                  onChange={(e) => {
                    setNewCatName(e.target.value);
                    setNewCatSlug(e.target.value.trim().toLowerCase().replace(/[^a-zA-Z0-9-]/g, '-'));
                  }}
                  placeholder="যেমন: খেলাধুলা"
                  className="w-full text-xs font-sans p-2.5 border border-stone-200 rounded mt-1 outline-stone-800 font-semibold"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono text-stone-400 uppercase tracking-widest block font-bold">ইউআরএল স্ল্যাগ (Slug)</label>
                <input
                  type="text"
                  required
                  value={newCatSlug}
                  onChange={(e) => setNewCatSlug(e.target.value)}
                  placeholder="যেমন: sports"
                  className="w-full text-xs font-mono p-2.5 border border-stone-200 rounded mt-1 outline-stone-800"
                />
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddCatModal(false);
                    setNewCatName('');
                    setNewCatSlug('');
                  }}
                  className="px-3 py-2 border border-stone-200 text-stone-600 rounded text-xs font-sans font-bold hover:bg-stone-50 transition-colors"
                >
                  বাতিল করুন
                </button>
                <button
                  type="submit"
                  disabled={isAddingCat}
                  className="px-4 py-2 bg-rose-700 hover:bg-rose-800 text-white rounded text-xs font-sans font-bold shadow-xs flex items-center gap-1 transition-colors disabled:opacity-50"
                >
                  {isAddingCat ? (
                    <>
                      <Loader2 className="w-3 animate-spin" />
                      <span>সংরক্ষণ হচ্ছে...</span>
                    </>
                  ) : (
                    <span>ক্যাটাগরি সংরক্ষণ করুন</span>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

    </div>
  );
}
