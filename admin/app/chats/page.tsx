// admin/app/chats/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { db } from "../../src/lib/firebase";

type ThreadRow = {
  id: string;          // threadId
  users?: string[];    // [uid1, uid2]
  updatedAt?: any;
  createdAt?: any;
};

type UserMini = {
  uid: string;
  name?: string;
  photo?: string;
  email?: string;
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

async function loadUserMini(uid: string): Promise<UserMini> {
  // prefer profiles/{uid} (your app writes it)
  const p = await getDoc(doc(db, "profiles", uid));
  if (p.exists()) {
    const d: any = p.data();
    return {
      uid,
      name: d?.name || d?.nameLower,
      photo: d?.photo,
      email: d?.email,
    };
  }

  // fallback users/{uid}
  const u = await getDoc(doc(db, "users", uid));
  if (u.exists()) {
    const d: any = u.data();
    return {
      uid,
      name: d?.name || d?.displayName || d?.username,
      photo: d?.photo || d?.photoURL,
      email: d?.email,
    };
  }

  return { uid };
}

export default function ChatsPage() {
  const [rows, setRows] = useState<ThreadRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState("");
  const [onlyRecent, setOnlyRecent] = useState(true);

  const [userByUid, setUserByUid] = useState<Record<string, UserMini>>({});
  const inflight = useRef<Set<string>>(new Set());

  useEffect(() => {
    const qq = query(collection(db, "threads"), orderBy("updatedAt", "desc"), limit(200));
    const unsub = onSnapshot(
      qq,
      (snap) => {
        const arr: ThreadRow[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        setRows(arr);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, []);

  // hydrate user minis (cached, best-effort)
  useEffect(() => {
    const uids = new Set<string>();
    rows.forEach((t) => (t.users || []).forEach((u) => u && uids.add(u)));

    uids.forEach((uid) => {
      if (!uid) return;
      if (userByUid[uid]) return;
      if (inflight.current.has(uid)) return;

      inflight.current.add(uid);
      loadUserMini(uid)
        .then((mini) => {
          setUserByUid((prev) => (prev[uid] ? prev : { ...prev, [uid]: mini }));
        })
        .finally(() => inflight.current.delete(uid));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  const normalized = q.trim().toLowerCase();

  const filtered = useMemo(() => {
    let r = rows;

    if (onlyRecent) {
      // hide threads with no updatedAt at top (cleaner)
      r = r.filter((t) => !!t.updatedAt);
    }

    if (!normalized) return r;

    return r.filter((t) => {
      const users = t.users || [];
      const a = users[0] || "";
      const b = users[1] || "";
      const an = userByUid[a]?.name || "";
      const bn = userByUid[b]?.name || "";

      const hay = [t.id, a, b, an, bn].join(" ").toLowerCase();
      return hay.includes(normalized);
    });
  }, [rows, normalized, onlyRecent, userByUid]);

  const stats = useMemo(() => {
    const total = rows.length;
    const withUpdated = rows.filter((r) => !!r.updatedAt).length;
    return { total, withUpdated };
  }, [rows]);

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
              Chats
            </div>

            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950">
              Threads & participants
            </h1>

            <p className="mt-1 text-sm text-zinc-600">
              {loading ? "Loading…" : `${stats.total} total • ${stats.withUpdated} active`}
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
              href="/reports"
              className="rounded-2xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-zinc-800"
            >
              Reports
            </Link>
          </div>
        </div>

        {/* controls */}
        <div className="mt-6 overflow-hidden rounded-[28px] border border-zinc-200 bg-white/70 shadow-[0_1px_0_rgba(0,0,0,0.04),0_28px_90px_rgba(0,0,0,0.10)] backdrop-blur">
          <div className="relative p-5 sm:p-6">
            <div className="absolute inset-0 opacity-[0.55] bg-[radial-gradient(circle_at_18%_12%,rgba(99,102,241,0.14),transparent_46%),radial-gradient(circle_at_75%_30%,rgba(0,0,0,0.05),transparent_52%)]" />
            <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <Badge>threads/{`{threadId}`}</Badge>
                <Badge>users: uidA_uidB</Badge>
                <Badge>Search: uid / name / threadId</Badge>
              </div>

              <div className="flex w-full flex-col gap-2 sm:w-[560px] sm:flex-row sm:items-center">
                <div className="flex-1">
                  <input
                    className="w-full rounded-2xl border border-zinc-200 bg-white/90 px-4 py-3 text-sm shadow-sm outline-none placeholder:text-zinc-400 focus:border-zinc-300"
                    placeholder="Search chats… (uid, name, threadId)"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                  />
                </div>

                <button
                  onClick={() => setOnlyRecent((v) => !v)}
                  className={[
                    "rounded-2xl border px-4 py-3 text-sm shadow-sm transition",
                    onlyRecent
                      ? "border-zinc-900 bg-zinc-900 text-white"
                      : "border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50",
                  ].join(" ")}
                >
                  {onlyRecent ? "Active only" : "Show all"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* list */}
        <div className="mt-6 grid gap-4">
          {filtered.map((t) => (
            <ThreadRowCard key={t.id} t={t} userByUid={userByUid} />
          ))}
        </div>

        {!loading && filtered.length === 0 ? (
          <div className="mt-10 rounded-3xl border border-zinc-200 bg-white/80 p-6 text-sm text-zinc-600">
            No chats match “{q}”.
          </div>
        ) : null}
      </div>
    </main>
  );
}

function ThreadRowCard({
  t,
  userByUid,
}: {
  t: ThreadRow;
  userByUid: Record<string, UserMini>;
}) {
  const users = t.users || [];
  const a = users[0] || "—";
  const b = users[1] || "—";

  const A = userByUid[a];
  const B = userByUid[b];

  return (
    <Link
      href={`/chats/${t.id}`}
      className="group relative overflow-hidden rounded-[26px] border border-zinc-200 bg-white/85 p-5 shadow-sm transition hover:bg-white hover:border-zinc-300"
    >
      <div className="pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-100 bg-[radial-gradient(circle_at_22%_12%,rgba(255,255,255,0.95),transparent_55%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.55] bg-[linear-gradient(135deg,rgba(99,102,241,0.10),transparent_42%)]" />

      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <StackAvatar a={A} b={B} />

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-base font-semibold tracking-tight text-zinc-900">
                {A?.name || a} <span className="text-zinc-400">↔</span> {B?.name || b}
              </h3>
              <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[11px] text-zinc-700">
                {t.id}
              </span>
            </div>

            <div className="mt-2 grid gap-1 text-xs text-zinc-600">
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                <span className="rounded-full border border-zinc-200 bg-white/70 px-2 py-0.5">
                  uidA: <span className="font-medium text-zinc-900">{a}</span>
                </span>
                <span className="rounded-full border border-zinc-200 bg-white/70 px-2 py-0.5">
                  uidB: <span className="font-medium text-zinc-900">{b}</span>
                </span>
              </div>

              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {A?.email ? (
                  <span className="truncate">A: {A.email}</span>
                ) : null}
                {B?.email ? (
                  <span className="truncate">B: {B.email}</span>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
          <div className="text-xs text-zinc-600">
            <div className="text-[11px] text-zinc-500">Updated</div>
            <div className="font-medium text-zinc-900">{tsToText(t.updatedAt) || "—"}</div>
          </div>

          <span className="inline-flex items-center gap-2 text-sm text-zinc-400 transition group-hover:text-zinc-900">
            Open <span>↗</span>
          </span>
        </div>
      </div>

      <div className="relative mt-4 h-px w-full bg-zinc-200" />
      <div className="relative mt-3 text-xs text-zinc-500 group-hover:text-zinc-900">
        Open /chats/{t.id}
      </div>
    </Link>
  );
}

function StackAvatar({ a, b }: { a?: UserMini; b?: UserMini }) {
  const A = a?.photo;
  const B = b?.photo;

  const Initial = ({ name }: { name?: string }) => (
    <div className="grid h-full w-full place-items-center text-sm font-semibold text-zinc-800">
      {(name?.[0] || "?").toUpperCase()}
    </div>
  );

  return (
    <div className="relative h-12 w-16">
      <div className="absolute left-0 top-0 h-12 w-12 overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-100">
        {A ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={A} alt="" className="h-full w-full object-cover" />
        ) : (
          <Initial name={a?.name} />
        )}
      </div>

      <div className="absolute left-6 top-0 h-12 w-12 overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-100 shadow-sm">
        {B ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={B} alt="" className="h-full w-full object-cover" />
        ) : (
          <Initial name={b?.name} />
        )}
      </div>
    </div>
  );
}
