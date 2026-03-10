"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../src/lib/firebase";
import { useRouter } from "next/navigation";

type Item = { title: string; desc: string; href: string; badge?: string };
type Section = { name: string; items: Item[] };

export default function AdminHome() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
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

  const sections = useMemo<Section[]>(
    () => [
      {
        name: "Core",
        items: [
          { title: "All users", desc: "Search, view, manage accounts.", href: "/users" },
          { title: "Profiles", desc: "Review bios, photos, edits.", href: "/profiles" },
          { title: "Chats", desc: "Monitor chat health & issues.", href: "/chats" },
          { title: "Reports", desc: "Moderation queue & escalations.", href: "/reports", badge: "Priority" },
        ],
      },
      {
        name: "Safety",
        items: [
          { title: "Banned accounts", desc: "Bans, reasons, appeals.", href: "/banned" },
          { title: "Deleted accounts", desc: "Audit deletions & restores.", href: "/deleted" },
        ],
      },
      {
        name: "Support",
        items: [
          { title: "Tickets", desc: "Manage open and resolved tickets.", href: "/tickets" },
          { title: "Suggestions", desc: "Feedback & feature requests.", href: "/suggestions" },
        ],
      },
      {
        name: "Business",
        items: [
          { title: "Premium accounts", desc: "Subscriptions & entitlement.", href: "/premium" },
          { title: "Refund requests", desc: "Pending / Refunded / Rejected.", href: "/refunds", badge: "Finance" },
          { title: "App emails sent", desc: "Outbound email log.", href: "/emails" },
        ],
      },
      {
        name: "Growth",
        items: [
          { title: "Push notifications", desc: "Campaigns & delivery status.", href: "/push" },
          { title: "Analytics", desc: "DAU, matches, churn, revenue.", href: "/analytics" },
        ],
      },
    ],
    []
  );

  const q = filter.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!q) return sections;
    const keep = (it: Item) => (it.title + " " + it.desc + " " + it.href).toLowerCase().includes(q);
    return sections
      .map((s) => ({ ...s, items: s.items.filter(keep) }))
      .filter((s) => s.items.length > 0);
  }, [q, sections]);

  if (!ready) {
    return (
      <main className="min-h-screen bg-zinc-50 text-zinc-900">
        <div className="mx-auto max-w-6xl p-6">
          <div className="h-10 w-72 rounded-2xl bg-zinc-200" />
          <div className="mt-4 h-11 w-full rounded-2xl bg-zinc-200" />
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="h-32 rounded-3xl bg-zinc-200" />
            ))}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-900">
      {/* cinematic background (low color, high design) */}
      <div className="pointer-events-none fixed inset-0">
        {/* soft light falloff */}
        <div className="absolute inset-0 bg-gradient-to-b from-white via-zinc-50 to-zinc-50" />

        {/* “projector” beams */}
        <div className="absolute -top-40 left-[-10%] h-[620px] w-[620px] rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(99,102,241,0.16),transparent_60%)] blur-3xl" />
        <div className="absolute top-[-120px] right-[-15%] h-[720px] w-[720px] rounded-full bg-[radial-gradient(circle_at_45%_40%,rgba(24,24,27,0.06),transparent_62%)] blur-3xl" />
        <div className="absolute bottom-[-22%] left-[18%] h-[760px] w-[760px] rounded-full bg-[radial-gradient(circle_at_50%_45%,rgba(24,24,27,0.05),transparent_62%)] blur-3xl" />

        {/* subtle grid */}
        <div className="absolute inset-0 opacity-[0.10] [background-image:linear-gradient(to_right,rgba(0,0,0,.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,.06)_1px,transparent_1px)] [background-size:84px_84px]" />

        {/* film grain */}
        <div className="absolute inset-0 opacity-[0.10] mix-blend-multiply [background-image:url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22120%22 height=%22120%22><filter id=%22n%22><feTurbulence type=%22fractalNoise%22 baseFrequency=%220.9%22 numOctaves=%222%22 stitchTiles=%22stitch%22/></filter><rect width=%22120%22 height=%22120%22 filter=%22url(%23n)%22 opacity=%220.35%22/></svg>')]" />
      </div>

      <div className="relative mx-auto max-w-6xl p-6">
        {/* top bar */}
        <div className="flex items-center justify-between gap-3">
          <div>
  <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white/70 px-3 py-1 text-xs text-zinc-700 shadow-sm backdrop-blur">
    <span className="h-1.5 w-1.5 rounded-full bg-zinc-900" />
    Operations Console
  </div>

  <h1 className="mt-3 text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-950">
    <span className="bg-[linear-gradient(90deg,rgba(99,102,241,1),rgba(236,72,153,0.95),rgba(16,185,129,0.95))] bg-clip-text text-transparent">
      Tsedey
    </span>{" "}
    <span className="text-zinc-950">Admin</span>
  </h1>

  <p className="mt-1 text-sm text-zinc-600">
    Moderation • Support • Revenue
  </p>
