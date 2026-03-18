import { useState } from "react";
import { PhishScoreLogo } from "./Primitives";

const FAQS = [
  { q: "What is PhishScore.ai?", a: "PhishScore.ai is a free community-powered scam detection tool. Paste or screenshot any suspicious message - email, text, social media DM, or letter - and our AI instantly scores the likelihood it is a scam from 0 to 100, explains why, and tells you what to do." },
  { q: "What types of scams can I submit?", a: "Any suspicious communication: publishing scams (fake literary agents, vanity presses), delivery scams (fake USPS/FedEx texts), retail scams (fake Amazon alerts), phone carrier scams (fake rewards texts), traffic and toll notices, social media phishing, banking alerts, IRS impersonation, prize and lottery fraud, romance scams, fake job offers, tech support scams, travel and vacation scams, and political campaign scams. Not sure what type? Select Other / Not Sure and the AI will figure out the category automatically." },
  { q: "What happens when I select Other / Not Sure?", a: "Selecting Other / Not Sure tells the AI to determine the category itself. After analyzing the message, if the AI is 70% or more confident, it automatically assigns the most likely category. The submission appears in the dashboard under that detected category with a small AUTO label. If the AI is not confident enough, the submission stays listed under Other. Additionally, even if you select a specific category, if the AI is 85% or more confident the content actually belongs to a different category, it will automatically reclassify it and show a RECLASSIFIED label." },
  { q: "What is the difference between Public, Private, and Anonymous?", a: "Private is the default and recommended setting - your score and category appear in the community feed but message content and sender are never shown publicly. Public submissions share full details to help the community and are best when your message contains no personal info. Anonymous submissions store nothing after analysis - only score and category briefly appear in the feed." },
  { q: "How do I submit for the best results?", a: "The more information you include, the better the score. Include the full message text, the sender email or phone number, and the subject line if it is an email. For texts, include the full phone number. For emails, including the email headers (see below) gives the most accurate analysis." },
  { q: "What are email headers and how do I find them?", a: "Email headers are hidden technical data that show the true origin of an email, even if the sender name looks legitimate. In Gmail: open the email, click the three dots menu, click Show original. In Apple Mail: open the email, go to View menu, then Message, then All Headers. In Outlook: open the email, click File, then Properties. Copy all of that text and paste it into PhishScore along with the message body for the most accurate analysis." },
  { q: "Why should I include the sender address?", a: "Scammers often disguise their real email address. The display name might say Apple Support but the actual address is random-letters@suspicious-domain.net. Including the full sender address helps our AI spot spoofed domains, lookalike addresses, and known scam infrastructure." },
  { q: "Can I upload a screenshot instead of typing?", a: "Yes. Use the Upload Screenshot option in the submission flow. Our AI will read all visible text in the image including sender information, logos, links, and message content. This is especially useful for text message scams that are easier to screenshot than type out." },
  { q: "Is my data safe?", a: "Public and Private submissions store the message content and source in our database to power the community dashboard. Anonymous submissions store nothing after analysis. We never sell data or share it with third parties. Contact us at contact@phishscore.ai to request removal." },
  { q: "What does the score mean?", a: "The score is the AI's estimated probability that the message is a scam, from 0 to 100. A score of 75 or above is flagged as SCAM. Between 45 and 74 is SUSPICIOUS and worth treating with caution. Below 45 is LIKELY SAFE, though no automated tool is perfect and you should always trust your instincts." },
  { q: "What external databases does PhishScore use?", a: "PhishScore checks submitted URLs against three independent threat intelligence databases: Google Safe Browsing, Cloudflare Radar, and URLhaus. When any of these databases flag a URL in your submission, the score is automatically adjusted and the source is shown in your result." },
  { q: "Why does the community feed only show a limited number of submissions?", a: "The default dashboard view shows the 3 most recent community submissions from the last 20 to keep the feed fast and focused. This keeps load times fast as the database grows and ensures you are always seeing the most relevant and recent intelligence." },
  { q: "Can I report a scam that already happened to me?", a: "Yes. Submit the original message even if you already fell for it. Your submission helps others recognize the same scam and may help identify patterns. For financial fraud, also report to the FTC at reportfraud.ftc.gov, the FBI at ic3.gov, and your bank immediately." },
];

function FAQItem({ q, a, T }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ background: T.innerBg, border: `1px solid ${T.innerBorder}`, borderRadius: 10, overflow: "hidden" }}>
      <button onClick={() => setOpen(!open)} style={{ width: "100%", padding: "14px 18px", background: "none", border: "none", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: T.text, fontFamily: "monospace", textAlign: "left", lineHeight: 1.4 }}>{q}</span>
        <span style={{ color: "#f43f5e", fontSize: 16, flexShrink: 0, fontFamily: "monospace", display: "inline-block", transform: open ? "rotate(45deg)" : "rotate(0)", transition: "transform 0.2s" }}>+</span>
      </button>
      {open && (
        <div style={{ padding: "0 18px 16px", color: T.text2, fontSize: 13, fontFamily: "Georgia, serif", lineHeight: 1.8, borderTop: `1px solid ${T.innerBorder}` }}>
          <div style={{ paddingTop: 14 }}>{a}</div>
        </div>
      )}
    </div>
  );
}

