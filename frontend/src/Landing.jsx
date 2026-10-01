import React from "react"
import { ConnectButton } from '@rainbow-me/rainbowkit'

const MODALITIES = [
  'Robotics', 'LLM ranking', 'Vision inspection', 'Audio transcribe',
  'Safety red-team', 'Writing & research', 'Medical imaging', 'Street scenes',
]

const TIERS = [
  { name: 'Scout', req: 'None — entry. Learn the ropes.', multiplier: '1.0x', pool: 'Image labels, verification, simple ranks' },
  { name: 'Operator', req: '50 tasks · 85% accuracy', multiplier: '1.5x', pool: 'Multi-step annotation, audio, 3D boxes' },
  { name: 'Specialist', req: '200 tasks · 90% accuracy', multiplier: '2.5x', pool: 'Phase labeling, red-teaming, synthetic prompts', pick: true },
  { name: 'Expert', req: '500 tasks · 95% accuracy', multiplier: '4.0x', pool: 'Medical imaging, policy review, audits' },
  { name: 'Architect', req: 'Invite only · 98% bar', multiplier: '6.0x', pool: 'Governance, private pools, early access' },
]

const STEPS = [
  { num: '01', title: 'Register', desc: 'Connect a wallet. Takes a minute, costs nothing.', tag: 'Free · 1 min' },
  { num: '02', title: 'Pull a work order', desc: 'Board is matched to your tier and modality badges.', tag: 'Matched to skill' },
  { num: '03', title: 'Do the work', desc: 'Label, rank, transcribe, flag. Points issue on approval.', tag: 'Points on-chain' },
  { num: '04', title: 'Level up', desc: 'Accuracy + volume move you up the tier sheet.', tag: 'Up to 6.0×' },
]

function ConnectCta({ className, children }) {
  return (
    <ConnectButton.Custom>
      {({ openConnectModal }) => (
        <button onClick={openConnectModal} className={className}>
          {children}
        </button>
      )}
    </ConnectButton.Custom>
  )
}

