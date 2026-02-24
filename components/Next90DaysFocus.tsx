"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/app/AuthProvider";
import {
  Calendar,
  AlertCircle,
  CheckCircle2,
  ChevronUp,
  ChevronDown,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type CertFocusItem = {
  id: string;
  name: string;
  organization: string;
  expiration_date: string;
  issue_date: string;
  cpe_required: number;
  cpe_earned: number;
  daysLeft: number;
  progressPct: number;
  monthlyPaceNeeded: number;
  status: "urgent" | "needs-attention" | "on-track";
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="mb-6 border border-blue-200 dark:border-blue-800 rounded-xl overflow-hidden animate-pulse">
      <div className="h-11 bg-blue-50 dark:bg-blue-900/20" />
      <div className="bg-white dark:bg-gray-800 p-4 space-y-3">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
        <div className="h-16 bg-gray-100 dark:bg-gray-700/50 rounded-lg" />
        <div className="h-16 bg-gray-100 dark:bg-gray-700/50 rounded-lg" />
      </div>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

type NextUpcoming = {
  name: string;
  organization: string;
  daysLeft: number;
};

export default function Next90DaysFocus() {
  const { user } = useAuth();
  const [items, setItems] = useState<CertFocusItem[]>([]);
  const [nextUpcoming, setNextUpcoming] = useState<NextUpcoming | null>(null);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!user) return;

    async function load() {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const in90 = new Date(today);
      in90.setDate(in90.getDate() + 200);

      // Fetch all future certs (no upper-date limit) so we can also show
      // the next upcoming cert beyond the 90-day window.
      const { data, error } = await supabase
        .from("certifications")
        .select(
          "id, name, organization, expiration_date, issue_date, cpe_required, cpe_earned"
        )
        .eq("user_id", user!.id)
        .not("expiration_date", "is", null)
        .gte("expiration_date", today.toISOString().split("T")[0])
        .order("expiration_date", { ascending: true });

      if (error) {
        console.error("Next90DaysFocus:", error);
        setLoading(false);
        return;
      }

      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const cutoff = in90.toISOString().split("T")[0];
      const allFuture = data ?? [];

      // Split: focus window (≤90 days + has CPE requirement) vs beyond
      const withinWindow = allFuture.filter(
        (c) => c.expiration_date <= cutoff && c.cpe_required != null
      );
      const beyondWindow = allFuture.filter((c) => c.expiration_date > cutoff);

      const processed: CertFocusItem[] = withinWindow.map((cert) => {
        const expDate = new Date(cert.expiration_date + "T00:00:00Z");
        const issueDate = new Date(
          (cert.issue_date ?? cert.expiration_date) + "T00:00:00Z"
        );
        const daysLeft = Math.ceil(
          (expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );
        const cpeEarned = cert.cpe_earned ?? 0;
        const cpeRequired = cert.cpe_required as number;
        const progressPct = Math.min(
          100,
          Math.round((cpeEarned / cpeRequired) * 100)
        );

        const monthsLeft = daysLeft / 30.44;
        const remaining = Math.max(0, cpeRequired - cpeEarned);
        const monthlyPaceNeeded =
          monthsLeft > 0 ? remaining / monthsLeft : remaining;

        let status: "urgent" | "needs-attention" | "on-track";
        if (daysLeft < 90 && progressPct < 50) {
          status = "urgent";
        } else {
          const totalMs = expDate.getTime() - issueDate.getTime();
          const elapsedMs = now.getTime() - issueDate.getTime();
          const expectedFraction =
            totalMs > 0 ? Math.min(1, elapsedMs / totalMs) : 1;
          const actualFraction = cpeEarned / cpeRequired;
          status =
            actualFraction < expectedFraction ? "needs-attention" : "on-track";
        }

        return {
          id: cert.id,
          name: cert.name,
          organization: cert.organization,
          expiration_date: cert.expiration_date,
          issue_date: cert.issue_date,
          cpe_required: cpeRequired,
          cpe_earned: cpeEarned,
          daysLeft,
          progressPct,
          monthlyPaceNeeded,
          status,
        };
      });

      // Nearest cert expiring beyond the 90-day window
      if (beyondWindow.length > 0) {
        const next = beyondWindow[0];
        const expDate = new Date(next.expiration_date + "T00:00:00Z");
        const daysLeft = Math.ceil(
          (expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );
        setNextUpcoming({
          name: next.name,
          organization: next.organization,
          daysLeft,
        });
      }

      setItems(processed);
      setLoading(false);
    }

    load();
  }, [user]);

  if (loading) return <Skeleton />;

  if (items.length === 0) {
    return (
      <div className="mb-6 border border-blue-200 dark:border-blue-800 rounded-xl overflow-hidden">
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="w-full flex items-center justify-between px-4 py-3 bg-blue-50 dark:bg-blue-900/20 text-left"
        >
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span className="text-sm font-semibold text-blue-800 dark:text-blue-300">
              Next 6 Months Focus
            </span>
          </div>
          {collapsed ? (
            <ChevronDown className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          ) : (
            <ChevronUp className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          )}
        </button>

        {!collapsed && (
          <div className="bg-white dark:bg-gray-800 px-4 py-4">
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
              ✅ All Clear — No certifications expiring in the next 6 months.
            </p>
            {nextUpcoming && (
              <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                Next up:{" "}
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  {nextUpcoming.name}
                </span>{" "}
                <span className="text-gray-400 dark:text-gray-500">
                  ({nextUpcoming.organization})
                </span>{" "}
                · {nextUpcoming.daysLeft} days away
              </p>
            )}
          </div>
        )}
      </div>
    );
  }

  const actionNeeded = items.filter(
    (c) => c.status === "urgent" || c.status === "needs-attention"
  );
  const onTrack = items.filter((c) => c.status === "on-track");
  const sortedByDate = [...items].sort((a, b) => a.daysLeft - b.daysLeft);

  return (
    <div className="mb-6 border border-blue-200 dark:border-blue-800 rounded-xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center justify-between px-4 py-3 bg-blue-50 dark:bg-blue-900/20 text-left"
      >
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span className="text-sm font-semibold text-blue-800 dark:text-blue-300">
            Next 6 Months Focus
          </span>
          <span className="text-xs font-normal text-blue-600 dark:text-blue-400">
            ({items.length} certification{items.length !== 1 ? "s" : ""}{" "}
            expiring)
          </span>
        </div>
        {collapsed ? (
          <ChevronDown className="w-4 h-4 text-blue-600 dark:text-blue-400" />
        ) : (
          <ChevronUp className="w-4 h-4 text-blue-600 dark:text-blue-400" />
        )}
      </button>

      {!collapsed && (
        <div className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
          {/* ── Action Needed ── */}
          {actionNeeded.length > 0 && (
            <div className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle className="w-4 h-4 text-red-500 dark:text-red-400" />
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Action Needed
                </span>
              </div>
              <div className="space-y-3">
                {actionNeeded.map((cert) => (
                  <div
                    key={cert.id}
                    className={`p-3 rounded-lg border ${
                      cert.status === "urgent"
                        ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
                        : "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                          {cert.name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {cert.organization}
                        </p>

                        {/* Progress bar */}
                        <div className="mt-2">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {cert.cpe_earned} / {cert.cpe_required} CPE
                            </span>
                            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                              {cert.progressPct}%
                            </span>
                          </div>
                          <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                cert.status === "urgent"
                                  ? "bg-red-500"
                                  : "bg-amber-500"
                              }`}
                              style={{ width: `${cert.progressPct}%` }}
                            />
                          </div>
                        </div>

                        <p className="mt-1.5 text-xs text-gray-600 dark:text-gray-400">
                          Pace needed: ~{cert.monthlyPaceNeeded.toFixed(1)}{" "}
                          CPE/month
                        </p>
                      </div>

                      <div className="shrink-0 flex flex-col items-end gap-2 mt-0.5">
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${
                            cert.daysLeft <= 30
                              ? "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300"
                              : "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300"
                          }`}
                        >
                          {cert.daysLeft}d left
                        </span>
                        <a
                          href={`#cert-${cert.id}`}
                          className="text-xs font-medium text-blue-900 dark:text-blue-400 hover:underline whitespace-nowrap"
                        >
                          View Details →
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── On Track ── */}
          {onTrack.length > 0 && (
            <div className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="w-4 h-4 text-green-500 dark:text-green-400" />
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  On Track
                </span>
              </div>
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800 p-3">
                <ul className="space-y-1.5">
                  {onTrack.map((cert) => (
                    <li
                      key={cert.id}
                      className="flex items-center justify-between gap-2"
                    >
                      <span className="text-sm text-gray-800 dark:text-gray-200 truncate">
                        {cert.name}
                      </span>
                      <span className="text-xs text-green-700 dark:text-green-400 shrink-0">
                        {cert.progressPct}% · {cert.daysLeft}d
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* ── Upcoming Deadlines timeline ── */}
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="w-4 h-4 text-gray-400 dark:text-gray-500" />
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Upcoming Deadlines
              </span>
            </div>
            <div className="space-y-2">
              {sortedByDate.map((cert) => (
                <div key={cert.id} className="flex items-center gap-3">
                  <div
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      cert.status === "urgent"
                        ? "bg-red-400"
                        : cert.status === "needs-attention"
                          ? "bg-amber-400"
                          : "bg-green-400"
                    }`}
                  />
                  <span className="text-xs text-gray-700 dark:text-gray-300 flex-1 truncate">
                    {cert.name}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0">
                    {formatDate(cert.expiration_date)} · {cert.daysLeft}d
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
