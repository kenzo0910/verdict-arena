import fs from "fs";
import os from "os";
import path from "path";

// Lightweight index of recent verdicts for the arena feed. The *proof* of each
// verdict lives on 0G (root hash + TEE signature); this is only a convenience
// index. Designed to be serverless-safe: it keeps an in-memory cache and
// best-effort persists to the OS temp dir (the only writable path on Vercel /
// most serverless runtimes). It NEVER throws — a read-only filesystem just
// means the feed lives in memory for the lifetime of the warm instance.
const FILE = path.join(os.tmpdir(), "verdict-arena-history.json");

export interface Entry {
  id: string;
  question: string;
  optionA: string;
  optionB: string;
  winner: string;
  confidence: number;
  reasoning: string;
  mode: string;
  model: string;
  provider: string | null;
  chatId: string | null;
  content: string;
  verified: boolean;
  verifyNote: string;
  rootHash: string | null;
  txHash: string | null;
  createdAt: string;
}

let mem: Entry[] = [];
let loaded = false;

function load(): void {
  if (loaded) return;
  loaded = true;
  try {
    if (fs.existsSync(FILE)) mem = JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch {
    mem = [];
  }
}

function persist(): void {
  try {
    fs.writeFileSync(FILE, JSON.stringify(mem, null, 2));
  } catch {
    // read-only filesystem (e.g. cold serverless instance) — keep in memory only.
  }
}

export function list(): Entry[] {
  load();
  return mem;
}

export function addEntry(e: Entry): void {
  load();
  mem.unshift(e);
  mem = mem.slice(0, 100);
  persist();
}

export function get(id: string): Entry | null {
  load();
  return mem.find((e) => e.id === id) ?? null;
}
