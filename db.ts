import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import { Article, Subscription, Comment, Newsletter, LoggedEvent, User, Advertisement, Category } from './src/types';

const DEFAULT_ADS: Advertisement[] = [
  {
    id: "ad-top-1",
    title: "দৈনিক কথা প্রকাশ প্রিমিয়াম মেম্বারশিপ - নিরপেক্ষ স্বাধীন সাংবাদিকতাকে সমর্থন করুন",
    imageUrl: "https://images.unsplash.com/photo-1588681664899-f142ff2bac99?auto=format&fit=crop&w=1200&h=150&q=80",
    linkUrl: "https://ais-pre-orhudcut2bcz3yzyypn2vd-662948938709.asia-east1.run.app",
    slot: "top-banner",
    status: "active",
    views: 1540,
    clicks: 124,
    createdAt: "2026-07-15T09:00:00Z"
  },
  {
    id: "ad-sidebar-1",
    title: "আনস্প্ল্যাশ - সৃষ্টিশীল রচনার জন্য চমৎকার সব নিখরচায় ছবি",
    imageUrl: "https://images.unsplash.com/photo-1542038784456-1ea8e935640e?auto=format&fit=crop&w=400&h=300&q=80",
    linkUrl: "https://unsplash.com",
    slot: "sidebar",
    status: "active",
    views: 980,
    clicks: 54,
    createdAt: "2026-07-15T09:00:00Z"
  },
  {
    id: "ad-mid-1",
    title: "গুগল ক্লাউড - আপনার ফুল-স্ট্যাক নোড অ্যাপ্লিকেশনগুলোকে নিরাপদে স্কেল করুন",
    imageUrl: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=800&h=200&q=80",
    linkUrl: "https://cloud.google.com",
    slot: "mid-list",
    status: "active",
    views: 1230,
    clicks: 88,
    createdAt: "2026-07-15T09:00:00Z"
  },
  {
    id: "ad-bottom-1",
    title: "এআই স্টুডিও বিল্ড - প্রম্পটের সাহায্যে মুহূর্তেই তৈরি করুন প্রডাকশন-রেডি ওয়েব অ্যাপ্লিকেশন",
    imageUrl: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1200&h=150&q=80",
    linkUrl: "https://ai.studio",
    slot: "bottom-banner",
    status: "active",
    views: 2450,
    clicks: 195,
    createdAt: "2026-07-15T09:00:00Z"
  }
];

const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

// Ensure data folder exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Global connection state
let mysqlPool: mysql.Pool | null = null;
let isMysqlConnected = false;
let mysqlConnectionError: string | null = null;

// Pre-hash password for default seed users to speed up first load
const ADMIN_PASSWORD_HASH = bcrypt.hashSync("adminpassword", 10);
const EDITOR_PASSWORD_HASH = bcrypt.hashSync("editorpassword", 10);
const READER_PASSWORD_HASH = bcrypt.hashSync("readerpassword", 10);

const DEFAULT_CATEGORIES: Category[] = [
  { id: "cat-science", name: "Science", slug: "science", createdAt: "2026-07-15T09:00:00Z" },
  { id: "cat-tech", name: "Tech", slug: "tech", createdAt: "2026-07-15T09:00:00Z" },
  { id: "cat-opinions", name: "Opinions", slug: "opinions", createdAt: "2026-07-15T09:00:00Z" },
  { id: "cat-business", name: "Business", slug: "business", createdAt: "2026-07-15T09:00:00Z" },
  { id: "cat-culture", name: "Culture", slug: "culture", createdAt: "2026-07-15T09:00:00Z" }
];

const DEFAULT_USERS: any[] = [
  {
    id: "user-admin",
    name: "Eleanor Vance",
    email: "admin@chronicle.com",
    password: ADMIN_PASSWORD_HASH,
    role: "Admin",
    createdAt: "2026-07-15T09:00:00Z"
  },
  {
    id: "user-editor",
    name: "Arthur Scribbler",
    email: "editor@chronicle.com",
    password: EDITOR_PASSWORD_HASH,
    role: "Editor",
    createdAt: "2026-07-15T09:05:00Z"
  },
  {
    id: "user-reader",
    name: "John Reader",
    email: "reader@chronicle.com",
    password: READER_PASSWORD_HASH,
    role: "Reader",
    createdAt: "2026-07-15T09:10:00Z"
  }
];

