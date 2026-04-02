# TON Testnet Wallet

A self-custodial TON testnet wallet built as a pure frontend web application — no backend required.

## Quick Start

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # run all tests once
npm run test:watch # watch mode
npm run build      # production build
```

---

## Architecture

```
src/
├── api/           # TON Center API wrappers (getBalance, getTransactions, sendBoc, getSeqno)
├── crypto/        # BIP-39 mnemonic → Ed25519 keypair → WalletV4 → signed BOC
├── hooks/         # React hooks: useBalance, useTransactions, useSend, useClipboardGuard
├── components/    # Reusable UI: AddressDisplay, Modal, ClipboardWarning, NewAddressWarning, Spinner, TransactionItem
├── pages/         # Full screens: Setup, Wallet, Send, Receive
├── store/         # WalletContext (React Context + sessionStorage)
├── utils/         # Pure functions: address validation/formatting, addressBook, clipboard helpers
└── tests/         # Vitest setup file
```

### Key architectural decisions

| Decision | Rationale |
|---|---|
| No router library | Single-page tab navigation is sufficient for 3 screens; avoids a dependency |
| React Context (no Zustand) | Wallet state is simple — one object, rarely changes |
| TON Center API (no SDK node client) | The `@ton/ton` TonClient requires a direct RPC endpoint with CORS. `fetch()` to the REST API is simpler in a browser context |
| `@ton/ton` only for transaction building | We use the SDK to construct and sign the BOC, but delegate broadcast to the REST API |

---

## Storage Decisions

### sessionStorage for mnemonic/keys

The private key and mnemonic are stored only in `sessionStorage`.

**Why not `localStorage`?**
- `localStorage` persists indefinitely across browser sessions, even on shared devices.
- If a user accesses the wallet on a public computer, `localStorage` would leave the mnemonic accessible to the next person.
- `sessionStorage` is cleared automatically when the tab is closed, limiting the exposure window.

**Trade-off accepted:** The user must re-enter their mnemonic after every browser session. For a testnet tool this is acceptable. For production, hardware wallet integration or an encrypted vault with a password would be appropriate.

### localStorage for address book

The address book (known recipients) stores no sensitive data — it's just a list of addresses the user has previously sent to. Persisting it in `localStorage` across sessions improves UX and makes the first-send security warning more reliable.

---

## Three Anti-Spoofing Mechanisms

### A — Visual Address Highlighting

**Where:** Every `<AddressDisplay>` component across the entire UI (history, receive screen, send confirmation modal).

**How:** The first 6 and last 4 characters of an address are rendered in **bold blue**. The middle portion is normal weight.

**Why it helps:** Clipboard hijacking malware substitutes a different address that may share the first few characters with the intended target but differ in the middle or end. By always training users to check the highlighted corners, we make it harder for the swap to go unnoticed.

**Implementation:** `src/utils/address.ts → splitAddressForHighlight()` / `src/components/AddressDisplay.tsx`

---

### B — Clipboard Paste Warning

**Where:** The recipient address field on the Send page.

**How:** An `onPaste` event listener marks the field as "pasted". A non-dismissable yellow banner appears immediately: *"Address pasted from clipboard. Verify the full address before sending."* The banner disappears only when the user manually edits the field (types any character), indicating deliberate correction.

**Why it helps:** The most common delivery vector for address substitution is the clipboard. This banner creates a deliberate friction point that forces the user to look at the address again. Crucially, there is **no close button** — the only escape is manual verification.

**Limitation:** Cannot detect programmatic clipboard reads (e.g., if the page is served over `http://` and uses `document.execCommand`). Works for standard Ctrl+V / right-click paste flows.

**Implementation:** `src/hooks/useClipboardGuard.ts` / `src/components/ClipboardWarning.tsx`

---

### C — New Address Warning (Address Book)

**Where:** Inline hint below the address input + red block inside the confirmation modal.

**How:** After every successful outgoing transaction, the destination address is saved to `localStorage` under the key `ton_address_book`. When the user types a recipient address, we check if it's in the book. If not, we show a red warning: *"First time sending to this address."* The warning appears both before the confirmation modal and inside it, so it cannot be missed.

**Why it helps:** Legitimate recipients you've paid before are very unlikely to suddenly change their address. A new address appearing in the field is a signal to double-check. Over time the address book grows and the warnings become rare, reducing alert fatigue.

**Implementation:** `src/utils/addressBook.ts` / `src/components/NewAddressWarning.tsx` / `src/hooks/useSend.ts`

---

## What's Missing Without a Backend

| Feature | Impact | Compensation |
|---|---|---|
| Transaction history depth | Limited to last 20 txs from TON Center API | Acceptable for testnet |
| Real-time push notifications | No incoming tx alerts | User can manually refresh |
| Rate limiting | TON Center free tier has rate limits | Acceptable for personal testnet use |
| Mempool/pending state | Can't track unconfirmed txs | Hash shown after broadcast |
| Price feed / fiat conversion | No TON/USD rate | Not needed for testnet |

---

## Security Risks Accepted Consciously (Testnet Only)

| Risk | Decision | Production mitigation |
|---|---|---|
| Keys in sessionStorage | Readable by any JS on the same origin (XSS) | Hardware wallet / encrypted vault |
| No Content-Security-Policy headers | Would require a server | Add strict CSP headers on the hosting server |
| Mnemonic displayed in plaintext | Convenient for testnet recovery | Blur + reveal pattern; never display in production |
| No PIN / biometric lock | Too much friction for a testnet dev tool | Add PIN gate before key access |
| TON Center API is a third party | Could return wrong data | Run own lite-client; use Merkle proofs |

---

## What to Add Next

1. **PIN / password lock** — derive an encryption key from the PIN via PBKDF2, encrypt the session in `sessionStorage`
2. **Multiple accounts** — store a list of derived key indices
3. **Jetton (token) support** — query token balances and build Jetton transfer payloads
4. **NFT viewer** — list NFTs owned by the address
5. **WalletV5** support — the newer wallet contract with gasless transactions
6. **Deep-link support** — parse `ton://transfer/...` URLs pasted into the browser
7. **Ledger hardware wallet** — sign via `@ledgerhq/hw-transport-webusb`
8. **PWA / offline mode** — service worker + IndexedDB cache for the address book
9. **Fiat conversion** — integrate a price API for TON/USD
10. **E2E tests** — Playwright smoke test for the full create → receive → send flow
