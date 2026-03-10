"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "../../src/lib/firebase";

type ReportStatus = "pending" | "reviewing" | "resolved" | "rejected";

type ReportRow = {
  id: string;
  reporter?: string;
  reportedUser?: string;
  reason?: string;
  status?: ReportStatus;
  source?: string;
  reportedName?: string;
  reportedPhoto?: string;
  chatId?: string;
  createdAt?: Timestamp | Date | string | number | null;
};

function tsToText(ts: ReportRow["createdAt"]) {
  const d = (ts as any)?.toDate?.() ?? (ts ? new Date(ts as any) : null);
  if (!d || Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function statusPillClass(status: ReportStatus) {
  switch (status) {
    case "resolved":
      return "bg-emerald-100 text-emerald-700 border border-emerald-200";
    case "reviewing":
      return "bg-amber-100 text-amber-700 border border-amber-200";
    case "rejected":
      return "bg-zinc-100 text-zinc-700 border border-zinc-200";
    case "pending":
    default:
      return "bg-indigo-100 text-indigo-700 border border-indigo-200";
  }
}

export default function ReportsPage() {
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, "reports"),
      orderBy("createdAt", "desc"),
      limit(200)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const arr: ReportRow[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        }));
        setRows(arr);
        setLoading(false);
      },
      (err) => {
        console.error("reports snapshot error:", err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  const setReportStatus = async (reportId: string, status: ReportStatus) => {
    try {
      setSavingId(reportId);

      // optimistic UI
      setRows((prev) =>
        prev.map((r) => (r.id === reportId ? { ...r, status } : r))
      );

      await updateDoc(doc(db, "reports", reportId), {
        status,
        updatedAt: Timestamp.now(),
      });
    } catch (e) {
      console.error("update report status error:", e);
      // rollback by reloading from Firestore quickly via snapshot (it will sync)
      alert("Failed to update status.");
    } finally {
      setSavingId(null);
    }
  };

  const pendingCount = useMemo(
    () => rows.filter((r) => (r.status || "pending") === "pending").length,
    [rows]
  );

  const withReasonCount = useMemo(
    () => rows.filter((r) => !!r.reason?.trim()).length,
    [rows]
  );

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-6 text-gray-900">
      {/* Header */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-900">
              Reports
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              Review user reports from chat list actions
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 md:flex md:flex-wrap">
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
              <div className="text-xs text-gray-500">Total</div>
              <div className="text-lg font-semibold text-gray-900">
                {loading ? "…" : rows.length}
              </div>
            </div>

            <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3">
              <div className="text-xs text-indigo-600">Pending</div>
              <div className="text-lg font-semibold text-indigo-700">
                {loading ? "…" : pendingCount}
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 col-span-2 md:col-span-1">
              <div className="text-xs text-gray-500">With reason</div>
              <div className="text-lg font-semibold text-gray-900">
                {loading ? "…" : withReasonCount}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="mt-5 space-y-3">
        {loading && rows.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-600">
            Loading reports…
          </div>
        ) : null}

        {!loading && rows.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-600">
            No reports yet.
          </div>
        ) : null}

        {rows.map((r) => {
          const status: ReportStatus = (r.status || "pending") as ReportStatus;
          const isSaving = savingId === r.id;

          return (
            <div
              key={r.id}
              className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition"
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                {/* Left */}
                <div className="flex min-w-0 items-start gap-3">
                  {r.reportedPhoto ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={r.reportedPhoto}
                      alt=""
                      className="h-12 w-12 rounded-xl object-cover border border-gray-200"
                    />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100 border border-gray-200 text-sm font-semibold text-gray-700">
                      {(r.reportedName || r.reportedUser || "?")
                        .slice(0, 1)
                        .toUpperCase()}
                    </div>
                  )}

                  <div className="min-w-0">
                    <div className="truncate font-semibold text-gray-900">
                      {r.reportedName || r.reportedUser || "Unknown user"}
                    </div>
                    <div className="mt-1 text-xs text-gray-500">
                      {tsToText(r.createdAt)}
                      {r.source ? ` • ${r.source}` : ""}
                    </div>

                    {r.reason ? (
                      <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800">
                        {r.reason}
                      </div>
                    ) : (
                      <div className="mt-3 rounded-xl border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-500">
                        No reason provided
                      </div>
                    )}
                  </div>
                </div>

                {/* Right */}
                <div className="flex shrink-0 flex-col items-start gap-2 md:items-end">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${statusPillClass(
                      status
                    )}`}
                  >
                    {status}
                  </span>

                  {r.reportedUser ? (
                    <Link
                      href={`/users/${r.reportedUser}`}
                      className="rounded-full bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
                    >
                      View user
                    </Link>
                  ) : null}
                </div>
              </div>

              {/* Action buttons */}
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setReportStatus(r.id, "pending")}
                  disabled={isSaving}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium border transition ${
                    status === "pending"
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "bg-white text-indigo-700 border-indigo-200 hover:bg-indigo-50"
                  } disabled:opacity-50`}
                >
                  Pending
                </button>

                <button
                  type="button"
                  onClick={() => setReportStatus(r.id, "reviewing")}
                  disabled={isSaving}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium border transition ${
                    status === "reviewing"
                      ? "bg-amber-500 text-white border-amber-500"
                      : "bg-white text-amber-700 border-amber-200 hover:bg-amber-50"
                  } disabled:opacity-50`}
                >
                  Reviewing
                </button>

                <button
                  type="button"
                  onClick={() => setReportStatus(r.id, "resolved")}
                  disabled={isSaving}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium border transition ${
                    status === "resolved"
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : "bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                  } disabled:opacity-50`}
                >
                  Resolved
                </button>

                <button
                  type="button"
                  onClick={() => setReportStatus(r.id, "rejected")}
                  disabled={isSaving}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium border transition ${
                    status === "rejected"
                      ? "bg-gray-700 text-white border-gray-700"
                      : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                  } disabled:opacity-50`}
                >
                  Reject
                </button>

                {isSaving ? (
                  <span className="self-center text-xs text-gray-500 ml-1">
                    Saving...
                  </span>
                ) : null}
              </div>

              {/* Meta */}
              <div className="mt-4 grid gap-1 rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600 md:grid-cols-2">
                <div className="truncate">reportedUser: {r.reportedUser || "-"}</div>
                <div className="truncate">reporter: {r.reporter || "-"}</div>
                <div className="truncate">chatId: {r.chatId || "-"}</div>
                <div className="truncate">reportId: {r.id}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}