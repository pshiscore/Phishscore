import { FLAG_LABELS } from "./constants";

export function maskPhone(phone) {
const cleaned = phone.trim();
let result = cleaned, replaced = 0;
for (let i = result.length - 1; i >= 0 && replaced < 4; i–) {
if (/\d/.test(result[i])) { result = result.slice(0, i) + "*" + result.slice(i + 1); replaced++; }
}
return result;
}

export function maskEmail(email) {
const atIdx = email.indexOf("@");
if (atIdx < 0) return email;
const user = email.slice(0, atIdx), domain = email.slice(atIdx), len = user.length;
let masked;
if (len <= 3) masked = user;
else if (len <= 6) masked = user[0] + "*".repeat(len - 2) + user[len - 1];
else if (len <= 12) masked = user.slice(0, 2) + "*".repeat(len - 3) + user[len - 1];
else masked = user.slice(0, 2) + "*".repeat(Math.min(len - 3, 10)) + user[len - 1];
return masked + domain;
}

export function maskName(name) {
return name.trim().split(/\s+/).map(word => {
if (word.length <= 1) return word;
return word[0] + "*".repeat(Math.min(word.length - 1, 5));
}).join(" ");
}

export function isLikelyName(str) {
const parts = str.trim().split(/\s+/);
if (parts.length < 2) return false;
if (/[\d@]/.test(str)) return false;
if (str.includes(".com") || str.includes(".net") || str.includes(".org")) return false;
return parts.every(p => p.length >= 2 && /^[A-Z]/.test(p));
}

export function parseSingleSource(source) {
if (!source || source === "user-submitted") return { label: "Anonymous", platform: null, flag: null };
const cleanSource = source.trim().toLowerCase();
const phonePatterns = [
{ regex: /^+91|^0091/, country: "India", flag: "IN" },
{ regex: /^+234|^00234/, country: "Nigeria", flag: "NG" },
{ regex: /^+44|^0044/, country: "UK", flag: "GB" },
{ regex: /^+1[2-9]/, country: "USA", flag: "US" },
{ regex: /^+63|^0063/, country: "Philippines", flag: "PH" },
{ regex: /^+86|^0086/, country: "China", flag: "CN" },
{ regex: /^+7|^007/, country: "Russia", flag: "RU" },
{ regex: /^+55|^0055/, country: "Brazil", flag: "BR" },
{ regex: /^+\d{1,3}/, country: "Intl", flag: null },
];
if (/^[+\d\s-()]{7,}$/.test(source.trim())) {
const masked = maskPhone(source.trim());
for (const p of phonePatterns) {
if (p.regex.test(source.trim())) return { label: masked, platform: `${p.country} Phone`, flag: p.flag, type: "phone" };
}
return { label: masked, platform: "Phone", flag: null, type: "phone" };
}
if (cleanSource.includes("@")) {
const domain = cleanSource.split("@")[1] || "";
const masked = maskEmail(source.trim());
const knownProviders = { "gmail.com": { name: "Gmail", color: "#ea4335" }, "yahoo.com": { name: "Yahoo", color: "#6001d2" }, "hotmail.com": { name: "Hotmail", color: "#0072c6" }, "outlook.com": { name: "Outlook", color: "#0072c6" }, "icloud.com": { name: "iCloud", color: "#3478f6" }, "aol.com": { name: "AOL", color: "#ff0b00" }, "protonmail.com": { name: "ProtonMail", color: "#6d4aff" }, "me.com": { name: "iCloud", color: "#3478f6" } };
if (knownProviders[domain]) return { label: masked, platform: knownProviders[domain].name, platformColor: knownProviders[domain].color, flag: null, type: "email" };
const suspicious = ["amazon-", "apple-", "paypal-", "microsoft-", "google-", "irs-", "usps-", "fedex-", "ups-", "chase-", "wells-", "bank"];
const isSuspicious = suspicious.some(s => domain.includes(s));
return { label: masked, platform: isSuspicious ? "Fake Domain" : domain, flag: null, type: "email", suspicious: isSuspicious };
}
if (source.trim().startsWith("http://") || source.trim().startsWith("https://")) {
try {
const url = new URL(source.trim());
const cleanDomain = url.hostname.replace(/^www./, "");
const suspicious = ["amazon-", "apple-", "paypal-", "microsoft-", "google-", "irs-", "usps-", "fedex-", "ups-", "chase-", "wells-", "bank"];
const isSuspicious = suspicious.some(s => cleanDomain.includes(s));
return { label: cleanDomain, platform: isSuspicious ? "Fake Domain" : "URL", flag: null, type: "email", suspicious: isSuspicious };
} catch {}
}
if (/^\d{5,6}$/.test(source.trim())) return { label: source, platform: "SMS Shortcode", flag: null, type: "sms" };
if (isLikelyName(source.trim())) return { label: maskName(source.trim()), platform: "Name", flag: null, type: "name" };
return { label: source, platform: null, flag: null, type: "text" };
}

export function parseSource(source) {
if (!source || source === "user-submitted") return [{ label: "Anonymous", platform: null, flag: null }];
try {
const arr = JSON.parse(source);
if (Array.isArray(arr)) return arr.map(s => parseSingleSource(s)).filter(p => p.label !== "Anonymous");
} catch {}
return [parseSingleSource(source)];
}
