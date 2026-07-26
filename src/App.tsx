import React, { useState, useEffect } from 'react';
import ReaderView from './components/ReaderView';
import AdminDashboard from './components/AdminDashboard';
import AuthModal from './components/AuthModal';
import { Article, User } from './types';
import { Loader2, AlertCircle } from 'lucide-react';

export default function App() {
  const [isAdminView, setIsAdminView] = useState(false);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Authentication State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Load articles & verify session on mount
  useEffect(() => {
    const initApp = async () => {
      try {
        setLoading(true);
        setError(null);

        // 1. Fetch published/draft articles
        const res = await fetch('/api/articles');
        if (!res.ok) throw new Error('নিবন্ধসমূহ লোড করতে ব্যর্থ হয়েছে');
        const data = await res.json();
        setArticles(data);

        // 2. Restore JWT Auth session if exists
        const savedToken = localStorage.getItem('chronicle_session_token');
        if (savedToken) {
          try {
            const meRes = await fetch('/api/auth/me', {
              headers: { 'Authorization': `Bearer ${savedToken}` }
            });
            if (meRes.ok) {
              const meData = await meRes.json();
              if (meData.user) {
                setCurrentUser(meData.user);
                setToken(savedToken);
              } else {
                localStorage.removeItem('chronicle_session_token');
              }
            } else {
              localStorage.removeItem('chronicle_session_token');
            }
          } catch (sessionErr) {
            console.error('Session restoration failed:', sessionErr);
          }
        }
      } catch (err: any) {
        console.error('Error initializing app:', err);
        setError('ডাটাবেস সার্ভারের সাথে সংযোগ করা সম্ভব হয়নি। অনুগ্রহ করে নিশ্চিত করুন যে সার্ভারটি চালু আছে।');
      } finally {
        setLoading(false);
      }
    };
    initApp();
  }, []);

  const handleAuthSuccess = (user: User, userToken: string) => {
    setCurrentUser(user);
    setToken(userToken);
    localStorage.setItem('chronicle_session_token', userToken);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setToken(null);
    localStorage.removeItem('chronicle_session_token');
    setIsAdminView(false); // kick out of dashboard if logged out
  };

  const handleTriggerAuth = () => {
    setIsAuthModalOpen(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-6 text-stone-900 font-sans">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-stone-800 mx-auto" />
          <h2 className="font-serif text-xl font-bold italic tracking-wide">ডিজিটাল প্রেস আর্কাইভ লোড হচ্ছে...</h2>
          <p className="text-xs text-stone-500 font-serif">ডাটাবেস সংযোগ স্থাপন করা হচ্ছে, অনুগ্রহ করে অপেক্ষা করুন</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-6 text-stone-900 font-sans">
        <div className="max-w-md bg-white border border-red-200 rounded-lg p-6 shadow-md text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
          <h3 className="font-serif text-lg font-bold">সার্ভার সংযোগ বিচ্ছিন্ন</h3>
          <p className="text-xs text-stone-600 font-serif leading-relaxed">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="bg-stone-900 hover:bg-stone-800 text-white text-xs font-serif font-bold px-4 py-2 rounded transition-colors cursor-pointer"
          >
            পুনরায় সংযোগ করুন
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-stone-50">
      {isAdminView && currentUser && (currentUser.role === 'Admin' || currentUser.role === 'Editor') ? (
        <AdminDashboard 
          onBackToReader={() => setIsAdminView(false)} 
          articles={articles}
          setArticles={setArticles}
          currentUser={currentUser}
          token={token || ''}
        />
      ) : isAuthModalOpen ? (
        <div className="min-h-screen bg-stone-100 flex flex-col justify-center py-6 px-4 sm:px-6 lg:px-8">
          <AuthModal 
            isOpen={isAuthModalOpen}
            onClose={() => setIsAuthModalOpen(false)}
            onAuthSuccess={handleAuthSuccess}
            isInline={true}
          />
        </div>
      ) : (
        <ReaderView 
          onEnterAdmin={() => {
            if (currentUser && (currentUser.role === 'Admin' || currentUser.role === 'Editor')) {
              setIsAdminView(true);
            } else {
              setIsAuthModalOpen(true);
            }
          }} 
          articles={articles}
          setArticles={setArticles}
          currentUser={currentUser}
          onLogout={handleLogout}
          onTriggerAuth={handleTriggerAuth}
          token={token || ''}
        />
      )}
    </div>
  );
}
