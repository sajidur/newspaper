export interface Article {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  content: string;
  author: string;
  date: string;
  image: string;
  reads: number;
  likes: number;
  views: number;
  status: 'published' | 'draft';
}

export interface Subscription {
  id: string;
  email: string;
  date: string;
  status: 'active' | 'unsubscribed';
}

export interface Comment {
  id: string;
  articleId: string;
  articleTitle: string;
  author: string;
  content: string;
  date: string;
  status: 'approved' | 'pending' | 'flagged';
  flagReason?: string;
  isAiModerated?: boolean;
}

export interface Newsletter {
  id: string;
  subject: string;
  content: string;
  articleIds: string[];
  sentAt: string;
  subscriberCount: number;
}

export interface AnalyticsSummary {
  totalViews: number;
  totalReads: number;
  totalSubscribers: number;
  activeReadersNow: number;
  viewsByCategory: { [category: string]: number };
  popularArticles: { articleId: string; title: string; views: number; reads: number }[];
  visitorTimeline: { date: string; views: number; subscriptions: number }[];
  deviceBreakdown: { name: string; value: number }[];
  countryBreakdown: { name: string; value: number }[];
}

export interface LoggedEvent {
  id: string;
  articleId?: string;
  eventType: 'view' | 'read_complete' | 'subscribe' | 'share' | 'comment';
  timestamp: string;
  durationSeconds?: number;
  country?: string;
  device?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'Admin' | 'Editor' | 'Reader';
  createdAt: string;
}

export interface Advertisement {
  id: string;
  title: string;
  imageUrl: string;
  linkUrl: string;
  slot: 'top-banner' | 'sidebar' | 'mid-list' | 'bottom-banner';
  status: 'active' | 'inactive';
  views: number;
  clicks: number;
  createdAt: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
}

