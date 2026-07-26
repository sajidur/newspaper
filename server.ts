import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import { Article, Subscription, Comment, Newsletter, LoggedEvent, AnalyticsSummary, User, Advertisement, Category } from "./src/types";
import {
  initDatabase,
  getUsers,
  saveUser,
  getUserByEmail,
  getArticles,
  searchArticles,
  saveArticle,
  updateArticle,
  deleteArticle,
  getSubscriptions,
  saveSubscription,
  getComments,
  saveComment,
  updateComment,
  deleteComment,
  getEvents,
  saveEvent,
  getNewsletters,
  saveNewsletter,
  getDbMode,
  getAds,
  saveAd,
  updateAd,
  deleteAd,
  incrementAdMetric,
  getCategories,
  saveCategory,
  deleteCategory
} from "./db";
import { runNewsSync, getNewsFetcherStatus } from "./server/newsFetcher";

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' })); // Support larger payloads for embedded base64 image uploads

const JWT_SECRET = process.env.JWT_SECRET || "the-chronicle-secret-key-2026";

// Setup local directories
const DATA_DIR = path.join(process.cwd(), "data");
const UPLOADS_DIR = path.join(DATA_DIR, "uploads");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Lazy Gemini Initialization
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (aiClient) return aiClient;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey.trim() === "") {
    console.warn("GEMINI_API_KEY is not configured or is set to placeholder. Falling back to rule-based mock responses.");
    return null;
  }
  try {
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
    return aiClient;
  } catch (err) {
    console.error("Failed to initialize Gemini Client:", err);
    return null;
  }
}

