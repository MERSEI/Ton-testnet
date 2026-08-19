import React from 'react'
import { Modal } from './Modal'

type Props = {
  open: boolean
  onClose: () => void
}

export function HelpModal({ open, onClose }: Props) {
  return (
    <Modal open={open} onClose={onClose} title="How to use">
      <div className="stack" style={{ fontSize: '0.82rem', lineHeight: 1.7, color: 'var(--bone-dim)' }}>

        <Section ord="01" title="First launch">
          <p>
            <b>Create new wallet</b> generates a fresh 24-word phrase. <b>Import</b> restores
            from an existing one.
          </p>
          <p style={{ marginTop: '0.4rem' }}>
            Write the words on paper. They are the only way to recover the wallet — there is no
            &ldquo;forgot password&rdquo;.
          </p>
        </Section>

        <Section ord="02" title="Wallet">
          <ul style={{ paddingLeft: '1.1rem' }}>
            <li>Your address sits under the balance. <b>Expand</b> shows it grouped in fours.</li>
            <li>The balance loads automatically. <b>↻</b> refreshes it (5 s cooldown).</li>
            <li>The ledger holds your last 20 transactions; the search box filters by address,
              amount or comment.</li>
          </ul>
        </Section>

        <Section ord="03" title="Receiving">
          <p>
            Share your address or QR from the <b>Receive</b> tab. This is a <b>testnet</b>
            {' '}address — only testnet TON can arrive here.
          </p>
          <p style={{ marginTop: '0.4rem' }}>
            Need coins? <code className="mark">@testgiver_ton_bot</code> in Telegram.
          </p>
        </Section>

        <Section ord="04" title="Sending">
          <ol style={{ paddingLeft: '1.1rem' }}>
            <li>Paste or type the recipient address and an amount, or hit <b>Max</b>.</li>
            <li>Check the grouped address plate that appears under the field.</li>
            <li><b>Review &amp; Send</b>, then read the confirmation before <b>Confirm Send</b>.</li>
          </ol>
          <p style={{ marginTop: '0.4rem' }}>
            A small fee reserve is always left behind so the network does not reject the transfer.
          </p>
        </Section>

        <Section ord="05" title="Address safety">
          <p style={{ marginBottom: '0.6rem' }}>
            Address substitution is the real threat here — usually clipboard malware. Three
            layers work against it:
          </p>
          <div className="stack-s">
            <Guard letter="A" title="Grouped address, marked corners">
              Addresses are shown in groups of four with the first 6 and last 4 characters in
              accent. Grouping is what makes 48 random characters checkable by eye at all.
            </Guard>
            <Guard letter="B" title="Paste warning">
              Pasting raises a warning that clears only when you edit the field by hand.
            </Guard>
            <Guard letter="C" title="Familiarity and look-alikes">
              A first-time recipient is flagged. An address resembling one you have used before
              raises a stronger alert — strongest when it matches both highlighted corners,
              because that defeats layer A on its own.
            </Guard>
          </div>
        </Section>

        <Section ord="06" title="Security model">
          <ul style={{ paddingLeft: '1.1rem' }}>
            <li>The keypair lives in <b>sessionStorage</b> and is erased when the tab closes.</li>
            <li>The seed phrase is never stored at all, and never leaves the browser.</li>
            <li>Every transaction is signed locally.</li>
            <li>Testnet only. Do not use this with real TON.</li>
          </ul>
        </Section>

        <Section ord="07" title="Rate limits">
          <p>
            TON Center allows 1 request per second without an API key. Requests are queued and
            retried automatically, so brief waits are normal.
          </p>
        </Section>

        <button className="btn btn--primary btn--block btn--tall" onClick={onClose}>
          Got it
        </button>
      </div>
    </Modal>
  )
}

function Section({ ord, title, children }: { ord: string; title: string; children: React.ReactNode }) {
  return (
    <section>
      <div style={{ display: 'flex', gap: 'calc(var(--step) * 3)', alignItems: 'baseline', marginBottom: 'calc(var(--step) * 2)' }}>
        <span className="label" style={{ color: 'var(--acid)' }}>{ord}</span>
        <span style={{ fontWeight: 600, color: 'var(--bone)', letterSpacing: '0.02em' }}>{title}</span>
      </div>
      <div style={{ paddingLeft: 'calc(var(--step) * 8)' }}>{children}</div>
      <hr className="rule" style={{ marginTop: 'calc(var(--step) * 4)' }} />
    </section>
  )
}

function Guard({ letter, title, children }: { letter: string; title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 'calc(var(--step) * 3)', alignItems: 'flex-start' }}>
      <span
        aria-hidden="true"
        style={{
          width: 20, height: 20, flexShrink: 0, display: 'grid', placeItems: 'center',
          border: '1px solid var(--acid)', borderRadius: 'var(--r-sm)',
          color: 'var(--acid)', fontSize: '0.62rem', fontWeight: 600, marginTop: 2,
        }}
      >
        {letter}
      </span>
      <div>
        <div style={{ fontWeight: 600, color: 'var(--bone)', fontSize: '0.78rem' }}>{title}</div>
        <div style={{ fontSize: '0.78rem' }}>{children}</div>
      </div>
    </div>
  )
}