// Helper to check if MySQL connection parameters are supplied
export function isMysqlConfigured(): boolean {
  return !!(
    process.env.MYSQL_HOST &&
    process.env.MYSQL_USER &&
    process.env.MYSQL_DATABASE
  );
}

// Initialize database (creates tables if MySQL, otherwise populates db.json)
export async function initDatabase(
  defaultArticles: Article[],
  defaultSubscriptions: Subscription[],
  defaultComments: Comment[],
  defaultEvents: LoggedEvent[]
) {
  if (isMysqlConfigured()) {
    try {
      console.log(`[Database] Attempting to connect to MySQL at ${process.env.MYSQL_HOST}:${process.env.MYSQL_PORT || 3306}...`);
      
      mysqlPool = mysql.createPool({
        host: process.env.MYSQL_HOST,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASSWORD,
        database: process.env.MYSQL_DATABASE,
        port: process.env.MYSQL_PORT ? parseInt(process.env.MYSQL_PORT) : 3306,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        connectTimeout: 5000 // fail fast if server unavailable
      });

      // Test connection
      const conn = await mysqlPool.getConnection();
      console.log("[Database] MySQL Connection established successfully!");
      isMysqlConnected = true;
      mysqlConnectionError = null;
      conn.release();

      // Create Tables
      await createMysqlTables(defaultArticles, defaultSubscriptions, defaultComments, defaultEvents);
    } catch (err: any) {
      console.error("[Database] Failed to connect or initialize MySQL. Falling back to JSON database.", err.message);
      isMysqlConnected = false;
      mysqlConnectionError = err.message || String(err);
      mysqlPool = null;
    }
  } else {
    console.log("[Database] No MySQL credentials found in environment. Defaulting to local JSON file-based database.");
    isMysqlConnected = false;
    mysqlConnectionError = "MYSQL environment variables are not configured in AI Studio Secrets/Settings panel.";
  }

  // Fallback / initialization for local file database
  if (!isMysqlConnected) {
    if (!fs.existsSync(DB_FILE)) {
      const initialDb = {
        users: DEFAULT_USERS,
        articles: defaultArticles,
        subscriptions: defaultSubscriptions,
        comments: defaultComments,
        newsletters: [],
        events: defaultEvents,
        ads: DEFAULT_ADS,
        categories: DEFAULT_CATEGORIES
      };
      fs.writeFileSync(DB_FILE, JSON.stringify(initialDb, null, 2), "utf-8");
    } else {
      // Ensure the existing file contains users key and ads key
      try {
        const fileContent = fs.readFileSync(DB_FILE, 'utf-8');
        const db = JSON.parse(fileContent);
        let modified = false;
        if (!db.users) {
          db.users = DEFAULT_USERS;
          modified = true;
        }
        if (!db.ads) {
          db.ads = DEFAULT_ADS;
          modified = true;
        }
        if (!db.categories) {
          db.categories = DEFAULT_CATEGORIES;
          modified = true;
        }
        if (modified) {
          fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf-8");
        }
      } catch (err) {
        console.error("[Database] Error checking JSON database schema, resetting to defaults", err);
      }
    }
  }
}