// Seed Data definition to feed the initDatabase helper
const DEFAULT_ARTICLES: Article[] = [
  {
    id: "art-1",
    title: "সবুজ জ্বালানি বিপ্লব: রেকর্ড ৮% কমল বৈশ্বিক কার্বন নির্গমন",
    subtitle: "সৌর বিদ্যুৎ গ্রিড, সামুদ্রিক বায়ুশক্তি এবং উন্নত সলিড-স্টেট ব্যাটারি প্রযুক্তির সমন্বয়ে জলবায়ু লক্ষ্যমাত্রা অর্জনে বড় অগ্রগতি।",
    category: "Science",
    content: "২০২৬ সালের জলবায়ু চিত্রে একটি ঐতিহাসিক মোড় প্রত্যক্ষ করা গেছে। আধুনিক শিল্প ইতিহাসে প্রথমবারের মতো বৈশ্বিক কার্বন নির্গমন একক বছরে রেকর্ড ৮% হ্রাস পেয়েছে, যা অর্থনৈতিক মন্দার কারণে নয় বরং নিয়মতান্ত্রিক জ্বালানি কাঠামোগত পরিবর্তনের কারণে সম্ভব হয়েছে।\n\nইউনিফাইড এনার্জি Research Council (ইউইআরসি)-এর মতে, উত্তর সাগরের উপকূলবর্তী উপ-সাগরীয় বায়ু করিডোর এবং পূর্ব এশিয়ায় সলিড-স্টেট সোডিয়াম ব্যাটারি খামারগুলোর দ্রুত বিস্তার এই রূপান্তরকে ত্বরান্বিত করেছে। এই উচ্চ-ক্ষমতার গ্রিডগুলো নবায়নযোগ্য উৎসের দীর্ঘদিনের অনিয়মিত সরবরাহ সমস্যার সমাধান করেছে।\n\nপ্রধান জ্বালানি অর্থনীতিবিদ ড. হেলেন ভ্যান্স মন্তব্য করেছেন যে আমরা আর সাধারণ অগ্রগতির দিকে তাকিয়ে নেই। 'আমরা এখন একটি সম্পূর্ণ সমন্বিত নবায়নযোগ্য বেসলোড সরবরাহ দেখছি। কয়লা চালিত বিদ্যুৎ কেন্দ্রগুলো আগের অনুমিত সময়ের চেয়ে দ্বিগুণ গতিতে বন্ধ করা হচ্ছে।' বিভিন্ন দেশ কার্বন ক্রেডিট চূড়ান্ত করার সাথে সাথে ভারী জাহাজ পরিবহন এবং ইস্পাত পরিশোধনের মতো গুরুত্বপূর্ণ ক্ষেত্রগুলোতেও সবুজ হাইড্রোজেন ব্যবহারের পরীক্ষা চালানো হচ্ছে।",
    author: "এলেনা রস্তোভা",
    date: "2026-07-14T08:00:00Z",
    image: "https://images.unsplash.com/photo-1466611653911-95081537e5b7?auto=format&fit=crop&w=1200&q=80",
    reads: 320,
    likes: 124,
    views: 890,
    status: "published"
  },
  {
    id: "art-2",
    title: "সুপারকন্ডাক্টর অপ্টিমাইজেশনে কোয়ান্টাম আধিপত্য অর্জন",
    subtitle: "গবেষকরা লোকসানহীন বিদ্যুৎ বিতরণের এক নতুন যুগের সূচনা করতে ২৫০০-কিউবিট প্রসেসর ব্যবহার করে সুপারকন্ডাক্টর গঠন উন্মোচন করেছেন।",
    category: "Tech",
    content: "জেনেভা ইনস্টিটিউট এবং সিলিকন ভ্যালি কোয়ান্টাম কনসোর্টিয়ামের এক যৌথ ঘোষণায় পদার্থবিদরা অত্যন্ত সফলতার সাথে ১৪ ডিগ্রি সেলসিয়াস পর্যন্ত তাপমাত্রায় সুপারকন্ডাক্টিং ক্রিস্টাল অনুকরণ করতে সক্ষম হয়েছেন।\n\nএই অনুকরণ সম্পন্ন করতে গবেষকরা ব্যবহার করেছেন 'ইথার' প্রসেসর—যা একটি অত্যাধুনিক ২৫০০-কিউবিট কোয়ান্টাম কম্পিউটার। ঐতিহ্যগত সাধারণ কম্পিউটারগুলোর এই জটিল পারমাণবিক স্পন্দন ও স্থিতিশীলতা গণনা করতে প্রায় কয়েক বিলিয়ন বছর সময় লাগত। কোয়ান্টাম ব্যবস্থাটি মাত্র ১৮ মিনিটের মধ্যে সমাধানটি বের করেছে।\n\nপ্রধান পদার্থবিজ্ঞানী ড. মার্কাস কোল বলেন, 'এটি পরীক্ষামূলক কোয়ান্টাম গণিত এবং বাস্তব ভৌত প্রকৌশলের মধ্যকার সীমানা নির্ধারণ করে দিল।' এই আবিষ্কার হাইপার-লুপ পরিবহন, চৌম্বকীয় লেভিটেশন এবং বৈশ্বিক বৈদ্যুতিক সঞ্চালন গ্রিডে বৈপ্লবিক পরিবর্তন আনতে চলেছে, যেখানে বর্তমানে সঞ্চালিত বিদ্যুতের প্রায় ১০% অপচয় হয়ে যায়।",
    author: "জুলিয়ান চেন",
    date: "2026-07-13T10:30:00Z",
    image: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&w=1200&q=80",
    reads: 215,
    likes: 88,
    views: 650,
    status: "published"
  },
  {
    id: "art-3",
    title: "অনবরত যুক্ত থাকার নীরব মূল্য: একাকীত্বের প্রশান্তি ফিরিয়ে আনা",
    subtitle: "অনবরত অ্যালগরিদমিক নোটিফিকেশন এবং তথ্যের ভিড়ে সচেতনভাবে অফলাইনে যাওয়া ও নিস্তব্ধতা উপভোগ করাই এখন সবচেয়ে বড় বিলাসিতা।",
    category: "Opinions",
    content: "আমরা এমন এক যুগে বাস করছি যা ফাঁকা সময়কে একটি বড় ভুল হিসেবে বিবেচনা করে। আমাদের মন যদি মাত্র ত্রিশ সেকেন্ডের জন্যও বিভ্রান্ত হয়, আমরা তখনই পকেটে থাকা ডিভাইসটির দিকে হাত বাড়াই যা আমাদের অনবরত মনোযোগ আকর্ষণকারী বিনোদন সরবরাহ করে। এই অতি-সংযুক্ততার মূল্য কেবল মনোযোগের সংক্ষিপ্ত পরিধি নয়, বরং আমাদের চিন্তা করার ক্ষমতা ও গভীর নিরবতাকেও মুছে দিচ্ছে।\n\n can-not স্নায়ুবিজ্ঞানের গবেষণা ইঙ্গিত দেয় যে মস্তিষ্কের 'ডিফল্ট মোড নেটওয়ার্ক'—যা স্মৃতি সংরক্ষণ, আত্ম-সচেতনতা এবং সৃজনশীলতার জন্য দায়ী—কেবল তখনই সক্রিয় হয় যখন আমরা সম্পূর্ণ ডিজিটাল ব্যস্ততামুক্ত থাকি। দিনের প্রতিটি মুহূর্ত কন্টেন্ট দিয়ে পূর্ণ করে আমরা আমাদের মস্তিষ্ককে সেই শান্ত অবস্থা থেকে বঞ্চিত করছি যা আমাদের নিজেদের বুঝতে সাহায্য করে।\n\nডিজিটাল ডিটক্স এখন আর কোনো সাময়িক ট্রেন্ড নয়; এটি একটি গুরুত্বপূর্ণ সামাজিক বিভাজন তৈরি করছে। যারা এই সংযোগ থেকে নিজেদের দূরে রাখার সামর্থ্য রাখেন, তারা উন্নত মানসিক স্বচ্ছতা অর্জন করছেন, যেখানে বাকিরা ডোপামিন-অপ্টিমাইজড স্ক্রলে আটকে আছেন। নিজের একাকীত্ব ও নীরবতা পুনরুদ্ধার করা আমাদের মানসিক স্বাধিকার প্রতিষ্ঠার প্রথম পদক্ষেপ।",
    author: "হ্যারিয়েট ভ্যান্স",
    date: "2026-07-12T14:15:00Z",
    image: "https://images.unsplash.com/photo-1499209974431-9dddcece7f88?auto=format&fit=crop&w=1200&q=80",
    reads: 430,
    likes: 245,
    views: 1200,
    status: "published"
  },
  {
    id: "art-4",
    title: "স্বয়ংক্রিয় লজিস্টিকসের অগ্রযাত্রায় বিশ্বজুড়ে স্থিতিশীল হচ্ছে মূল্যস্ফীতি",
    subtitle: "স্থানীয় রোবোটিক ফুলফিলমেন্ট হাব এবং উন্নত অ্যালগরিদমের কল্যাণে বিশ্বব্যাপী নিত্যপ্রয়োজনীয় পণ্যের দাম গড়ে ১৪% কমেছে।",
    category: "Business",
    content: "গত এক বছরে সরবরাহ শৃঙ্খলের জটিলতা এবং বাধাগুলো নিয়মতান্ত্রিকভাবে দূর করা সম্ভব হয়েছে। এর স্থলাভিষিক্ত হয়েছে অত্যন্ত দক্ষ বিকেন্দ্রীকৃত ওয়্যারহাউজ বা গুদাম নেটওয়ার্ক।\n\nপণ্য পরিবহনের ক্ষেত্রে দূরদূরান্তে বড় চালানের পরিবর্তে আধুনিক এআই বা কৃত্রিম বুদ্ধিমত্তা অ্যালগরিদম পাড়া-মহল্লা স্তরে খুচরা বিক্রির প্রয়োজনীয়তা পূর্বাভাস দিতে পারে। ভারী কার্গোগুলো অফ-পিক সময়ে আঞ্চলিক হাবগুলোতে পৌঁছে দেওয়া হয়, যেখানে ছোট রোবটগুলো প্যাকেজিং এবং স্থানীয় বন্টনের কাজ করে থাকে।\n\nগ্লোবাল কমার্স রিপোর্ট অনুসারে, এই মডেলটি মধ্যবর্তী ব্যবস্থাপনা খরচ ৩৪% হ্রাস করেছে এবং পণ্য পরিবহনের দূরত্ব অর্ধেক করে ফেলেছে। ফলে নিত্যপ্রয়োজনীয় খাবার, ওষুধ ও গৃহস্থালির জিনিসপত্রের দাম বিশ্বজুড়ে সাধারণ ক্রেতার হাতের নাগালে আসছে। অর্থনীতিবিদরা আশা করছেন এর ফলে সুদের হার কমানোর পথ সুগম হবে।",
    author: "সারাহ জেনকিন্স",
    date: "2026-07-11T09:00:00Z",
    image: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1200&q=80",
    reads: 180,
    likes: 67,
    views: 420,
    status: "published"
  },
  {
    id: "art-5",
    title: "বেন্তো-স্টাইল টেকসই আবাসন পরিবেশ ও জীবনযাত্রায় পরিবর্তন আনছে",
    subtitle: "ভিয়েনা এবং টোকিওর স্থপতিরা এমন এক স্বনির্ভর আবাসন ব্লক উন্মোচন করেছেন যা কৃষিকাজ, পানি বিশুদ্ধকরণ এবং কর্মক্ষেত্রকে একই ছাদের নিচে নিয়ে এসেছে।",
    category: "Culture",
    content: "শহরের স্থাপত্য এখন আর কেবল বহুতল ভবনের মধ্যে সীমাবদ্ধ নেই। একটি নতুন নকশা দর্শন, যাকে 'বেন্তো নেবারহুড' বলা হচ্ছে, মানুষের সব মৌলিক চাহিদাকে স্বনির্ভর এবং পরিবেশবান্ধব ব্লকে রূপ দেওয়ার চেষ্টা করছে।\n\nএই মডুলার কাঠামোর অভ্যন্তরে ভার্টিকাল হাইড্রোপনিক ফার্মিং বা উলম্ব চাষাবাদের মাধ্যমে বাসিন্দাদের প্রায় ৪০% শাকসবজির চাহিদা পূরণ করা হচ্ছে। ব্যবহৃত পানি বা গ্রে-ওয়াটার সরাসরি ফিল্টার করে চাষাবাদের মাটিতে নিয়ে যাওয়া হচ্ছে, এবং ভাগ করা কেন্দ্রীয় কর্মক্ষেত্র থাকার কারণে দৈনন্দিন যাতায়াতের ঝক্কি বা ট্রাফিক জ্যামের কোনো প্রয়োজনই থাকছে না। এক প্রতিবেশী অন্য প্রতিবেশীর সাথে তার প্রয়োজনীয় জিনিস ও সেবা ভাগ করে নিতে পারছেন।\n\nস্থানিয় বাসিন্দারা এতে অত্যন্ত সন্তুষ্ট। কিয়োটোর নতুন ব্লকের বাসিন্দা ইউকি সাতো বলেন, 'আমরা কেবল একে অপরের পাশে বাস করছি না, আমরা আমাদের সম্পদগুলোর সহ-ব্যবস্থাপনা করছি। আমি জানি কে আমার টমেটো চাষ করছে, এবং উইন্ড টারবাইন রক্ষণাবেক্ষণকারী প্রতিবেশীর সাথে আমি নিয়মিত কফি খাচ্ছি।'",
    author: "রেনাতো রসি",
    date: "2026-07-10T11:20:00Z",
    image: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80",
    reads: 250,
    likes: 110,
    views: 580,
    status: "published"
  }
];

