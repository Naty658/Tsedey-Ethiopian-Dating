// admin/app/chats/[threadId]/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import {
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { db } from "../../../src/lib/firebase";

type MsgRow = {
  id: string;
  fromUid?: string;
  toUid?: string;
  text?: string;
  createdAt?: any;
  seenAt?: any;
  giftId?: string;
  giftKey?: string;
  giftImageUrl?: string;
  giftImagePath?: string;
};

type ThreadRow = {
  id: string;
  users?: string[];
  createdAt?: any;
  updatedAt?: any;
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

async function loadUserMini(uid: string): Promise<UserMini> {
  const p = await getDoc(doc(db, "profiles", uid));
  if (p.exists()) {
    const d: any = p.data();
    return { uid, name: d?.name || d?.nameLower, photo: d?.photo, email: d?.email };
  }
  const u = await getDoc(doc(db, "users", uid));
  if (u.exists()) {
    const d: any = u.data();
    return { uid, name: d?.name || d?.displayName || d?.username, photo: d?.photo || d?.photoURL, email: d?.email };
  }
  return { uid };
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-zinc-200 bg-white/70 px-2.5 py-1 text-[11px] text-zinc-700 shadow-sm backdrop-blur">
      {children}
    </span>
  );
}

export default function ChatThreadPage() {
  const params = useParams<{ threadId: string }>();
  const threadId = (params?.threadId as string) || "";

  const [thread, setThread] = useState<ThreadRow | null>(null);
  const [msgs, setMsgs] = useState<MsgRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [userByUid, setUserByUid] = useState<Record<string, UserMini>>({});
  const inflight = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!threadId) return;

    const unsub = onSnapshot(
      doc(db, "threads", threadId),
      (snap) => {
        if (!snap.exists()) {
          setThread(null);
          setLoading(false);
          return;
        }
        setThread({ id: snap.id, ...(snap.data() as any) });
        setLoading(false);
      },
      () => setLoading(false)
    );

    return () => unsub();
  }, [threadId]);

  useEffect(() => {
    if (!threadId) return;

    const q = query(
      collection(db, "threads", threadId, "messages"),
      orderBy("createdAt", "asc"),
      limit(300)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const arr: MsgRow[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        setMsgs(arr);
      },
      () => {}
    );

    return () => unsub();
  }, [threadId]);

  // hydrate participants
  useEffect(() => {
    const uids = new Set<string>();
    (thread?.users || []).forEach((u) => u && uids.add(u));
    msgs.forEach((m) => {
      if (m.fromUid) uids.add(m.fromUid);
      if (m.toUid) uids.add(m.toUid);
    });

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
  }, [thread?.users, msgs.length]);

  const title = useMemo(() => {
    const u = thread?.users || [];
    if (u.length !== 2) return `Thread ${threadId}`;
    const a = userByUid[u[0]]?.name || u[0];
    const b = userByUid[u[1]]?.name || u[1];
    return `${a} ↔ ${b}`;
  }, [thread?.users, userByUid, threadId]);

  const participants = useMemo(() => {
    const u = thread?.users || [];
    return u.map((uid) => ({
      uid,
      name: userByUid[uid]?.name,
      photo: userByUid[uid]?.photo,
      email: userByUid[uid]?.email,
    }));
  }, [thread?.users, userByUid]);

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
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white/70 px-3 py-1 text-xs text-zinc-700 shadow-sm backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-zinc-900" />
              Chat thread
            </div>

            <h1 className="mt-3 truncate text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-950">
              {title}
            </h1>

            <p className="mt-1 text-sm text-zinc-600">
              {loading ? "Loading…" : `${msgs.length} messages`}
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              <Pill>threadId: {threadId}</Pill>
              {thread?.updatedAt ? <Pill>updated: {tsToText(thread.updatedAt)}</Pill> : null}
              {thread?.createdAt ? <Pill>created: {tsToText(thread.createdAt)}</Pill> : null}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/chats"
              className="rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-900 shadow-sm hover:bg-zinc-50"
            >
              Back
            </Link>
            <Link
              href="/reports"
              className="rounded-2xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-zinc-800"
            >
              Reports
            </Link>
          </div>
        </div>

        {/* participants */}
        <div className="mt-6 overflow-hidden rounded-[28px] border border-zinc-200 bg-white/70 shadow-[0_1px_0_rgba(0,0,0,0.04),0_28px_90px_rgba(0,0,0,0.10)] backdrop-blur">
          <div className="relative p-5 sm:p-6">
            <div className="absolute inset-0 opacity-[0.55] bg-[radial-gradient(circle_at_18%_12%,rgba(99,102,241,0.14),transparent_46%),radial-gradient(circle_at_75%_30%,rgba(0,0,0,0.05),transparent_52%)]" />

            <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-3">
                {participants.length ? (
                  participants.map((p) => (
                    <div
                      key={p.uid}
                      className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white/85 px-3 py-2 shadow-sm"
                    >
                      <div className="h-10 w-10 overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-100">
                        {p.photo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.photo} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="grid h-full w-full place-items-center text-sm font-semibold text-zinc-800">
                            {(p.name?.[0] || "?").toUpperCase()}
                          </div>
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-zinc-900">
                          {p.name || p.uid}
                        </div>
                        <div className="truncate text-xs text-zinc-600">{p.uid}</div>
                        {p.email ? <div className="truncate text-xs text-zinc-500">{p.email}</div> : null}
                      </div>

                      <Link
                        href={`/users/${p.uid}`}
                        className="ml-2 rounded-xl border border-zinc-200 bg-white px-3 py-1 text-xs text-zinc-900 hover:bg-zinc-50"
                      >
                        User
                      </Link>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-zinc-600">
                    {loading ? "Loading participants…" : "No participants field on this thread."}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <Pill>threads/{threadId}</Pill>
                <Pill>messages (max 300)</Pill>
              </div>
            </div>
          </div>
        </div>

        {/* messages */}
        <div className="mt-6 overflow-hidden rounded-[28px] border border-zinc-200 bg-white/80 shadow-[0_1px_0_rgba(0,0,0,0.04),0_28px_90px_rgba(0,0,0,0.10)] backdrop-blur">
          <div className="p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold tracking-tight text-zinc-900">Messages</h2>
                <span className="rounded-full border border-zinc-200 bg-white/70 px-2.5 py-1 text-[11px] text-zinc-700">
                  {msgs.length}
                </span>
              </div>
              <div className="text-xs text-zinc-600">
                {msgs.length ? `Latest: ${tsToText(msgs[msgs.length - 1]?.createdAt)}` : "—"}
              </div>
            </div>

            <div className="grid gap-3">
              {msgs.map((m) => {
                const from = m.fromUid || "—";
                const to = m.toUid || "—";
                const fromName = userByUid[from]?.name || from;
                const toName = userByUid[to]?.name || to;

                const hasGift = !!(m.giftId || m.giftKey || m.giftImageUrl || m.giftImagePath);

                return (
                  <div
                    key={m.id}
                    className="rounded-2xl border border-zinc-200 bg-white/80 p-4 shadow-sm"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[11px] text-zinc-700">
                            {m.id}
                          </span>
                          <span className="text-xs text-zinc-600">
                            <span className="font-medium text-zinc-900">{fromName}</span>{" "}
                            <span className="text-zinc-400">→</span>{" "}
                            <span className="font-medium text-zinc-900">{toName}</span>
                          </span>
                          {m.seenAt ? (
                            <span className="rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-[11px] text-zinc-700">
                              Seen
                            </span>
                          ) : (
                            <span className="rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-[11px] text-zinc-700">
                              Sent
                            </span>
                          )}
                          {hasGift ? (
                            <span className="rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-[11px] text-zinc-700">
                              Gift
                            </span>
                          ) : null}
                        </div>

                        <div className="mt-2 text-sm text-zinc-900">
                          {m.text ? (
                            m.text
                          ) : (
                            <span className="text-zinc-500">{hasGift ? "(gift message)" : "—"}</span>
                          )}
                        </div>
                      </div>

                      <div className="shrink-0 text-xs text-zinc-600">
                        <div className="text-[11px] text-zinc-500">Created</div>
                        <div className="font-medium text-zinc-900">{tsToText(m.createdAt) || "—"}</div>
                      </div>
                    </div>

                    {hasGift ? (
                      <div className="mt-3 grid gap-1 text-xs text-zinc-600">
                        {m.giftId ? <div>giftId: {m.giftId}</div> : null}
                        {m.giftKey ? <div>giftKey: {m.giftKey}</div> : null}
                        {m.giftImageUrl ? <div>giftImageUrl: {m.giftImageUrl}</div> : null}
                        {m.giftImagePath ? <div>giftImagePath: {m.giftImagePath}</div> : null}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>

            {!loading && msgs.length === 0 ? (
              <div className="rounded-2xl border border-zinc-200 bg-white/70 p-6 text-sm text-zinc-600">
                No messages in this thread.
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </main>
  );
}