async function createMysqlTables(
  defaultArticles: Article[],
  defaultSubscriptions: Subscription[],
  defaultComments: Comment[],
  defaultEvents: LoggedEvent[]
) {
  if (!mysqlPool) return;

  console.log("[Database] Ensuring tables exist in MySQL...");

  // 1. Users Table
  await mysqlPool.query(`
    CREATE TABLE IF NOT EXISTS \`users\` (
      \`id\` VARCHAR(128) PRIMARY KEY,
      \`name\` VARCHAR(255) NOT NULL,
      \`email\` VARCHAR(255) UNIQUE NOT NULL,
      \`password\` VARCHAR(255) NOT NULL,
      \`role\` VARCHAR(50) NOT NULL,
      \`createdAt\` DATETIME NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // 2. Articles Table
  await mysqlPool.query(`
    CREATE TABLE IF NOT EXISTS \`articles\` (
      \`id\` VARCHAR(128) PRIMARY KEY,
      \`title\` VARCHAR(255) NOT NULL,
      \`subtitle\` TEXT,
      \`category\` VARCHAR(100) NOT NULL,
      \`content\` TEXT NOT NULL,
      \`author\` VARCHAR(255) NOT NULL,
      \`date\` DATETIME NOT NULL,
      \`image\` TEXT,
      \`reads\` INT DEFAULT 0,
      \`likes\` INT DEFAULT 0,
      \`views\` INT DEFAULT 0,
      \`status\` VARCHAR(50) DEFAULT 'published'
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // 3. Subscriptions Table
  await mysqlPool.query(`
    CREATE TABLE IF NOT EXISTS \`subscriptions\` (
      \`id\` VARCHAR(128) PRIMARY KEY,
      \`email\` VARCHAR(255) UNIQUE NOT NULL,
      \`date\` DATETIME NOT NULL,
      \`status\` VARCHAR(50) DEFAULT 'active'
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // 4. Comments Table
  await mysqlPool.query(`
    CREATE TABLE IF NOT EXISTS \`comments\` (
      \`id\` VARCHAR(128) PRIMARY KEY,
      \`articleId\` VARCHAR(128) NOT NULL,
      \`articleTitle\` VARCHAR(255) NOT NULL,
      \`author\` VARCHAR(255) NOT NULL,
      \`content\` TEXT NOT NULL,
      \`date\` DATETIME NOT NULL,
      \`status\` VARCHAR(50) DEFAULT 'pending',
      \`flagReason\` TEXT,
      \`isAiModerated\` TINYINT DEFAULT 0
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // 5. Newsletters Table
  await mysqlPool.query(`
    CREATE TABLE IF NOT EXISTS \`newsletters\` (
      \`id\` VARCHAR(128) PRIMARY KEY,
      \`subject\` VARCHAR(255) NOT NULL,
      \`content\` TEXT NOT NULL,
      \`articleIds\` TEXT NOT NULL,
      \`sentAt\` DATETIME NOT NULL,
      \`subscriberCount\` INT DEFAULT 0
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // 6. Events Table
  await mysqlPool.query(`
    CREATE TABLE IF NOT EXISTS \`events\` (
      \`id\` VARCHAR(128) PRIMARY KEY,
      \`articleId\` VARCHAR(128),
      \`eventType\` VARCHAR(100) NOT NULL,
      \`timestamp\` DATETIME NOT NULL,
      \`durationSeconds\` INT,
      \`country\` VARCHAR(50),
      \`device\` VARCHAR(50)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // 7. Ads Table
  await mysqlPool.query(`
    CREATE TABLE IF NOT EXISTS \`ads\` (
      \`id\` VARCHAR(128) PRIMARY KEY,
      \`title\` VARCHAR(255) NOT NULL,
      \`imageUrl\` TEXT NOT NULL,
      \`linkUrl\` TEXT NOT NULL,
      \`slot\` VARCHAR(100) NOT NULL,
      \`status\` VARCHAR(50) DEFAULT 'active',
      \`views\` INT DEFAULT 0,
      \`clicks\` INT DEFAULT 0,
      \`createdAt\` DATETIME NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // 8. Categories Table
  await mysqlPool.query(`
    CREATE TABLE IF NOT EXISTS \`categories\` (
      \`id\` VARCHAR(128) PRIMARY KEY,
      \`name\` VARCHAR(255) UNIQUE NOT NULL,
      \`slug\` VARCHAR(255) UNIQUE NOT NULL,
      \`createdAt\` DATETIME NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  console.log("[Database] MySQL Tables verified/created.");

  // Seeding default categories if empty
  const [catRows]: any = await mysqlPool.query("SELECT COUNT(*) as cnt FROM `categories`");
  if (catRows[0].cnt === 0) {
    console.log("[Database] Seeding default categories into MySQL...");
    for (const cat of DEFAULT_CATEGORIES) {
      await mysqlPool.query(
        "INSERT INTO `categories` (`id`, `name`, `slug`, `createdAt`) VALUES (?, ?, ?, ?)",
        [cat.id, cat.name, cat.slug, new Date(cat.createdAt)]
      );
    }
  }

  // Seeding default users if user table is empty
  const [userRows]: any = await mysqlPool.query("SELECT COUNT(*) as cnt FROM `users`");
  if (userRows[0].cnt === 0) {
    console.log("[Database] Seeding default users into MySQL...");
    for (const u of DEFAULT_USERS) {
      await mysqlPool.query(
        "INSERT INTO `users` (`id`, `name`, `email`, `password`, `role`, `createdAt`) VALUES (?, ?, ?, ?, ?, ?)",
        [u.id, u.name, u.email, u.password, u.role, new Date(u.createdAt)]
      );
    }
  }

  // Seeding default articles if empty
  const [artRows]: any = await mysqlPool.query("SELECT COUNT(*) as cnt FROM `articles`");
  if (artRows[0].cnt === 0) {
    console.log("[Database] Seeding default articles into MySQL...");
    for (const a of defaultArticles) {
      await mysqlPool.query(
        "INSERT INTO `articles` (`id`, `title`, `subtitle`, `category`, `content`, `author`, `date`, `image`, `reads`, `likes`, `views`, `status`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [a.id, a.title, a.subtitle, a.category, a.content, a.author, new Date(a.date), a.image, a.reads, a.likes, a.views, a.status]
      );
    }
  }

  // Seeding default subscriptions if empty
  const [subRows]: any = await mysqlPool.query("SELECT COUNT(*) as cnt FROM `subscriptions`");
  if (subRows[0].cnt === 0) {
    console.log("[Database] Seeding default subscriptions into MySQL...");
    for (const s of defaultSubscriptions) {
      await mysqlPool.query(
        "INSERT INTO `subscriptions` (`id`, `email`, `date`, `status`) VALUES (?, ?, ?, ?)",
        [s.id, s.email, new Date(s.date), s.status]
      );
    }
  }

  // Seeding default comments if empty
  const [comRows]: any = await mysqlPool.query("SELECT COUNT(*) as cnt FROM `comments`");
  if (comRows[0].cnt === 0) {
    console.log("[Database] Seeding default comments into MySQL...");
    for (const c of defaultComments) {
      await mysqlPool.query(
        "INSERT INTO `comments` (`id`, `articleId`, `articleTitle`, `author`, `content`, `date`, `status`, \`flagReason\`, \`isAiModerated\`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [c.id, c.articleId, c.articleTitle, c.author, c.content, new Date(c.date), c.status, c.flagReason || null, c.isAiModerated ? 1 : 0]
      );
    }
  }

  // Seeding default events if empty
  const [evRows]: any = await mysqlPool.query("SELECT COUNT(*) as cnt FROM `events`");
  if (evRows[0].cnt === 0) {
    console.log("[Database] Seeding default events into MySQL...");
    for (const e of defaultEvents) {
      await mysqlPool.query(
        "INSERT INTO \`events\` (\`id\`, \`articleId\`, \`eventType\`, \`timestamp\`, \`durationSeconds\`, \`country\`, \`device\`) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [e.id, e.articleId || null, e.eventType, new Date(e.timestamp), e.durationSeconds || null, e.country || null, e.device || null]
      );
    }
  }

  // Seeding default ads if empty
  const [adRows]: any = await mysqlPool.query("SELECT COUNT(*) as cnt FROM `ads`");
  if (adRows[0].cnt === 0) {
    console.log("[Database] Seeding default advertisements into MySQL...");
    for (const ad of DEFAULT_ADS) {
      await mysqlPool.query(
        "INSERT INTO `ads` (`id`, `title`, `imageUrl`, `linkUrl`, \`slot\`, \`status\`, `views`, `clicks`, `createdAt`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [ad.id, ad.title, ad.imageUrl, ad.linkUrl, ad.slot, ad.status, ad.views || 0, ad.clicks || 0, new Date(ad.createdAt)]
      );
    }
  }
}

// Load JSON Database fallback helper
function loadJsonDatabase() {
  try {
    const data = JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
    return {
      users: data.users || [],
      articles: data.articles || [],
      subscriptions: data.subscriptions || [],
      comments: data.comments || [],
      newsletters: data.newsletters || [],
      events: data.events || [],
      ads: data.ads || [],
      categories: data.categories || []
    };
  } catch (e) {
    console.error("Error loading JSON Database, using blank arrays", e);
    return { users: [], articles: [], subscriptions: [], comments: [], newsletters: [], events: [], ads: [], categories: [] };
  }
}

function saveJsonDatabase(db: any) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf-8");
  } catch (err) {
    console.error("Error saving JSON database file", err);
  }
}

// Unified Database APIs

export async function getUsers(): Promise<any[]> {
  if (isMysqlConnected && mysqlPool) {
    const [rows]: any = await mysqlPool.query("SELECT * FROM `users` ORDER BY `createdAt` DESC");
    return rows;
  } else {
    return loadJsonDatabase().users;
  }
}

export async function saveUser(user: any): Promise<void> {
  if (isMysqlConnected && mysqlPool) {
    await mysqlPool.query(
      "INSERT INTO `users` (`id`, `name`, `email`, `password`, `role`, `createdAt`) VALUES (?, ?, ?, ?, ?, ?)",
      [user.id, user.name, user.email, user.password, user.role, new Date(user.createdAt)]
    );
  } else {
    const db = loadJsonDatabase();
    db.users.push(user);
    saveJsonDatabase(db);
  }
}

export async function getUserByEmail(email: string): Promise<any | null> {
  if (isMysqlConnected && mysqlPool) {
    const [rows]: any = await mysqlPool.query("SELECT * FROM `users` WHERE `email` = ?", [email]);
    return rows.length > 0 ? rows[0] : null;
  } else {
    const db = loadJsonDatabase();
    return db.users.find((u: any) => u.email.toLowerCase() === email.toLowerCase()) || null;
  }
}

export async function getArticles(): Promise<Article[]> {
  if (isMysqlConnected && mysqlPool) {
    const [rows]: any = await mysqlPool.query("SELECT * FROM `articles` ORDER BY `date` DESC");
    return rows.map((r: any) => ({
      ...r,
      author: (r.author && r.author.includes('অটো-সংগ্রাহক')) ? 'নিজস্ব প্রতিবেদক' : (r.author || 'নিজস্ব প্রতিবেদক'),
      reads: parseInt(r.reads || 0),
      likes: parseInt(r.likes || 0),
      views: parseInt(r.views || 0)
    }));
  } else {
    const articles = loadJsonDatabase().articles;
    return articles.map((a: Article) => ({
      ...a,
      author: (a.author && a.author.includes('অটো-সংগ্রাহক')) ? 'নিজস্ব প্রতিবেদক' : (a.author || 'নিজস্ব প্রতিবেদক')
    }));
  }
}

export async function searchArticles(keywords: string): Promise<Article[]> {
  if (isMysqlConnected && mysqlPool) {
    const searchPattern = `%${keywords}%`;
    const [rows]: any = await mysqlPool.query(
      "SELECT * FROM `articles` WHERE `title` LIKE ? OR `content` LIKE ? ORDER BY `date` DESC",
      [searchPattern, searchPattern]
    );
    return rows.map((r: any) => ({
      ...r,
      reads: parseInt(r.reads || 0),
      likes: parseInt(r.likes || 0),
      views: parseInt(r.views || 0)
    }));
  } else {
    const db = loadJsonDatabase();
    const query = keywords.toLowerCase();
    return db.articles.filter((art: Article) =>
      art.title.toLowerCase().includes(query) ||
      art.content.toLowerCase().includes(query)
    );
  }
}

export async function saveArticle(a: Article): Promise<void> {
  const sanitizedAuthor = (a.author && a.author.includes('অটো-সংগ্রাহক')) ? 'নিজস্ব প্রতিবেদক' : (a.author || 'নিজস্ব প্রতিবেদক');
  const articleToSave = { ...a, author: sanitizedAuthor };

  if (isMysqlConnected && mysqlPool) {
    await mysqlPool.query(
      "INSERT INTO `articles` (`id`, `title`, `subtitle`, `category`, `content`, `author`, `date`, `image`, `reads`, `likes`, `views`, `status`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [articleToSave.id, articleToSave.title, articleToSave.subtitle, articleToSave.category, articleToSave.content, articleToSave.author, new Date(articleToSave.date), articleToSave.image, articleToSave.reads || 0, articleToSave.likes || 0, articleToSave.views || 0, articleToSave.status]
    );
  } else {
    const db = loadJsonDatabase();
    db.articles.unshift(articleToSave);
    saveJsonDatabase(db);
  }
}

export async function updateArticle(id: string, a: Partial<Article>): Promise<Article | null> {
  if (isMysqlConnected && mysqlPool) {
    const fields: string[] = [];
    const params: any[] = [];
    
    Object.keys(a).forEach(key => {
      if (key !== 'id') {
        fields.push(`\`${key}\` = ?`);
        if (key === 'date') {
          params.push(new Date(a[key] as string));
        } else {
          params.push(a[key as keyof Article]);
        }
      }
    });

    if (fields.length === 0) return null;

    params.push(id);
    await mysqlPool.query(`UPDATE \`articles\` SET ${fields.join(", ")} WHERE \`id\` = ?`, params);

    const [rows]: any = await mysqlPool.query("SELECT * FROM `articles` WHERE `id` = ?", [id]);
    return rows.length > 0 ? rows[0] : null;
  } else {
    const db = loadJsonDatabase();
    const idx = db.articles.findIndex((art: any) => art.id === id);
    if (idx === -1) return null;

    db.articles[idx] = {
      ...db.articles[idx],
      ...a,
      id
    };
    saveJsonDatabase(db);
    return db.articles[idx];
  }
}