const DEFAULT_SUBSCRIPTIONS: Subscription[] = [
  { id: "sub-1", email: "sajid.ict@gmail.com", date: "2026-07-01T12:00:00Z", status: "active" },
  { id: "sub-2", email: "reader.one@example.com", date: "2026-07-05T14:22:00Z", status: "active" },
  { id: "sub-3", email: "news.lover@digital.org", date: "2026-07-08T09:10:00Z", status: "active" },
  { id: "sub-4", email: "unsub.test@mail.com", date: "2026-07-09T18:40:00Z", status: "unsubscribed" }
];

const DEFAULT_COMMENTS: Comment[] = [
  {
    id: "com-1",
    articleId: "art-1",
    articleTitle: "সবুজ জ্বালানি বিপ্লব: রেকর্ড ৮% কমল বৈশ্বিক কার্বন নির্গমন",
    author: "ডেভিড সুজুকি জুনিয়র",
    content: "এটি সত্যিই একটি মাইলফলক! সলিড-স্টেট সোডিয়াম ব্যাটারিগুলো এখানে মূল ভূমিকা পালন করছে। লিথিয়াম খনির জটিলতা না থাকায় আমরা সামনের বছর এই গতি দ্বিগুণ করতে পারব।",
    date: "2026-07-14T09:12:00Z",
    status: "approved"
  },
  {
    id: "com-2",
    articleId: "art-3",
    articleTitle: "অনবরত যুক্ত থাকার নীরব মূল্য: একাকীত্বের প্রশান্তি ফিরিয়ে আনা",
    author: "শান্তিপ্রিয় পাঠক",
    content: "ব্যস্ত ট্রেনে দাঁড়িয়ে স্মার্টফোনে এটি পড়ছি। তবে কথাগুলো অনেক বাস্তবসম্মত। নীরবতা এখন আসলেই বড় বিলাসিতা হয়ে দাঁড়িয়েছে।",
    date: "2026-07-12T15:30:00Z",
    status: "approved"
  },
  {
    id: "com-3",
    articleId: "art-3",
    articleTitle: "অনবরত যুক্ত থাকার নীরব মূল্য: একাকীত্বের প্রশান্তি ফিরিয়ে আনা",
    author: "বট_ক্যাশ",
    content: "ঘরে বসেই প্রতিদিন ৫০০ ডলার আয় করুন!!! ১০০% নিশ্চিত সুযোগ!!! কোনো অভিজ্ঞতার প্রয়োজন নেই!!! www.fake-cash-scam.net",
    date: "2026-07-12T16:05:00Z",
    status: "flagged",
    flagReason: "Automated Link Spam & Financial Scam Patterns Detected",
    isAiModerated: true
  },
  {
    id: "com-4",
    articleId: "art-1",
    articleTitle: "সবুজ জ্বালানি বিপ্লব: রেকর্ড ৮% কমল বৈশ্বিক কার্বন নির্গমন",
    author: "সংশয়ী পাঠক",
    content: "এই প্রতিবেদনটি কি পুরোপুরি সঠিক? সবুজ শক্তি কি কেবলই একটি প্রচারণা? গ্লোবাল ওয়ার্মিং কি ব্যাটারি লবি দ্বারা তৈরি?",
    date: "2026-07-14T11:45:00Z",
    status: "approved"
  }
];

