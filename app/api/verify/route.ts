import { NextRequest, NextResponse } from "next/server";
import { reVerify } from "@/lib/zerog-compute";
import { fetchJSON } from "@/lib/zerog-storage";

export const runtime = "nodejs";
export const maxDuration = 60;

// Independent verification endpoint. Pass either:
//   { provider, content, chatId }   -> re-check the TEE signature directly, or
//   { rootHash }                    -> pull the bundle from 0G Storage first,
//                                       then re-check its signature.
// This is the "verify this judgment yourself" path — the proof a centralized
// AI judge cannot offer.
export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  let provider = body?.provider as string | undefined;
  let content = body?.content as string | undefined;
  let chatId = body?.chatId as string | undefined;
  const rootHash = body?.rootHash as string | undefined;

  if (rootHash) {
    const bundle = await fetchJSON(rootHash);
    if (!bundle) {
      return NextResponse.json(
        { error: "could not fetch bundle from 0G Storage for that root hash" },
        { status: 404 },
      );
    }
    provider = bundle.provider ?? provider;
    content = bundle.content ?? content;
    chatId = bundle.chatId ?? chatId;
  }

  if (!provider || !content || !chatId) {
    return NextResponse.json(
      {
        error:
          "need {provider, content, chatId} or a {rootHash} that resolves to broker-mode data",
      },
      { status: 400 },
    );
  }

  const r = await reVerify(provider, content, chatId);
  return NextResponse.json({
    ...r,
    provider,
    chatId,
    rootHash: rootHash ?? null,
  });
}