export async function deleteArticle(id: string): Promise<boolean> {
  if (isMysqlConnected && mysqlPool) {
    await mysqlPool.query("DELETE FROM `articles` WHERE `id` = ?", [id]);
    await mysqlPool.query("DELETE FROM `comments` WHERE `articleId` = ?", [id]);
    await mysqlPool.query("DELETE FROM `events` WHERE `articleId` = ?", [id]);
    return true;
  } else {
    const db = loadJsonDatabase();
    db.articles = db.articles.filter((a: any) => a.id !== id);
    db.comments = db.comments.filter((c: any) => c.articleId !== id);
    db.events = db.events.filter((e: any) => e.articleId !== id);
    saveJsonDatabase(db);
    return true;
  }
}

export async function getSubscriptions(): Promise<Subscription[]> {
  if (isMysqlConnected && mysqlPool) {
    const [rows]: any = await mysqlPool.query("SELECT * FROM `subscriptions` ORDER BY `date` DESC");
    return rows;
  } else {
    return loadJsonDatabase().subscriptions;
  }
}

export async function saveSubscription(s: Subscription): Promise<void> {
  if (isMysqlConnected && mysqlPool) {
    await mysqlPool.query(
      "INSERT INTO `subscriptions` (`id`, \`email\`, \`date\`, \`status\`) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE \`status\` = ?, \`date\` = ?",
      [s.id, s.email, new Date(s.date), s.status, s.status, new Date(s.date)]
    );
  } else {
    const db = loadJsonDatabase();
    const existingIdx = db.subscriptions.findIndex((item: any) => item.email.toLowerCase() === s.email.toLowerCase());
    if (existingIdx !== -1) {
      db.subscriptions[existingIdx] = s;
    } else {
      db.subscriptions.push(s);
    }
    saveJsonDatabase(db);
  }
}

