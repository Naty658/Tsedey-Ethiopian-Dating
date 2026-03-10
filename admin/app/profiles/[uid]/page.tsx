// admin/app/profiles/[uid]/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../../src/lib/firebase";

type AnyObj = Record<string, any>;

function toText(v: any) {
  if (v == null || v === "") return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  const d = v?.toDate?.();
  if (d instanceof Date && !Number.isNaN(d.getTime())) return d.toLocaleString();
  return String(v);
}

function Field({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-2xl border bg-white p-4">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="mt-1 text-sm text-zinc-900 break-words">{toText(value)}</div>
    </div>
  );
}

export default function ProfileDetailsPage() {
  const params = useParams();
  const uid = useMemo(() => {
    const v = params?.uid;
    return Array.isArray(v) ? v[0] : v;
  }, [params]);

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<AnyObj | null>(null);
  const [userDoc, setUserDoc] = useState<AnyObj | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!uid) return;

    let alive = true;
    setLoading(true);
    setError("");

    (async () => {
      try {
       const pSnap = await getDoc(doc(db, "profiles", uid));

if (!alive) return;

if (!pSnap.exists()) {
  setProfile(null);
  setUserDoc(null);
  return;
}

const pData = pSnap.data();
setProfile(pData);

const realUid = pData?.uid || uid;
const uSnap = await getDoc(doc(db, "users", realUid));

if (!alive) return;
setUserDoc(uSnap.exists() ? uSnap.data() : null);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message || "Failed to load profile");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [uid]);

  const extraPhotos = Array.isArray(profile?.extraPhotos) ? profile.extraPhotos : [];

  return (
    <main className="min-h-screen bg-zinc-50 p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4 flex items-center justify-between gap-3">

          <div>
            <h1 className="text-2xl font-semibold">Profile details</h1>
            <p className="text-sm text-zinc-500">UID: {uid || "—"}</p>
          </div>

          <div className="flex gap-2">
            <Link href="/profiles" className="rounded-xl border bg-white px-4 py-2 text-sm">
              Back to profiles
            </Link>
            <Link href={`/profiles/${uid}`} className="rounded-xl bg-black px-4 py-2 text-sm text-white">
            
            <Link href={`/users/${profile?.uid || uid}`} className="rounded-xl bg-black px-4 py-2 text-sm text-white"></Link>
              Open user page
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="rounded-2xl border bg-white p-6 text-sm text-zinc-500">Loading…</div>
        ) : error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{error}</div>
        ) : !profile ? (
          <div className="rounded-2xl border bg-white p-6 text-sm text-zinc-500">
            No profile found for this UID.
          </div>
        ) : (
          <div className="space-y-6">
            {/* top */}
            <div className="rounded-2xl border bg-white p-5">
              <div className="flex flex-col gap-4 sm:flex-row">
                <div className="flex gap-3">
                  <div className="h-24 w-24 overflow-hidden rounded-2xl border bg-zinc-100">
                    {profile.photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={profile.photo} alt="" className="h-full w-full object-cover" />
                    ) : null}
                  </div>

                  <div>
                    <div className="text-lg font-semibold">
                      {profile.name || profile.nameLower || "Unknown"}
                    </div>
                    <div className="mt-1 text-sm text-zinc-600">
                      {profile.gender || "—"}
                      {profile.age ? ` • ${profile.age}` : ""}
                      {profile.interestedIn ? ` • Interested in ${profile.interestedIn}` : ""}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full border px-2 py-1">
                        {profile.isPremium ? "Premium" : "Standard"}
                      </span>
                      <span className="rounded-full border px-2 py-1">
                        {profile.isComplete === false ? "Incomplete" : "Complete"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="sm:ml-auto text-sm text-zinc-700">
                  <div>Email: {userDoc?.email ?? profile.email ?? "—"}</div>
                  <div>Phone: {userDoc?.phone ?? userDoc?.phoneNumber ?? "—"}</div>
                  <div className="mt-1 text-zinc-500">Updated: {toText(profile.updatedAt)}</div>
                </div>
              </div>

              <div className="mt-4 rounded-xl bg-zinc-50 p-4 text-sm text-zinc-700">
                <div className="text-xs text-zinc-500 mb-1">Bio</div>
                {profile.bio || "—"}
              </div>
            </div>

            {/* extra photos */}
            <div className="rounded-2xl border bg-white p-5">
              <div className="mb-3 text-sm font-medium">Extra photos ({extraPhotos.length})</div>
              {extraPhotos.length === 0 ? (
                <div className="text-sm text-zinc-500">No extra photos</div>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                  {extraPhotos.map((src: string, i: number) => (
                    <div key={`${src}-${i}`} className="overflow-hidden rounded-xl border bg-zinc-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt="" className="h-36 w-full object-cover" />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* fields */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="UID (profile doc id)" value={uid} />
              <Field label="uid field" value={profile.uid} />
              <Field label="name" value={profile.name} />
              <Field label="nameLower" value={profile.nameLower} />
              <Field label="age" value={profile.age} />
              <Field label="gender" value={profile.gender} />
              <Field label="interestedIn" value={profile.interestedIn} />
              <Field label="lookingFor" value={profile.lookingFor} />
              <Field label="Country of Origin" value={profile.from} />
              <Field label="Current Country" value={profile.country} />
              <Field label="Current City" value={profile.city} />
              <Field label="smoke" value={profile.smoke} />
              <Field label="drink" value={profile.drink} />
              <Field label="hobby" value={profile.hobby} />
              <Field label="diet" value={profile.diet} />
              <Field label="religion" value={profile.religion} />
              <Field label="languages" value={profile.languages} />
              <Field label="education" value={profile.education} />
              <Field label="occupation" value={profile.occupation} />
              <Field label="isPremium" value={profile.isPremium} />
              <Field label="isComplete" value={profile.isComplete} />
              <Field label="lat" value={profile.lat} />
              <Field label="lng" value={profile.lng} />
              <Field label="updatedAt" value={profile.updatedAt} />
            </div>

            {/* raw json */}
            <details className="rounded-2xl border bg-white p-5">
              <summary className="cursor-pointer text-sm font-medium">Raw profile JSON</summary>
              <pre className="mt-3 overflow-auto rounded-xl bg-zinc-50 p-4 text-xs">
{JSON.stringify(profile, null, 2)}
              </pre>
            </details>
          </div>
        )}
      </div>
    </main>
  );
}