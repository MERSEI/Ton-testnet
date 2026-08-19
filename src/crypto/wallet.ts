/**
 * Wallet generation and transaction signing.
 *
 * We use WalletContractV4 (the most common TON wallet type). Key derivation
 * follows the TON BIP-39-style mnemonic → Ed25519 keypair path via @ton/crypto.
 *
 * IMPORTANT: the mnemonic and secret key never leave this module except through
 * the returned WalletInfo, which the store keeps in sessionStorage only.
 */

import { mnemonicNew, mnemonicToPrivateKey, mnemonicValidate } from '@ton/crypto'
import {
  WalletContractV4,
  SendMode,
  internal,
  beginCell,
  type Cell,
} from '@ton/ton'
import { parseTonAddress, tonToNano } from '../utils/address'

/**
 * Derive the WalletKeys type from @ton/crypto's KeyPair — avoids declaring
 * 'Buffer' as a global (not available in the browser without the polyfill).
 */
export type WalletKeys = Awaited<ReturnType<typeof mnemonicToPrivateKey>>

export type WalletInfo = {
  /** user-friendly non-bounceable, test-only form (0Q…) */
  address: string
  mnemonic: string[] // 24 words
  keys: WalletKeys
}

/** Comment payloads are stored in the message body; keep them well inside one cell chain. */
export const MAX_COMMENT_BYTES = 120

/** Generate a brand new 24-word mnemonic and derive the wallet address */
export async function generateWallet(): Promise<WalletInfo> {
  const mnemonic = await mnemonicNew(24)
  return deriveWallet(mnemonic)
}

/**
 * Normalise user-entered seed words: lowercase, collapse whitespace, drop the
 * numbering people paste along with their backup ("1. word 2. word").
 */
export function normalizeMnemonicInput(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/[0-9]+[.)]\s*/g, ' ')
    .replace(/[^a-z\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
}

/**
 * Derive a wallet from an existing mnemonic.
 *
 * The checksum is verified first. `mnemonicToPrivateKey` happily derives a
 * keypair from *any* 24 words, so without this check a single mistyped word
 * silently produced a different, empty wallet — and the user would conclude their
 * funds had vanished rather than that they had a typo.
 */
export async function deriveWallet(mnemonic: string[]): Promise<WalletInfo> {
  if (mnemonic.length !== 24) {
    throw new Error(`Expected 24 words, got ${mnemonic.length}.`)
  }
  const valid = await mnemonicValidate(mnemonic)
  if (!valid) {
    throw new Error(
      'This seed phrase failed its checksum. One or more words are misspelled or out of order.',
    )
  }
  return deriveWalletUnchecked(mnemonic)
}

/** Derivation without validation — used for freshly generated phrases. */
async function deriveWalletUnchecked(mnemonic: string[]): Promise<WalletInfo> {
  const keys = await mnemonicToPrivateKey(mnemonic)
  const contract = WalletContractV4.create({ workchain: 0, publicKey: keys.publicKey })
  const address = contract.address.toString({ urlSafe: true, bounceable: false, testOnly: true })
  return { address, mnemonic, keys }
}

/**
 * Build and sign a transfer cell.
 *
 * Returns a base64-encoded BOC ready for sendBoc(). seqno=0 is valid when the
 * wallet has not been deployed yet — that first transfer also deploys it.
 *
 * The bounce flag is taken from the recipient address rather than hardcoded:
 * sending non-bounceable to an address the sender explicitly marked bounceable
 * (EQ… / kQ…) burns the funds if that account does not exist, instead of
 * returning them.
 */
export async function buildTransferBoc(params: {
  keys: WalletKeys
  toAddress: string
  amountTon: string   // human-readable, e.g. "1.5"
  seqno: number
  comment?: string
}): Promise<string> {
  const { keys, toAddress, amountTon, seqno, comment } = params

  const parsed = parseTonAddress(toAddress)
  if (!parsed) throw new Error('Invalid recipient address.')

  const value = tonToNano(amountTon)
  if (value <= BigInt(0)) throw new Error('Amount must be greater than 0.')

  if (!Number.isInteger(seqno) || seqno < 0) throw new Error('Invalid wallet seqno.')

  const contract = WalletContractV4.create({ workchain: 0, publicKey: keys.publicKey })

  let body: Cell | undefined
  if (comment) {
    const bytes = new TextEncoder().encode(comment).length
    if (bytes > MAX_COMMENT_BYTES) {
      throw new Error(`Comment is too long (${bytes} bytes, max ${MAX_COMMENT_BYTES}).`)
    }
    body = beginCell().storeUint(0, 32).storeStringTail(comment).endCell()
  }

  const transfer = contract.createTransfer({
    seqno,
    secretKey: keys.secretKey,
    sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
    messages: [
      internal({
        to: parsed.address,
        value,
        bounce: parsed.isBounceable,
        body,
      }),
    ],
  })

  return transfer.toBoc().toString('base64')
}