export async function getComments(): Promise<Comment[]> {
  if (isMysqlConnected && mysqlPool) {
    const [rows]: any = await mysqlPool.query("SELECT * FROM `comments` ORDER BY `date` ASC");
    return rows.map((r: any) => ({
      ...r,
      isAiModerated: !!r.isAiModerated
    }));
  } else {
    return loadJsonDatabase().comments;
  }
}

export async function saveComment(c: Comment): Promise<void> {
  if (isMysqlConnected && mysqlPool) {
    await mysqlPool.query(
      "INSERT INTO `comments` (`id`, `articleId`, \`articleTitle\`, \`author\`, `content`, `date`, `status`, \`flagReason\`, \`isAiModerated\`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [c.id, c.articleId, c.articleTitle, c.author, c.content, new Date(c.date), c.status, c.flagReason || null, c.isAiModerated ? 1 : 0]
    );
  } else {
    const db = loadJsonDatabase();
    db.comments.push(c);
    saveJsonDatabase(db);
  }
}

export async function updateComment(id: string, updates: Partial<Comment>): Promise<Comment | null> {
  if (isMysqlConnected && mysqlPool) {
    const fields: string[] = [];
    const params: any[] = [];
    
    Object.keys(updates).forEach(key => {
      if (key !== 'id') {
        fields.push(`\`${key}\` = ?`);
        if (key === 'isAiModerated') {
          params.push(updates[key] ? 1 : 0);
        } else if (key === 'date') {
          params.push(new Date(updates[key] as string));
        } else {
          params.push(updates[key as keyof Comment]);
        }
      }
    });

    if (fields.length === 0) return null;
    params.push(id);
    await mysqlPool.query(`UPDATE \`comments\` SET ${fields.join(", ")} WHERE \`id\` = ?`, params);

    const [rows]: any = await mysqlPool.query("SELECT * FROM `comments` WHERE \`id\` = ?", [id]);
    return rows.length > 0 ? rows[0] : null;
  } else {
    const db = loadJsonDatabase();
    const comment = db.comments.find((c: any) => c.id === id);
    if (!comment) return null;

    Object.assign(comment, updates);
    saveJsonDatabase(db);
    return comment;
  }
}