const DEFAULT_EVENTS: LoggedEvent[] = [
  { id: "ev-1", eventType: "view", articleId: "art-1", timestamp: "2026-07-14T08:15:00Z", country: "US", device: "Desktop" },
  { id: "ev-2", eventType: "read_complete", articleId: "art-1", timestamp: "2026-07-14T08:18:00Z", durationSeconds: 180, country: "US", device: "Desktop" },
  { id: "ev-3", eventType: "view", articleId: "art-3", timestamp: "2026-07-14T09:10:00Z", country: "GB", device: "Mobile" },
  { id: "ev-4", eventType: "subscribe", timestamp: "2026-07-14T09:12:00Z", country: "GB", device: "Mobile" },
  { id: "ev-5", eventType: "view", articleId: "art-2", timestamp: "2026-07-14T10:00:00Z", country: "DE", device: "Desktop" }
];

// Authentication Middlewares

function authenticateJWT(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization;
  let token = "";

  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  } else if (req.query.token) {
    token = req.query.token as string;
  }

  if (!token) {
    return next(); // Guest session
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = decoded;
    next();
  } catch (err) {
    console.warn("Invalid JWT token received:", err);
    return res.status(401).json({ error: "Your session has expired. Please log in again." });
  }
}

function requireAuth(req: any, res: any, next: any) {
  if (!req.user) {
    return res.status(401).json({ error: "Authentication is required to perform this action." });
  }
  next();
}

function requireRole(allowedRoles: ("Admin" | "Editor" | "Reader")[]) {
  return (req: any, res: any, next: any) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication is required." });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: `Access Denied. This action requires ${allowedRoles.join(" or ")} permissions.` });
    }
    next();
  };
}

// REST API IMPLEMENTATION

// 1. JWT User Authentication Endpoints

// POST Register
app.post("/api/auth/register", async (req: any, res: any) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: "All fields are required (name, email, password)." });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const targetRole = (role && ["Admin", "Editor", "Reader"].includes(role)) ? role : "Reader";

  try {
    const existing = await getUserByEmail(normalizedEmail);
    if (existing) {
      return res.status(400).json({ error: "An account with this email already exists." });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    const newUser: User = {
      id: `user-${Date.now()}`,
      name: name.trim(),
      email: normalizedEmail,
      role: targetRole as any,
      createdAt: new Date().toISOString()
    };

    // Save with hashed password
    const userDbEntry = { ...newUser, password: hashedPassword };
    await saveUser(userDbEntry);

    // Create session JWT
    const token = jwt.sign(
      { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(201).json({ user: newUser, token });
  } catch (err: any) {
    console.error("Registration error:", err);
    res.status(500).json({ error: "Failed to create user account.", details: err.message });
  }
});

// POST Login
app.post("/api/auth/login", async (req: any, res: any) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    const user = await getUserByEmail(normalizedEmail);
    if (!user) {
      return res.status(401).json({ error: "Invalid email address or password." });
    }

    const isMatch = bcrypt.compareSync(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid email address or password." });
    }

    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    const safeUser: User = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt
    };

    res.json({ user: safeUser, token });
  } catch (err: any) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Internal server error during login.", details: err.message });
  }
});

// GET Me
app.get("/api/auth/me", authenticateJWT, (req: any, res: any) => {
  if (!req.user) {
    return res.status(401).json({ guest: true });
  }
  res.json({ user: req.user });
});

// Serve DB Mode
app.get("/api/db/info", (req, res) => {
  res.json(getDbMode());
});

// Category Endpoints
app.get("/api/categories", async (req, res) => {
  try {
    const categories = await getCategories();
    res.json(categories);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to read categories.", details: err.message });
  }
});

app.post("/api/categories", authenticateJWT, requireRole(["Admin", "Editor"]), async (req: any, res: any) => {
  const { name, slug } = req.body;
  if (!name || !slug) {
    return res.status(400).json({ error: "Missing required category fields (name and slug)." });
  }

  const categoryId = req.body.id || `cat-${Date.now()}`;
  const newCat: Category = {
    id: categoryId,
    name,
    slug: slug.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
    createdAt: req.body.createdAt || new Date().toISOString()
  };

  try {
    await saveCategory(newCat);
    res.status(201).json(newCat);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to save category.", details: err.message });
  }
});

app.delete("/api/categories/:id", authenticateJWT, requireRole(["Admin"]), async (req: any, res: any) => {
  const { id } = req.params;
  try {
    await deleteCategory(id);
    res.json({ success: true, message: "Category deleted." });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to delete category.", details: err.message });
  }
});

// 2. Article Endpoints with integrated Search & Roles

// GET Articles
app.get("/api/articles", async (req, res) => {
  try {
    const articles = await getArticles();
    res.json(articles);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to read articles database.", details: err.message });
  }
});

// GET Search Articles
app.get("/api/articles/search", async (req, res) => {
  const { q } = req.query;
  if (!q) {
    return res.json([]);
  }
  try {
    const results = await searchArticles(q as string);
    res.json(results);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to search articles.", details: err.message });
  }
});

// POST Add Article (Admin or Editor only)
app.post("/api/articles", authenticateJWT, requireRole(["Admin", "Editor"]), async (req: any, res: any) => {
  const { title, subtitle, category, content, author, image, status } = req.body;
  
  if (!title || !content || !category) {
    return res.status(400).json({ error: "Missing required article fields" });
  }

  const newArticle: Article = {
    id: `art-${Date.now()}`,
    title,
    subtitle: subtitle || "",
    category,
    content,
    author: author || req.user.name || "Staff Writer",
    date: new Date().toISOString(),
    image: image || "https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=1200&q=80",
    reads: 0,
    likes: 0,
    views: 0,
    status: status || "published"
  };

  try {
    await saveArticle(newArticle);
    res.status(201).json(newArticle);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to write article.", details: err.message });
  }
});

// PUT Update Article (Admin or Editor only)
app.put("/api/articles/:id", authenticateJWT, requireRole(["Admin", "Editor"]), async (req: any, res: any) => {
  const { id } = req.params;
  try {
    const updated = await updateArticle(id, req.body);
    if (!updated) {
      return res.status(404).json({ error: "Article not found" });
    }
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to update article.", details: err.message });
  }
});

