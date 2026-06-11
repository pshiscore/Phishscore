import { useState } from "react";
import { SCAM_CATEGORIES } from "../constants";
import PageWrapper from "./PageWrapper";
import SchemaMarkup from "./SEO/SchemaMarkup";

// ── Per-category threat intelligence content ─────────────────────────────────

const GLOSSARY = {
  publishing: {
    definition: "Publishing and literary scams target aspiring authors by impersonating literary agents, publishers, or contest organizers to extract fees or personal information. Victims are promised representation, publication, or prize money that never materializes after paying upfront costs.",
    redFlags: [
      "Unsolicited contact claiming your manuscript was 'discovered' or 'referred'",
      "Requests for reading fees, editing fees, or publishing packages before representation",
      "Vague contract terms with no verifiable publisher ISBN history or physical address",
    ],
    enterpriseImpact: "Targets small business owners self-publishing training materials, HR departments purchasing bulk learning resources, and corporate communications teams contracting editorial services.",
  },
  delivery: {
    definition: "Package and delivery scams impersonate major carriers — USPS, FedEx, UPS, DHL — sending fake tracking notifications that claim a package is held, requires a customs fee, or needs address confirmation. Clicking the link leads to a credential-harvesting page or installs malware.",
    redFlags: [
      "Unexpected delivery notification for a package you did not order",
      "Request for a small 'redelivery fee' paid by credit card before release",
      "Tracking link that does not match the carrier's official domain",
    ],
    enterpriseImpact: "Highly effective against procurement teams and warehouse staff who receive high volumes of legitimate shipment notifications daily, making the fake difficult to distinguish.",
  },
  retail: {
    definition: "Retail and shopping scams mimic major e-commerce brands — Amazon, eBay, Etsy — to report fake account problems, unauthorized purchases, or prize winnings, redirecting victims to phishing sites. These campaigns exploit the victim's existing account anxiety to prompt immediate credential submission.",
    redFlags: [
      "Alert about an order you did not place demanding immediate verification",
      "Sender domain does not exactly match the retailer's official domain",
      "Urgency framing: 'Your account will be suspended in 24 hours'",
    ],
    enterpriseImpact: "Corporate purchasing card fraud and business account takeover are primary vectors, particularly targeting accounts payable teams with high-volume purchase authority.",
  },
  telecom: {
    definition: "Phone and telecom scams impersonate mobile carriers — T-Mobile, Verizon, AT&T — claiming reward points are expiring, bills are overdue, or account upgrades are available. They funnel victims to lookalike portals designed to capture login credentials or payment details.",
    redFlags: [
      "Text message claiming reward points or credits expire imminently",
      "Link uses a shortened URL or domain resembling but not matching the carrier",
      "Request to 'verify' your account by re-entering full payment card details",
    ],
    enterpriseImpact: "Corporate mobile fleet administrators are targeted through fake enterprise account alerts, enabling SIM-swap attacks that can bypass multi-factor authentication across an organization.",
  },
  traffic: {
    definition: "Traffic and tolls scams send fake violation notices impersonating state DMVs, toll authorities (E-ZPass, FasTrak, SunPass), or municipal parking enforcement. They demand immediate payment of a small fine to prevent escalating penalties, creating urgency that bypasses scrutiny.",
    redFlags: [
      "Fine notice received by text or email for a jurisdiction you may not have visited",
      "Payment portal URL that does not match the official government or toll authority domain",
      "Amount is deliberately small (under $15) to reduce resistance to paying",
    ],
    enterpriseImpact: "Fleet managers and vehicle-allowance employees are targeted at scale, with attackers banking on the high daily transaction volume making individual fake notices undetectable.",
  },
  social: {
    definition: "Social media scams exploit platform DMs, stories, and comments to deliver phishing links, fake investment opportunities, or impersonation attacks using cloned or compromised accounts. They leverage trust built through existing social graphs to bypass skepticism.",
    redFlags: [
      "Message from a known contact with an unusual tone promoting an investment or giveaway",
      "Link that bypasses the platform's built-in link preview or opens an external login page",
      "Requests to 'verify your account' or 'confirm your identity' via an external site",
    ],
    enterpriseImpact: "Brand impersonation attacks on corporate social profiles damage customer trust, while executive spear-phishing via LinkedIn and Instagram enables business email compromise campaigns.",
  },
  finance: {
    definition: "Banking and finance scams impersonate banks, credit unions, cryptocurrency exchanges, or investment platforms to harvest credentials, initiate fraudulent wire transfers, or drain crypto wallets. These are among the highest-impact scams by financial loss per incident.",
    redFlags: [
      "Urgent alert about a 'suspicious transaction' requiring immediate verification",
      "Request to move funds to a 'safe account' controlled by the scammer",
      "Crypto investment opportunity with guaranteed returns or 'recovery' of lost funds",
    ],
    enterpriseImpact: "Business email compromise (BEC) attacks targeting CFOs and accounts payable staff are the dominant enterprise vector, with average losses exceeding $125,000 per incident according to the FBI IC3.",
  },
  government: {
    definition: "Government and IRS scams impersonate federal agencies — the IRS, Social Security Administration, Medicare, or USCIS — to threaten arrest, account suspension, or benefit termination unless immediate payment or personal information is provided. They exploit institutional authority to paralyze victims with fear.",
    redFlags: [
      "Threat of immediate arrest or deportation unless payment is made today",
      "Request for payment via gift card, wire transfer, or cryptocurrency — never how agencies operate",
      "Caller ID or email header appearing to be from a '.gov' domain but with spoofed headers",
    ],
    enterpriseImpact: "Targets HR and payroll teams with fake IRS employer notices, and legal/compliance departments with fraudulent regulatory penalty letters demanding wire transfers.",
  },
  prize: {
    definition: "Prize and lottery scams inform victims they have won a sweepstakes, lottery, or gift card they never entered, then require payment of 'taxes,' 'processing fees,' or 'customs charges' to release the prize. No prize exists — the fees are the fraud.",
    redFlags: [
      "You 'won' a contest or lottery you have no memory of entering",
      "Prize release requires upfront payment of taxes or fees before delivery",
      "Pressure to keep the winnings secret to 'protect the prize'",
    ],
    enterpriseImpact: "Rarely targets enterprises directly but is used in HR gift card scams where employees are told they won a company drawing and must verify their identity with a gift card purchase.",
  },
  romance: {
    definition: "Romance and friendship scams build artificial emotional relationships over weeks or months via dating apps and social media before introducing a financial crisis — investment opportunity, medical emergency, or travel cost — that requires the victim's money. The relationship exists entirely to enable the financial extraction.",
    redFlags: [
      "Person refuses video calls or in-person meetings despite weeks of messaging",
      "Introduces a financial need or 'amazing investment' after establishing emotional trust",
      "Story contains inconsistencies about location, profession, or personal history",
    ],
    enterpriseImpact: "Executives targeted through romance vectors can be manipulated into authorizing fraudulent wire transfers or leaking confidential information under emotional coercion — a variant known as 'romance BEC.'",
  },
  job: {
    definition: "Job and employment scams advertise fake positions on LinkedIn, Indeed, and job boards, then either charge for training materials, steal personal information through fake onboarding, or recruit victims as unwitting money mules. Remote work scams surged significantly post-2020.",
    redFlags: [
      "Job offer arrives unsolicited without a formal application process",
      "Position requires purchasing equipment or paying for certification upfront",
      "Onboarding asks for bank account details to 'set up direct deposit' before any work begins",
    ],
    enterpriseImpact: "Fake job postings mimicking real companies damage employer brand, and money mule recruitment through fake remote roles creates regulatory and legal liability for the unwitting employees involved.",
  },
  tech: {
    definition: "Tech support scams display fake security alerts — mimicking Microsoft, Apple, or antivirus brands — warning of virus infections or account breaches, then direct victims to call a number where 'technicians' request remote access to install malware or charge for fake repairs.",
    redFlags: [
      "Browser popup or audio alarm claiming your device is infected and providing a phone number",
      "Remote access software (AnyDesk, TeamViewer) requested before any diagnosis",
      "Charge for 'lifetime protection' or 'virus removal' payable only by gift card",
    ],
    enterpriseImpact: "Remote access granted to attackers provides a foothold into corporate networks, enabling lateral movement, data exfiltration, and ransomware deployment from a single compromised endpoint.",
  },
  political: {
    definition: "Political campaign scams impersonate real candidates, PACs, or advocacy organizations during election cycles to fraudulently solicit donations or steal voter registration data. They exploit heightened political engagement to lower victims' fraud defenses.",
    redFlags: [
      "Donation link redirects to a payment page not on the official campaign domain",
      "Extreme urgency framing — 'LAST CHANCE to stop [opponent]' — with a countdown",
      "Request for donation via gift card, cryptocurrency, or wire transfer",
    ],
    enterpriseImpact: "Corporate political contribution fraud can create legal compliance violations if employees are deceived into making donations that appear to originate from business accounts.",
  },
  travel: {
    definition: "Travel and vacation scams offer implausibly cheap flights, hotels, or vacation packages through fake booking sites, then either take payment for non-existent reservations or collect personal data through fake confirmation forms. Timeshare exit scams are a high-value subset.",
    redFlags: [
      "Price is 40–60% below market rate for a popular destination or hotel",
      "Payment required via wire transfer, cryptocurrency, or non-refundable gift card",
      "Booking confirmation arrives from a personal email rather than a corporate booking domain",
    ],
    enterpriseImpact: "Corporate travel managers targeted through fake vendor invoices and employees deceived on personal travel can result in corporate card fraud that escapes detection in high-volume travel spend environments.",
  },
  legal: {
    definition: "Legal and compliance scams threaten victims with lawsuits, arrest warrants, debt collection, or regulatory penalties to coerce immediate payment or personal data disclosure. They impersonate courts, collection agencies, law firms, or compliance bodies with official-looking documents.",
    redFlags: [
      "Urgent notice of a lawsuit or warrant demanding same-day payment to avoid arrest",
      "Contact from a 'court' or 'attorney' via text message or personal email address",
      "Settlement payment required in cryptocurrency, wire transfer, or gift card",
    ],
    enterpriseImpact: "Legal department BEC attacks using fake court orders or regulatory notices can trigger unauthorized wire transfers, and fake compliance audits are used to harvest sensitive employee and financial data.",
  },
  other: {
    definition: "Unknown and AI-detected threats represent emerging or hybrid scam patterns that do not fit neatly into established categories. PhishScore's AI engine analyzes linguistic patterns, urgency signals, and structural red flags to classify and score these submissions automatically.",
    redFlags: [
      "Unusual urgency or pressure to act immediately without time to verify",
      "Request for payment via untraceable method — gift cards, crypto, wire transfer",
      "Contact arrives through an unexpected channel with unverifiable sender identity",
    ],
    enterpriseImpact: "Novel AI-generated scam content is increasingly difficult to detect with signature-based filters, making behavioral analysis and community intelligence sharing — like PhishScore's feed — critical enterprise defenses.",
  },
};

