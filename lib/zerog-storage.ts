import { ethers } from "ethers";
import fs from "fs";
import os from "os";
import path from "path";
import { ZG_RPC } from "./zerog-compute";

export const INDEXER =
  process.env.ZG_INDEXER_URL || "https://indexer-storage-testnet-turbo.0g.ai";

function tmpFile(prefix: string): string {
  const rand = Math.floor(Math.random() * 1e9).toString(36);
  return path.join(os.tmpdir(), `${prefix}-${Date.now()}-${rand}.json`);
}

// Upload a verdict bundle to 0G Storage (Log layer). Returns the content-addressed
// root hash + on-chain tx. The root hash IS the immutable fingerprint of the
// verdict — anyone can re-download the exact bytes and they cannot be silently
// edited. Returns null if storage is not configured / fails (never throws to the
// caller, so a storage hiccup can't sink the verdict flow).
export async function storeJSON(
  obj: unknown,
): Promise<{ rootHash: string; txHash: string } | null> {
  const pk = process.env.ZG_PRIVATE_KEY;
  if (!pk) return null;
  let tmp: string | null = null;
  try {
    const mod: any = await import("@0gfoundation/0g-storage-ts-sdk");
    const ZgFile = mod.ZgFile ?? mod.default?.ZgFile;
    const Indexer = mod.Indexer ?? mod.default?.Indexer;

    tmp = tmpFile("verdict");
    fs.writeFileSync(tmp, JSON.stringify(obj));

    const file = await ZgFile.fromFilePath(tmp);
    const [tree, treeErr] = await file.merkleTree();
    if (treeErr) throw treeErr;

    const provider = new ethers.JsonRpcProvider(ZG_RPC);
    const signer = new ethers.Wallet(pk, provider);
    const indexer = new Indexer(INDEXER);

    const [tx, uploadErr] = await indexer.upload(file, ZG_RPC, signer);
    try {
      await file.close?.();
    } catch {
      /* noop */
    }
    if (uploadErr) throw uploadErr;

    const rootHash =
      typeof tree?.rootHash === "function" ? tree.rootHash() : tree?.rootHash;
    return { rootHash: String(rootHash), txHash: String(tx) };
  } catch (e) {
    console.error("[0g-storage] storeJSON failed:", e);
    return null;
  } finally {
    if (tmp && fs.existsSync(tmp)) {
      try {
        fs.unlinkSync(tmp);
      } catch {
        /* noop */
      }
    }
  }
}

// Re-download a verdict bundle from 0G Storage by its root hash.
export async function fetchJSON(rootHash: string): Promise<any | null> {
  let out: string | null = null;
  try {
    const mod: any = await import("@0gfoundation/0g-storage-ts-sdk");
    const Indexer = mod.Indexer ?? mod.default?.Indexer;
    const indexer = new Indexer(INDEXER);
    out = tmpFile("download");
    const err = await indexer.download(rootHash, out, true);
    if (err) throw err;
    return JSON.parse(fs.readFileSync(out, "utf8"));
  } catch (e) {
    console.error("[0g-storage] fetchJSON failed:", e);
    return null;
  } finally {
    if (out && fs.existsSync(out)) {
      try {
        fs.unlinkSync(out);
      } catch {
        /* noop */
      }
    }
  }
}
