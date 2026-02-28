"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/app/AuthProvider";
import { BarChart3, Calendar, ChevronDown, ChevronUp } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

// Minimal shape returned by the partial select in this component
type ActivityRow = {
  id: string;
  title: string;
  activity_date: string;
  total_hours: number;
  certification_activities: {
    id: string;
    certification_id: number;
    hours_applied: number;
    certifications: { name: string; organization: string } | null;
  }[];
};

type MonthGroup = {
  monthKey: string; // YYYY-MM
  monthLabel: string;
  totalHours: number;
  activities: ActivityRow[];
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-");
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString(
    "en-US",
    { month: "long", year: "numeric" }
  );
}

function formatDate(iso: string): string {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatHrs(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, "");
}

function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="mb-6 border border-purple-200 dark:border-purple-800 rounded-xl overflow-hidden animate-pulse">
      <div className="h-11 bg-purple-50 dark:bg-purple-900/20" />
      <div className="bg-white dark:bg-gray-800 p-4 space-y-3">
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-14 bg-gray-100 dark:bg-gray-700/50 rounded-lg"
            />
          ))}
        </div>
        <div className="h-24 bg-gray-100 dark:bg-gray-700/50 rounded-lg" />
        <div className="h-24 bg-gray-100 dark:bg-gray-700/50 rounded-lg" />
      </div>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function MonthlyCPEBreakdown() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<MonthGroup[]>([]);
  const [totalCPE, setTotalCPE] = useState(0);
  const [avgPerMonth, setAvgPerMonth] = useState(0);
  const [activeMonths, setActiveMonths] = useState(0);
  const [hasThisMonth, setHasThisMonth] = useState(true);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (!user) return;

    async function load() {
      const { data, error } = await supabase
        .from("cpe_activities")
        .select(
          `
          id, title, activity_date, total_hours,
          certification_activities(
            id, certification_id, hours_applied,
            certifications(name, organization)
          )
        `
        )
        .eq("user_id", user!.id)
        .order("activity_date", { ascending: false });

      if (error) {
        console.error("MonthlyCPEBreakdown:", error);
        setLoading(false);
        return;
      }

      const activities = (data ?? []) as unknown as ActivityRow[];

      // Group by month
      const monthMap = new Map<string, MonthGroup>();
      for (const act of activities) {
        const key = act.activity_date.substring(0, 7);
        if (!monthMap.has(key)) {
          monthMap.set(key, {
            monthKey: key,
            monthLabel: formatMonthLabel(key),
            totalHours: 0,
            activities: [],
          });
        }
        const g = monthMap.get(key)!;
        g.totalHours += act.total_hours;
        g.activities.push(act);
      }

      // Sort months descending (most recent first)
      const sorted = Array.from(monthMap.values()).sort((a, b) =>
        b.monthKey.localeCompare(a.monthKey)
      );

      const total = activities.reduce((s, a) => s + a.total_hours, 0);
      const numMonths = sorted.length;

      setGroups(sorted);
      setTotalCPE(total);
      setActiveMonths(numMonths);
      setAvgPerMonth(numMonths > 0 ? total / numMonths : 0);
      setHasThisMonth(
        sorted.length > 0 && sorted[0].monthKey === currentMonthKey()
      );
      setLoading(false);
    }

    load();
  }, [user]);

  if (loading) return <Skeleton />;
  if (groups.length === 0) return null;

  const visibleGroups = showAll ? groups : groups.slice(0, 3);

  return (
    <div className="mb-6 border border-purple-200 dark:border-purple-800 rounded-xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center justify-between px-4 py-3 bg-purple-50 dark:bg-purple-900/20 text-left"
      >
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          <span className="text-sm font-semibold text-purple-800 dark:text-purple-300">
            Monthly CPD Breakdown
          </span>
        </div>
        {collapsed ? (
          <ChevronDown className="w-4 h-4 text-purple-600 dark:text-purple-400" />
        ) : (
          <ChevronUp className="w-4 h-4 text-purple-600 dark:text-purple-400" />
        )}
      </button>

      {!collapsed && (
        <div className="bg-white dark:bg-gray-800">
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-px bg-gray-100 dark:bg-gray-700 border-b border-gray-100 dark:border-gray-700">
            {[
              { label: "Total CPD", value: `${formatHrs(totalCPE)} hrs` },
              { label: "Avg / Month", value: `${formatHrs(avgPerMonth)} hrs` },
              { label: "Active Months", value: String(activeMonths) },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="bg-white dark:bg-gray-800 px-4 py-3 text-center"
              >
                <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
                  {label}
                </p>
                <p className="mt-0.5 text-base font-semibold text-purple-700 dark:text-purple-400">
                  {value}
                </p>
              </div>
            ))}
          </div>

          {/* No-CPE-this-month alert */}
          {!hasThisMonth && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-700 text-xs text-amber-700 dark:text-amber-300">
              <Calendar className="w-3.5 h-3.5 shrink-0" />
              No CPD logged this month yet.
            </div>
          )}

          {/* Monthly groups */}
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {visibleGroups.map((group) => (
              <div key={group.monthKey} className="p-4">
                {/* Month header */}
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                    {group.monthLabel}
                  </span>
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300">
                    {formatHrs(group.totalHours)} hrs
                  </span>
                </div>

                {/* Activities */}
                <div className="space-y-2.5">
                  {group.activities.map((act) => {
                    const certLinks = act.certification_activities ?? [];
                    // Show per-cert hours if multiple certs or if the single cert's
                    // hours_applied differs from total_hours (split activity)
                    const showPerCert =
                      certLinks.length > 1 ||
                      (certLinks.length === 1 &&
                        certLinks[0].hours_applied !== act.total_hours);

                    return (
                      <div
                        key={act.id}
                        className="pl-3 border-l-2 border-purple-300 dark:border-purple-700"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                              {act.title}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                              {formatDate(act.activity_date)}
                            </p>
                          </div>
                          <span className="shrink-0 text-xs font-medium text-gray-700 dark:text-gray-300">
                            {formatHrs(act.total_hours)} hrs
                          </span>
                        </div>

                        {/* Cert tags */}
                        {certLinks.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {certLinks.map((ca) => (
                              <span
                                key={ca.id}
                                className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300"
                              >
                                {ca.certifications?.name ?? "Unknown"}
                                {showPerCert
                                  ? ` · ${formatHrs(ca.hours_applied)}h`
                                  : ""}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Show All / Show Less button */}
          {groups.length > 3 && (
            <div className="border-t border-gray-100 dark:border-gray-700 px-4 py-3">
              <button
                onClick={() => setShowAll((s) => !s)}
                className="flex items-center gap-1.5 text-sm font-medium text-purple-700 dark:text-purple-400 hover:text-purple-900 dark:hover:text-purple-200 transition-colors"
              >
                {showAll ? (
                  <>
                    <ChevronUp className="w-4 h-4" />
                    Show Less
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-4 h-4" />
                    Show All Months ({groups.length - 3} more)
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
