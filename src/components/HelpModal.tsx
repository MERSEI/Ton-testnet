import React from 'react'
import { Modal } from './Modal'

type Props = {
  open: boolean
  onClose: () => void
}

export function HelpModal({ open, onClose }: Props) {
  return (
    <Modal open={open} onClose={onClose} title="How to use">
      <div style={{ fontSize: '0.9rem', lineHeight: 1.65, color: 'var(--text-2)', overflowY: 'auto', maxHeight: '70vh' }}>

        <Section icon="🔑" title="First launch">
          <p>Choose <b>Create new wallet</b> to generate a fresh wallet, or <b>Import</b> to restore from an existing 24-word phrase.</p>
          <Warning>Write down the 24 seed words on paper and store them safely. They are the <b>only way</b> to recover your wallet — there is no "forgot password".</Warning>
        </Section>

        <Section icon="💰" title="Wallet screen">
          <ul style={{ paddingLeft: '1.1rem' }}>
            <li>Your <b>address</b> is shown at the top. Tap it to toggle the full address.</li>
            <li><b>Balance</b> loads automatically. Hit <b>↻</b> to refresh (5 s cooldown).</li>
            <li>Below you see your last 20 transactions. Use the search bar to filter by address or amount.</li>
          </ul>
        </Section>

        <Section icon="📥" title="Receiving TON">
          <p>Open the <b>Receive</b> tab. Share your address or QR code with the sender. This is a <b>testnet</b> address — only testnet TON can be received here.</p>
          <p style={{ marginTop: '0.4rem' }}>Need testnet coins? Use the official faucet: <code style={codeStyle}>@testgiver_ton_bot</code> in Telegram.</p>
        </Section>

        <Section icon="📤" title="Sending TON">
          <ol style={{ paddingLeft: '1.1rem' }}>
            <li>Open the <b>Send</b> tab.</li>
            <li>Enter the recipient's TON address and the amount.</li>
            <li>Tap <b>Review &amp; Send</b>.</li>
            <li>Check the confirmation screen carefully, then tap <b>Confirm Send</b>.</li>
          </ol>
        </Section>

        <Section icon="🛡️" title="Address safety (important)">
          <p style={{ marginBottom: '0.5rem' }}>The wallet has three layers of protection against address substitution attacks:</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <SafetyItem color="#2AABEE" letter="A" title="Highlighted corners">
              The <b>first 6</b> and <b>last 4</b> characters of every address are shown in bold blue. Always verify these corners match what you expect.
            </SafetyItem>
            <SafetyItem color="#FF9500" letter="B" title="Clipboard warning">
              If you <b>paste</b> an address, a yellow banner appears and stays until you manually edit the field. Clipboard malware can silently replace addresses — always re-read after pasting.
            </SafetyItem>
            <SafetyItem color="#FF3B30" letter="C" title="New address alert">
              When you send to an address for the <b>first time</b>, a red warning appears. If the address looks similar to one you've used before but isn't identical, an orange <i>"Suspicious address match"</i> alert fires — this may indicate a prefix-swap attack.
            </SafetyItem>
          </div>
        </Section>

        <Section icon="🔒" title="Security model">
          <ul style={{ paddingLeft: '1.1rem' }}>
            <li>Your private key is stored in <b>sessionStorage</b> — it's erased when you close the tab.</li>
            <li>The mnemonic phrase is <b>never</b> sent to any server.</li>
            <li>All transactions are signed locally in your browser.</li>
            <li>This is a <b>testnet</b> wallet. Do not use it with real TON.</li>
          </ul>
        </Section>

        <Section icon="⚠️" title="Rate limits">
          <p>TON Center API allows <b>1 request per second</b> on the free tier. If you see "Rate limited" errors, wait a few seconds and refresh.</p>
        </Section>

        <button
          className="btn btn-primary"
          onClick={onClose}
          style={{ width: '100%', marginTop: '1rem' }}
        >
          Got it
        </button>
      </div>
    </Modal>
  )
}

function Section({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
        <span>{icon}</span>
        <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text)' }}>{title}</span>
      </div>
      <div style={{ paddingLeft: '0.25rem' }}>{children}</div>
    </div>
  )
}

function Warning({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: '#fff9e6', border: '1px solid #f59e0b', borderRadius: '8px',
      padding: '0.55rem 0.75rem', fontSize: '0.82rem', color: '#92400e', marginTop: '0.5rem',
    }}>
      ⚠️ {children}
    </div>
  )
}

function SafetyItem({ color, letter, title, children }: {
  color: string; letter: string; title: string; children: React.ReactNode
}) {
  return (
    <div style={{
      display: 'flex', gap: '0.6rem', alignItems: 'flex-start',
      background: 'var(--surface-2)', borderRadius: '8px', padding: '0.6rem 0.75rem',
    }}>
      <div style={{
        width: 22, height: 22, borderRadius: '50%', background: color,
        color: '#fff', fontWeight: 700, fontSize: '0.75rem',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1,
      }}>
        {letter}
      </div>
      <div>
        <div style={{ fontWeight: 600, marginBottom: '0.15rem', fontSize: '0.85rem' }}>{title}</div>
        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{children}</div>
      </div>
    </div>
  )
}

const codeStyle: React.CSSProperties = {
  background: 'var(--surface-2)', padding: '0.1rem 0.35rem',
  borderRadius: '4px', fontFamily: 'monospace', fontSize: '0.85rem',
}
