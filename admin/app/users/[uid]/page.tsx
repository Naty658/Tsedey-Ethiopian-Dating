"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../../src/lib/firebase";

export default function UserDetailPage({ params }: { params: { uid: string } }) {
  const uid = params.uid;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const snap = await getDoc(doc(db, "users", uid));
        setData(snap.exists() ? snap.data() : null);
      } finally {
        setLoading(false);
      }
    })();
  }, [uid]);

  return (
    <main className="p-6">
      <div className="flex items-center gap-3">
        <Link href="/users" className="text-sm underline">
          Back
        </Link>
        <h1 className="text-xl font-semibold">User</h1>
        <span className="font-mono text-xs text-zinc-500">{uid}</span>
      </div>

      <div className="mt-4 rounded-2xl border bg-white p-4">
        {loading ? (
          <div className="text-sm text-zinc-500">Loading...</div>
        ) : data ? (
          <pre className="text-xs overflow-auto">{JSON.stringify(data, null, 2)}</pre>
        ) : (
          <div className="text-sm text-zinc-500">User not found.</div>
        )}
      </div>
    </main>
  );
}
