/**
 * SimilarAddressWarning — shown when a NEW address resembles a KNOWN one.
 *
 * A stronger signal than "first time sending here": resemblance suggests a
 * deliberately ground look-alike rather than a new counterparty.
 */

import React from 'react'
import type { SimilarMatch, SimilarityReason } from '../utils/addressBook'
import { AddressPlate } from './AddressPlate'

type Props = {
  similar: SimilarMatch | null
}

const REASON_TEXT: Record<SimilarityReason, string> = {
  corners:
    'Both the first 6 and last 4 characters match — exactly the characters this wallet highlights, so checking the corners alone will not catch the difference.',
  prefix: 'The leading characters match.',
  suffix: 'The trailing characters match.',
}

export function SimilarAddressWarning({ similar }: Props) {
  if (!similar) return null

  const { entry, reason } = similar
  const severe = reason === 'corners'

  return (
    <div
      role="alert"
      className={`alert ${severe ? 'alert--critical' : 'alert--warn'} similar-address-warning`}
      style={{ marginTop: '0.5rem', flexDirection: 'column', gap: '0.5rem' }}
    >
      <span style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
        <span className="alert__glyph" aria-hidden="true">{severe ? '▲' : '◆'}</span>
        <span>
          <strong>Suspicious address match.</strong> This looks similar to an address you
          have sent to before. {REASON_TEXT[reason]} Compare the middle of the address
          character by character — this may be an address-substitution attack.
        </span>
      </span>
      <span style={{ paddingLeft: '1.6rem', display: 'block' }}>
        <span className="label" style={{ display: 'block', marginBottom: '0.35rem' }}>
          Known address
        </span>
        <AddressPlate address={entry.address} size="sm" />
      </span>
    </div>
  )
}
