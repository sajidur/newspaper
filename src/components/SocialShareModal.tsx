import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X, Twitter, Linkedin, Mail, Check, Copy, Sparkles, Loader2 } from 'lucide-react';
import { Article } from '../types';

interface SocialShareModalProps {
  article: Article;
  onClose: () => void;
  token?: string;
}

interface GeneratedShare {
  twitter: string;
  linkedin: string;
  newsletterSnippet: string;
}

export default function SocialShareModal({ article, onClose, token }: SocialShareModalProps) {
  const [loading, setLoading] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [data, setData] = useState<GeneratedShare | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generateSocials = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/articles/social-share', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({
          title: article.title,
          subtitle: article.subtitle,
          author: article.author,
        }),
      });

      if (!response.ok) {
        throw new Error('এআই রাইটার সার্ভিসের সাথে যোগাযোগ করতে ব্যর্থ হয়েছে।');
      }

      const result = await response.json();
      setData(result);
    } catch (err: any) {
      setError(err.message || 'খসড়া তৈরির সময় একটি অপ্রত্যাশিত ত্রুটি ঘটেছে।');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Generate automatically on open if not already loaded
  React.useEffect(() => {
    generateSocials();
  }, [article.id]);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-stone-50 border border-stone-200 shadow-2xl rounded-lg max-w-2xl w-full p-6 text-stone-900"
      >
        {/* Header */}
        <div className="flex justify-between items-start border-b border-stone-200 pb-4 mb-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-stone-500 uppercase tracking-wider">
              <Sparkles className="w-3 h-3 text-amber-600 animate-pulse" />
              জেমিনি সোশ্যাল প্রোমোটার
            </div>
            <h3 className="font-serif text-xl font-semibold mt-1">ক্রস-প্ল্যাটফর্ম প্রচার সহায়ক</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-stone-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5 text-stone-500" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4">
          <div className="bg-stone-100 p-3 rounded border border-stone-200">
            <span className="text-xs font-serif uppercase tracking-widest text-stone-400">নির্বাচিত নিবন্ধ</span>
            <p className="font-serif text-stone-800 font-medium text-sm mt-1">{article.title}</p>
          </div>

          {loading && (
            <div className="py-12 flex flex-col items-center justify-center text-stone-500">
              <Loader2 className="w-8 h-8 animate-spin text-stone-700 mb-2" />
              <p className="text-sm font-serif animate-pulse">সোশ্যাল ক্যাম্পেইনের খসড়া তৈরি করা হচ্ছে...</p>
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded text-red-700 text-sm font-serif flex flex-col gap-2">
              <p className="font-medium">এআই রাইটার অফলাইন অথবা সিক্রেট কী অনুপস্থিত</p>
              <p className="text-xs">{error}</p>
              <button
                onClick={generateSocials}
                className="mt-2 text-xs font-serif self-start bg-red-100 hover:bg-red-200 px-3 py-1.5 rounded transition-all cursor-pointer"
              >
                পুনরায় চেষ্টা করুন
              </button>
            </div>
          )}

          {!loading && !error && data && (
            <div className="space-y-5">
              {/* Twitter Draft */}
              <div className="border border-stone-200 rounded-lg overflow-hidden bg-white shadow-xs">
                <div className="bg-stone-100 px-4 py-2 flex justify-between items-center border-b border-stone-200">
                  <div className="flex items-center gap-2 text-xs font-medium text-stone-700">
                    <Twitter className="w-4 h-4 text-sky-500" />
                    <span>টুইটার / এক্স ক্যাম্পেইন</span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(data.twitter, 'twitter')}
                    className="flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-800 cursor-pointer font-serif"
                  >
                    {copiedField === 'twitter' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-green-600" />
                        <span className="text-green-600 font-medium">অনুলিপি করা হয়েছে!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>খসড়া কপি করুন</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="p-3 text-stone-800 text-sm whitespace-pre-wrap font-sans">
                  {data.twitter}
                </div>
              </div>

              {/* LinkedIn Draft */}
              <div className="border border-stone-200 rounded-lg overflow-hidden bg-white shadow-xs">
                <div className="bg-stone-100 px-4 py-2 flex justify-between items-center border-b border-stone-200">
                  <div className="flex items-center gap-2 text-xs font-medium text-stone-700">
                    <Linkedin className="w-4 h-4 text-blue-700" />
                    <span>লিঙ্কডইন আপডেট</span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(data.linkedin, 'linkedin')}
                    className="flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-800 cursor-pointer font-serif"
                  >
                    {copiedField === 'linkedin' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-green-600" />
                        <span className="text-green-600 font-medium">অনুলিপি করা হয়েছে!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>খসড়া কপি করুন</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="p-3 text-stone-800 text-sm whitespace-pre-wrap font-sans max-h-40 overflow-y-auto">
                  {data.linkedin}
                </div>
              </div>

              {/* Newsletter Snippet */}
              <div className="border border-stone-200 rounded-lg overflow-hidden bg-white shadow-xs">
                <div className="bg-stone-100 px-4 py-2 flex justify-between items-center border-b border-stone-200">
                  <div className="flex items-center gap-2 text-xs font-medium text-stone-700">
                    <Mail className="w-4 h-4 text-amber-600" />
                    <span>ইমেইল টিজার খসড়া</span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(data.newsletterSnippet, 'newsletter')}
                    className="flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-800 cursor-pointer font-serif"
                  >
                    {copiedField === 'newsletter' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-green-600" />
                        <span className="text-green-600 font-medium">অনুলিপি করা হয়েছে!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>খসড়া কপি করুন</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="p-3 text-stone-800 text-sm whitespace-pre-wrap font-sans">
                  {data.newsletterSnippet}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-stone-200 pt-4 mt-6 flex justify-between items-center">
          <span className="text-xs text-stone-400 font-serif">
            * জেমিনি কৃত্রিম বুদ্ধিমত্তা দ্বারা খসড়াটি তৈরি করা হয়েছে
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white font-serif text-xs font-medium rounded-md shadow-xs transition-colors cursor-pointer"
          >
            সম্পন্ন
          </button>
        </div>
      </motion.div>
    </div>
  );
}
