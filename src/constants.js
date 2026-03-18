export const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
export const SUPABASE_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;

export const SCAM_CATEGORIES = [
  { id: "publishing", label: "Publishing & Literary", icon: "book", color: "#a78bfa", description: "Fake agents, vanity presses, contest mills" },
  { id: "delivery", label: "Package & Delivery", icon: "package", color: "#fb923c", description: "FedEx, UPS, USPS, DHL fake notices" },
  { id: "retail", label: "Retail & Shopping", icon: "cart", color: "#34d399", description: "Amazon, eBay, online store scams" },
  { id: "telecom", label: "Phone & Telecom", icon: "phone", color: "#38bdf8", description: "T-Mobile, Verizon, AT&T points/rewards scams" },
  { id: "traffic", label: "Traffic & Tolls", icon: "car", color: "#f43f5e", description: "Fake speeding tickets, toll violations, parking" },
  { id: "social", label: "Social Media", icon: "chat", color: "#e879f9", description: "Instagram, Facebook, TikTok, Twitter scams" },
  { id: "finance", label: "Banking & Finance", icon: "bank", color: "#facc15", description: "Bank alerts, crypto, investment scams" },
  { id: "government", label: "Government & IRS", icon: "gov", color: "#4ade80", description: "IRS, Social Security, Medicare, DMV" },
  { id: "prize", label: "Prize & Lottery", icon: "prize", color: "#fbbf24", description: "You've won!, sweepstakes, gift cards" },
  { id: "romance", label: "Romance & Friendship", icon: "heart", color: "#fb7185", description: "Dating app scams, fake relationships" },
  { id: "job", label: "Job & Employment", icon: "job", color: "#67e8f9", description: "Fake job offers, work from home, pyramid schemes" },
  { id: "tech", label: "Tech Support", icon: "tech", color: "#86efac", description: "Microsoft, Apple, virus alerts, fake support" },
  { id: "political", label: "Political Campaign", icon: "vote", color: "#f97316", description: "Fake fundraising, candidate impersonation, polling scams" },
  { id: "travel", label: "Travel & Vacation", icon: "plane", color: "#2dd4bf", description: "Fake hotels, airline scams, vacation rental fraud, bogus travel deals" },
  { id: "other", label: "Unknown / AI Detect", icon: "other", color: "#94a3b8", description: "Don't know the type? AI will automatically detect and classify your submission" },
];

export const VISIBILITY_OPTIONS = [
  { id: "public", label: "Public", icon: "[ PUB ]", color: "#34d399", short: "Full details visible to everyone", description: "Your submission including the message preview and sender source will be visible to all visitors. Helps the community identify and avoid this scam. Best for scams with no personal information." },
  { id: "private", label: "Private", icon: "[ PRI ]", color: "#38bdf8", short: "Score shown, details hidden", description: "Your score, category, and tags are shown in the community feed but the message preview and source are hidden. Your data is stored securely and used to improve detection. This is the default setting. Good for most submissions." },
  { id: "anonymous", label: "Anonymous", icon: "[ ANO ]", color: "#94a3b8", short: "Nothing stored, score only", description: "Only the score and category are shown. No message content, no source, nothing personal is stored after analysis. Appears as Anonymous in the feed. Use this for sensitive messages like romance scams or financial fraud." }
];

export const THEMES = {
  light: {
    pageBg: "#f8f6f2",
    cardBg: "#ffffff",
    cardBorder: "#e8e4de",
    innerBg: "#f3f0eb",
    innerBorder: "#e8e4de",
    headerBg: "rgba(248,246,242,0.97)",
    headerBorder: "#e8e4de",
    text: "#111827",
    text2: "#374151",
    text3: "#6b7280",
    text4: "#9ca3af",
    ringTrack: "#e5e7eb",
    feedDivider: "#f3f0eb",
    tagBg: "#f3f0eb",
    tagColor: "#6b7280",
    inputBg: "#ffffff",
    inputBorder: "#e8e4de",
    scrollTrack: "#f0ede8",
    scrollThumb: "#c8c4bc",
  },
  dark: {
    pageBg: "#060810",
    cardBg: "#090b14",
    cardBorder: "#1a1d2e",
    innerBg: "#0d0f1a",
    innerBorder: "#1a1d2e",
    headerBg: "rgba(6,8,16,0.95)",
    headerBorder: "#1a1d2e",
    text: "#e2e8f0",
    text2: "#94a3b8",
    text3: "#64748b",
    text4: "#475569",
    ringTrack: "#1a1d2e",
    feedDivider: "#0d0f1a",
    tagBg: "#1a1d2e",
    tagColor: "#475569",
    inputBg: "#0d0f1a",
    inputBorder: "#1a1d2e",
    scrollTrack: "#060810",
    scrollThumb: "#1a1d2e",
  },
};

export const getScoreColor = (s) => s >= 75 ? "#f43f5e" : s >= 45 ? "#fb923c" : "#34d399";
export const getStatusLabel = (s) => s >= 75 ? "SCAM" : s >= 45 ? "SUSPICIOUS" : "LIKELY SAFE";
export const getCat = (id) => SCAM_CATEGORIES.find(c => c.id === id) || SCAM_CATEGORIES[SCAM_CATEGORIES.length - 1];

export const timeAgo = (ts) => {
  const d = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (d < 60) return "just now";
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  return `${Math.floor(d / 86400)}d ago`;
};

export const FLAG_LABELS = { IN: "IN", PK: "PK", NG: "NG", GB: "UK", US: "US", PH: "PH", CN: "CN", RU: "RU", BR: "BR", ZA: "ZA", BD: "BD", ID: "ID" };
