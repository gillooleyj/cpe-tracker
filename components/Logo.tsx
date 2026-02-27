interface LogoProps {
  className?: string;
}

export default function Logo({ className }: LogoProps) {
  return (
    <span className={`inline-flex items-center gap-2${className ? ` ${className}` : ""}`}>
      {/* Shield icon: gradient #3b82f6 → #0ea5e9 with white checkmark */}
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="credvault-shield" x1="12" y1="2" x2="12" y2="22" gradientUnits="userSpaceOnUse">
            <stop stopColor="#3b82f6" />
            <stop offset="1" stopColor="#0ea5e9" />
          </linearGradient>
        </defs>
        <path
          d="M12 2L4 5.5V11c0 5 3.5 9.7 8 11 4.5-1.3 8-6 8-11V5.5L12 2z"
          fill="url(#credvault-shield)"
        />
        <path
          d="M9 12l2 2 4-4"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      {/* Two-tone text: "Cred" in blue, "Vault" in foreground */}
      <span className="text-xl font-outfit font-extrabold leading-none tracking-tight">
        <span className="text-[#2563eb] dark:text-[#60a5fa]">Cred</span>
        <span className="text-[#0f172a] dark:text-gray-100">Vault</span>
      </span>
    </span>
  );
}
