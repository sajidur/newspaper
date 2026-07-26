import { GoogleGenAI } from "@google/genai";
import { Article } from "../src/types";

export interface SyncLog {
  id: string;
  timestamp: string;
  source: string;
  originalTitle: string;
  rewordedTitle: string;
  category: string;
  status: "added" | "skipped" | "failed";
  reason?: string;
}

export interface NewsFetcherStatus {
  lastRunTimestamp: string | null;
  isRunning: boolean;
  intervalMinutes: number;
  totalFetchedCount: number;
  logs: SyncLog[];
}

const syncLogs: SyncLog[] = [];
let lastRunTimestamp: string | null = null;
let isSyncRunning = false;
let processedTitles = new Set<string>();

// Bengali synonym replacements for rule-based title modification fallback
const BENGALI_SYNONYMS: Array<[RegExp, string]> = [
  [/বলেন/g, "জানান"],
  [/বললেন/g, "জানালেন"],
  [/জানানো হয়েছে/g, "প্রকাশ করা হয়েছে"],
  [/হলো/g, "সংঘটিত হলো"],
  [/পেল/g, "অর্জন করল"],
  [/শুরু/g, "সূচনা"],
  [/শেষ/g, "সমাপ্ত"],
  [/বড়/g, "গুরুত্বপূর্ণ"],
  [/নতুন/g, "আধুনিক"],
  [/ঘোষণা/g, "বিজ্ঞপ্তি"],
  [/দাবি/g, "বক্তব্য"],
  [/বৈঠক/g, "আলোচনা সভা"],
  [/নেতা/g, "প্রতিনিধি"],
  [/সরকার/g, "প্রশাসন"],
  [/বৃদ্ধি/g, "উন্নতি"],
  [/হ্রাস/g, "কমে যাওয়া"],
  [/সিদ্ধান্ত/g, "পদক্ষেপ"],
  [/মূল্য/g, "দাম"],
  [/ঝুঁকি/g, "আশঙ্কা"],
  [/প্রশ্ন/g, "জিজ্ঞাসা"]
];

/**
 * Rephrases/modifies the given title slightly using Gemini AI or Bengali Synonym Rule engine
 */
export async function rewordTitle(originalTitle: string, getAiClient: () => GoogleGenAI | null): Promise<string> {
  const cleanOriginal = originalTitle.trim();
  
  // Try Gemini AI first
  const ai = getAiClient();
  if (ai) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `আপনি একটি শীর্ষস্থানীয় বাংলা সংবাদপত্রের সম্পাদক। নিচের সংবাদের শিরোনামের মূল অর্থ ও বিষয়বস্তু হুবহু ঠিক রেখে শিরোনামটিকে একটু নতুনভাবে সুন্দর ও আকর্ষণীয় করে পরিমার্জন করুন। 

মূল শিরোনাম: "${cleanOriginal}"

শর্ত: 
১. শুধুমাত্র পরিমার্জিত একটি নতুন শিরোনামটি লিখুন। 
২. কোনো উদ্ধৃতি চিহ্ন (Quotes), অতিরিক্ত কথা বা ভূমিকা দেবেন না।`,
      });

      const aiTitle = response.text ? response.text.trim().replace(/^["'‘“]+|["'’”]+$/g, '') : null;
      if (aiTitle && aiTitle.length >= 8 && aiTitle !== cleanOriginal) {
        return aiTitle;
      }
    } catch (err) {
      console.warn("Gemini title rephrasing fallback to rule engine:", (err as Error).message);
    }
  }

  // Fallback Rule Engine: Apply synonym swaps
  let reworded = cleanOriginal;
  let replacedAny = false;

  for (const [pattern, replacement] of BENGALI_SYNONYMS) {
    if (pattern.test(reworded)) {
      reworded = reworded.replace(pattern, replacement);
      replacedAny = true;
      break; // swap one or two words to keep title change subtle ("little change title")
    }
  }

  // If no synonym matched, rephrase prefix/suffix tastefully
  if (!replacedAny) {
    if (reworded.startsWith("উন্নয়ন:")) {
      reworded = reworded.replace("উন্নয়ন:", "সর্বশেষ খবর:");
    } else if (reworded.includes(":")) {
      const parts = reworded.split(":");
      reworded = `${parts[0]} প্রসঙ্গে: ${parts.slice(1).join(":")}`;
    } else {
      reworded = `বিশেষ সংবাদ: ${reworded}`;
    }
  }

  return reworded.trim();
}