</div>


          <div className="flex items-center gap-2">
            <Link
              href="/users"
              className="rounded-2xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-zinc-800"
            >
              All users
            </Link>
            <button
              className="rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-900 shadow-sm hover:bg-zinc-50 active:bg-zinc-100"
              onClick={async () => {
                await signOut(auth);
                document.cookie = "admin_ok=; Max-Age=0; path=/";
                router.push("/login");
              }}
            >
              Sign out
            </button>
          </div>
        </div>

        {/* hero */}
        <div className="mt-6 overflow-hidden rounded-[32px] border border-zinc-200 bg-white/70 shadow-[0_1px_0_rgba(0,0,0,0.04),0_28px_90px_rgba(0,0,0,0.10)] backdrop-blur">
          <div className="relative p-6">
            {/* minimal accent, mostly neutral */}
            <div className="absolute inset-0 opacity-[0.55] bg-[radial-gradient(circle_at_18%_12%,rgba(99,102,241,0.16),transparent_46%),radial-gradient(circle_at_75%_30%,rgba(0,0,0,0.05),transparent_52%)]" />
            <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white/80 px-3 py-1 text-xs text-zinc-700">
                  <span className="h-2 w-2 rounded-full bg-zinc-900" />
                  Live operations
                </div>

                <p className="mt-3 text-lg font-medium text-zinc-900">
                  Moderation, support, revenue—fast and tidy.
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Chip label="Moderation" />
                  <Chip label="Support" />
                  <Chip label="Premium + Refunds" />
                </div>
              </div>

              <div className="w-full sm:w-[420px]">
                <input
                  className="w-full rounded-2xl border border-zinc-200 bg-white/90 px-4 py-3 text-sm shadow-sm outline-none placeholder:text-zinc-400 focus:border-zinc-300"
                  placeholder="Search tools… (reports, refunds, tickets)"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                />
                {!!q && (
                  <div className="mt-2 text-xs text-zinc-600">
                    Showing results for <span className="font-medium text-zinc-900">{filter}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          
        </div>

        {/* sections */}
        <div className="mt-8 grid gap-8">
          {filtered.map((sec) => (
            <section key={sec.name}>
              <div className="mb-4 flex items-end justify-between gap-3">
  <div className="flex items-end gap-3">
    <h2 className="text-xl font-semibold tracking-tight text-zinc-900">
      {sec.name}
    </h2>
    <span className="rounded-full border border-zinc-200 bg-white/80 px-2.5 py-1 text-xs text-zinc-600">
      {sec.items.length} tools
    </span>
  </div>

  <div className="hidden sm:block h-px flex-1 bg-gradient-to-r from-zinc-200 via-zinc-300/70 to-transparent" />
</div>


              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {sec.items.map((it) => (
                  <ToolCard key={it.href} it={it} />
                ))}
              </div>
            </section>
          ))}
        </div>

        {!filtered.length && (
          <div className="mt-10 rounded-3xl border border-zinc-200 bg-white/80 p-6 text-sm text-zinc-600">
            No tools match “{filter}”.
          </div>
        )}
      </div>
    </main>
  );
}

function Chip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-zinc-200 bg-white/80 px-3 py-1 text-xs text-zinc-700">
      {label}
    </span>
  );
}



function ToolCard({ it }: { it: Item }) {
  const badgeTone =
    it.badge === "Priority"
      ? "border-zinc-200 bg-zinc-900 text-white"
      : it.badge === "Finance"
      ? "border-zinc-200 bg-white text-zinc-900"
      : "border-zinc-200 bg-zinc-50 text-zinc-700";

  return (
    <Link
      href={it.href}
      className="group relative overflow-hidden rounded-[26px] border border-zinc-200 bg-white/85 p-5 shadow-sm transition hover:bg-white hover:border-zinc-300"
    >
      {/* design > color: subtle light sweep */}
      <div className="pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-100 bg-[radial-gradient(circle_at_22%_12%,rgba(255,255,255,0.95),transparent_55%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.55] bg-[linear-gradient(135deg,rgba(99,102,241,0.10),transparent_42%)]" />

      <div className="relative flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold tracking-tight text-zinc-900">{it.title}</h3>
            {it.badge ? (
              <span className={`rounded-full border px-2 py-0.5 text-[11px] ${badgeTone}`}>
                {it.badge}
              </span>
            ) : null}
          </div>
          <p className="mt-2 text-sm text-zinc-600">{it.desc}</p>
        </div>

        <span className="mt-1 text-zinc-400 transition group-hover:text-zinc-900">↗</span>
      </div>

      <div className="relative mt-4 h-px w-full bg-zinc-200" />
      <div className="relative mt-3 text-xs text-zinc-500 group-hover:text-zinc-900">
        Open {it.href}
      </div>
    </Link>
  );
}