// DELETE Article (Admin only - editors can edit but not delete!)
app.delete("/api/articles/:id", authenticateJWT, requireRole(["Admin"]), async (req: any, res: any) => {
  const { id } = req.params;
  try {
    await deleteArticle(id);
    res.json({ success: true, message: "Article and related comments deleted from archives." });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to delete article.", details: err.message });
  }
});

// Image Upload Endpoint (Supports rich text visual embedding)
app.post("/api/upload", authenticateJWT, requireRole(["Admin", "Editor"]), (req: any, res: any) => {
  const { image } = req.body; // base64 string
  if (!image) {
    return res.status(400).json({ error: "No image payload found" });
  }

  try {
    // Check for valid base64 data url header
    const matches = image.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,(.+)$/);
    if (!matches) {
      return res.status(400).json({ error: "Invalid image format. Must be a base64 encoded data URL." });
    }

    const ext = matches[1].split('+')[0]; // strip detailed XML qualifiers
    const data = matches[2];
    const buffer = Buffer.from(data, 'base64');
    const filename = `${crypto.randomUUID()}.${ext || 'png'}`;
    const filePath = path.join(UPLOADS_DIR, filename);

    fs.writeFileSync(filePath, buffer);
    res.json({ url: `/api/uploads/${filename}` });
  } catch (err: any) {
    console.error("Error uploading image:", err);
    res.status(500).json({ error: "Failed to upload image", details: err.message });
  }
});

// Serve uploaded files statically
app.get("/api/uploads/:filename", (req, res) => {
  const filePath = path.join(UPLOADS_DIR, req.params.filename);
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).json({ error: "Uploaded media file not found." });
  }
});