/**
 * Normalizes title for deduplication comparison
 */
function normalizeTitle(t: string): string {
  return t.toLowerCase().replace(/[^\w\u0980-\u09FF]/g, '').trim();
}

/**
 * Extract clean HTML text
 */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>?/gm, '').replace(/\s+/g, ' ').trim();
}

/**
 * Scrapes/Fetches news from Prothom Alo
 */
async function fetchProthomAloNews(): Promise<Array<{ title: string; subtitle: string; content: string; category: string; link: string; image?: string }>> {
  const items: Array<{ title: string; subtitle: string; content: string; category: string; link: string; image?: string }> = [];

  try {
    // Prothom Alo Feed or Home API
    const res = await fetch("https://www.prothomalo.com/api/v1/collections/home?offset=0&limit=12", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*"
      }
    });

    if (res.ok) {
      const data = await res.json();
      const itemsList = data.items || data["story-elements"] || data.stories || [];
      for (const item of itemsList) {
        const story = item.story || item;
        if (!story || !story.headline) continue;

        const title = story.headline.trim();
        const subtitle = story.subheadline || story.summary || "প্রথম আলোর পরিবেশিত বিশেষ বাংলা সংবাদ বুলেটিন।";
        const link = story.url || `https://www.prothomalo.com/${story.slug || ''}`;
        const rawCategory = story.section?.name || story["section-name"] || "Politics";
        const category = mapCategory(rawCategory);

        let image = "https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=1200&q=80";
        if (story["hero-image-s3-key"]) {
          image = `https://images.prothomalo.com/${story["hero-image-s3-key"]}?w=1200&auto=format%2Ccompress&ogImage=true`;
        } else if (story["hero-image-url"]) {
          image = story["hero-image-url"];
        }

        const content = `${subtitle}\n\nঢাকা ও সারা দেশের সর্বশেষ খবর, রাজনীতি, অর্থনীতি ও দৈনন্দিন ঘটনাপ্রবাহ বিশ্লেষণ নিয়ে বিশেষ প্রতিবেদন।\n\n(সূত্র: প্রথম আলো)`;

        items.push({ title, subtitle, content, category, link, image });
      }
    }
  } catch (err) {
    console.warn("Primary Prothom Alo API fetch failed, trying RSS/HTML fallback:", (err as Error).message);
  }

  // Fallback HTML / RSS fetch if API gave 0 items
  if (items.length === 0) {
    try {
      const rssRes = await fetch("https://www.prothomalo.com/feed", {
        headers: { "User-Agent": "Mozilla/5.0" }
      });
      if (rssRes.ok) {
        const xmlText = await rssRes.text();
        const matches = xmlText.match(/<item>[\s\S]*?<\/item>/g) || [];
        for (const itemXml of matches.slice(0, 10)) {
          const titleMatch = itemXml.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) || itemXml.match(/<title>(.*?)<\/title>/);
          const linkMatch = itemXml.match(/<link>(.*?)<\/link>/);
          const descMatch = itemXml.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/) || itemXml.match(/<description>(.*?)<\/description>/);
          
          if (titleMatch && titleMatch[1]) {
            const title = stripHtml(titleMatch[1]);
            const link = linkMatch ? linkMatch[1] : "https://www.prothomalo.com";
            const subtitle = descMatch ? stripHtml(descMatch[1]).slice(0, 200) : "প্রথম আলোর পরিবেশিত সর্বশেষ সংবাদ।";
            items.push({
              title,
              subtitle,
              content: `${subtitle}\n\nবিস্তারিত আপডেট পেতে দৈনিক কথা প্রকাশ পত্রিকার সাথেই থাকুন।\n\n(সূত্র: প্রথম আলো)`,
              category: "Politics",
              link,
              image: "https://images.unsplash.com/photo-1585829365295-ab7cd400c167?auto=format&fit=crop&w=1200&q=80"
            });
          }
        }
      }
    } catch (err) {
      console.error("Prothom Alo RSS fallback error:", (err as Error).message);
    }
  }

  return items;
}

/**
 * Scrapes/Fetches news from Ittefaq
 */
