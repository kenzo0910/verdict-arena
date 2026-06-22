# VerdictArena — a verifiable AI judge on 0G

> The crowd brings the duels. An AI judge renders the verdict on **TEE-verifiable
> 0G Compute** — and every verdict ships with a proof you can check yourself.
> The judge provably can't be swapped or rigged.

Built for the **0G Zero Cup**. AI-native, and 0G does the load-bearing work.

---

## Why this can't be a centralized app (the anti-bolt-on test)

The whole product is _"you can trust this verdict because you can verify which
model produced it and that nobody tampered with it."_

- A normal `OpenAI + sign-it-on-our-server` bot requires you to **trust the
  operator**. Nothing stops them from swapping the model, editing the answer, or
  faking the signature.
- **0G Compute** runs the model inside a **TEE (TeeML)**. Each response is signed
  by a key that lives inside the enclave, and the SDK's `processResponse()`
  checks that signature against the response `chatId`. Remove 0G and the
  "verify this judgment" button — the entire point of the app — is impossible.

So the core (0G Compute, verifiable inference) passes the test. 0G Storage and 0G
Chain play supporting roles:

| 0G primitive   | Role                                                                                                           | Load-bearing?      |
| -------------- | -------------------------------------------------------------------------------------------------------------- | ------------------ |
| **0G Compute** | TEE-signed inference + `processResponse` verification                                                          | **Yes — the core** |
| **0G Storage** | Pins each verdict bundle at a content-addressed root hash so it can be re-downloaded and re-verified by anyone | Supporting         |
| **0G Chain**   | `VerdictRegistry` contract makes verdicts public, on-chain records (optional R32 upgrade)                      | Supporting         |

---

## How it works

```
duel (question + A + B)
      │
      ▼
/api/verdict ── getVerdict() ─────────────► 0G Compute (broker, TEE)
      │                                       • acknowledgeProviderSigner
      │                                       • getRequestHeaders
      │                                       • POST /chat/completions
      │                                       • processResponse() → verified ✓
      ├── storeJSON(bundle) ───────────────► 0G Storage → { rootHash, txHash }
      └── addEntry() ──────────────────────► local index (arena feed only)

/api/verify ({rootHash})  ── fetch bundle from 0G Storage → reVerify() → verified ✓
```

The `verify` endpoint lets **anyone re-check a stored verdict independently** — it
pulls the bundle back from 0G Storage by root hash and re-runs the TEE signature
check. That is the proof a centralized judge cannot offer.

---

## Quick start

```bash
npm install
cp env.example .env.local      # then edit .env.local
npm run dev                    # http://localhost:3000
```

### Three modes (auto-detected)

| Mode       | Trigger                 | What you get                                                                                                  |
| ---------- | ----------------------- | ------------------------------------------------------------------------------------------------------------- |
| **broker** | `ZG_PRIVATE_KEY` set    | TEE-verifiable inference + working verify button. **Use this for the submission.**                            |
| **router** | `ZG_ROUTER_API_KEY` set | Real 0G Compute via the OpenAI-compatible gateway; no per-response TEE verify. Fastest first demo.            |
| **demo**   | nothing set             | Mock verdict so the UI runs with no funds. Clearly labelled in the UI — **never** present this as a real run. |

### Broker mode (full setup)

```bash
# 1) get test 0G  →  https://faucet.0g.ai
# 2) put the funded wallet key in .env.local  →  ZG_PRIVATE_KEY=0x...
# 3) fund the compute ledger and list TEE providers:
npm run setup:ledger 0.5
# 4) (optional) pin a provider:  ZG_PROVIDER=0x...
npm run dev
```

---

## Network (0G Galileo testnet)

|                 |                                                                                 |
| --------------- | ------------------------------------------------------------------------------- |
| RPC             | `https://evmrpc-testnet.0g.ai`                                                  |
| Chain ID        | `16602` _(verify in-wallet — some community sources list a stale value)_        |
| Faucet          | `https://faucet.0g.ai`                                                          |
| Explorer        | `https://chainscan-galileo.0g.ai`                                               |
| Storage indexer | `https://indexer-storage-testnet-turbo.0g.ai`                                   |
| Compute SDK     | `@0gfoundation/0g-compute-ts-sdk` _(legacy alias: `@0glabs/0g-serving-broker`)_ |
| Storage SDK     | `@0gfoundation/0g-storage-ts-sdk`                                               |

---

## Project layout

```
app/
  page.tsx              arena UI (duel form, verdict card, verify badge, feed)
  api/verdict/route.ts  render verdict on 0G Compute → pin to 0G Storage → index
  api/verify/route.ts   independent re-verification of a stored verdict
  api/history/route.ts  arena feed
lib/
  zerog-compute.ts      broker / router / demo inference + processResponse verify
  zerog-storage.ts      upload / download verdict bundles (root hash)
  store.ts              local feed index (not a source of truth)
contracts/
  VerdictRegistry.sol   optional on-chain registry (R32 upgrade)
scripts/
  setup-ledger.mjs      fund the compute ledger + list TEE providers
```

---

## Honesty notes (per Zero Cup rules)

- The demo must match the code. The UI always shows which **mode** produced a
  verdict; demo-mode verdicts are explicitly marked as not-live.
- The "verify" badge reflects the **actual** `processResponse` result — it is not
  a cosmetic checkmark.
- SDK method signatures can shift between versions. If verification always returns
  false, check the `processResponse(provider, content, chatId)` argument order
  against your installed SDK version (noted inline in `lib/zerog-compute.ts`).

---

## Roadmap (snapshot-per-round)

- **Group stage (23 Jun)** — duel → TEE-verified verdict → verify button → 0G Storage. ✅ this build
- **R32 (28 Jun)** — wire `VerdictRegistry` so every verdict is an on-chain record; show contract + explorer link.
- **R16 (4 Jul)** — public leaderboard, shareable verdict cards, polished docs/demo video.
- **8 Jul (final lock)** — harden the verify path under load; freeze.
