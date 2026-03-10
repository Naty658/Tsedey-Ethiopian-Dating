"use client";

import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../src/lib/firebase";
import { useRouter } from "next/navigation";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  deleteDoc,
  doc,
} from "firebase/firestore";

type Suggestion = {
  id: string;
  uid: string | null;
  email: string | null;
  phone: string | null;
  text: string;
  createdAt: Timestamp | null;
};

export default function SuggestionsPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [items, setItems] = useState<Suggestion[]>([]);
  const [filter, setFilter] = useState("");

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

    const qy = query(collection(db, "suggestions"), orderBy("createdAt", "desc"));
    return onSnapshot(
      qy,
      (snap) => {
        setItems(
          snap.docs.map((d) => {
            const data = d.data() as any;
            return {
              id: d.id,
              uid: data.uid ?? null,
              email: data.email ?? null,
              phone: data.phone ?? null,
              text: data.text ?? "",
              createdAt: data.createdAt ?? null,
            };
          })
        );
      },
      () => {}
    );
  }, [ready]);

  const rows = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return items;
    return items.filter((s) =>
      `${s.text} ${s.email ?? ""} ${s.phone ?? ""} ${s.uid ?? ""}`.toLowerCase().includes(q)
    );
  }, [items, filter]);

  if (!ready) return null;

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-900">
      <div className="mx-auto max-w-6xl p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Suggestions</h1>
            <p className="mt-1 text-sm text-zinc-600">User feedback & feature requests.</p>
          </div>

          <div className="flex items-center gap-2">
            <input
              className="w-[340px] max-w-full rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm shadow-sm outline-none placeholder:text-zinc-400"
              placeholder="Search (text, email, phone, uid)…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
            <button
              className="rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm shadow-sm hover:bg-zinc-50"
              onClick={() => router.push("/")}
            >
              Home
            </button>
          </div>
        </div>

        <div className="mt-6 overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">
          <div className="grid grid-cols-12 gap-3 border-b border-zinc-200 bg-zinc-50 px-4 py-3 text-xs font-semibold text-zinc-600">
            <div className="col-span-3">When</div>
            <div className="col-span-3">From</div>
            <div className="col-span-5">Suggestion</div>
            <div className="col-span-1 text-right">Actions</div>
          </div>

          {rows.map((s) => (
            <div key={s.id} className="grid grid-cols-12 gap-3 px-4 py-4 border-b border-zinc-100">
              <div className="col-span-3 text-sm text-zinc-700">
                {s.createdAt ? s.createdAt.toDate().toLocaleString() : "—"}
              </div>

              <div className="col-span-3 text-sm">
                <div className="font-medium text-zinc-900">{s.email || s.phone || "—"}</div>
                <div className="text-xs text-zinc-500">{s.uid || "no uid"}</div>
              </div>

              <div className="col-span-5 text-sm text-zinc-800 whitespace-pre-wrap">
                {s.text}
              </div>

              <div className="col-span-1 flex justify-end">
                <button
                  className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-700 shadow-sm hover:bg-zinc-50"
                  onClick={async () => {
                    if (!confirm("Delete this suggestion?")) return;
                    await deleteDoc(doc(db, "suggestions", s.id));
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}

          {!rows.length && (
            <div className="px-4 py-10 text-sm text-zinc-600">No suggestions yet.</div>
          )}
        </div>
      </div>
    </main>
  );
}