// FIX: now accepts T prop and uses it throughout instead of hardcoded dark colors
export default function FAQPage({ onClose, T = {} }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)", backdropFilter: "blur(14px)", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 300, padding: 16, overflowY: "auto" }}>
      <div style={{ background: T.cardBg, border: `1px solid ${T.cardBorder}`, borderRadius: 20, width: "100%", maxWidth: 700, padding: 40, position: "relative", margin: "20px 0" }}>
        <button onClick={onClose} style={{ position: "absolute", top: 16, right: 16, background: T.innerBg, border: `1px solid ${T.innerBorder}`, color: T.text3, width: 32, height: 32, borderRadius: "50%", cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>x</button>

        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 10, letterSpacing: 4, color: "#f43f5e", fontFamily: "monospace", marginBottom: 10 }}>HELP CENTER</div>
          <div style={{ marginBottom: 8 }}>
            <PhishScoreLogo T={T} size={24} dotSize={13} />
            <span style={{ fontSize: 24, fontWeight: 800, fontFamily: "monospace", color: T.text3, letterSpacing: 1 }}> FAQ</span>
          </div>
          <p style={{ color: T.text3, fontFamily: "Georgia, serif", fontSize: 14, lineHeight: 1.7, margin: 0 }}>
            Everything you need to know about submitting scams, protecting your privacy, and getting the most accurate results.
          </p>
        </div>

        <div style={{ background: T.innerBg, border: "1px solid #34d39930", borderRadius: 12, padding: 20, marginBottom: 32 }}>
          <div style={{ fontSize: 10, letterSpacing: 3, color: "#34d399", fontFamily: "monospace", marginBottom: 12 }}>TIPS FOR BEST RESULTS</div>
          {["Include the full sender address, not just the display name", "For emails, paste the email headers for deepest analysis", "Include the complete message - subject, body, any links", "For texts, include the full phone number with country code", "Submissions default to Private to protect your privacy", "Not sure of the type? Select Other and AI will auto-classify it"].map((tip, i) => (
            <div key={i} style={{ display: "flex", gap: 10, marginBottom: i < 5 ? 8 : 0 }}>
              <span style={{ color: "#34d399", flexShrink: 0, fontFamily: "monospace" }}>0{i + 1}</span>
              <span style={{ color: T.text2, fontSize: 13, fontFamily: "Georgia, serif", lineHeight: 1.5 }}>{tip}</span>
            </div>
          ))}
        </div>

        <div style={{ background: T.innerBg, border: "1px solid #38bdf830", borderRadius: 12, padding: 20, marginBottom: 32 }}>
          <div style={{ fontSize: 10, letterSpacing: 3, color: "#38bdf8", fontFamily: "monospace", marginBottom: 12 }}>HOW TO FIND EMAIL HEADERS</div>
          {[
            { client: "Gmail", steps: "Open email > Three dots menu (...) > Show original > Copy all" },
            { client: "Apple Mail", steps: "Open email > View menu > Message > All Headers > Copy all" },
            { client: "Outlook", steps: "Open email > File > Properties > Internet headers box > Copy all" },
            { client: "Yahoo Mail", steps: "Open email > Three dots menu > View raw message > Copy all" },
          ].map((item, i) => (
            <div key={i} style={{ display: "flex", gap: 12, marginBottom: i < 3 ? 10 : 0, alignItems: "flex-start" }}>
              <span style={{ fontSize: 10, color: "#38bdf8", fontFamily: "monospace", fontWeight: 700, whiteSpace: "nowrap", minWidth: 80 }}>{item.client}</span>
              <span style={{ color: T.text2, fontSize: 12, fontFamily: "Georgia, serif", lineHeight: 1.5 }}>{item.steps}</span>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {FAQS.map((faq, i) => <FAQItem key={i} q={faq.q} a={faq.a} T={T} />)}
        </div>

        <div style={{ marginTop: 32, paddingTop: 24, borderTop: `1px solid ${T.cardBorder}`, textAlign: "center" }}>
          <div style={{ fontSize: 11, color: T.text3, fontFamily: "monospace", marginBottom: 8 }}>STILL HAVE QUESTIONS?</div>
          <a href="mailto:contact@phishscore.ai" style={{ color: "#f43f5e", fontFamily: "monospace", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>contact@phishscore.ai</a>
        </div>
      </div>
    </div>
  );
}
