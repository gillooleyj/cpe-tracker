"use client";

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface Props {
  secondsLeft: number;
  onStayLoggedIn: () => void;
  onLogOut: () => void;
}

export default function SessionTimeoutModal({
  secondsLeft,
  onStayLoggedIn,
  onLogOut,
}: Props) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="timeout-title"
      aria-describedby="timeout-desc"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Panel */}
      <div className="relative w-full max-w-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl p-6">

        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
            <svg
              className="w-6 h-6 text-amber-600 dark:text-amber-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
        </div>

        <h2
          id="timeout-title"
          className="text-base font-semibold text-center text-gray-900 dark:text-gray-100 mb-1"
        >
          Session Expiring Soon
        </h2>
        <p
          id="timeout-desc"
          className="text-sm text-center text-gray-500 dark:text-gray-400 mb-4"
        >
          Your session will expire due to inactivity. Continue working?
        </p>

        {/* Countdown */}
        <div className="flex justify-center mb-6">
          <span
            className="text-4xl font-mono font-bold tabular-nums text-amber-600 dark:text-amber-400"
            aria-live="polite"
            aria-atomic="true"
            aria-label={`${secondsLeft} seconds remaining`}
          >
            {formatTime(secondsLeft)}
          </span>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onLogOut}
            className="flex-1 py-2 px-3 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
          >
            Log Out
          </button>
          <button
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            onClick={onStayLoggedIn}
            className="flex-1 py-2 px-3 text-sm font-medium text-white bg-blue-900 dark:bg-blue-700 hover:bg-blue-800 dark:hover:bg-blue-600 rounded-lg transition-colors"
          >
            Stay Logged In
          </button>
        </div>
      </div>
    </div>
  );
}