export default function Landing() {
  return (
    <div className="fm">
      <div className="fm-strip fm-mono">
        <div className="fm-wrap">
          <span>Acerv // Field manual v1.0 — Decentralized AI data layer</span>
          <span className="fm-live"><i /> Robinhood Chain · Testnet live</span>
        </div>
      </div>

      <header className="fm-site">
        <div className="fm-wrap">
          <div className="fm-brand">
            <img className="fm-mark-img" src="/acerv-mark.svg" alt="Acerv" width="38" height="38" />
            <div><b>ACERV</b><small className="fm-mono">WORK ORDERS FOR MACHINES</small></div>
          </div>
          <nav style={{ display: 'flex', gap: 10 }}>
            <a className="fm-btn fm-btn-ghost fm-mono" href="#tiers">Tier sheet</a>
            <ConnectCta className="fm-btn fm-btn-solid fm-mono">Connect wallet →</ConnectCta>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="fm-hero">
        <div className="fm-wrap">
          <div>
            <span className="fm-kicker fm-mono"><span className="fm-kicker-n">FORM 001</span> Points economy · No deposits · On-chain receipts</span>
            <h1>Train<br /><span className="fm-outline">machines.</span><br /><span className="fm-hl">Keep receipts.</span></h1>
            <p className="fm-lede">
              Acerv is a work-order board for physical AI. Label a grasp, rank two answers,
              flag a risky prompt — every approved job is <em>stamped on-chain</em> and compounds into your tier.
            </p>
            <div className="fm-hero-cta">
              <ConnectCta className="fm-btn fm-btn-accent fm-mono">Start earning →</ConnectCta>
              <a className="fm-btn fm-btn-ghost fm-mono" href="#how">Read the manual</a>
            </div>
            <p className="fm-fine fm-mono">FREE TO REGISTER · MOST REVIEWS IN 24–48H · SKILL GATES, NOT STAKE GATES</p>
          </div>
          <aside className="fm-ticket" aria-label="Example work order">
            <div className="fm-ticket-head fm-mono"><span>Work order #0841</span><span>Robotics / Grasp</span></div>
            <div className="fm-ticket-body">
              <h3>Label the lift phase</h3>
              <p className="fm-ticket-sub">12-sec teleop clip · mark Approach → Grasp → Lift timestamps.</p>
              <ul className="fm-check fm-mono">
                <li><span className="fm-box fm-done" /> Watch clip <b>0:12</b></li>
                <li><span className="fm-box fm-done" /> Mark 3 phases <b>3/3</b></li>
                <li><span className="fm-box" /> Submit for review <b>—</b></li>
              </ul>
              <div className="fm-stamp">
                <div className="fm-pts">120<small className="fm-mono">BASE PTS</small></div>
                <div className="fm-seal">2.5× specialist</div>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <div className="fm-ticker fm-mono" aria-hidden="true">
        <div>
          {MODALITIES.map((m) => <span key={m}>{m} <b>◆</b></span>)}
          {MODALITIES.map((m) => <span key={`b-${m}`}>{m} <b>◆</b></span>)}
        </div>
      </div>

      <div className="fm-ledger fm-mono">
        <div className="fm-wrap">
          <div className="fm-cell"><strong>5</strong><span>Tier levels</span></div>
          <div className="fm-cell"><strong>$0</strong><span>To register</span></div>
          <div className="fm-cell"><strong>24–48h</strong><span>Review window</span></div>
          <div className="fm-cell"><strong>100%</strong><span>On-chain receipts</span></div>
        </div>
      </div>

      {/* How it works */}
      <section className="fm-block" id="how">
        <div className="fm-wrap">
          <div className="fm-sec-head">
            <span className="fm-idx fm-mono">01</span><h2>How it works</h2>
            <p>Four entries in the logbook. No staking, no deposits — progress is earned through work.</p>
          </div>
          {STEPS.map((s) => (
            <div className="fm-row" key={s.num}>
              <div className="fm-num">{s.num}</div>
              <h3>{s.title} <small>{s.desc}</small></h3>
              <span className="fm-tag fm-mono">{s.tag}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Tiers */}
      <section className="fm-block fm-block-alt" id="tiers">
        <div className="fm-wrap">
          <div className="fm-sec-head">
            <span className="fm-idx fm-mono">02</span><h2>Tier sheet</h2>
            <p>Higher tiers open higher-value pools. Read across: requirement → multiplier → work.</p>
          </div>
          <div style={{ height: 26 }} />
          <table className="fm-spec fm-mono">
            <thead><tr><th>Tier</th><th>Requirement</th><th>Rate</th><th>Pool</th></tr></thead>
            <tbody>
              {TIERS.map((t) => (
                <tr key={t.name} className={t.pick ? 'fm-pick' : ''}>
                  <td>{t.name}</td>
                  <td><span className="fm-req">{t.req}</span></td>
                  <td><span className="fm-mult">{t.multiplier}</span></td>
                  <td>{t.pool}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Why */}
      <section className="fm-block">
        <div className="fm-wrap">
          <div className="fm-sec-head">
            <span className="fm-idx fm-mono">03</span><h2>Why Acerv</h2>
            <p>Three properties, stated plainly. No “revolutionize” anywhere on this page.</p>
          </div>
          <div style={{ height: 26 }} />
          <div className="fm-why-grid">
            <article>
              <svg width="34" height="34" viewBox="0 0 34 34" fill="none"><rect x="2" y="2" width="30" height="30" stroke="#16130C" strokeWidth="2.5" /><path d="M10 22 L15 12 L19 18 L24 10" stroke="#FF4D00" strokeWidth="2.5" fill="none" /></svg>
              <h3>Receipts, not promises</h3>
              <p>Every approval is a permanent on-chain record. Your reputation is portable and auditable — not a score in someone's database.</p>
            </article>
            <article>
              <svg width="34" height="34" viewBox="0 0 34 34" fill="none"><rect x="2" y="2" width="30" height="30" stroke="#16130C" strokeWidth="2.5" /><rect x="9" y="18" width="5" height="8" fill="#16130C" /><rect x="16" y="12" width="5" height="14" fill="#FF4D00" /><rect x="23" y="7" width="5" height="19" fill="#16130C" /></svg>
              <h3>Skill gates, not stake gates</h3>
              <p>Access scales with demonstrated accuracy, from Scout to Architect. Money can't buy the multiplier — work does.</p>
            </article>
            <article>
              <svg width="34" height="34" viewBox="0 0 34 34" fill="none"><circle cx="17" cy="17" r="14" stroke="#16130C" strokeWidth="2.5" /><path d="M17 9 V17 L23 21" stroke="#FF4D00" strokeWidth="2.5" /></svg>
              <h3>Fast turnaround</h3>
              <p>Most jobs reviewed inside 24–48 hours. Short loops keep momentum up and tiers moving.</p>
            </article>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="fm-cta" id="start">
        <div className="fm-wrap">
          <div>
            <p className="fm-mono" style={{ fontSize: 11, letterSpacing: '.22em', color: 'var(--fm-accent)' }}>FORM 002 — ENLISTMENT</p>
            <h2>First shift starts <span>today.</span></h2>
            <p>Join the first wave of contributors. Register free, pull your first work order, and start building the receipt book.</p>
            <div className="fm-hero-cta"><ConnectCta className="fm-btn fm-btn-accent fm-mono">Get started →</ConnectCta></div>
          </div>
          <div className="fm-cta-card">
            <span className="fm-mono">What you need</span>
            <strong>A wallet. Nothing else.</strong>
            <ul className="fm-check fm-mono">
              <li><span className="fm-box fm-done" /> No deposits <b>$0</b></li>
              <li><span className="fm-box fm-done" /> No fees to join <b>$0</b></li>
              <li><span className="fm-box" /> ~5 min first task <b>★</b></li>
            </ul>
          </div>
        </div>
      </section>

      <footer className="fm-footer">
        <div className="fm-wrap fm-mono">
          <span>Acerv v1.0.0 — Decentralized AI data layer</span>
          <span>{new Date().getFullYear()} // Skill gates, not stake gates</span>
        </div>
      </footer>
    </div>
  )
}
