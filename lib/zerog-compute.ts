import { ethers } from "ethers";

// ── 0G Galileo testnet defaults (override via env) ────────────────────────────
export const ZG_RPC = process.env.ZG_RPC_URL || "https://evmrpc-testnet.0g.ai";
export const ZG_CHAIN_ID = Number(process.env.ZG_CHAIN_ID || 16602);
export const ROUTER_BASE =
  process.env.ZG_ROUTER_URL || "https://router-api.0g.ai/v1";

export type Mode = "broker" | "router" | "demo";

export interface VerdictResult {
  winner: "A" | "B" | "draw";
  confidence: number;
  reasoning: string;
  raw: string;
  mode: Mode;
  model: string;
  // The TEE provider (signer) address — the on-chain identity that signed the
  // response inside the enclave. This is what makes the verdict verifiable.
  provider: string | null;
  // chatId == the response id; the key the TEE signature is bound to.
  chatId: string | null;
  // The exact content sent to the model; needed to re-verify the signature.
  content: string;
  // True only when the TEE signature was checked and passed (broker mode).
  verified: boolean;
  verifyNote: string;
}

type Msg = { role: string; content: string };

function judgeMessages(question: string, a: string, b: string): Msg[] {
  const system =
    "You are VerdictArena, a strictly impartial AI judge. You are given a dispute and " +
    "two positions, A and B. Decide which position is more correct. Respond with ONLY " +
    'compact JSON, no prose: {"winner":"A|B|draw","confidence":0-100,"reasoning":"<=80 words"}. ' +
    "Be fair, specific, and explain the deciding factor.";
  const user = `DISPUTE: ${question}\n\nPOSITION A: ${a}\n\nPOSITION B: ${b}`;
  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

function parseVerdict(text: string): {
  winner: "A" | "B" | "draw";
  confidence: number;
  reasoning: string;
} {
  try {
    const m = text.match(/\{[\s\S]*\}/);
    const j = JSON.parse(m ? m[0] : text);
    const w = String(j.winner ?? "draw").toUpperCase();
    return {
      winner: w === "A" || w === "B" ? (w as "A" | "B") : "draw",
      confidence: Math.max(0, Math.min(100, Number(j.confidence ?? 50))),
      reasoning: String(j.reasoning ?? text).slice(0, 600),
    };
  } catch {
    return {
      winner: "draw",
      confidence: 50,
      reasoning: (text || "").slice(0, 600),
    };
  }
}

// ── BROKER mode: TEE-verifiable inference via the 0G Compute SDK ───────────────
let _broker: any = null;
const _acked = new Set<string>();

async function getBroker(): Promise<any | null> {
  if (_broker) return _broker;
  const pk = process.env.ZG_PRIVATE_KEY;
  if (!pk) return null;
  // Dynamic import keeps the Node-only SDK out of the client bundle.
  const mod: any = await import("@0gfoundation/0g-compute-ts-sdk");
  const create =
    mod.createZGComputeNetworkBroker ??
    mod.default?.createZGComputeNetworkBroker;
  const provider = new ethers.JsonRpcProvider(ZG_RPC);
  const wallet = new ethers.Wallet(pk, provider);
  _broker = await create(wallet);
  return _broker;
}

async function pickProvider(broker: any): Promise<string> {
  if (process.env.ZG_PROVIDER) return process.env.ZG_PROVIDER;
  const services: any[] = await broker.inference.listService();
  const chat =
    services.find((s) =>
      String(s.serviceType ?? "")
        .toLowerCase()
        .includes("chat"),
    ) ?? services[0];
  if (!chat)
    throw new Error("no inference providers available from listService()");
  return chat.provider ?? chat.providerAddress;
}

async function runBroker(
  messages: Msg[],
  q: string,
  a: string,
  b: string,
): Promise<VerdictResult> {
  const broker = await getBroker();
  const providerAddr = await pickProvider(broker);

  // Make sure the compute ledger is funded. Best-effort: ignore if already set up.
  try {
    await broker.ledger.getLedger();
  } catch {
    try {
      await broker.ledger.addLedger(0.1);
    } catch {
      /* run `npm run setup:ledger` if this keeps failing */
    }
  }

  // A provider's signer must be acknowledged once before its responses verify.
  if (!_acked.has(providerAddr)) {
    try {
      await broker.inference.acknowledgeProviderSigner(providerAddr);
    } catch {
      /* already acknowledged */
    }
    _acked.add(providerAddr);
  }

  const meta = await broker.inference.getServiceMetadata(providerAddr);
  const endpoint: string = meta.endpoint;
  const model: string = meta.model;

  const content = messages[messages.length - 1].content;
  // Single-use signed headers tying this request to the funded account.
  const headers = await broker.inference.getRequestHeaders(
    providerAddr,
    content,
  );

  const res = await fetch(`${endpoint}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({ model, messages }),
  });
  const data: any = await res.json();
  const text: string = data?.choices?.[0]?.message?.content ?? "";
  const chatId: string | null = data?.id ?? null;

  // The crux: verify the TEE signature for this response. A centralized
  // model cannot produce this proof — this is the anti-bolt-on artifact.
  let verified = false;
  let verifyNote = "not verified";
  try {
    // NOTE: arg order can differ across SDK versions; if verification always
    // returns false, try processResponse(providerAddr, chatId, content).
    const ok = await broker.inference.processResponse(
      providerAddr,
      content,
      chatId,
    );
    verified = !!ok;
    verifyNote = verified
      ? "TEE signature verified"
      : "verification returned false";
  } catch (e: any) {
    verifyNote = "verify error: " + (e?.message ?? String(e));
  }

  return {
    ...parseVerdict(text),
    raw: text,
    mode: "broker",
    model,
    provider: providerAddr,
    chatId,
    content,
    verified,
    verifyNote,
  };
}

// ── ROUTER mode: real 0G Compute via the OpenAI-compatible gateway ────────────
async function runRouter(messages: Msg[]): Promise<VerdictResult> {
  const key = process.env.ZG_ROUTER_API_KEY!;
  const model = process.env.ZG_MODEL || "llama-3.3-70b-instruct";
  const res = await fetch(`${ROUTER_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({ model, messages }),
  });
  const data: any = await res.json();
  const text: string = data?.choices?.[0]?.message?.content ?? "";
  return {
    ...parseVerdict(text),
    raw: text,
    mode: "router",
    model,
    provider: null,
    chatId: data?.id ?? null,
    content: messages[messages.length - 1].content,
    verified: false,
    verifyNote:
      "router mode: per-response TEE verification is not exposed here — use broker mode for verifiable inference",
  };
}

// ── DEMO mode: deterministic mock so the UI runs with no funds (clearly flagged) ─
function runDemo(q: string, a: string, b: string): VerdictResult {
  const winner: "A" | "B" = (q.length + a.length) % 2 === 0 ? "A" : "B";
  return {
    winner,
    confidence: 60,
    reasoning:
      "DEMO MODE — this is a placeholder verdict, not a live 0G inference. Set ZG_PRIVATE_KEY (broker) or ZG_ROUTER_API_KEY (router) to call real 0G Compute.",
    raw: "",
    mode: "demo",
    model: "demo",
    provider: null,
    chatId: null,
    content: `${q}|${a}|${b}`,
    verified: false,
    verifyNote: "demo mode — not a real inference",
  };
}

export async function getVerdict(
  question: string,
  optionA: string,
  optionB: string,
): Promise<VerdictResult> {
  const messages = judgeMessages(question, optionA, optionB);
  if (process.env.ZG_PRIVATE_KEY)
    return runBroker(messages, question, optionA, optionB);
  if (process.env.ZG_ROUTER_API_KEY) return runRouter(messages);
  return runDemo(question, optionA, optionB);
}

// Independent re-verification: anyone can re-check a stored verdict's TEE signature.
export async function reVerify(
  provider: string,
  content: string,
  chatId: string,
): Promise<{ verified: boolean; note: string }> {
  const broker = await getBroker();
  if (!broker)
    return { verified: false, note: "broker not configured on this server" };
  try {
    const ok = await broker.inference.processResponse(
      provider,
      content,
      chatId,
    );
    return {
      verified: !!ok,
      note: ok ? "TEE signature verified" : "verification returned false",
    };
  } catch (e: any) {
    return {
      verified: false,
      note: "verify error: " + (e?.message ?? String(e)),
    };
  }
}
