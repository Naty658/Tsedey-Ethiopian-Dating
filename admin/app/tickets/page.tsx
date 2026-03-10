"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../src/lib/firebase";
import { collection, onSnapshot, orderBy, query, updateDoc, doc, serverTimestamp, limit, where } from "firebase/firestore";

import { useRouter } from "next/navigation";

type Ticket = {
  id: string;
  uid: string | null;
  email: string | null;
  phone: string | null;
  category: string | null;
  message: string;
  status: "open" | "solved" | string;
  createdAt?: any;
  updatedAt?: any;
  adminNote?: string | null;
};

export default function TicketsPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [qtext, setQtext] = useState("");
  const [status, setStatus] = useState<"open" | "solved" | "all">("open");

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      if (!u) return router.push("/login");
      if (typeof document !== "undefined" && !document.cookie.includes("admin_ok=1")) {
        return router.push("/login");
      }
      setReady(true);
    });
  }, [router]);

  useEffect(() => {
    if (!ready) return;

    const ref = collection(db, "supportTickets");
    const qq =
  status === "all"
    ? query(ref, orderBy("createdAt", "desc"), limit(500))
    : query(ref, where("status", "==", status), orderBy("createdAt", "desc"), limit(500));


    const unsub = onSnapshot(qq, (snap) => {
      const rows: Ticket[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      setTickets(rows);
    });

    return () => unsub();
  }, [ready, status]);

  const filtered = useMemo(() => {
    const q = qtext.trim().toLowerCase();
    return tickets
      .filter((t) => (status === "all" ? true : (t.status || "open") === status))
      .filter((t) => {
        if (!q) return true;
        return (
          (t.email || "").toLowerCase().includes(q) ||
          (t.phone || "").toLowerCase().includes(q) ||
          (t.uid || "").toLowerCase().includes(q) ||
          (t.category || "").toLowerCase().includes(q) ||
          (t.message || "").toLowerCase().includes(q) ||
          (t.id || "").toLowerCase().includes(q)
        );
      });
  }, [tickets, qtext, status]);

  const setTicketStatus = async (id: string, next: "open" | "solved") => {
    await updateDoc(doc(db, "supportTickets", id), {
      status: next,
      updatedAt: serverTimestamp(),
    });
  };

  if (!ready) {
    return (
      <main className="min-h-screen bg-zinc-50 text-zinc-900">
        <div className="mx-auto max-w-6xl p-6">
          <div className="h-10 w-72 rounded-2xl bg-zinc-200" />
          <div className="mt-4 h-11 w-full rounded-2xl bg-zinc-200" />
          <div className="mt-6 grid gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-24 rounded-3xl bg-zinc-200" />
            ))}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-900">
      <div className="mx-auto max-w-6xl p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">Support tickets</h1>
            <p className="mt-1 text-sm text-zinc-600">Firestore: supportTickets</p>
          </div>
          <Link
            href="/"
            className="rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-900 shadow-sm hover:bg-zinc-50"
          >
            ← Back
          </Link>
        </div>

        <div className="mt-6 grid gap-3 rounded-3xl border border-zinc-200 bg-white/80 p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <input
              className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm shadow-sm outline-none placeholder:text-zinc-400 focus:border-zinc-300"
              placeholder="Search: email, phone, uid, category, message, id"
              value={qtext}
              onChange={(e) => setQtext(e.target.value)}
            />

            <div className="flex gap-2">
              {(["open", "solved", "all"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={`rounded-2xl border px-4 py-2 text-sm shadow-sm ${
                    status === s ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 bg-white text-zinc-900"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-3">
          {filtered.map((t) => (
            <div key={t.id} className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs text-zinc-700">
                      {t.status || "open"}
                    </span>
                    {t.category ? (
                      <span className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-xs text-zinc-700">
                        {t.category}
                      </span>
                    ) : null}
                    <span className="text-xs text-zinc-500">ID: {t.id}</span>
                  </div>

                  <p className="mt-3 whitespace-pre-wrap text-sm text-zinc-900">{t.message}</p>

                  <div className="mt-3 text-xs text-zinc-600">
                    <span className="mr-3">uid: {t.uid || "—"}</span>
                    <span className="mr-3">email: {t.email || "—"}</span>
                    <span>phone: {t.phone || "—"}</span>
                  </div>
                </div>

                <div className="flex shrink-0 gap-2">
  {t.status === "solved" ? (
    <button
      onClick={() => setTicketStatus(t.id, "open")}
      className="rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-900 shadow-sm hover:bg-zinc-50"
    >
      Reopen
    </button>
  ) : (
    <button
      onClick={() => setTicketStatus(t.id, "solved")}
      className="rounded-2xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-zinc-800"
    >
      Mark solved
    </button>
  )}
</div>

              </div>
            </div>
          ))}

          {!filtered.length && (
            <div className="rounded-3xl border border-zinc-200 bg-white/80 p-6 text-sm text-zinc-600">
              No tickets found.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
