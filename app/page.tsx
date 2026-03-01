import Link from "next/link";
import Image from "next/image";

// Authenticated users are redirected to /certifications by middleware before this page renders.
export default function LandingPage() {
  return (
    <main>

      {/* ── Hero ──────────────────────────────────────────────────────────────── */}
      <section className="px-4 sm:px-6 lg:px-8 pt-20 pb-10 sm:pt-28 sm:pb-14 text-center">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl sm:text-5xl font-outfit font-extrabold tracking-tight text-gray-900 dark:text-gray-100 leading-tight">
            Your Professional Credentials,{" "}
            <span className="text-blue-600 dark:text-blue-400">
              Always Under Control
            </span>
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-gray-600 dark:text-gray-400 leading-relaxed">
            Argus tracks your certifications and professional licenses,
            keeps you on pace with continuing professional development (CPD) requirements, and alerts you before
            anything expires.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/signup"
              className="w-full sm:w-auto px-6 py-3 text-sm font-medium text-white bg-blue-900 dark:bg-blue-700 hover:bg-blue-800 dark:hover:bg-blue-600 rounded-lg transition-colors shadow-sm"
            >
              Get Started Free
            </Link>
            <Link
              href="/login"
              className="w-full sm:w-auto px-6 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>

        {/* Dashboard screenshot */}
        <div className="mt-16 max-w-5xl mx-auto">
          <div className="rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-2xl">
            <Image
              src="/images/dashboard-preview.png"
              alt="Argus dashboard showing certification tracking and CPD progress"
              width={1280}
              height={800}
              className="w-full h-auto object-contain"
              priority
            />
          </div>
        </div>
      </section>

      {/* ── Feature blocks ────────────────────────────────────────────────────── */}
      <section className="px-4 sm:px-6 lg:px-8 py-16 sm:py-20 border-t border-gray-200 dark:border-gray-800">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">

          {/* Feature 1 — Track Every Credential */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm">
            <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 mb-4">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M12 2L4 5.5V11c0 5 3.5 9.7 8 11 4.5-1.3 8-6 8-11V5.5L12 2z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinejoin="round"
                  fill="currentColor"
                  fillOpacity="0.1"
                />
                <path
                  d="M9 12l2 2 4-4"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Track Every Credential
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
              Add all your certifications and professional licenses in one
              place. Argus tracks expiration dates, CPD cycle requirements,
              and renewal deadlines automatically.
            </p>
          </div>

          {/* Feature 2 — Stay On Pace */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm">
            <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 mb-4">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
                <path
                  d="M12 7v5l3 3"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Stay On Pace
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
              See exactly how many CPD hours you need per month to renew on
              time. Urgency indicators surface what needs your attention before
              it becomes a problem.
            </p>
          </div>

          {/* Feature 3 — Log Activities Easily */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm">
            <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 mb-4">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="2" />
                <path d="M8 9h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path d="M8 13h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path
                  d="M8 17l2-2 2 2 3-3"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Log Activities Easily
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
              Record training, conferences, courses, and self-study against any
              certification. Argus maps your activities to the right
              credentials automatically.
            </p>
          </div>

        </div>
      </section>

      {/* ── CTA band ──────────────────────────────────────────────────────────── */}
      <section className="px-4 sm:px-6 lg:px-8 py-16 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl font-outfit font-bold text-gray-900 dark:text-gray-100 mb-2">
            Ready to take control of your credentials?
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            Free to use. No credit card required.
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center px-6 py-3 text-sm font-medium text-white bg-blue-900 dark:bg-blue-700 hover:bg-blue-800 dark:hover:bg-blue-600 rounded-lg transition-colors shadow-sm"
          >
            Get Started Free
          </Link>
        </div>
      </section>

    </main>
  );
}