export async function deleteComment(id: string): Promise<boolean> {
  if (isMysqlConnected && mysqlPool) {
    await mysqlPool.query("DELETE FROM `comments` WHERE `id` = ?", [id]);
    return true;
  } else {
    const db = loadJsonDatabase();
    db.comments = db.comments.filter((c: any) => c.id !== id);
    saveJsonDatabase(db);
    return true;
  }
}

export async function getEvents(): Promise<LoggedEvent[]> {
  if (isMysqlConnected && mysqlPool) {
    const [rows]: any = await mysqlPool.query("SELECT * FROM `events` ORDER BY `timestamp` ASC");
    return rows;
  } else {
    return loadJsonDatabase().events;
  }
}

export async function saveEvent(e: LoggedEvent): Promise<void> {
  if (isMysqlConnected && mysqlPool) {
    await mysqlPool.query(
      "INSERT INTO `events` (`id`, `articleId`, `eventType`, `timestamp`, `durationSeconds`, `country`, `device`) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [e.id, e.articleId || null, e.eventType, new Date(e.timestamp), e.durationSeconds || null, e.country || null, e.device || null]
    );
  } else {
    const db = loadJsonDatabase();
    db.events.push(e);
    saveJsonDatabase(db);
  }
}

export async function getNewsletters(): Promise<Newsletter[]> {
  if (isMysqlConnected && mysqlPool) {
    const [rows]: any = await mysqlPool.query("SELECT * FROM `newsletters` ORDER BY `sentAt` DESC");
    return rows.map((r: any) => {
      let articleIds: string[] = [];
      try {
        articleIds = r.articleIds ? r.articleIds.split(",") : [];
      } catch (err) {
        articleIds = [];
      }
      return {
        ...r,
        articleIds,
        subscriberCount: parseInt(r.subscriberCount || 0)
      };
    });
  } else {
    return loadJsonDatabase().newsletters;
  }
}

