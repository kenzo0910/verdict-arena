"use client";

import { useEffect, useState } from "react";

interface Entry {
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

const EXPLORER = "https://chainscan-galileo.0g.ai";

function ModeBadge({ mode }: { mode: string }) {
  if (mode === "broker")
    return <span className="pill live">● LIVE · 0G Compute (TEE)</span>;
  if (mode === "router")
    return <span className="pill router">● 0G Compute (router)</span>;
  return <span className="pill demo">● demo mode (no live 0G)</span>;
}

function winnerLabel(e: Entry) {
  if (e.winner === "A") return e.optionA;
  if (e.winner === "B") return e.optionB;
  return "Draw";
}

export default function Home() {
  const [question, setQuestion] = useState("");
  const [optionA, setOptionA] = useState("");
  const [optionB, setOptionB] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [current, setCurrent] = useState<Entry | null>(null);
  const [feed, setFeed] = useState<Entry[]>([]);
  const [reverify, setReverify] = useState<{
    verified: boolean;
    note: string;
  } | null>(null);
  const [reloading, setReloading] = useState(false);

  async function loadFeed() {
    try {
      const r = await fetch("/api/history");
      setFeed(await r.json());
    } catch {
      /* noop */
    }
  }

  useEffect(() => {
    loadFeed();
  }, []);

  async function submit() {
    setError("");
    setReverify(null);
    if (!question.trim() || !optionA.trim() || !optionB.trim()) {
      setError("Fill in the dispute and both positions.");
      return;
    }
    setLoading(true);
    try {
      const r = await fetch("/api/verdict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, optionA, optionB }),
      });
      const data = await r.json();
      if (!r.ok) {
        setError(data?.error ?? "Something went wrong.");
      } else {
        setCurrent(data);
        loadFeed();
      }
    } catch (e: any) {
      setError(e?.message ?? "Network error.");
    } finally {
      setLoading(false);
    }
  }

  async function doReverify(e: Entry) {
    setReloading(true);
    setReverify(null);
    try {
      const r = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: e.rootHash
          ? JSON.stringify({ rootHash: e.rootHash })
          : JSON.stringify({
              provider: e.provider,
              content: e.content,
              chatId: e.chatId,
            }),
      });
      setReverify(await r.json());
    } catch (err: any) {
      setReverify({ verified: false, note: err?.message ?? "verify failed" });
    } finally {
      setReloading(false);
    }
  }

  const presets = [
    [
      "Is a hot dog a sandwich?",
      "Yes, bread + filling = sandwich",
      "No, it's its own category",
    ],
    [
      "Tabs vs spaces for indentation?",
      "Tabs — accessible and configurable",
      "Spaces — consistent rendering",
    ],
    ["Best first Pokémon?", "Charmander", "Squirtle"],
  ];

  return (
    <div className="wrap">
      <div className="header">
        <div className="brand">
          Verdict<span>Arena</span>
        </div>
        {current ? (
          <ModeBadge mode={current.mode} />
        ) : (
          <span className="pill">powered by 0G</span>
        )}
      </div>
      <p className="tagline">
        The crowd brings the duels. An AI judge renders the verdict on{" "}
        <strong>TEE-verifiable 0G Compute</strong> — and every verdict ships
        with a proof you can check yourself. The judge provably can&apos;t be
        swapped or rigged.
      </p>

      <div className="card">
        <div className="field">
          <label>The dispute</label>
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="e.g. Is a hot dog a sandwich?"
          />
        </div>
        <div className="row2">
          <div className="field">
            <label>Position A</label>
            <textarea
              rows={2}
              value={optionA}
              onChange={(e) => setOptionA(e.target.value)}
              placeholder="Argue for A"
            />
          </div>
          <div className="field">
            <label>Position B</label>
            <textarea
              rows={2}
              value={optionB}
              onChange={(e) => setOptionB(e.target.value)}
              placeholder="Argue for B"
            />
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <button className="btn" onClick={submit} disabled={loading}>
            {loading ? "Judging…" : "Render verdict"}
          </button>
          {presets.map((p, i) => (
            <button
              key={i}
              className="btn ghost"
              onClick={() => {
                setQuestion(p[0]);
                setOptionA(p[1]);
                setOptionB(p[2]);
              }}
              style={{ fontSize: 13, padding: "8px 12px" }}
            >
              {p[0]}
            </button>
          ))}
        </div>
        {error && <div className="err">{error}</div>}

        {current && (
          <div className="verdict">
            <div className="head">
              <div className="winner">
                Winner: <em>{winnerLabel(current)}</em>
              </div>
              <span className="conf">{current.confidence}% confidence</span>
            </div>
            <p className="reasoning">{current.reasoning}</p>

            <div className="proof">
              <h4>
                <span className={`dot ${current.verified ? "ok" : "no"}`} />{" "}
                Verify this judgment
              </h4>
              <div className="kv">
                <div className="k">Mode</div>
                <div className="v">{current.mode}</div>
                <div className="k">Model</div>
                <div className="v">{current.model}</div>
                <div className="k">TEE provider</div>
                <div className="v">{current.provider ?? "—"}</div>
                <div className="k">chatId</div>
                <div className="v">{current.chatId ?? "—"}</div>
                <div className="k">Storage root</div>
                <div className="v">{current.rootHash ?? "—"}</div>
                <div className="k">Tx</div>
                <div className="v">
                  {current.txHash ? (
                    <a
                      href={`${EXPLORER}/tx/${current.txHash}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {current.txHash}
                    </a>
                  ) : (
                    "—"
                  )}
                </div>
              </div>
              <div className={`vstatus ${current.verified ? "ok" : "no"}`}>
                {current.verified
                  ? "TEE signature verified ✓"
                  : current.verifyNote}
              </div>
              <div style={{ marginTop: 12 }}>
                <button
                  className="btn ghost"
                  onClick={() => doReverify(current)}
                  disabled={reloading || current.mode !== "broker"}
                  style={{ fontSize: 13, padding: "8px 14px" }}
                >
                  {reloading ? "Re-verifying…" : "Re-verify independently"}
                </button>
                {reverify && (
                  <span
                    className={`vstatus ${reverify.verified ? "ok" : "no"}`}
                    style={{ marginLeft: 12 }}
                  >
                    {reverify.verified ? "verified ✓" : reverify.note}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="section-title">Arena feed</div>
      {feed.length === 0 && (
        <p className="note">No verdicts yet. Be the first to start a duel.</p>
      )}
      {feed.map((e) => (
        <div className="feed-item" key={e.id}>
          <p className="q">
            <strong>{e.question}</strong> → {winnerLabel(e)}
          </p>
          <div className="meta">
            <span>{e.confidence}%</span>
            <ModeBadge mode={e.mode} />
            <span
              className={`vstatus ${e.verified ? "ok" : "no"}`}
              style={{ fontSize: 12 }}
            >
              <span className={`dot ${e.verified ? "ok" : "no"}`} />{" "}
              {e.verified ? "verified" : "unverified"}
            </span>
            {e.txHash && (
              <a
                href={`${EXPLORER}/tx/${e.txHash}`}
                target="_blank"
                rel="noreferrer"
              >
                tx
              </a>
            )}
          </div>
        </div>
      ))}

      <div className="foot">
        VerdictArena runs the judge on the 0G Compute Network — models execute
        inside a TEE and sign each response, so anyone can verify which model
        rendered a verdict and that it wasn&apos;t tampered with. Verdicts are
        pinned to 0G Storage (content-addressed root hash) and anchored on 0G
        Chain (Galileo testnet). Built for the 0G Zero Cup.
      </div>
    </div>
  );
}
