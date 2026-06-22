import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getVerdict } from "@/lib/zerog-compute";
import { storeJSON } from "@/lib/zerog-storage";
import { addEntry, type Entry } from "@/lib/store";

export const runtime = "nodejs";
// Vercel Hobby caps serverless functions at 60s. Broker-mode TEE inference +
// 0G Storage upload must fit inside this; router/demo modes are well under.
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const question = String(body?.question ?? "").trim();
  const optionA = String(body?.optionA ?? "").trim();
  const optionB = String(body?.optionB ?? "").trim();
  if (!question || !optionA || !optionB) {
    return NextResponse.json(
      { error: "question, optionA and optionB are all required" },
      { status: 400 },
    );
  }

  // 1) Render the verdict on 0G Compute (TEE-signed in broker mode).
  const v = await getVerdict(question, optionA, optionB);

  // 2) Pin the full verdict bundle to 0G Storage -> immutable root hash.
  const bundle = {
    question,
    optionA,
    optionB,
    ...v,
    createdAt: new Date().toISOString(),
  };
  const stored = await storeJSON(bundle);

  // 3) Index it for the arena feed.
  const entry: Entry = {
    id: crypto.randomUUID(),
    question,
    optionA,
    optionB,
    winner: v.winner,
    confidence: v.confidence,
    reasoning: v.reasoning,
    mode: v.mode,
    model: v.model,
    provider: v.provider,
    chatId: v.chatId,
    content: v.content,
    verified: v.verified,
    verifyNote: v.verifyNote,
    rootHash: stored?.rootHash ?? null,
    txHash: stored?.txHash ?? null,
    createdAt: bundle.createdAt,
  };
  addEntry(entry);

  return NextResponse.json(entry);
}