// Build FAQ schema from glossary data
function buildFAQSchema() {
  const mainEntity = SCAM_CATEGORIES.filter(c => c.id !== "other").map(cat => {
    const g = GLOSSARY[cat.id];
    if (!g) return null;
    return {
      "@type": "Question",
      "name": `What is a ${cat.label} scam?`,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": g.definition,
      },
    };
  }).filter(Boolean);

  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "name": "PhishScore Threat Glossary — Scam & Phishing Reference",
    "description": "A comprehensive threat intelligence glossary covering all major scam and phishing categories, their red flags, and enterprise security implications.",
    "url": "https://www.phishscore.ai/glossary",
    "mainEntity": mainEntity,
  };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function GlossaryEntry({ cat, T }) {
  const g = GLOSSARY[cat.id];
  if (!g) return null;
  const [expanded, setExpanded] = useState(false);

  return (
    <article
      id={`threat-${cat.id}`}
      style={{
        background: T.cardBg,
        border: `1px solid ${T.cardBorder}`,
        borderLeft: `4px solid ${cat.color}`,
        borderRadius: "0 12px 12px 0",
        padding: "24px 28px",
        marginBottom: 16,
        boxSizing: "border-box",
      }}
    >
      {/* Category header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: cat.color, fontFamily: "monospace", letterSpacing: 1, margin: "0 0 4px" }}>
            {cat.label}
          </h2>
          <p style={{ fontSize: 10, color: T.text4, fontFamily: "monospace", letterSpacing: 2, margin: 0 }}>
            THREAT CATEGORY — {cat.id.toUpperCase()}
          </p>
        </div>
        <button
          onClick={() => setExpanded(v => !v)}
          aria-expanded={expanded}
          aria-controls={`glossary-body-${cat.id}`}
          style={{ background: "none", border: `1px solid ${T.cardBorder}`, color: T.text4, borderRadius: 8, padding: "4px 12px", cursor: "pointer", fontSize: 10, fontFamily: "monospace", letterSpacing: 1, flexShrink: 0 }}
        >
          {expanded ? "COLLAPSE" : "EXPAND"}
        </button>
      </div>

      {/* Definition — always visible */}
      <p style={{ fontSize: 14, color: T.text2, fontFamily: "Georgia, serif", lineHeight: 1.8, margin: "0 0 16px" }}>
        {g.definition}
      </p>

      {/* Expandable detail */}
      {expanded && (
        <div id={`glossary-body-${cat.id}`}>
          <h3 style={{ fontSize: 11, fontWeight: 700, color: "#f43f5e", fontFamily: "monospace", letterSpacing: 2, margin: "0 0 10px" }}>
            KEY RED FLAGS
          </h3>
          <ul style={{ margin: "0 0 20px", paddingLeft: 20, listStyleType: "none" }}>
            {g.redFlags.map((flag, i) => (
              <li key={i} style={{ display: "flex", gap: 10, marginBottom: 8, alignItems: "flex-start" }}>
                <span style={{ color: "#f43f5e", flexShrink: 0, fontWeight: 700, marginTop: 1 }}>!</span>
                <span style={{ fontSize: 13, color: T.text2, fontFamily: "Georgia, serif", lineHeight: 1.6 }}>{flag}</span>
              </li>
            ))}
          </ul>

          <h3 style={{ fontSize: 11, fontWeight: 700, color: "#fb923c", fontFamily: "monospace", letterSpacing: 2, margin: "0 0 8px" }}>
            ENTERPRISE IMPACT
          </h3>
          <p style={{ fontSize: 13, color: T.text2, fontFamily: "Georgia, serif", lineHeight: 1.7, margin: 0 }}>
            {g.enterpriseImpact}
          </p>
        </div>
      )}
    </article>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function GlossaryContent({ T = {}, onScanClick }) {
  const faqSchema = buildFAQSchema();
  const displayCategories = SCAM_CATEGORIES.filter(c => c.id !== "other");

  return (
    <>
      <SchemaMarkup schema={faqSchema} />

      {/* Page header */}
      <header style={{ marginBottom: 36 }}>
        <p style={{ fontSize: 10, letterSpacing: 4, color: "#f43f5e", fontFamily: "monospace", margin: "0 0 10px" }}>
          THREAT INTELLIGENCE
        </p>
        <h2 style={{ fontSize: 28, fontWeight: 800, color: T.text, fontFamily: "monospace", letterSpacing: 1, margin: "0 0 12px", lineHeight: 1.2 }}>
          PHISHSCORE <span style={{ color: "#f43f5e" }}>THREAT</span> GLOSSARY
        </h2>
        <p style={{ fontSize: 15, color: T.text2, fontFamily: "Georgia, serif", lineHeight: 1.8, margin: "0 0 20px", maxWidth: 700 }}>
          A comprehensive reference covering all major scam and phishing categories tracked by the PhishScore community intelligence engine. Each entry includes a threat definition, behavioral red flags, and enterprise security implications — structured for both human readers and AI search engines.
        </p>
        <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", background: T.innerBg, border: `1px solid ${T.innerBorder}`, borderRadius: 20 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#34d399", display: "inline-block", flexShrink: 0 }} />
            <span style={{ fontSize: 10, color: T.text3, fontFamily: "monospace", letterSpacing: 1 }}>{displayCategories.length} THREAT CATEGORIES</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", background: T.innerBg, border: `1px solid ${T.innerBorder}`, borderRadius: 20 }}>
            <span style={{ fontSize: 10, color: T.text3, fontFamily: "monospace", letterSpacing: 1 }}>FAQ SCHEMA INJECTED</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", background: T.innerBg, border: `1px solid ${T.innerBorder}`, borderRadius: 20 }}>
            <span style={{ fontSize: 10, color: "#a78bfa", fontFamily: "monospace", letterSpacing: 1 }}>AI-OPTIMIZED (AIO)</span>
          </div>
        </div>
      </header>

      {/* Quick-jump index */}
      <nav aria-label="Threat category index" style={{ background: T.innerBg, border: `1px solid ${T.innerBorder}`, borderRadius: 12, padding: "16px 20px", marginBottom: 32 }}>
        <p style={{ fontSize: 9, letterSpacing: 3, color: T.text4, fontFamily: "monospace", margin: "0 0 12px" }}>JUMP TO CATEGORY</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {displayCategories.map(cat => (
            <a
              key={cat.id}
              href={`#threat-${cat.id}`}
              style={{ fontSize: 10, color: cat.color, fontFamily: "monospace", textDecoration: "none", background: `${cat.color}10`, border: `1px solid ${cat.color}30`, padding: "3px 10px", borderRadius: 20, letterSpacing: 0.5 }}
            >
              {cat.label}
            </a>
          ))}
        </div>
      </nav>

      {/* Glossary entries */}
      <section aria-label="Threat glossary entries">
        {displayCategories.map(cat => (
          <GlossaryEntry key={cat.id} cat={cat} T={T} />
        ))}
      </section>

      {/* Enterprise CTA */}
      <aside style={{ marginTop: 40, background: "linear-gradient(135deg, #1a0a2e, #0d0520)", border: "1px solid #a78bfa40", borderRadius: 16, padding: "32px 28px" }}>
        <p style={{ fontSize: 9, letterSpacing: 3, color: "#a78bfa", fontFamily: "monospace", margin: "0 0 10px" }}>ENTERPRISE THREAT INTELLIGENCE</p>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: "#ffffff", fontFamily: "monospace", margin: "0 0 12px", lineHeight: 1.3 }}>
          Are scammers spoofing your brand?
        </h2>
        <p style={{ fontSize: 14, color: "#c4b5fd", fontFamily: "Georgia, serif", lineHeight: 1.8, margin: "0 0 24px", maxWidth: 580 }}>
          PhishScore tracks active brand impersonation campaigns in real time. Contact us for enterprise threat intelligence — brand protection reports, sector briefings, and custom alerting when your organization's name appears in community scam submissions.
        </p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <a
            href="mailto:contact@phishscore.ai?subject=Enterprise Threat Intelligence Inquiry"
            style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "linear-gradient(135deg,#a78bfa,#7c3aed)", border: "none", color: "#fff", padding: "12px 24px", borderRadius: 10, fontSize: 11, fontWeight: 700, letterSpacing: 2, fontFamily: "monospace", textDecoration: "none" }}
          >
            CONTACT US FOR ENTERPRISE INTEL
          </a>
          {onScanClick && (
            <button
              onClick={onScanClick}
              style={{ background: "none", border: "1px solid #a78bfa50", color: "#c4b5fd", padding: "12px 20px", borderRadius: 10, fontSize: 11, fontWeight: 700, letterSpacing: 1, fontFamily: "monospace", cursor: "pointer" }}
            >
              CHECK A MESSAGE FREE →
            </button>
          )}
        </div>
      </aside>

      {/* Schema attribution */}
      <footer style={{ marginTop: 24, paddingTop: 16, borderTop: `1px solid ${T.cardBorder}`, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <p style={{ fontSize: 10, color: T.text4, fontFamily: "monospace", margin: 0 }}>
          PhishScore Threat Glossary — Updated continuously from community intelligence
        </p>
        <p style={{ fontSize: 10, color: T.text4, fontFamily: "monospace", margin: 0 }}>
          schema.org/FAQPage structured data injected ✓
        </p>
      </footer>
    </>
  );
}

export default function GlossaryPage({ onClose, T = {}, onScanClick }) {
  return (
    <PageWrapper>
      <div style={{ padding: "32px 0" }}>
        <GlossaryContent T={T} onScanClick={onScanClick} />
      </div>
    </PageWrapper>
  );
}
