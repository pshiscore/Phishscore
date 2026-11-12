const db = {
  // Served by /api/get-submissions (service key) so anon SELECT on the table can
  // be revoked; private rows arrive with preview and source already removed.
  async getSubmissions() {
    const res = await fetch('/api/get-submissions');
    if (!res.ok) {
      console.warn('[db] get-submissions returned', res.status);
      return [];
    }
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  },

  async getQuickScans() {
    const res = await fetch('/api/get-quick-scans');
    if (!res.ok) {
      console.warn('[db] get-quick-scans returned', res.status);
      return [];
    }
    const data = await res.json();
    if (!Array.isArray(data)) {
      console.warn('[db] get-quick-scans unexpected response:', data);
      return [];
    }
    return data;
  },

  // The similarity match now runs in /api/check-duplicate against recent rows
  // (private ones included) and returns only score/tags/category/created_at.
  async checkDuplicate(preview) {
    try {
      const res = await fetch('/api/check-duplicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preview }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data?.match || null;
    } catch {}
    return null;
  },
  // Submissions are saved by /api/analyze (service key) — see src/submissionRow.js.
};

export default db;