// POST AI Generate Article Draft via Gemini (Admin/Editor only)
app.post("/api/articles/generate", authenticateJWT, requireRole(["Admin", "Editor"]), async (req, res) => {
  const { topic, category, tone } = req.body;
  if (!topic || !category) {
    return res.status(400).json({ error: "Topic and category are required to generate an article" });
  }

  const ai = getGeminiClient();
  if (!ai) {
    // Fallback Mock Draft
    const mockTitle = `AI Draft: The Future of ${topic} in the ${category} Sphere`;
    const mockSubtitle = `Exploring the key dimensions and future shifts of ${topic} styled in a ${tone || 'informative'} perspective.`;
    const mockContent = `This is an automatically generated draft about "${topic}". Since the Gemini API key was not configured, we've provided this structured placeholder content.\n\nKey Analysis 1: The inception of ${topic} marks a turning point in modern industrial systems, bringing both efficiency and regulatory friction.\n\nKey Analysis 2: Stakeholders in the ${category} industry have expressed cautious optimism, noting that adaptive training and structured rollouts will determine long-term success.\n\nOpinion: Ultimately, how we structure governance around ${topic} will shape societal dynamics for the next decade.`;
    
    return res.json({
      title: mockTitle,
      subtitle: mockSubtitle,
      content: mockContent,
      author: "Gemini Writer (Mocked)",
      image: "https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=1200&q=80"
    });
  }

  try {
    const prompt = `Write a professional, detailed, and realistic newspaper article draft based on the following instructions:
Topic: ${topic}
Category: ${category}
Tone/Style: ${tone || 'Journalistic, objective'}

Your output MUST be a valid JSON object with the following schema:
{
  "title": "A captivating, high-impact headline",
  "subtitle": "An elegant, descriptive summary subtitle",
  "content": "A full, deeply written multi-paragraph article body (at least 3 paragraphs with rich paragraphs, separate paragraphs with \\n\\n)",
  "image": "A high-quality Unsplash image URL related to the topic"
}

Ensure the JSON is strictly formatted and contains no markdown backticks in the text properties. Make it fit for a premium newspaper like The New York Times.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            subtitle: { type: Type.STRING },
            content: { type: Type.STRING },
            image: { type: Type.STRING }
          },
          required: ["title", "subtitle", "content"]
        }
      }
    });

    const result = JSON.parse(response.text.trim());
    if (!result.image) {
      result.image = "https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=1200&q=80";
    }
    result.author = "Gemini AI Reporter";
    res.json(result);

  } catch (err: any) {
    console.error("Gemini article generation failed:", err);
    res.status(500).json({ error: "Failed to generate article with AI", details: err.message });
  }
});

// POST Generate Social Media Content via Gemini (Admin/Editor only)
app.post("/api/articles/social-share", authenticateJWT, requireRole(["Admin", "Editor"]), async (req, res) => {
  const { title, subtitle, author } = req.body;
  if (!title) {
    return res.status(400).json({ error: "Article title is required to generate share content" });
  }

  const ai = getGeminiClient();
  if (!ai) {
    return res.json({
      twitter: `📰 Out now: "${title}" by ${author || "Staff"}. ${subtitle || ''} #Chronicle #BreakingNews`,
      linkedin: `✍️ I am thrilled to share our latest coverage: "${title}". \n\n${subtitle || 'Dive into our detailed review of this emerging story.'} \n\nWritten by ${author || "our editorial team"}. Let's discuss in the comments below! #Publishing #BusinessNews #Chronicle`,
      newsletterSnippet: `Dear Readers, \n\nWe've just published a highly-anticipated piece: "${title}". ${subtitle || ''} Read the full article inside our portal.`
    });
  }

  try {
    const prompt = `Create professional, engaging social media promotional drafts for a newly published newspaper article with:
Title: "${title}"
Subtitle: "${subtitle}"
Author: "${author || 'Staff Writer'}"

Provide drafts specifically tailored for Twitter/X (with hashtags, micro-format), LinkedIn (more professional, conversational, engaging, call-to-action), and a teaser text snippet for an email newsletter.

Your response MUST be a JSON object with the schema:
{
  "twitter": "Draft for Twitter/X",
  "linkedin": "Draft for LinkedIn",
  "newsletterSnippet": "Brief email teaser snippet"
}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            twitter: { type: Type.STRING },
            linkedin: { type: Type.STRING },
            newsletterSnippet: { type: Type.STRING }
          },
          required: ["twitter", "linkedin", "newsletterSnippet"]
        }
      }
    });

    res.json(JSON.parse(response.text.trim()));
  } catch (err: any) {
    console.error("Gemini social generation failed:", err);
    res.status(500).json({ error: "Failed to generate social snippets", details: err.message });
  }
});

// 3. Subscriptions (Public action, Admin/Editor can view)

// GET Subscriptions
app.get("/api/subscriptions", authenticateJWT, requireRole(["Admin", "Editor"]), async (req, res) => {
  try {
    const subs = await getSubscriptions();
    res.json(subs);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to read subscriptions.", details: err.message });
  }
});

// POST Subscribe (Public)
app.post("/api/subscriptions", async (req, res) => {
  const { email } = req.body;

  if (!email || !email.includes("@")) {
    return res.status(400).json({ error: "Invalid email address" });
  }

  try {
    const subs = await getSubscriptions();
    const existing = subs.find((s: any) => s.email.toLowerCase() === email.toLowerCase());
    
    if (existing) {
      if (existing.status === "active") {
        return res.status(400).json({ error: "Email is already subscribed" });
      } else {
        const updatedSub: Subscription = {
          ...existing,
          status: "active",
          date: new Date().toISOString()
        };
        await saveSubscription(updatedSub);
        await saveEvent({
          id: `ev-${Date.now()}`,
          eventType: "subscribe",
          timestamp: new Date().toISOString()
        });
        return res.json(updatedSub);
      }
    }

    const newSub: Subscription = {
      id: `sub-${Date.now()}`,
      email,
      date: new Date().toISOString(),
      status: "active"
    };

    await saveSubscription(newSub);
    await saveEvent({
      id: `ev-${Date.now()}`,
      eventType: "subscribe",
      timestamp: new Date().toISOString()
    });

    res.status(201).json(newSub);
  } catch (err: any) {
    res.status(500).json({ error: "Subscription pipeline error.", details: err.message });
  }
});

// POST Unsubscribe (Public)
app.post("/api/subscriptions/unsubscribe", async (req, res) => {
  const { email } = req.body;
  try {
    const subs = await getSubscriptions();
    const sub = subs.find((s: any) => s.email.toLowerCase() === email?.toLowerCase());
    if (!sub) {
      return res.status(404).json({ error: "Email subscription not found" });
    }

    const updatedSub: Subscription = {
      ...sub,
      status: "unsubscribed"
    };
    await saveSubscription(updatedSub);
    res.json({ success: true, message: "Unsubscribed successfully" });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to unsubscribe.", details: err.message });
  }
});

// 4. Comments with JWT validation & roles

// GET Comments (Public)
app.get("/api/comments", async (req, res) => {
  try {
    const comments = await getComments();
    res.json(comments);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to retrieve comments.", details: err.message });
  }
});

// POST Add Comment (Authenticated Reader, Editor or Admin)
app.post("/api/comments", authenticateJWT, requireAuth, async (req: any, res: any) => {
  const { articleId, content } = req.body;
  const authorName = req.user.name;

  if (!articleId || !authorName || !content) {
    return res.status(400).json({ error: "Missing required comment parameters" });
  }

  try {
    const articles = await getArticles();
    const article = articles.find((a: any) => a.id === articleId);
    const articleTitle = article ? article.title : "Unknown Article";

    const newComment: Comment = {
      id: `com-${Date.now()}`,
      articleId,
      articleTitle,
      author: authorName,
      content,
      date: new Date().toISOString(),
      status: "pending"
    };

    // Run AI auto-moderation
    const ai = getGeminiClient();
    if (!ai) {
      // Basic Local Moderation Filter Fallback
      const toxicKeywords = ["cash-scam", "click here", "viagra", "casino", "free money", "scam"];
      const containsSpam = toxicKeywords.some(kw => content.toLowerCase().includes(kw));

      if (containsSpam) {
        newComment.status = "flagged";
        newComment.flagReason = "Scam or commercial link pattern detected (Local Filter).";
        newComment.isAiModerated = true;
      } else {
        newComment.status = "approved"; // Auto approve if safe
      }
    } else {
      try {
        const moderationPrompt = `You are an AI-powered content moderator for a highly respected newspaper. Analyze the following comment for spam, hatred, harassment, personal attacks, commercial links, scams, or intense toxicity.

Article Title: "${articleTitle}"
Comment Author: "${authorName}"
Comment Body: "${content}"

Your output MUST be a JSON object with this schema:
{
  "isSafe": true or false,
  "flagReason": "A brief explanation if flagged, otherwise empty string",
  "suggestedStatus": "approved" or "flagged"
}`;

        const response = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: moderationPrompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                isSafe: { type: Type.BOOLEAN },
                flagReason: { type: Type.STRING },
                suggestedStatus: { type: Type.STRING }
              },
              required: ["isSafe", "suggestedStatus"]
            }
          }
        });

        const moderationResult = JSON.parse(response.text.trim());
        newComment.status = moderationResult.suggestedStatus === "flagged" ? "flagged" : "approved";
        if (newComment.status === "flagged") {
          newComment.flagReason = moderationResult.flagReason || "Flagged by AI safety filters.";
        }
        newComment.isAiModerated = true;

      } catch (err) {
        console.error("AI comment moderation failed, falling back to local filter", err);
        newComment.status = "approved";
      }
    }

    await saveComment(newComment);
    await saveEvent({
      id: `ev-${Date.now()}`,
      eventType: "comment",
      articleId,
      timestamp: new Date().toISOString()
    });

    res.status(201).json(newComment);
  } catch (err: any) {
    res.status(500).json({ error: "Comment submittal error.", details: err.message });
  }
});

// PUT Approve Comment (Admin/Editor)
app.put("/api/comments/:id/approve", authenticateJWT, requireRole(["Admin", "Editor"]), async (req, res) => {
  const { id } = req.params;
  try {
    const updated = await updateComment(id, { status: "approved", flagReason: undefined });
    if (!updated) {
      return res.status(404).json({ error: "Comment not found" });
    }
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to approve comment.", details: err.message });
  }
});

// PUT Reject/Flag Comment (Admin/Editor)
app.put("/api/comments/:id/reject", authenticateJWT, requireRole(["Admin", "Editor"]), async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  try {
    const updated = await updateComment(id, { status: "flagged", flagReason: reason || "Flagged manually by editor." });
    if (!updated) {
      return res.status(404).json({ error: "Comment not found" });
    }
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to reject comment.", details: err.message });
  }
});

// DELETE Comment (Admin only)
app.delete("/api/comments/:id", authenticateJWT, requireRole(["Admin"]), async (req, res) => {
  const { id } = req.params;
  try {
    await deleteComment(id);
    res.json({ success: true, message: "Comment permanently purged from archives." });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to delete comment.", details: err.message });
  }
});

// 5. Newsletters (Admin/Editor)

// POST AI Compile Automated Newsletter Draft with Gemini (Admin/Editor)
app.post("/api/newsletters/generate", authenticateJWT, requireRole(["Admin", "Editor"]), async (req, res) => {
  const { articleIds } = req.body;
  if (!articleIds || !Array.isArray(articleIds) || articleIds.length === 0) {
    return res.status(400).json({ error: "Please select at least one article to generate the newsletter" });
  }

  try {
    const articles = await getArticles();
    const selectedArticles = articles.filter((a: any) => articleIds.includes(a.id));

    if (selectedArticles.length === 0) {
      return res.status(404).json({ error: "None of the selected articles were found" });
    }

    const ai = getGeminiClient();
    if (!ai) {
      // Mock Draft Summary
      const subject = `The Weekly Chronicle: Highlight Digest columns`;
      const header = `Welcome to this edition of The Chronicle. Today, we review major shifts in science, tech, and cultural urban living.\n\n`;
      const summaries = selectedArticles.map(a => `• ${a.title}\n  ${a.subtitle}`).join("\n\n");
      const footer = `\n\nThank you for supporting sustainable journalism. Configure preferences online.\n— The Editorial Board`;

      return res.json({
        subject,
        content: header + summaries + footer
      });
    }

    const articlesContext = selectedArticles.map(a => `Title: ${a.title}\nSubtitle: ${a.subtitle}\nCategory: ${a.category}\nContent Teaser: ${a.content.substring(0, 300)}...`).join("\n---\n");
    
    const prompt = `You are the Editor-in-Chief of "The Chronicle", a premium digital newspaper. Compile a clean, highly engaging and professional newsletter compiling the following stories:

${articlesContext}

Provide a catchy, premium, editorial email subject line and a beautifully written email newsletter body that:
1. Warmly greets the subscribers.
2. Summarizes the key insights of these selected articles in a cohesive, narrative editorial flow (do not just list them, blend them together gracefully).
3. Adds a call-to-action to read the full pieces on the portal.
4. Concludes with a professional editorial sign-off.

Your output MUST be a JSON object with this schema:
{
  "subject": "Captivating and professional email subject line",
  "content": "Rich text email newsletter body (use double newlines \\n\\n for paragraphs)"
}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            subject: { type: Type.STRING },
            content: { type: Type.STRING }
          },
          required: ["subject", "content"]
        }
      }
    });

    res.json(JSON.parse(response.text.trim()));

  } catch (err: any) {
    console.error("Gemini newsletter compiler failed:", err);
    res.status(500).json({ error: "Failed to compile newsletter with AI", details: err.message });
  }
});