async function fetchIttefaqNews(): Promise<Array<{ title: string; subtitle: string; content: string; category: string; link: string; image?: string }>> {
  const items: Array<{ title: string; subtitle: string; content: string; category: string; link: string; image?: string }> = [];

  try {
    const res = await fetch("https://www.ittefaq.com.bd/feed", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/rss+xml, application/xml, text/xml, */*"
      }
    });

    if (res.ok) {
      const xmlText = await res.text();
      const matches = xmlText.match(/<item>[\s\S]*?<\/item>/g) || [];

      for (const itemXml of matches.slice(0, 10)) {
        const titleMatch = itemXml.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) || itemXml.match(/<title>(.*?)<\/title>/);
        const linkMatch = itemXml.match(/<link>(.*?)<\/link>/);
        const descMatch = itemXml.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/) || itemXml.match(/<description>(.*?)<\/description>/);
        const categoryMatch = itemXml.match(/<category><!\[CDATA\[(.*?)\]\]><\/category>/) || itemXml.match(/<category>(.*?)<\/category>/);
        const mediaMatch = itemXml.match(/url="(https:\/\/.*?)"/) || itemXml.match(/src="(https:\/\/.*?)"/);

        if (titleMatch && titleMatch[1]) {
          const title = stripHtml(titleMatch[1]);
          const link = linkMatch ? linkMatch[1] : "https://www.ittefaq.com.bd";
          const rawSubtitle = descMatch ? stripHtml(descMatch[1]) : "";
          const subtitle = rawSubtitle.slice(0, 220) || "দৈনিক ইত্তেফাক থেকে সংগৃহীত সর্বশেষ তাজা খবর।";
          const rawCategory = categoryMatch ? categoryMatch[1] : "Business";
          const category = mapCategory(rawCategory);
          const image = mediaMatch ? mediaMatch[1] : "https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=1200&q=80";

          items.push({
            title,
            subtitle,
            content: `${subtitle}\n\nদৈনিক ইত্তেফাকের সূত্রধরে প্রকাশিত বিশেষ পরিমার্জিত খবরের আপডেট। খবরটির সর্বশেষ স্থিতি ও বিশ্লেষণ পড়তে চোখ রাখুন দৈনিক কথা প্রকাশে।\n\n(সূত্র: দৈনিক ইত্তেফাক)`,
            category,
            link,
            image
          });
        }
      }
    }
  } catch (err) {
    console.warn("Ittefaq RSS fetch error:", (err as Error).message);
  }

  // HTML fallback if RSS yields empty
  if (items.length === 0) {
    try {
      const htmlRes = await fetch("https://www.ittefaq.com.bd/", {
        headers: { "User-Agent": "Mozilla/5.0" }
      });
      if (htmlRes.ok) {
        const html = await htmlRes.text();
        // Regex extract h1, h2, h3 news titles
        const headingMatches = html.match(/<(?:h1|h2|h3)[^>]*>(.*?)<\/(?:h1|h2|h3)>/gi) || [];
        for (const headingHtml of headingMatches) {
          const cleanText = stripHtml(headingHtml);
          if (cleanText.length > 15 && cleanText.length < 120 && !cleanText.includes("ইত্তেফাক")) {
            items.push({
              title: cleanText,
              subtitle: "দৈনিক ইত্তেফাকের হোমপেজ থেকে সংগৃহীত সংবাদ।",
              content: `${cleanText}\n\nদেশ ও বিদেশের সর্বশেষ রাজনৈতিক ও সামাজিক খবরের নির্ভরযোগ্য কভারেজ।\n\n(সূত্র: দৈনিক ইত্তেফাক)`,
              category: "Business",
              link: "https://www.ittefaq.com.bd",
              image: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1200&q=80"
            });
            if (items.length >= 6) break;
          }
        }
      }
    } catch (err) {
      console.error("Ittefaq HTML scrape error:", (err as Error).message);
    }
  }

  return items;
}

/**
 * Maps raw newspaper categories to our app's categories
 */
function mapCategory(rawCat: string): string {
  const catLower = rawCat.toLowerCase();
  if (catLower.includes("tech") || catLower.includes("প্রযুক্তি") || catLower.includes("বিজ্ঞান")) return "Tech";
  if (catLower.includes("bus") || catLower.includes("অর্থনীতি") || catLower.includes("বাণিজ্য")) return "Business";
  if (catLower.includes("sci") || catLower.includes("পরিবেশ")) return "Science";
  if (catLower.includes("cul") || catLower.includes("বিনোদন") || catLower.includes("খেলা")) return "Culture";
  if (catLower.includes("opi") || catLower.includes("মতামত") || catLower.includes("সম্পাদকীয়")) return "Opinions";
  return "Politics";
}

/**
 * Executes the news synchronization:
 * 1. Fetches headlines from Prothom Alo & Ittefaq
 * 2. Rewords titles slightly using Gemini / Synonym engine
 * 3. Saves new articles to DB
 */
export async function runNewsSync(
  getAiClient: () => GoogleGenAI | null,
  getExistingArticles: () => Promise<Article[]>,
  saveArticleToDb: (art: Article) => Promise<void>
): Promise<{ addedCount: number; logs: SyncLog[] }> {
  if (isSyncRunning) {
    return { addedCount: 0, logs: syncLogs.slice(-10) };
  }

  isSyncRunning = true;
  lastRunTimestamp = new Date().toISOString();
  let addedCount = 0;
  const currentBatchLogs: SyncLog[] = [];

  try {
    const existing = await getExistingArticles();
    existing.forEach(a => processedTitles.add(normalizeTitle(a.title)));

    // Fetch from Prothom Alo
    console.log("Fetching news from Prothom Alo (https://www.prothomalo.com/)...");
    const prothomItems = await fetchProthomAloNews();
    
    // Fetch from Ittefaq
    console.log("Fetching news from Ittefaq (https://www.ittefaq.com.bd/)...");
    const ittefaqItems = await fetchIttefaqNews();

    const allFetched = [
      ...prothomItems.map(i => ({ ...i, sourceName: "প্রথম আলো" })),
      ...ittefaqItems.map(i => ({ ...i, sourceName: "দৈনিক ইত্তেফাক" }))
    ];

    for (const item of allFetched) {
      const normalizedOriginal = normalizeTitle(item.title);

      if (processedTitles.has(normalizedOriginal)) {
        const skipLog: SyncLog = {
          id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          timestamp: new Date().toISOString(),
          source: item.sourceName,
          originalTitle: item.title,
          rewordedTitle: item.title,
          category: item.category,
          status: "skipped",
          reason: "ইতিমধ্যে নিবন্ধিত আছে (Duplicate)"
        };
        syncLogs.unshift(skipLog);
        currentBatchLogs.push(skipLog);
        continue;
      }

      // Slightly change title ("little change title")
      const newTitle = await rewordTitle(item.title, getAiClient);
      const normalizedNew = normalizeTitle(newTitle);

      if (processedTitles.has(normalizedNew)) {
        continue;
      }

      // Construct Article
      const newArticle: Article = {
        id: `auto-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        title: newTitle,
        subtitle: item.subtitle,
        category: item.category,
        content: item.content,
        author: "নিজস্ব প্রতিবেদক",
        date: new Date().toISOString(),
        image: item.image || "https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=1200&q=80",
        reads: Math.floor(Math.random() * 50) + 10,
        likes: Math.floor(Math.random() * 20) + 2,
        views: Math.floor(Math.random() * 100) + 50,
        status: "published"
      };

      await saveArticleToDb(newArticle);
      processedTitles.add(normalizedOriginal);
      processedTitles.add(normalizedNew);
      addedCount++;

      const successLog: SyncLog = {
        id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        timestamp: new Date().toISOString(),
        source: item.sourceName,
        originalTitle: item.title,
        rewordedTitle: newTitle,
        category: item.category,
        status: "added"
      };
      syncLogs.unshift(successLog);
      currentBatchLogs.push(successLog);
    }

    // Keep logs list trimmed to last 50 entries
    if (syncLogs.length > 50) {
      syncLogs.length = 50;
    }

    console.log(`News sync completed: Successfully posted ${addedCount} newly reworded news articles.`);
  } catch (err) {
    console.error("Error during automated news fetcher run:", err);
  } finally {
    isSyncRunning = false;
  }

  return { addedCount, logs: currentBatchLogs };
}

/**
 * Returns current status and recent logs of the automated news fetcher
 */
export function getNewsFetcherStatus(): NewsFetcherStatus {
  return {
    lastRunTimestamp,
    isRunning: isSyncRunning,
    intervalMinutes: 60,
    totalFetchedCount: syncLogs.filter(l => l.status === "added").length,
    logs: syncLogs.slice(0, 20)
  };
}
