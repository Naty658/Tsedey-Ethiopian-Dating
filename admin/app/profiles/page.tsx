// admin/app/profiles/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../../src/lib/firebase";

type ProfileRow = {
  id: string;
  uid?: string;
  email?: string;
  name?: string;
  nameLower?: string;
  age?: string | number;
  gender?: string;
  interestedIn?: string;
  lookingFor?: string;
  bio?: string;
  photo?: string;
  extraPhotos?: string[];
  from?: string;
  country?: string;
  city?: string;
  isPremium?: boolean;
  isComplete?: boolean;
  updatedAt?: any;
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

export default function ProfilesPage() {
  const [rows, setRows] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [onlyIncomplete, setOnlyIncomplete] = useState(false);

  const normalized = q.trim().toLowerCase();

useEffect(() => {
  const searchMode = normalized.length > 0;

  if (searchMode) {
    let alive = true;
    setLoading(true);

    (async () => {
      try {
        const snap = await getDocs(collection(db, "profiles")); // fetch all profiles
        if (!alive) return;
        const arr: ProfileRow[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        setRows(arr);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }

  const qq = query(collection(db, "profiles"), orderBy("updatedAt", "desc"), limit(30));
  const unsub = onSnapshot(
    qq,
    (snap) => {
      const arr: ProfileRow[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      setRows(arr);
      setLoading(false);
    },
    () => setLoading(false)
  );

  return () => unsub();
}, [normalized]);


  const filtered = useMemo(() => {
    let r = rows;

    if (onlyIncomplete) r = r.filter((x) => x.isComplete === false);

    if (!normalized) return r;

    return r.filter((x) => {
      const hay = [
        x.id,
        x.uid,
        x.email,
        x.name,
        x.nameLower,
        x.country,
        x.city,
        x.from,
        x.gender,
        x.interestedIn,
        x.lookingFor,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return hay.includes(normalized);
    });
  }, [rows, normalized, onlyIncomplete]);

  const stats = useMemo(() => {
    const total = rows.length;
    const premium = rows.filter((r) => !!r.isPremium).length;
    const complete = rows.filter((r) => r.isComplete !== false).length; // treat missing as complete-ish
    const incomplete = rows.filter((r) => r.isComplete === false).length;
    return { total, premium, complete, incomplete };
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
              Profiles
            </div>

            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950">
              Review profiles
            </h1>

            <p className="mt-1 text-sm text-zinc-600">
              {loading
                ? "Loading…"
                : `${stats.total} total • ${stats.complete} complete • ${stats.incomplete} incomplete • ${stats.premium} premium`}
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
                <Badge>Newest first</Badge>
                <Badge>30 latest • search = all</Badge>
                <Badge>Search: name / email / uid / location</Badge>
              </div>

              <div className="flex w-full flex-col gap-2 sm:w-[520px] sm:flex-row sm:items-center">
                <div className="flex-1">
                  <input
                    className="w-full rounded-2xl border border-zinc-200 bg-white/90 px-4 py-3 text-sm shadow-sm outline-none placeholder:text-zinc-400 focus:border-zinc-300"
                    placeholder="Search profiles… (name, email, uid, city)"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                  />
                </div>

                <button
                  onClick={() => setOnlyIncomplete((v) => !v)}
                  className={[
                    "rounded-2xl border px-4 py-3 text-sm shadow-sm transition",
                    onlyIncomplete
                      ? "border-zinc-900 bg-zinc-900 text-white"
                      : "border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50",
                  ].join(" ")}
                >
                  {onlyIncomplete ? "Showing incomplete" : "Only incomplete"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* grid */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <ProfileCard key={p.id} p={p} />
          ))}
        </div>

        {!loading && filtered.length === 0 ? (
          <div className="mt-10 rounded-3xl border border-zinc-200 bg-white/80 p-6 text-sm text-zinc-600">
            No profiles match “{q}”.
          </div>
        ) : null}
      </div>
    </main>
  );
}

function ProfileCard({ p }: { p: ProfileRow }) {
  const name = p.name || p.nameLower || "Unknown";
  const profileDocId = p.id;
const uid = p.uid || p.id;

  const pill =
    p.isComplete === false
      ? "border-zinc-200 bg-white text-zinc-900"
      : p.isPremium
      ? "border-zinc-200 bg-zinc-900 text-white"
      : "border-zinc-200 bg-zinc-50 text-zinc-700";

  return (
    <Link
      href={`/profiles/${profileDocId}`}
      className="group relative overflow-hidden rounded-[26px] border border-zinc-200 bg-white/85 p-5 shadow-sm transition hover:bg-white hover:border-zinc-300"
    >
      <div className="pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-100 bg-[radial-gradient(circle_at_22%_12%,rgba(255,255,255,0.95),transparent_55%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.55] bg-[linear-gradient(135deg,rgba(99,102,241,0.10),transparent_42%)]" />

      <div className="relative flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="h-12 w-12 overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-100">
            {p.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.photo} alt="" className="h-full w-full object-cover" />
            ) : null}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold tracking-tight text-zinc-900">{name}</h3>
              <span className={`rounded-full border px-2 py-0.5 text-[11px] ${pill}`}>
                {p.isComplete === false ? "Incomplete" : p.isPremium ? "Premium" : "Standard"}
              </span>
            </div>

            <p className="mt-1 text-xs text-zinc-600">
              {p.gender ? p.gender : "—"}
              {p.age ? ` • ${p.age}` : ""}
              {p.interestedIn ? ` • Interested in: ${p.interestedIn}` : ""}
            </p>

            <p className="mt-2 line-clamp-2 text-sm text-zinc-600">
              {p.bio || "—"}
            </p>
          </div>
        </div>

        <span className="mt-1 text-zinc-400 transition group-hover:text-zinc-900">↗</span>
      </div>

      <div className="relative mt-4 flex items-center justify-between gap-3 text-xs text-zinc-500">
        <div className="truncate">
          {p.city || p.country || p.from ? (
            <>
              {(p.city || "").trim()}
              {p.city && p.country ? ", " : ""}
              {(p.country || "").trim()}
              {!p.city && !p.country && p.from ? `From: ${p.from}` : ""}
            </>
          ) : (
            "No location"
          )}
        </div>

        <div className="shrink-0">
          {p.updatedAt ? `Updated ${tsToText(p.updatedAt)}` : "—"}
        </div>
      </div>

      <div className="relative mt-4 h-px w-full bg-zinc-200" />
      <div className="relative mt-3 text-xs text-zinc-500 group-hover:text-zinc-900">
        Open /users/{uid}
      </div>
    </Link>
  );
}