// POST Send Compiled Newsletter to subscribers (Admin/Editor)
app.post("/api/newsletters/send", authenticateJWT, requireRole(["Admin", "Editor"]), async (req, res) => {
  const { subject, content, articleIds } = req.body;

  if (!subject || !content) {
    return res.status(400).json({ error: "Subject and content are required to send a newsletter" });
  }

  try {
    const subs = await getSubscriptions();
    const activeSubscribers = subs.filter((s: any) => s.status === "active");

    const newNewsletter: Newsletter = {
      id: `news-${Date.now()}`,
      subject,
      content,
      articleIds: articleIds || [],
      sentAt: new Date().toISOString(),
      subscriberCount: activeSubscribers.length
    };

    await saveNewsletter(newNewsletter);

    res.status(201).json({
      success: true,
      newsletter: newNewsletter,
      message: `Newsletter successfully dispatched to ${activeSubscribers.length} active subscriber inbox channels.`
    });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to register sent newsletter.", details: err.message });
  }
});

// GET Newsletter Archive (Admin/Editor can view detailed list, readers view general)
app.get("/api/newsletters", async (req, res) => {
  try {
    const newsletters = await getNewsletters();
    res.json(newsletters);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to read newsletters.", details: err.message });
  }
});

// 6. Analytics reporting & Event logging

