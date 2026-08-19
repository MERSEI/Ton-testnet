/**
 * AddressPlate — the full address rendered as a verification plate.
 *
 * SECURITY MECHANISM A, taken seriously in the layout rather than only in colour:
 * 48 undifferentiated base64 characters are effectively unreadable, which is
 * exactly what makes address substitution work. Grouping them in fours — the way
 * a card number, an IBAN or a banknote serial is grouped — gives the eye fixed
 * landmarks, so "compare the address" becomes a task a person can actually do.
 * The highlighted corner characters keep the accent colour on top of that.
 *
 * Used wherever the address is the subject of the screen: the Receive page and
 * the transfer confirmation. `AddressDisplay` remains for inline mentions.
 */

import React from 'react'

type Props = {
  address: string
  /** Characters highlighted at the start (Mechanism A) */
  prefixLen?: number
  /** Characters highlighted at the end (Mechanism A) */
  suffixLen?: number
  /** Characters per group */
  group?: number
  /** 'ink' renders dark type for use on the light QR plate */
  tone?: 'bone' | 'ink'
  size?: 'md' | 'sm'
}

type Segment = { text: string; marked: boolean }

/** Split one group into runs of marked / unmarked characters. */
function segment(chars: string[], offset: number, head: number, tailStart: number): Segment[] {
  const out: Segment[] = []
  chars.forEach((ch, i) => {
    const abs = offset + i
    const marked = abs < head || abs >= tailStart
    const last = out[out.length - 1]
    if (last && last.marked === marked) last.text += ch
    else out.push({ text: ch, marked })
  })
  return out
}

export function AddressPlate({
  address,
  prefixLen = 6,
  suffixLen = 4,
  group = 4,
  tone = 'bone',
  size = 'md',
}: Props) {
  const chars = Array.from(address)
  const tailStart = chars.length - suffixLen

  const groups: Segment[][] = []
  for (let i = 0; i < chars.length; i += group) {
    groups.push(segment(chars.slice(i, i + group), i, prefixLen, tailStart))
  }

  const className = [
    'plate',
    tone === 'ink' ? 'plate--ink' : '',
    size === 'sm' ? 'plate--sm' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    // The grouping is presentational: screen readers and clipboard consumers must
    // still receive the address as one unbroken string.
    <div className={className} role="text" aria-label={address}>
      {groups.map((segments, gi) => (
        <span className="plate__group" key={gi} aria-hidden="true">
          {segments.map((s, si) =>
            s.marked ? (
              <span className="plate__mark" key={si}>{s.text}</span>
            ) : (
              <span key={si}>{s.text}</span>
            ),
          )}
        </span>
      ))}
    </div>
  )
}
