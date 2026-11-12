// reCAPTCHA v3 token for a server-verified action. The script is loaded in
// public/index.html; this waits briefly for it, then returns null if it never
// arrived (blocked by an extension, offline). The server refuses requests
// without a valid token, so callers should stop and tell the user.

const SCRIPT_WAIT_MS = 5000;
const EXECUTE_TIMEOUT_MS = 8000;

export async function getRecaptchaToken(action) {
  const siteKey = process.env.REACT_APP_RECAPTCHA_SITE_KEY;
  if (!siteKey || typeof window === 'undefined') return null;

  const started = Date.now();
  while (!window.grecaptcha?.ready && Date.now() - started < SCRIPT_WAIT_MS) {
    await new Promise(r => setTimeout(r, 100));
  }
  if (!window.grecaptcha?.ready) return null;

  const token = new Promise((resolve) => {
    try {
      window.grecaptcha.ready(() => {
        window.grecaptcha.execute(siteKey, { action }).then(resolve, () => resolve(null));
      });
    } catch { resolve(null); }
  });
  const timeout = new Promise(resolve => setTimeout(() => resolve(null), EXECUTE_TIMEOUT_MS));
  return Promise.race([token, timeout]);
}