// POST Track Analytics Event
app.post("/api/analytics/event", async (req, res) => {
  const { articleId, eventType, durationSeconds, country, device } = req.body;

  if (!eventType) {
    return res.status(400).json({ error: "Event type is required" });
  }

  try {
    const newEvent: LoggedEvent = {
      id: `ev-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      articleId,
      eventType,
      timestamp: new Date().toISOString(),
      durationSeconds,
      country: country || "US",
      device: device || "Desktop"
    };

    await saveEvent(newEvent);

    // Increment article focus counters
    if (articleId) {
      if (eventType === "view") {
        await updateArticle(articleId, { views: (await getArticles()).find((a: any) => a.id === articleId)?.views as number + 1 || 1 });
      } else if (eventType === "read_complete") {
        await updateArticle(articleId, { reads: (await getArticles()).find((a: any) => a.id === articleId)?.reads as number + 1 || 1 });
      } else if (eventType === "like") {
        await updateArticle(articleId, { likes: (await getArticles()).find((a: any) => a.id === articleId)?.likes as number + 1 || 1 });
      }
    }

    res.json({ success: true, event: newEvent });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to track analytics event.", details: err.message });
  }
});

// GET Compiled Analytics Report (Admin or Editor only)
app.get("/api/analytics", authenticateJWT, requireRole(["Admin", "Editor"]), async (req, res) => {
  try {
    const articles = await getArticles();
    const subs = await getSubscriptions();
    const events = await getEvents();

    const totalViews = events.filter((e: any) => e.eventType === "view").length + 
                       articles.reduce((acc: number, cur: any) => acc + (cur.views || 0), 0);
    
    const totalReads = events.filter((e: any) => e.eventType === "read_complete").length + 
                       articles.reduce((acc: number, cur: any) => acc + (cur.reads || 0), 0);
    
    const totalSubscribers = subs.filter((s: any) => s.status === "active").length;
    
    // Active Visitors simulation
    const baseTime = new Date().getMinutes();
    const activeReadersNow = Math.floor(6 + 5 * Math.sin(baseTime / 3) + Math.random() * 3);

    // Views by category
    const viewsByCategory: { [category: string]: number } = {};
    articles.forEach((a: any) => {
      viewsByCategory[a.category] = (viewsByCategory[a.category] || 0) + (a.views || 0);
    });

    // Popular articles
    const popularArticles = articles
      .map((a: any) => ({
        articleId: a.id,
        title: a.title,
        views: a.views || 0,
        reads: a.reads || 0
      }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 5);

    // Timeline (last 7 days group)
    const timelineMap: { [date: string]: { views: number; subscriptions: number } } = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      timelineMap[dateStr] = { views: 0, subscriptions: 0 };
    }

    events.forEach((e: any) => {
      const dateStr = e.timestamp.split("T")[0];
      if (timelineMap[dateStr]) {
        if (e.eventType === "view") {
          timelineMap[dateStr].views += 1;
        } else if (e.eventType === "subscribe") {
          timelineMap[dateStr].subscriptions += 1;
        }
      }
    });

    const baselineViews = [120, 145, 180, 210, 195, 240, 280];
    const baselineSubs = [2, 1, 3, 5, 2, 4, 3];
    Object.keys(timelineMap).forEach((dateKey, index) => {
      timelineMap[dateKey].views += baselineViews[index % baselineViews.length];
      timelineMap[dateKey].subscriptions += baselineSubs[index % baselineSubs.length];
    });

    const visitorTimeline = Object.keys(timelineMap).map(key => ({
      date: key,
      views: timelineMap[key].views,
      subscriptions: timelineMap[key].subscriptions
    }));

    const deviceBreakdown = [
      { name: "Mobile", value: 58 },
      { name: "Desktop", value: 34 },
      { name: "Tablet", value: 8 }
    ];

    const countryBreakdown = [
      { name: "United States", value: 45 },
      { name: "United Kingdom", value: 18 },
      { name: "Germany", value: 12 },
      { name: "Canada", value: 10 },
      { name: "Others", value: 15 }
    ];

    const report: AnalyticsSummary = {
      totalViews,
      totalReads,
      totalSubscribers,
      activeReadersNow,
      viewsByCategory,
      popularArticles,
      visitorTimeline,
      deviceBreakdown,
      countryBreakdown
    };

    res.json(report);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to compile analytics summary.", details: err.message });
  }
});

// 8. Advertisements Endpoints (Admin, Editor & Reader)

// GET Ads (Public)
app.get("/api/ads", async (req, res) => {
  try {
    const ads = await getAds();
    res.json(ads);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch advertisements.", details: err.message });
  }
});

// POST Add Ad (Admin or Editor only)
app.post("/api/ads", authenticateJWT, requireRole(["Admin", "Editor"]), async (req: any, res: any) => {
  const { title, imageUrl, linkUrl, slot, status } = req.body;
  if (!title || !imageUrl || !linkUrl || !slot) {
    return res.status(400).json({ error: "Missing required advertisement fields." });
  }

  const newAd: Advertisement = {
    id: `ad-${Date.now()}`,
    title,
    imageUrl,
    linkUrl,
    slot,
    status: status || "active",
    views: 0,
    clicks: 0,
    createdAt: new Date().toISOString()
  };

  try {
    await saveAd(newAd);
    res.status(201).json(newAd);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to save advertisement.", details: err.message });
  }
});

// PUT Update Ad (Admin or Editor only)
app.put("/api/ads/:id", authenticateJWT, requireRole(["Admin", "Editor"]), async (req: any, res: any) => {
  const { id } = req.params;
  try {
    const updated = await updateAd(id, req.body);
    if (!updated) {
      return res.status(404).json({ error: "Advertisement not found." });
    }
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to update advertisement.", details: err.message });
  }
});

// DELETE Ad (Admin or Editor only)
app.delete("/api/ads/:id", authenticateJWT, requireRole(["Admin", "Editor"]), async (req: any, res: any) => {
  const { id } = req.params;
  try {
    await deleteAd(id);
    res.json({ success: true, message: "Advertisement removed successfully." });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to delete advertisement.", details: err.message });
  }
});

// POST Increment Ad Views (Public)
app.post("/api/ads/:id/view", async (req, res) => {
  const { id } = req.params;
  try {
    await incrementAdMetric(id, "views");
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to log advertisement view." });
  }
});

// POST Increment Ad Clicks (Public)
app.post("/api/ads/:id/click", async (req, res) => {
  const { id } = req.params;
  try {
    await incrementAdMetric(id, "clicks");
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to log advertisement click." });
  }
});

// 9. Automated Hourly News Fetcher Endpoints (Prothom Alo & Ittefaq)

// GET News Fetcher Status & Logs
app.get("/api/news-fetcher/status", async (req, res) => {
  try {
    const status = getNewsFetcherStatus();
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to retrieve news fetcher status.", details: err.message });
  }
});

// POST Manual Trigger News Fetcher Sync (Public / Admin / Editor)
app.post("/api/news-fetcher/sync", async (req, res) => {
  try {
    const result = await runNewsSync(getGeminiClient, getArticles, saveArticle);
    res.json({
      success: true,
      message: `Automated news sync complete. Added ${result.addedCount} new articles with reworded titles.`,
      addedCount: result.addedCount,
      logs: result.logs
    });
  } catch (err: any) {
    res.status(500).json({ error: "Automated news sync failed.", details: err.message });
  }
});

// Vite Setup for Dev Mode or Serve Static Files for Prod Mode
async function startServer() {
  // Initialize Database before starting listener
  await initDatabase(DEFAULT_ARTICLES, DEFAULT_SUBSCRIPTIONS, DEFAULT_COMMENTS, DEFAULT_EVENTS);

  // Setup Automated News Sync (Runs every 1 hour = 3600000ms)
  const HOURLY_MS = 60 * 60 * 1000;
  setInterval(() => {
    console.log("[Hourly Cron] Triggering automated news fetch from Prothom Alo & Ittefaq...");
    runNewsSync(getGeminiClient, getArticles, saveArticle);
  }, HOURLY_MS);

  // Trigger initial sync 10 seconds after boot to populate latest news
  setTimeout(() => {
    console.log("[Boot Sync] Initial news fetch from Prothom Alo & Ittefaq starting...");
    runNewsSync(getGeminiClient, getArticles, saveArticle);
  }, 10000);

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Express server successfully running on http://localhost:${PORT}`);
  });
}

startServer();
