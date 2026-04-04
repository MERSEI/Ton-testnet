/**
 * Wallet generation and transaction signing.
 *
 * We use WalletContractV4 (the most common TON wallet type as of 2024).
 * Key derivation follows BIP-39 mnemonic → Ed25519 keypair via @ton/crypto.
 *
 * IMPORTANT: The private key / mnemonic NEVER leaves this module as a string
 * stored in any persistent storage — that responsibility belongs to
 * sessionStorage (see store/walletStore.ts).
 */

import { mnemonicNew, mnemonicToPrivateKey } from '@ton/crypto'
import {
  WalletContractV4,
  internal,
  beginCell,
  toNano,
  type Cell,
} from '@ton/ton'

/**
 * Derive WalletKeys type from @ton/crypto's KeyPair — avoids declaring 'Buffer'
 * as a global (not available in browser without polyfill).  The Buffer type is
 * resolved transitively through @ton/crypto's own @types/node dependency.
 */
export type WalletKeys = Awaited<ReturnType<typeof mnemonicToPrivateKey>>

export type WalletInfo = {
  address: string    // user-friendly non-bounceable (UQ…)
  mnemonic: string[] // 24 words
  keys: WalletKeys
}

/** Generate a brand new 24-word mnemonic and derive wallet address */
export async function generateWallet(): Promise<WalletInfo> {
  const mnemonic = await mnemonicNew(24)
  return deriveWallet(mnemonic)
}

/** Derive wallet from existing mnemonic */
export async function deriveWallet(mnemonic: string[]): Promise<WalletInfo> {
  const keys = await mnemonicToPrivateKey(mnemonic)
  const contract = WalletContractV4.create({ workchain: 0, publicKey: keys.publicKey })
  const address = contract.address.toString({ urlSafe: true, bounceable: false, testOnly: true })
  return { address, mnemonic, keys }
}

/**
 * Build and sign a transfer cell.
 *
 * Returns a base64-encoded BOC ready to be passed to sendBoc().
 * seqno=0 is accepted when the wallet hasn't been deployed yet — the first
 * transaction will also deploy the wallet contract.
 */
export async function buildTransferBoc(params: {
  keys: WalletKeys
  toAddress: string
  amountTon: string   // human-readable, e.g. "1.5"
  seqno: number
  comment?: string
}): Promise<string> {
  const { keys, toAddress, amountTon, seqno, comment } = params

  const contract = WalletContractV4.create({ workchain: 0, publicKey: keys.publicKey })

  // Build optional comment payload
  let body: Cell | undefined
  if (comment) {
    body = beginCell().storeUint(0, 32).storeStringTail(comment).endCell()
  }

  const transfer = contract.createTransfer({
    seqno,
    secretKey: keys.secretKey,
    messages: [
      internal({
        to: toAddress,
        value: toNano(amountTon),
        bounce: false,
        body,
      }),
    ],
  })

  // Serialize to BOC base64
  return transfer.toBoc().toString('base64')
}
