"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, getDocs, limit, orderBy, query, where, doc, getDoc, startAt, endAt } from "firebase/firestore";
import { db, auth } from "../../src/lib/firebase";
import { signOut } from "firebase/auth";

type U = { id: string; email?: string; phone?: string; displayName?: string; createdAt?: any };

export default function UsersPage() {
  const [qText, setQText] = useState("");
  const [rows, setRows] = useState<U[]>([]);
  const [loading, setLoading] = useState(false);
  const canSearch = useMemo(() => qText.trim().length >= 3, [qText]);

  async function runSearch() {
    const t = qText.trim();
    const tDigits = t.replace(/[^\d]/g, "");

    if (!t) return;

    setLoading(true);
    try {
      const col = collection(db, "users");

      const profilesCol = collection(db, "profiles");
const tLower = t.toLowerCase();

const byProfileName = query(
  profilesCol,
  where("name", "==", t),
  limit(50)
);







      // exact match only (Firestore doesn’t do contains)
      const byEmail = query(col, where("email", "==", t), limit(50));
const byPhone = query(col, where("phone", "==", t), limit(50));
const byPhoneDigits = query(col, where("phoneDigits", "==", tDigits), limit(50));


const [a, b, c, p] = await Promise.all([
  getDocs(byEmail),
  getDocs(byPhone),
  getDocs(byPhoneDigits),
  getDocs(byProfileName),
]);

      const map = new Map<string, U>();

for (const s of [a, b, c]) {


s.forEach((d) => {
  const data: any = d.data();
  map.set(d.id, {
    id: d.id,
    email: data.email ?? data.userEmail ?? data.emailAddress ?? data.mail,
    phone: data.phone ?? data.phoneNumber ?? data.phone_number,
  });
});
      }


      for (const d of p.docs) {
const puid = (d.data() as any)?.uid ?? d.id;
  if (!puid) continue;
  const uSnap = await getDoc(doc(db, "users", puid));
  if (!uSnap.exists()) continue;

  const data: any = uSnap.data();
  map.set(uSnap.id, {
    id: uSnap.id,
    email: data.email ?? data.userEmail ?? data.emailAddress ?? data.mail,
    phone: data.phone ?? data.phoneNumber ?? data.phone_number,
  });
}


      setRows(Array.from(map.values()));
    } finally {
      setLoading(false);
    }
  }

  async function loadLatest() {
    setLoading(true);
    try {
      const col = collection(db, "users");
      const qq = query(col, orderBy("createdAt", "desc"), limit(25));
      const snap = await getDocs(qq);
setRows(
  snap.docs.map((d) => {
    const data: any = d.data();
    return {
      id: d.id,
      email: data.email ?? data.userEmail ?? data.emailAddress ?? data.mail,
      phone: data.phone ?? data.phoneNumber ?? data.phone_number,
    };
  })
);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLatest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="p-6">
      <div className="flex items-end justify-between gap-3">

        <div className="flex-1">

          <h1 className="text-2xl font-semibold">Users</h1>
          <p className="text-sm text-zinc-500 mt-1">Search by exact email or phone.</p>

</div>

<div className="flex gap-2">
  <button
    className="rounded-xl border px-3 py-2 text-sm"
    onClick={loadLatest}
    disabled={loading}
  >
    Latest
  </button>

  <button
    className="rounded-xl bg-black px-3 py-2 text-sm text-white"
    onClick={async () => {
      await signOut(auth);
      document.cookie = "admin_ok=; Max-Age=0; path=/";
      window.location.href = "/login";
    }}
  >
    Sign out
  </button>
</div>

      
</div>

      
      <div className="mt-4 flex gap-2">
        <input
          className="w-full rounded-xl border px-3 py-2"
          placeholder="email@example.com or +12025550123"
          value={qText}
          onChange={(e) => setQText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") runSearch();
          }}
        />
        <button
          className="rounded-xl bg-black px-4 py-2 text-white disabled:opacity-60"
          disabled={loading || !canSearch}
          onClick={runSearch}
        >
          {loading ? "..." : "Search"}
        </button>
      </div>

      <div className="mt-6 rounded-2xl border bg-white overflow-hidden">
        <div className="grid grid-cols-12 gap-2 px-4 py-3 text-xs text-zinc-500 border-b">
          <div className="col-span-5">UID</div>
          <div className="col-span-4">Email</div>
          <div className="col-span-3">Phone</div>
        </div>

        {rows.length === 0 ? (
          <div className="p-4 text-sm text-zinc-500">No results.</div>
        ) : (
          rows.map((u) => (
            <Link
              key={u.id}
              href={`/users/${u.id}`}
              className="grid grid-cols-12 gap-2 px-4 py-3 text-sm hover:bg-zinc-50 border-b last:border-b-0"
            >
              <div className="col-span-5 font-mono text-xs">{u.id}</div>
              <div className="col-span-4">{u.email ?? "-"}</div>
              <div className="col-span-3">{u.phone ?? "-"}</div>
            </Link>
          ))
        )}
      </div>
    </main>
  );
}