export async function saveNewsletter(n: Newsletter): Promise<void> {
  if (isMysqlConnected && mysqlPool) {
    const articleIdsStr = n.articleIds ? n.articleIds.join(",") : "";
    await mysqlPool.query(
      "INSERT INTO `newsletters` (`id`, `subject`, `content`, `articleIds`, `sentAt`, `subscriberCount`) VALUES (?, ?, ?, ?, ?, ?)",
      [n.id, n.subject, n.content, articleIdsStr, new Date(n.sentAt), n.subscriberCount]
    );
  } else {
    const db = loadJsonDatabase();
    db.newsletters = db.newsletters || [];
    db.newsletters.unshift(n);
    saveJsonDatabase(db);
  }
}

// Check database mode
export function getDbMode(): { isMysql: boolean; dbFile?: string; error?: string | null } {
  return {
    isMysql: isMysqlConnected,
    dbFile: isMysqlConnected ? undefined : DB_FILE,
    error: mysqlConnectionError
  };
}

export async function getAds(): Promise<Advertisement[]> {
  if (isMysqlConnected && mysqlPool) {
    const [rows]: any = await mysqlPool.query("SELECT * FROM `ads` ORDER BY `createdAt` DESC");
    return rows.map((r: any) => ({
      ...r,
      views: parseInt(r.views || 0),
      clicks: parseInt(r.clicks || 0)
    }));
  } else {
    return loadJsonDatabase().ads;
  }
}

