"use client";

import { signInWithPopup } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

import { auth, provider, db } from "../../src/lib/firebase";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  return (
    <main className="min-h-screen flex items-center justify-center bg-zinc-50">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow">
        <h1 className="text-2xl font-semibold">Tsedey Admin</h1>
        <p className="mt-2 text-sm text-zinc-500">Sign in to manage users & reports.</p>

        <button
          className="mt-6 w-full rounded-xl bg-black px-4 py-3 text-white disabled:opacity-60"
          disabled={loading}
          onClick={async () => {
            if (loading) return;
            try {
              setLoading(true);
             const res = await signInWithPopup(auth, provider);
const uid = res.user.uid;

const snap = await getDoc(doc(db, "admins", uid));
const enabled = snap.exists() && snap.data()?.enabled === true;

if (!enabled) {
  await auth.signOut();
  document.cookie = "admin_ok=; Max-Age=0; path=/";
  alert("Not an admin");
  return;
}

document.cookie = "admin_ok=1; path=/; samesite=lax";
router.push("/");

            } finally {
              setLoading(false);
            }
          }}
        >
          {loading ? "Signing in..." : "Sign in with Google"}
        </button>
      </div>
    </main>
  );
}
