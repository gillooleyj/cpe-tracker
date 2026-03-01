interface LogoProps {
  className?: string;
}

export default function Logo({ className }: LogoProps) {
  return (
    <span className={`inline-flex items-center gap-2${className ? ` ${className}` : ""}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/argus-logo-icon.svg"
        alt=""
        aria-hidden="true"
        className="h-6 w-auto"
      />
      <span className="text-xl font-outfit font-extrabold leading-none tracking-tight text-gray-900 dark:text-gray-100">
        Argus
      </span>
    </span>
  );
}
