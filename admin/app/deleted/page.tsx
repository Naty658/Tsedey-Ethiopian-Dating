// admin/app/deleted/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../../src/lib/firebase";

type DeletedRow = {
  id: string; // uid (doc id)
  uid?: string;
  email?: string | null;
  phone?: string | null;
  deletedAt?: any;
};

function tsToText(ts: any) {
  const d = ts?.toDate?.() ?? (ts ? new Date(ts) : null);
  if (!d) return "";
  return d.toLocaleString();
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-zinc-200 bg-white/70 px-2.5 py-1 text-[11px] text-zinc-700 shadow-sm backdrop-blur">
      {children}
    </span>
  );
}

export default function DeletedAccountsPage() {
  const [rows, setRows] = useState<DeletedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    const qq = query(collection(db, "deletedAccounts"), orderBy("deletedAt", "desc"), limit(200));
    const unsub = onSnapshot(
      qq,
      (snap) => {
        const arr: DeletedRow[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        setRows(arr);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, []);

  const normalized = q.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!normalized) return rows;
    return rows.filter((r) => {
      const hay = [r.id, r.uid, r.email, r.phone].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(normalized);
    });
  }, [rows, normalized]);

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-900">
      {/* background */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-gradient-to-b from-white via-zinc-50 to-zinc-50" />
        <div className="absolute -top-40 left-[-10%] h-[620px] w-[620px] rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(99,102,241,0.14),transparent_60%)] blur-3xl" />
        <div className="absolute top-[-120px] right-[-15%] h-[720px] w-[720px] rounded-full bg-[radial-gradient(circle_at_45%_40%,rgba(24,24,27,0.06),transparent_62%)] blur-3xl" />
        <div className="absolute inset-0 opacity-[0.10] [background-image:linear-gradient(to_right,rgba(0,0,0,.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,.06)_1px,transparent_1px)] [background-size:84px_84px]" />
      </div>

      <div className="relative mx-auto max-w-6xl p-6">
        {/* header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white/70 px-3 py-1 text-xs text-zinc-700 shadow-sm backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-zinc-900" />
              Deleted accounts
            </div>

            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950">
              Deletions audit
            </h1>

            <p className="mt-1 text-sm text-zinc-600">
              {loading ? "Loading…" : `${rows.length} records`}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-900 shadow-sm hover:bg-zinc-50"
            >
              Dashboard
            </Link>
            <Link
              href="/users"
              className="rounded-2xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-zinc-800"
            >
              Users
            </Link>
          </div>
        </div>

        {/* controls */}
        <div className="mt-6 overflow-hidden rounded-[28px] border border-zinc-200 bg-white/70 shadow-[0_1px_0_rgba(0,0,0,0.04),0_28px_90px_rgba(0,0,0,0.10)] backdrop-blur">
          <div className="relative p-5 sm:p-6">
            <div className="absolute inset-0 opacity-[0.55] bg-[radial-gradient(circle_at_18%_12%,rgba(99,102,241,0.14),transparent_46%),radial-gradient(circle_at_75%_30%,rgba(0,0,0,0.05),transparent_52%)]" />
            <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <Badge>deletedAccounts/{`{uid}`}</Badge>
                <Badge>Search: uid / email / phone</Badge>
                <Badge>Newest first</Badge>
              </div>

              <div className="w-full sm:w-[520px]">
                <input
                  className="w-full rounded-2xl border border-zinc-200 bg-white/90 px-4 py-3 text-sm shadow-sm outline-none placeholder:text-zinc-400 focus:border-zinc-300"
                  placeholder="Search deletions… (uid, email, phone)"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* list */}
        <div className="mt-6 grid gap-4">
          {filtered.map((r) => (
            <div
              key={r.id}
              className="relative overflow-hidden rounded-[26px] border border-zinc-200 bg-white/85 p-5 shadow-sm"
            >
              <div className="pointer-events-none absolute inset-0 opacity-[0.55] bg-[linear-gradient(135deg,rgba(99,102,241,0.10),transparent_42%)]" />

              <div className="relative flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold tracking-tight text-zinc-900">
                      {r.email || r.phone || r.id}
                    </h3>
                    <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[11px] text-zinc-700">
                      uid: {r.uid || r.id}
                    </span>
                  </div>

                  <div className="mt-2 grid gap-1 text-xs text-zinc-600">
                    <div>email: {r.email || "—"}</div>
                    <div>phone: {r.phone || "—"}</div>
                  </div>
                </div>

                <div className="shrink-0 text-xs text-zinc-600">
                  <div className="text-[11px] text-zinc-500">Deleted</div>
                  <div className="font-medium text-zinc-900">{tsToText(r.deletedAt) || "—"}</div>

                  <div className="mt-2">
                    <Link
                      href={`/users/${r.uid || r.id}`}
                      className="inline-flex items-center justify-center rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm hover:bg-zinc-50"
                    >
                      View user uid
                    </Link>
                  </div>
                </div>
              </div>

              <div className="relative mt-4 h-px w-full bg-zinc-200" />
              <div className="relative mt-3 text-xs text-zinc-500">
                Record: deletedAccounts/{r.id}
              </div>
            </div>
          ))}
        </div>

        {!loading && filtered.length === 0 ? (
          <div className="mt-10 rounded-3xl border border-zinc-200 bg-white/80 p-6 text-sm text-zinc-600">
            No deleted accounts match “{q}”.
          </div>
        ) : null}
      </div>
    </main>
  );
}
