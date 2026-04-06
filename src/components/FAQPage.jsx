import { useState } from "react";
import { PhishScoreLogo } from "./Primitives";

const FAQS = [
  // ── Core product ─────────────────────────────────────────────────────────────
  {
    q: "What is PhishScore.ai?",
    a: "PhishScore.ai is a free community-powered scam detection platform. Paste or screenshot any suspicious message — email, text, social media DM, or letter — and our AI instantly scores the likelihood it is a scam from 0 to 100, explains why, identifies red flags, and tells you what to do. Every submission contributes to a live community intelligence dashboard that helps protect others."
  },
  {
    q: "What types of scams can I submit?",
    a: "Any suspicious communication across 15 categories: Publishing & Literary (fake agents, vanity presses), Package & Delivery (fake USPS/FedEx notices), Retail & Shopping (fake Amazon alerts), Phone & Telecom (carrier reward scams), Traffic & Tolls (fake tickets), Social Media (phishing DMs), Banking & Finance (crypto and bank scams), Government & IRS (IRS impersonation), Prize & Lottery, Romance & Friendship, Job & Employment (fake offers), Tech Support (fake Microsoft/Apple alerts), Political Campaign (fake fundraising), Travel & Vacation (fake hotel and airline deals), and Legal & Compliance (fake court notices, debt collection scams). Not sure of the type? Select Unknown / AI Detect and the AI will classify it automatically."
  },
  {
    q: "What happens when I select Unknown / AI Detect?",
    a: "The AI determines the category itself. If it is 70% or more confident, it assigns the most likely category and marks the submission with an AUTO label in the feed. If it is less certain, the submission stays listed under Other. Even if you pick a specific category, if the AI is 85% or more confident the content belongs to a different one, it will reclassify it and show a RECLASSIFIED label — so you always know when this happens."
  },
  {
    q: "What do the score ranges mean?",
    a: "The score is the AI's estimated probability that the message is a scam, from 0 to 100. A score of 75 or above is flagged as SCAM — treat this message as confirmed fraud. Between 45 and 74 is SUSPICIOUS — proceed with caution and verify before acting. Below 45 is LIKELY SAFE — but no automated tool is perfect, so always trust your instincts if something feels off."
  },

  // ── Submission ────────────────────────────────────────────────────────────────
  {
    q: "How do I get the most accurate score?",
    a: "Include as much context as possible: the full message text, the sender email or phone number, the subject line for emails, and any links. For emails, pasting the email headers alongside the message body gives the deepest analysis: the headers reveal the true sending server even when the display name looks legitimate. For text messages, include the full phone number with country code."
  },
  {
    q: "What are email headers and how do I find them?",
    a: "Email headers are hidden technical data showing the true origin of a message. In Gmail: open the email, click the three dots menu, click Show original. In Apple Mail: go to View > Message > All Headers. In Outlook: click File > Properties > Internet headers. In Yahoo Mail: open the email, click the three dots menu, click View raw message. Copy all of that text and paste it into PhishScore along with the message body."
  },
  {
    q: "Can I upload a screenshot instead of typing?",
    a: "Yes. Use the Upload Screenshot option in the submission flow. The AI reads all visible text in the image including sender information, logos, links, and message content. This is especially useful for text message scams that are easier to screenshot than type out."
  },
  {
    q: "What is the difference between Public, Private, and Anonymous?",
    a: "Private is the default: your score, category, and tags appear in the community feed but message content and sender are never shown publicly. Public shares a one-sentence AI summary along with your score and tags to help the community recognize the same scam — best used when your message contains no personal information. Anonymous stores nothing after analysis — only the score and category briefly appear in the feed, with no content retained."
  },

  // ── Privacy & data ────────────────────────────────────────────────────────────
  {
    q: "Is my data safe?",
    a: "Public and Private submissions store your score, category, tags, and an AI-generated summary in our database. The AI summary is two plain-English sentences describing the scam type — no personal information, email addresses, or raw message content. Anonymous submissions store nothing after analysis completes. We never sell data or share it with advertisers or third parties. Contact contact@phishscore.ai to request removal of any submission."
  },
  {
    q: "What information is shown publicly on the feed?",
    a: "For Public submissions: the score, category, tags, and a one-sentence AI-generated summary describing the scam type and tactic — nothing else. For Private submissions: only the score, category, and tags. No raw message text, no sender addresses, no personal details are ever shown publicly regardless of submission type."
  },

  // ── Intelligence features ─────────────────────────────────────────────────────
  {
    q: "What external databases does PhishScore check?",
    a: "PhishScore cross-checks submitted URLs against three independent threat intelligence databases in addition to AI analysis. Google Safe Browsing monitors known phishing, malware, and social engineering sites in real time. Cloudflare Radar uses traffic intelligence from Cloudflare's global network to catch threats based on actual patterns. URLhaus, operated by abuse.ch, tracks active malware distribution URLs and botnet infrastructure. When any of these flag a URL in your submission, the score is boosted accordingly and the flagging source is shown in your results."
  },
  {
    q: "What is PhishScore Radar?",
    a: "PhishScore Radar is a live threat intelligence dashboard accessible from the radar icon in the navigation bar. It analyzes the last 100 community submissions to produce a color-coded Threat Level (1 to 5), a Gemini AI-powered intelligence summary highlighting current scam tactics and seasonal threats, sector-specific alerts showing which communities are most targeted, and an activity breakdown by scam category. Radar data refreshes every 48 hours and is powered by Gemini AI."
  },
  {
    q: "Why does the community feed show a limited number of submissions?",
    a: "The feed defaults to showing the 3 most recent submissions from the last 20 to keep the dashboard fast and focused. You can expand to see all 20 using the Show More button. Stats like Total Reports and category breakdowns are calculated across the last 1,000 submissions so the numbers always reflect the full picture."
  },
  {
    q: "Can I report a scam that already happened to me?",
    a: "Yes. Submit the original message even if you already fell for it. Your submission helps others recognize the same scam and contributes to community intelligence. For financial fraud, also report to the FTC at reportfraud.ftc.gov, the FBI Internet Crime Complaint Center at ic3.gov, and contact your bank immediately to initiate a fraud claim."
  },

  // ── Deep Intel ────────────────────────────────────────────────────────────────
  {
    q: "What is PhishScore Deep Intel?",
    a: "PhishScore Deep Intel is a premium investigation service currently in beta. When a scam scores above 75 and you need to go further — whether to recover from fraud, protect your accounts, or understand exactly what happened — Deep Intel conducts a full forensic investigation combining multiple threat intelligence databases and AI analysis into a professional case file report."
  },
  {
    q: "What does a Deep Intel investigation include?",
    a: "A Deep Intel report pulls data from URLScan.io (live screenshot and page analysis), VirusTotal (verdicts from 70+ security engines), AbuseIPDB (IP history and victim reports), and WhoisXML (domain ownership and age (most scam domains are under 30 days old)). Claude AI synthesizes all of this with your personal account of what happened to produce a structured case file with an evidence summary, a specific recovery checklist tailored to your situation, and recommended next steps."
  },
  {
    q: "What service tiers will Deep Intel offer?",
    a: "Deep Intel will launch with multiple tiers to match different situations and levels of urgency. The entry tier delivers a fully automated AI forensic report. Higher tiers add a human Sanity Check review for complex or subtle cases, and an expert OSINT investigation for serious incidents requiring manual research and a custom recovery strategy. Pricing has not been announced. Contact contact@phishscore.ai to be notified at launch or to request early access."
  },
  {
    q: "How do I access Deep Intel?",
    a: "After any scan that returns a score above 75, you will see an Uncover This Scam — PhishScore Deep Intel button above the Report to FTC button on your results screen. You can also access it from the magnifying glass icon in the navigation bar. The service is currently in closed beta. Clicking either entry point will show you a preview of the upcoming launch and how to join the waitlist."
  },

  // ── PhishScore Mini ───────────────────────────────────────────────────────────
  {
    q: "What is PhishScore Mini?",
    a: "PhishScore Mini is our in-development lightweight AI model trained exclusively on community-submitted scam data. Unlike general-purpose AI models, PhishScore Mini will be trained specifically to detect scams — making it faster, cheaper to run, and more accurate for this exact task. It is being built from the ground up using real scam submissions from the PhishScore community."
  },
  {
    q: "Why are you training your own model?",
    a: "Today PhishScore uses large general-purpose AI models like Claude to analyze submissions. These are powerful but expensive and slower than a specialized model. By training PhishScore Mini on thousands of real scam examples, we can eventually run faster initial scoring without relying entirely on large external models — reducing costs, improving speed, and making PhishScore more resilient. The goal is a hybrid system: PhishScore Mini handles fast initial scoring, and Claude handles deep analysis when needed."
  },
  {
    q: "What is the Train PhishScore AI checkbox?",
    a: (
      <div>
        <p style={{ margin: "0 0 10px" }}>When you check Train PhishScore AI before submitting, you consent to having enriched data from your submission used to improve PhishScore Mini. This is entirely optional; your submission is analyzed identically either way.</p>
        <p style={{ margin: "0 0 8px" }}>If you opt in, we collect:</p>
        <ul style={{ margin: "0 0 10px", paddingLeft: 18, lineHeight: 1.8 }}>
          <li>The full AI analysis and reasoning (score rationale, detected red flags, category inference)</li>
          <li>Whether the submission was an image or pasted text</li>
        </ul>
        <p style={{ margin: 0 }}>We do not store your original message for training purposes. Anonymous submissions are flagged with reduced training weight and never linked to any identity.</p>
      </div>
    )
  },
  {
    q: "What data is actually collected for training?",
    a: (
      <div>
        {[
          { label: "When training consent is given:", text: "Full AI analysis, submission modality, threat database signals, and community reflag counts. Anonymous submissions accepted but weighted separately.", color: "#06b6d4" },
          { label: "Always:", text: "Score, category, delivery channel, red flag types, and tags — anonymized.", color: "#06b6d4" },
          { label: "Never:", text: "Your original message text or images stored for training. No identity linkage.", color: "#f43f5e" },
        ].map((row, i) => (
          <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: i < 2 ? 10 : 0 }}>
            <span style={{ fontFamily: "monospace", fontSize: 11, fontWeight: 700, color: row.color, whiteSpace: "nowrap", marginTop: 2 }}>{row.label}</span>
            <span>{row.text}</span>
          </div>
        ))}
      </div>
    )
  },
  {
    q: "Can I opt out or request deletion of my training contribution?",
    a: "Yes. Because we only store anonymized feature vectors and not your original message, we cannot link a training record back to a specific submission once the raw content is discarded. However if you contact us at contact@phishscore.ai with the approximate date and category of your submission, we will remove any matching training records. You can also choose not to participate by simply leaving the checkbox unchecked — it is always opt-in, never opt-out."
  },
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