export async function saveAd(ad: Advertisement): Promise<void> {
  if (isMysqlConnected && mysqlPool) {
    await mysqlPool.query(
      "INSERT INTO `ads` (`id`, `title`, `imageUrl`, `linkUrl`, `slot`, `status`, `views`, `clicks`, `createdAt`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [ad.id, ad.title, ad.imageUrl, ad.linkUrl, ad.slot, ad.status, ad.views || 0, ad.clicks || 0, new Date(ad.createdAt)]
    );
  } else {
    const db = loadJsonDatabase();
    db.ads = db.ads || [];
    db.ads.unshift(ad);
    saveJsonDatabase(db);
  }
}

export async function updateAd(id: string, updates: Partial<Advertisement>): Promise<Advertisement | null> {
  if (isMysqlConnected && mysqlPool) {
    const fields: string[] = [];
    const params: any[] = [];
    
    Object.keys(updates).forEach(key => {
      if (key !== 'id') {
        fields.push(`\`${key}\` = ?`);
        if (key === 'createdAt') {
          params.push(new Date(updates[key] as string));
        } else {
          params.push(updates[key as keyof Advertisement]);
        }
      }
    });

    if (fields.length === 0) return null;
    params.push(id);
    await mysqlPool.query(`UPDATE \`ads\` SET ${fields.join(", ")} WHERE \`id\` = ?`, params);

    const [rows]: any = await mysqlPool.query("SELECT * FROM `ads` WHERE `id` = ?", [id]);
    return rows.length > 0 ? rows[0] : null;
  } else {
    const db = loadJsonDatabase();
    const ad = db.ads.find((item: any) => item.id === id);
    if (!ad) return null;

    Object.assign(ad, updates);
    saveJsonDatabase(db);
    return ad;
  }
}

export async function deleteAd(id: string): Promise<boolean> {
  if (isMysqlConnected && mysqlPool) {
    await mysqlPool.query("DELETE FROM `ads` WHERE `id` = ?", [id]);
    return true;
  } else {
    const db = loadJsonDatabase();
    db.ads = db.ads.filter((item: any) => item.id !== id);
    saveJsonDatabase(db);
    return true;
  }
}

export async function incrementAdMetric(id: string, metric: 'views' | 'clicks'): Promise<void> {
  if (isMysqlConnected && mysqlPool) {
    if (metric === 'views') {
      await mysqlPool.query("UPDATE `ads` SET `views` = `views` + 1 WHERE `id` = ?", [id]);
    } else {
      await mysqlPool.query("UPDATE `ads` SET `clicks` = `clicks` + 1 WHERE `id` = ?", [id]);
    }
  } else {
    const db = loadJsonDatabase();
    const ad = db.ads.find((item: any) => item.id === id);
    if (ad) {
      if (metric === 'views') ad.views = (ad.views || 0) + 1;
      else ad.clicks = (ad.clicks || 0) + 1;
      saveJsonDatabase(db);
    }
  }
}

export async function getCategories(): Promise<Category[]> {
  if (isMysqlConnected && mysqlPool) {
    const [rows]: any = await mysqlPool.query("SELECT * FROM `categories` ORDER BY `name` ASC");
    return rows;
  } else {
    return loadJsonDatabase().categories || [];
  }
}

export async function saveCategory(cat: Category): Promise<void> {
  if (isMysqlConnected && mysqlPool) {
    await mysqlPool.query(
      "INSERT INTO `categories` (`id`, `name`, \`slug\`, \`createdAt\`) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE \`name\` = ?, \`slug\` = ?",
      [cat.id, cat.name, cat.slug, new Date(cat.createdAt), cat.name, cat.slug]
    );
  } else {
    const db = loadJsonDatabase();
    if (!db.categories) db.categories = [];
    const index = db.categories.findIndex((c: any) => c.id === cat.id);
    if (index >= 0) {
      db.categories[index] = cat;
    } else {
      db.categories.push(cat);
    }
    saveJsonDatabase(db);
  }
}

export async function deleteCategory(id: string): Promise<boolean> {
  if (isMysqlConnected && mysqlPool) {
    await mysqlPool.query("DELETE FROM `categories` WHERE `id` = ?", [id]);
    return true;
  } else {
    const db = loadJsonDatabase();
    if (!db.categories) db.categories = [];
    db.categories = db.categories.filter((c: any) => c.id !== id);
    saveJsonDatabase(db);
    return true;
  }
}
