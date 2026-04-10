import { SUPABASE_URL, SUPABASE_KEY } from "./constants";

const db = {
  async getSubmissions() {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/submissions?order=created_at.desc&limit=1000`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
    });
    return res.json();
  },

  async getQuickScans() {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/quick_scans?select=id,input_type,ai_score,ai_category,created_at&order=created_at.desc&limit=50`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
    });
    return res.json();
  },

  async checkDuplicate(preview) {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/submissions?select=preview,score,tags,category,created_at&order=created_at.desc&limit=50`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
      });
      const data = await res.json();
      if (!Array.isArray(data)) return null;
      const words = preview.toLowerCase().split(/\s+/).filter(w => w.length > 5);
      for (const sub of data) {
        if (!sub.preview) continue;
        const subWords = sub.preview.toLowerCase().split(/\s+/).filter(w => w.length > 5);
        const matches = words.filter(w => subWords.includes(w)).length;
        const similarity = words.length > 0 ? matches / words.length : 0;
        if (similarity > 0.5) return sub;
      }
    } catch {}
    return null;
  },

  async insertSubmission(data) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/submissions`, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(data)
    });
    return res.json();
  }
};

export default db;