// ── Shared FAQ content — used both inline and inside the modal ────────────────
export function FAQContent({ T = {} }) {
  return (
    <>
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
        {["Include the full sender address, not just the display name", "For emails, paste the email headers for deepest analysis", "Include the complete message - subject, body, any links", "For texts, include the full phone number with country code", "Submissions default to Private to protect your privacy", "Not sure of the type? Select Unknown / AI Detect and AI will auto-classify it"].map((tip, i) => (
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

      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

        {/* Core product */}
        <div>
          <div style={{ fontSize: 9, letterSpacing: 3, color: T.text4, fontFamily: "monospace", marginBottom: 12, paddingLeft: 4 }}>THE BASICS</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {FAQS.slice(0, 4).map((faq, i) => <FAQItem key={i} q={faq.q} a={faq.a} T={T} />)}
          </div>
        </div>

        {/* Submission */}
        <div>
          <div style={{ fontSize: 9, letterSpacing: 3, color: T.text4, fontFamily: "monospace", marginBottom: 12, paddingLeft: 4 }}>SUBMITTING SCAMS</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {FAQS.slice(4, 8).map((faq, i) => <FAQItem key={i} q={faq.q} a={faq.a} T={T} />)}
          </div>
        </div>

        {/* Privacy */}
        <div>
          <div style={{ fontSize: 9, letterSpacing: 3, color: T.text4, fontFamily: "monospace", marginBottom: 12, paddingLeft: 4 }}>PRIVACY & YOUR DATA</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {FAQS.slice(8, 10).map((faq, i) => <FAQItem key={i} q={faq.q} a={faq.a} T={T} />)}
          </div>
        </div>

        {/* Intelligence */}
        <div>
          <div style={{ fontSize: 9, letterSpacing: 3, color: T.text4, fontFamily: "monospace", marginBottom: 12, paddingLeft: 4 }}>INTELLIGENCE FEATURES</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {FAQS.slice(10, 13).map((faq, i) => <FAQItem key={i} q={faq.q} a={faq.a} T={T} />)}
          </div>
        </div>

        {/* Deep Intel */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, paddingLeft: 4 }}>
            <div style={{ fontSize: 9, letterSpacing: 3, color: "#a78bfa", fontFamily: "monospace" }}>PHISHSCORE DEEP INTEL</div>
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, color: "#f43f5e", border: "1px solid #f43f5e60", background: "#f43f5e12", padding: "2px 7px", borderRadius: 6, fontFamily: "monospace" }}>BETA</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {FAQS.slice(13).map((faq, i) => <FAQItem key={i} q={faq.q} a={faq.a} T={T} />)}
          </div>
        </div>

      </div>

      <div style={{ marginTop: 32, paddingTop: 24, borderTop: `1px solid ${T.cardBorder}`, textAlign: "center" }}>
        <div style={{ fontSize: 11, color: T.text3, fontFamily: "monospace", marginBottom: 8 }}>STILL HAVE QUESTIONS?</div>
        <a href="mailto:contact@phishscore.ai" style={{ color: "#f43f5e", fontFamily: "monospace", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>contact@phishscore.ai</a>
      </div>
    </>
  );
}

// ── Modal wrapper (kept for legacy/external callers) ──────────────────────────
export default function FAQPage({ onClose, T = {} }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)", backdropFilter: "blur(14px)", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 300, padding: 16, overflowY: "auto" }}>
      <div style={{ background: T.cardBg, border: `1px solid ${T.cardBorder}`, borderRadius: 20, width: "100%", maxWidth: 700, padding: 40, position: "relative", margin: "20px 0" }}>
        <button onClick={onClose} style={{ position: "absolute", top: 16, right: 16, background: T.innerBg, border: `1px solid ${T.innerBorder}`, color: T.text3, width: 32, height: 32, borderRadius: "50%", cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>x</button>
        <FAQContent T={T} />
      </div>
    </div>
  );
}
