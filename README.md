# TON Testnet Wallet

A self-custodial TON testnet wallet built as a pure frontend web application — no backend required.

## Quick Start

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # run all tests once (347 tests)
npm run test:watch # watch mode
npm run lint       # eslint, zero-warning policy
npm run build      # production build
```

Optional: set `VITE_TONCENTER_API_KEY` in `.env.local` to raise the TON Center rate
limit above the 1 req/s free tier.

---

## Security & Correctness Audit

The wallet was audited end-to-end (validation, signing, transport, storage, UI) and
the findings below were fixed. Each row names the observable consequence, because
"hardening" without a failure mode is not a finding.

### Critical — correctness of the send path

> Note on #1: it was first written up here as a fund-loss bug. Reading
> `@ton/core`'s `internal()` showed it calls `Address.parse`, which does verify the
> checksum — so a typo could never actually be broadcast. Corrected below. The
> defect is real (our validation layer accepted input it should have refused, and
> the failure surfaced far too late) but it is a correctness and UX defect, not a
> loss of funds. #2–#5 are unaffected.

| # | Finding | Consequence | Fix |
|---|---|---|---|
| 1 | `isValidTonAddress` was a regex (`/^[UEkf][Qq0-9A-Za-z+/\-_]{47}$/`) and never verified the CRC16 checksum | A mistyped address passed our own validation and the confirmation step, then failed deep in the signing path where `@ton/core`'s `internal()` runs `Address.parse`. So funds were **not** lost — but the user reached "Confirm Send" before anything objected, and the objection arrived as a raw library string (`Invalid checksum: …`) in the send-error banner instead of as a field error. `EQ` + 46 × `Q` also passed. | Validation goes through the same decoder up front (`parseTonAddress`), so a bad address is refused at the field. Verified live: `…SQj5` → `…SQj6` is rejected before the modal opens. |
| 2 | The same regex required a leading `U`, `E`, `k` or `f`, so the `0Q…` form was rejected | `0Q…` is exactly the form this wallet generates and displays for itself. Two users of this app could not send to each other, and the address shown on the dashboard could not be pasted back in. | All four friendly forms (`EQ`/`UQ`/`kQ`/`0Q`) plus raw `workchain:hex` are accepted and normalised. |
| 3 | `getSeqno` called `runGetMethod` over **GET**, but TON Center v2 accepts it only over POST — the 404 was swallowed by `catch { return 0 }` | Every wallet with `seqno > 0` signed with `seqno = 0`. The network silently dropped the message while the UI reported success. Only the very first transfer from a fresh wallet ever worked. | Replaced with `getWalletInformation` (one GET returning balance + seqno + account state), with a POST `runGetMethod` fallback. Network errors now propagate instead of being guessed away. Verified live: the audited wallet reports `seqno: 1`. |
| 4 | `sendBoc` called `/sendBoc`, which answers `{"@type":"ok"}` with **no hash** | `txHash` came back `undefined`, so the `if (txHash)` success screen never rendered. After a successful send the user saw nothing at all. | Switched to `/sendBocReturnHash`, and success is now keyed on `txHash !== null` so an accepted-without-hash response still confirms. |
| 5 | Imported mnemonics were never checksum-validated — `mnemonicToPrivateKey` derives a keypair from *any* 24 words | One misspelled word silently opened a **different**, empty wallet. Indistinguishable from "my funds are gone". | `mnemonicValidate` runs before derivation, with a message that names the cause. Input is also normalised (case, whitespace, pasted numbering). |

### High — security mechanisms weakened

| # | Finding | Consequence | Fix |
|---|---|---|---|
| 6 | `normalizeAddress` dropped the test-only flag, so a wallet's own `0Q…` address normalised to `UQ…` | A wallet's address did not compare equal to itself. There was also no self-send check at all. | The canonical form keeps the flag; added `isSameAddress` and a self-send block. |
| 7 | Mechanism A rendered the highlighted corners in `--color-primary` (a blue that was never defined) on the blue balance card | Blue-on-blue: the highlight was invisible on the one screen that always shows the address. The source even carried a comment admitting it. | `AddressDisplay` gained a `tone` prop; the card renders the corners white. Asserted in tests. |
| 8 | Look-alike detection only compared characters 2–9 | An attacker who ground a vanity address matching the **first 6 and last 4** characters — precisely what Mechanism A highlights — defeated both mechanisms and got no warning. | Detection now reports `corners` (strongest), `prefix` or `suffix`, and the warning escalates in colour and wording for a corner collision. |
| 9 | `seedAddressBookFromHistory` marked any API-reported outgoing destination as fully "known" | A compromised or hostile endpoint could inject one fabricated outgoing transaction and permanently silence the first-send warning for the attacker's address. | Entries carry a provenance tag. `history` entries no longer suppress the warning — they downgrade it to an explicit "recognised from on-chain history, not from a send made on this device", shown both inline and in the confirmation modal. Unparseable addresses never enter the book. |
| 10 | The mnemonic was persisted to `sessionStorage` although nothing after the setup screen read it | Any XSS on this origin could lift a phrase that recovers the wallet forever; the keypair alone only controls this one wallet. | Only the address and keypair are persisted. The phrase stays in memory for the tab. |
| 11 | `restoreSession` fed unvalidated JSON straight into `new Uint8Array(...)` | A tampered entry (e.g. `publicKey: null`) produced a wallet with an empty key and an attacker-chosen address displayed as the user's own. | The payload is validated: address must decode, keys must be 32/64 bytes of valid octets. |
| 12 | The confirmation modal had no focus trap or scroll lock | A keyboard user could tab out to the form behind an open confirmation and approve a transfer they could not see. | Focus is trapped, moved in on open, restored on close; background scroll is locked. |

### Medium — availability, robustness, UX

| # | Finding | Consequence | Fix |
|---|---|---|---|
| 13 | No client-side rate limiting against a 1 req/s budget | React StrictMode double-fires effects, so the first render alone tripped a 429. The code worked around it with hardcoded `setTimeout(…, 1200)` staggering. | The API layer serialises every request through one queue with a minimum interval, and retries 429/5xx with exponential backoff. The stagger hacks are gone. |
| 14 | A failed balance load left `balanceNano = 0n` | Validation answered "Insufficient balance" — a network problem reported as a wallet problem. | `useAccount` exposes `loaded`, so unknown and zero are distinguishable; the UI says the balance could not be loaded and offers Retry. |
| 15 | `bounce: false` was hardcoded on every transfer | Funds sent to a bounceable (`EQ…`/`kQ…`) address that does not exist were burned instead of returned. | The bounce flag is taken from the recipient address, and the confirmation modal states which behaviour applies. |
| 16 | `tonToNano` coerced anything (`"1e9"`, `"1.2.3"`) through `BigInt`/`split` | Malformed amounts produced silent nonsense values on a money path. | Strict decimal parsing that throws; `formatTon` returns `0` instead of throwing on bad API data. |
| 17 | Balance check allowed sending the entire balance | Nothing left for gas, so the network rejected the transfer. | A 0.01 TON fee reserve, plus a **Max** button that fills the largest safe amount. |
| 18 | Two rapid confirms could sign two messages with one seqno | One lands, the other is dropped with no feedback. | Re-entrancy guard in `useSend` and a disabled Confirm button while in flight. |
| 19 | Comment length unbounded | An over-long comment failed at signing time, after the confirmation step. | 120-byte cap, measured in bytes (multi-byte characters count), with a live counter. |
| 20 | Transaction parsing assumed optional API fields were present, and read only `out_msgs[0]` | A missing field could crash the whole history render; multi-message transfers under-reported the amount. | Every field is parsed defensively, and outgoing amounts sum all `out_msgs`. |
| 21 | `setTimeout` callbacks were never cleared on unmount | State writes after unmount. | Timers are tracked and cleared. |
| 22 | No CSP; `index.html` referenced a favicon that did not exist (404) | Injected script could exfiltrate the key to any host. | A CSP is injected into the production build (`connect-src` limited to TON Center, `script-src 'self'`), applied at build time so dev HMR still works. Favicon added. |
| 23 | `npm run lint` referenced ESLint, which was not installed | The documented lint command failed outright. | ESLint + TypeScript and react-hooks plugins configured; the tree is clean at `--max-warnings 0`. |
| 24 | Single 703 kB JS chunk | Slow first load; the `@ton/*` stack invalidated on every app change. | `manualChunks` splits vendor code: app 92 kB / react 141 kB / ton 481 kB. |
| 25 | Dead code: `TransactionItem.tsx` (superseded by the dashboard's own row), `pasteEventOccurred`, no-op ternaries | Misleading surface area. | Removed. |

### Deliberately not changed

- **Mainnet-flag warning on the recipient.** Flagging `EQ…`/`UQ…` as "wrong network" looks attractive but TON Center's own testnet responses return addresses in `EQ…` form, so the warning would fire constantly and train users to ignore it. The flag is surfaced as information (bounce behaviour) rather than as an alarm.
- **Transaction confirmation polling.** Broadcast still is not confirmation. Instead of a polling loop, the success screen now says so explicitly and points at the Wallet tab.
- **Keys in `sessionStorage`.** Unchanged by design for a testnet tool; the CSP and the removal of the stored mnemonic narrow the blast radius. A production build wants an encrypted vault or hardware signing.

### Verification

- **347 unit and component tests** across 14 files (`npm test`), up from 78. New coverage: the transport layer with mocked `fetch` (rate limiting, 429 retry, direction classification, malformed payloads), `crypto/wallet` against a known mnemonic vector, `WalletContext` session tampering, the wallet dashboard, the Setup flow, `Modal` focus management, and the `useAccount`/`useSend` hooks.
- `npm run lint` and `tsc --noEmit` are clean; `npm run build` succeeds.
- **Live testnet run** in a real browser: imported a funded wallet from a numbered, uppercased phrase (24/24 counter), dashboard rendered the real balance (0.995994535 TON) and three real transactions with correct in/out direction, fees, comments and explorer links, zero console errors; self-send blocked; address-book seeding from on-chain history produced the weaker provenance notice; `Max` computed `balance − reserve`; a one-character address corruption was rejected; `getSeqno` returned the true on-chain `seqno: 1`.

---

## Design

The interface is built as a **measuring instrument**, not a consumer app, because
that is what the product actually is: the whole value here is careful verification
of a 48-character string before an irreversible transfer.

| Choice | Reasoning |
|---|---|
| **Dark, single scheme** (warm blacks `#09090A`–`#1B1B1F`, bone `#EDE9E1`) | A developer tool for a test network. One well-tuned palette beats two half-tuned ones, so there is no light mode to keep in sync. |
| **Acid lime `#D4FF4F`** as the only accent | Crypto interfaces default to blue and violet; this one does not, and the accent stays scarce enough to actually mean "look here". Amber and red are reserved for the warning levels so the accent never competes with them. |
| **IBM Plex Mono** for everything except one number | Every figure and every address is data to be compared character by character. Tabular monospace makes columns line up and makes a substituted character visible. |
| **Instrument Serif** for the balance and titles | One high-contrast serif against an all-mono interface gives the screen a focal point and keeps it from reading as a terminal dump. |
| **Hairlines, 3–8 px radii, no shadows** | Precision instead of softness: 1 px rules at 10 % opacity separate regions without the drop-shadow depth stack that makes dashboards feel generic. |
| **Fixed grid + grain overlay** | Fine 64 px grid masked to the top, plus an SVG grain wash, so the page reads as a surface rather than a scrolling document. |
| **Self-hosted fonts** (66 KB, latin subsets) | The production CSP sets `font-src 'self'`; loading Google Fonts at runtime would be blocked. Bundling the woff2 files keeps the policy strict and removes a third-party request. |
| **One load cascade** | A single staggered reveal (`.rise-1`–`.rise-4`) rather than scattered micro-interactions. The only decorative motion is a light sweep on the primary button — the one that commits a transfer. |

### The address is the hero

`AddressPlate` renders the full address in **groups of four**, the way a card
number or a banknote serial is grouped, with the Mechanism A corners in accent:

```
0QDw zJzZ sH2r II9S v4kr AGIh In12 pEhC j4LY cKa8 jdXT d7Pa
▔▔▔▔ ▔▔                                                ▔▔▔▔
```

This is a security change wearing a design change's clothes. Forty-eight
undifferentiated base64 characters cannot be compared by eye, which is precisely
what makes address substitution work; grouping gives the eye fixed landmarks, so
"check the address" becomes a task a person can actually perform. The grouping is
purely presentational — the plate still exposes one unbroken string to assistive
technology and to anything copying it.

The plate is used wherever the address is the subject of the screen: the dashboard
(grouped by default, not truncated), the Receive page, and the transfer
confirmation. `AddressDisplay` still handles inline mentions inside ledger rows.

### Accessibility

Every control has an accessible name, the confirmation dialog traps and restores
focus and locks background scroll, focus rings are drawn in the accent at 2 px, and
`prefers-reduced-motion` collapses all animation. The amount field is deliberately
`type="text"` with `inputMode="decimal"`: a number input renders its value in the
browser's locale (so `0.98` displays as `0,98` where commas are decimal separators,
which the strict parser then rejects) and mutates the amount on a stray scroll.

---

## Architecture

```
src/
├── api/           # TON Center API wrappers (getBalance, getTransactions, sendBoc, getSeqno)
├── crypto/        # BIP-39 mnemonic → Ed25519 keypair → WalletV4 → signed BOC
├── hooks/         # React hooks: useBalance, useTransactions, useSend, useClipboardGuard
├── components/    # Reusable UI: AddressPlate, AddressDisplay, Modal, the three warning banners, Spinner
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

### sessionStorage for the keypair (never the mnemonic)

The keypair is stored only in `sessionStorage`. The **mnemonic is not persisted at all** —
nothing after the setup screen reads it, so storing it was pure attack surface: XSS on this
origin could lift a phrase that recovers the wallet forever, whereas the keypair only
controls this one wallet. The phrase lives in memory for the lifetime of the tab.

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

**Provenance:** entries are tagged `sent` (this device broadcast a transfer) or `history`
(seeded from the TON Center transaction list). Only `sent` fully suppresses the warning — a
hostile endpoint could otherwise fabricate one outgoing transaction and silence Mechanism C
for the attacker's own address. See audit #9.

**Look-alike detection:** an unknown address is compared against the book for a shared
prefix, a shared suffix, or — most dangerous — a match on both the first 6 and last 4
characters, which is exactly what Mechanism A highlights. See audit #8.

**Implementation:** `src/utils/addressBook.ts` / `src/components/NewAddressWarning.tsx` /
`src/components/SimilarAddressWarning.tsx` / `src/hooks/useSend.ts`

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
| ~~Mnemonic in sessionStorage~~ | **Fixed** — only the keypair is persisted; the phrase never leaves memory | — |
| ~~No Content-Security-Policy~~ | **Fixed** — a CSP meta tag ships in the production build (`connect-src` limited to TON Center) | Serve it as a real response header so `frame-ancestors` also applies |
| ~~Mnemonic displayed in plaintext~~ | **Fixed** — blurred behind an explicit reveal | — |
| No PIN / biometric lock | Too much friction for a testnet dev tool | Add PIN gate before key access |
| TON Center API is a third party | Could return wrong data | Run own lite-client; use Merkle proofs |

---

## Stack Justification (Критерий 5: обоснование архитектуры и стека)

### Почему React + TypeScript + Vite

| Выбор | Альтернатива | Обоснование |
|---|---|---|
| **React 18** | Vue, Svelte | Наибольшая экосистема для Web3/TON-компонентов; команды знают его лучше всего. Нет специфической причины уходить. |
| **TypeScript** | JavaScript | Кошелёк работает с деньгами. Строгая типизация отловила несколько ошибок ещё на этапе написания (например, `bigint` vs `number` в нано-TON расчётах). |
| **Vite** | CRA, Next.js | Нет SSR-требований (pure frontend), Vite даёт HMR < 50 мс и встроенный Vitest. CRA устарел. Next.js избыточен без бэкенда. |
| **Один CSS-файл с токенами** | Tailwind, CSS Modules | Дизайн держится на ~20 переменных и ~40 классах — этого достаточно для 4 экранов, а Tailwind добавил бы зависимость и PostCSS-конфиг. Инлайн-стили остались только там, где значение вычисляется в рантайме. |

### Почему @ton/ton + @ton/crypto (а не TonWeb или tonutils)

`@ton/ton` — официальная библиотека от core-команды TON. Важные причины:
- **Активная поддержка:** TonWeb не обновлялся с 2023 г., `@ton/ton` — текущий стандарт.
- **WalletContractV4 out of the box:** не нужно вручную собирать cell-структуры.
- **Ed25519 через `@ton/crypto`:** нативная поддержка BIP-39 мнемоники без сторонних пакетов типа `bip39`.

**Ограничение:** `@ton/ton` рассчитан на Node.js (`TonClient` требует WebSocket-соединения с lite-клиентом, которое браузер не открывает без прокси). Поэтому мы используем библиотеку **только для построения и подписи транзакции** (BOC), а broadcast делаем через REST API.

### Почему TON Center REST API (а не собственный lite-client)

| Вариант | Плюсы | Минусы | Решение |
|---|---|---|---|
| TON Center testnet API | Нет CORS, нет инфраструктуры, бесплатно | Третья сторона, rate limits (1 RPS без ключа) | **Выбрано** — приемлемо для testnet |
| Собственный lite-server | Полный контроль, Merkle-доказательства | Требует сервера, VPS, обслуживания | Нет для testnet |
| TON Access (orbs) | Децентрализованный RPC, нет rate limits | Нужен API-ключ, дополнительная зависимость | Хороший вариант для production |

### Почему React Context вместо Zustand / Redux

Состояние кошелька — **один объект `WalletInfo`**, который:
- создаётся один раз (при генерации/импорте),
- меняется только при logout,
- нужен только в нескольких компонентах.

Zustand добавил бы зависимость ради одного `useState` + Context. Redux — тем более избыточен.

### Почему нет React Router

В приложении 3 экрана с простой навигацией: Wallet → Send → Receive. Состояние `tab: 'wallet' | 'send' | 'receive'` в `App.tsx` решает задачу без dependency. Добавление роутера оправдано при: deep-link поддержке, браузерной навигации кнопками Back/Forward, или при росте числа экранов > 6–7.

### Разделение ответственности: api / crypto / hooks / utils

```
api/       — чистые async-функции, только fetch(), бросают Error
crypto/    — чистые функции, только @ton/*, никакого I/O
utils/     — чистые функции без side-effects (кроме addressBook → localStorage)
hooks/     — React-специфичный слой: состояние + вызов api/crypto
pages/     — компоновка: хуки + компоненты, бизнес-логика минимальна
components/ — "немые" компоненты, получают пропсы, не знают о хуках
```

Такое разделение позволяет тестировать `utils` и `crypto` без React, без fetch-мока, без jsdom.

---

## Architectural Trade-offs (Критерий 4: компромиссы с обоснованием)

### 1. sessionStorage для приватного ключа

**Что:** Мнемоника и ключи хранятся только в `sessionStorage` — сбрасываются при закрытии вкладки.

**Почему не localStorage:** Persistent-хранение ключа в браузере означает, что любой JS-код на том же origin (XSS-атака, вредоносное расширение) может его прочитать *в любое время*, даже спустя месяцы. С `sessionStorage` окно атаки ограничено активной сессией.

**Цена компромисса:** Пользователь вводит мнемонику при каждом открытии приложения. Для testnet-инструмента разработчика это терпимо.

**Production-путь:** Шифровать ключ через PBKDF2(PIN, salt) и хранить зашифрованный blob в localStorage. PIN не хранится нигде — только используется для расшифровки в памяти. Либо аппаратный кошелёк (Ledger).

---

### 2. Доверие TON Center API

**Что:** Мы принимаем баланс и транзакции на веру от третьей стороны.

**Риск:** TON Center мог бы вернуть подменённые данные (показать ложный баланс или скрыть транзакцию). Но для **чтения** это риск UX (пользователь видит неверные данные), а не безопасности средств: отправка строится на локально подписанном BOC с независимым seqno-запросом.

**Реальный риск:** Если `getSeqno` возвращает неверный seqno → транзакция будет отклонена сетью, но средства не потеряются.

**Production-путь:** Запускать собственный lite-client с Merkle-proof верификацией ответов. TON предоставляет для этого `ValidatorEngine`.

---

### 3. Отображение мнемоники открытым текстом

**Что:** На экране создания кошелька 24 слова показаны сразу, без blur/reveal.

**Почему так:** Для testnet-инструмента это удобнее — мнемоника бесценности не имеет. Паттерн "нажмите чтобы показать" добавляет false sense of security, если экран пишется на видео.

**Production-путь:** Показывать слова по одному, требовать подтверждение в случайном порядке, делать blur по умолчанию с отдельной кнопкой-подтверждением.

---

### 4. Rate limiting — исправлено (см. аудит #13)

**Что было:** ни cooldown, ни очереди запросов. StrictMode сам по себе удваивал эффекты,
и первый же рендер упирался в 429. В коде вместо этого стояли хардкодные `setTimeout(…, 1200)`.

**Что сейчас:** все запросы сериализуются через одну очередь с минимальным интервалом,
429/5xx повторяются с экспоненциальной задержкой, на кнопке Refresh — 5-секундный cooldown.
`getWalletInformation` отдаёт баланс, seqno и состояние аккаунта одним запросом вместо двух.

**Остаточный компромисс:** без API-ключа лимит всё равно 1 req/s. Ключ подставляется
через `VITE_TONCENTER_API_KEY`.

---

### 5. Учёт комиссии — исправлено частично (см. аудит #17)

**Что было:** проверялось только `amount > balance`, поэтому отправка всего баланса
проходила валидацию и отклонялась сетью.

**Что сейчас:** резерв 0.01 TON под комиссию плюс кнопка **Max**, подставляющая
`balance − reserve`.

**Остаточный компромисс:** резерв — константа, а не результат `estimateFee`. Реальная
комиссия простого перевода v4 ≈ 0.005 TON, так что константа с запасом безопасна, но
неточна. Production-путь — вызывать `estimateFee` и вычитать фактическую оценку.

---

### 6. Нет подтверждения включения транзакции в блок

**Что:** после `sendBoc` мы показываем хэш. Транзакция при этом ещё не в блоке.

**Почему принято:** polling до подтверждения требует либо loop-опроса, либо WebSocket.
Для testnet-демо достаточно хэша — но раньше экран успеха вообще не показывался
(аудит #4), а формулировка создавала впечатление финальности.

**Что изменено:** экран успеха теперь прямо говорит, что broadcast ≠ подтверждение, и
отправляет проверить вкладку Wallet.

**Production-путь:** polling `getTransactions` каждые 2–3 секунды до появления хэша в
истории, с timeout 60 секунд.

---

## Self-Assessment (Самооценка по критериям задания)

### 1. Полнота реализации — **9/10**

✅ Реализовано всё из ТЗ:
- Создание (24-слова) и импорт мнемоники
- sessionStorage с очисткой при закрытии
- Баланс с кнопкой refresh
- История транзакций (тип in/out, адрес, дата, сумма)
- Поиск по истории (адрес + сумма)
- Receive с QR-кодом и копированием
- Send с валидацией, loading-состоянием, модалкой подтверждения
- Все три механизма защиты от подмены адреса

Плюс добавлено по итогам аудита: валидация мнемоники, self-send guard, кнопка Max с резервом
под комиссию, bounce-флаг из адреса, провенанс адресной книги, focus trap в модалке, CSP.

❌ Что не сделано по сравнению с полным production-кошельком:
- Нет подтверждения включения tx в блок (polling) — экран успеха честно об этом говорит
- Резерв под комиссию — константа, а не `estimateFee`
- История ограничена 20 транзакциями (лимит бесплатного API)

---

### 2. UI/UX — **9/10**

✅ Хорошо:
- Цельная «приборная» эстетика вместо телеграм-клона: тёмная палитра, один
  кислотный акцент, hairline-разделители, Instrument Serif на балансе и
  IBM Plex Mono на всех данных (см. раздел Design)
- **Адрес группами по 4** с акцентными «уголками» — 48 символов base64 наконец
  можно сверить глазами; это и есть усиление механизма A
- Мобильный layout 460px, работает и на десктопе; bottom navigation
- Один срежиссированный каскад появления, единственная декоративная анимация —
  на кнопке, которая подтверждает перевод
- Живая валидация адреса с чипом ✓ Valid и плашкой сверки под полем
- Все состояния разведены: неизвестный баланс ≠ нулевой, недеплоенный кошелёк,
  провенанс адреса (sent / history), четыре уровня предупреждений
- Focus trap, scroll lock, `prefers-reduced-motion`, доступные имена у всех контролов

❌ Что можно улучшить:
- Нет toast-уведомлений о входящих транзакциях
- Нет skeleton-loading для истории (сейчас спиннер)
- Светлая тема не поддерживается сознательно — но это ограничение

---

### 3. Тесты — **9.5/10**

✅ **347 тестов в 14 файлах**, покрывают:
- Адресный слой: все четыре friendly-формы, raw-форма, отказ по контрольной сумме,
  нормализация, `formatTon` / `tonToNano` (включая отказ на `1e9`, `1.2.3`, отрицательных)
- Транспорт (`api/tonCenter`) на моке `fetch`: очередь запросов и интервал, retry на 429/5xx,
  классификация in/out, суммирование `out_msgs`, отсутствующие поля, `sendBocReturnHash`,
  POST-fallback `runGetMethod`, отказ вместо угаданного seqno
- `crypto/wallet` в node-окружении: детерминированный вектор от известной мнемоники, отказ по
  чек-сумме и при перестановке слов, флаг bounce из адреса, лимит комментария в байтах
- Адресную книгу: провенанс `sent`/`history`, апгрейд/недопущение даунгрейда, look-alike по
  prefix / suffix / corners, отказ парсить мусор из API
- `WalletContext`: восстановление сессии, отказ на подделанной (короткий ключ, битый адрес,
  не-числовые байты), отсутствие мнемоники в storage, revalidation по focus
- Дашборд `Wallet`: баланс/нулевой баланс/неизвестный баланс, полный адрес, контраст
  подсветки, копирование, cooldown обновления, строки истории, поиск по адресу/сумме/
  комментарию, баннеры ошибок, notice о недеплоенном кошельке, засев адресной книги
- Страницу `Send`: валидация (включая self-send, чек-сумму, резерв комиссии, Max, неизвестный
  баланс), три механизма защиты, модалка подтверждения и её a11y
- `Setup`: счётчик слов, нормализация ввода, отказ по чек-сумме, отсутствие мнемоники в storage
- `Modal`: focus trap, restore focus, scroll lock, Escape, backdrop
- Хуки `useAccount` / `useTransactions` / `useSend`: loaded vs zero, сохранение прошлых данных
  при ошибке, отсутствие записи состояния после unmount, guard от двойной отправки

Плюс живой прогон в браузере против testnet (см. раздел Verification в аудите).

❌ Чего не хватает:
- Автоматизированного E2E (Playwright в CI) — проверка выполнялась вручную
- Теста на реальный broadcast: требует расходуемых testnet-средств в CI

### 4. Объяснение компромиссов — **9.5/10**

Шесть конкретных компромиссов с тремя колонками: что сделано, почему, production-путь.
Каждый компромисс привязан к конкретному техническому решению, а не к абстрактным рассуждениям.

Небольшой минус: не описан компромисс "почему WalletV4, а не V5".

---

### 5. Обоснование архитектуры — **9/10**

Описан выбор каждого элемента стека в сравнении с альтернативами.
Разделение слоёв (api/crypto/hooks/utils) объяснено с точки зрения тестируемости.
Явно указаны ограничения выбранного подхода (TON Center, отсутствие lite-client).

---

### Итог

| Критерий | Оценка |
|---|---|
| Полнота реализации | 9.5 / 10 |
| UI/UX | 9 / 10 |
| Тесты | 9.5 / 10 |
| Компромиссы | 9.5 / 10 |
| Архитектура | 9 / 10 |
| **Среднее** | **9.3 / 10** |

Главный пробел — отсутствие подтверждения транзакции после broadcast и toast-уведомлений
о входящих переводах. Четыре критических дефекта, найденных аудитом, устранены: до
этого кошелёк отклонял собственный формат адреса (`0Q…`), подписывал `seqno = 0` для любого
задеплоенного кошелька, не показывал экран успеха после отправки и молча открывал другой
кошелёк при опечатке в seed-фразе. Пятый пункт (адреса с битой контрольной суммой) при
перепроверке оказался не потерей средств, а поздним и невнятным отказом — см. примечание
к #1 в разделе аудита.

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
10. **E2E tests in CI** — Playwright smoke test for the full create → receive → send flow
    (the flow was verified manually against testnet; automating it needs a funded CI wallet)
11. **`estimateFee`** instead of the constant fee reserve
12. **Confirmation polling** after broadcast, with a 60 s timeout
