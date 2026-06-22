import fs from "fs";
import path from "path";

// Lightweight local index of verdicts for the history feed. The *proof* of each
// verdict lives on 0G (root hash + TEE signature); this file is only a
// convenience index so the arena can list recent duels. Not a source of truth.
const DIR = path.join(process.cwd(), ".data");
const FILE = path.join(DIR, "history.json");

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

function ensure(): void {
  if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });
  if (!fs.existsSync(FILE)) fs.writeFileSync(FILE, "[]");
}

export function list(): Entry[] {
  ensure();
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch {
    return [];
  }
}

export function addEntry(e: Entry): void {
  ensure();
  const all = list();
  all.unshift(e);
  fs.writeFileSync(FILE, JSON.stringify(all.slice(0, 100), null, 2));
}

export function get(id: string): Entry | null {
  return list().find((e) => e.id === id) ?? null;
}
