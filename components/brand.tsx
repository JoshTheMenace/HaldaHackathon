import Link from "next/link";

// The four-point Guide Star — Halda's core mark. A compass that points to the
// right-fit school AND the reward token earned on level-up. One shape, double duty.
export function GuideStar({
  className = "",
  size = 24,
  fill = "currentColor",
}: {
  className?: string;
  size?: number;
  fill?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      aria-hidden
    >
      <path
        d="M12 1.5c.5 4.8 2.2 7 7 7.5v0c-4.8.5-6.5 2.7-7 7.5v0c-.5-4.8-2.2-7-7-7.5v0c4.8-.5 6.5-2.7 7-7.5Z"
        transform="scale(1)"
        fill={fill}
      />
      <path
        d="M18.5 14.5c.22 2 .95 2.9 3 3.1-2.05.22-2.78 1.1-3 3.1-.22-2-.95-2.9-3-3.1 2.05-.2 2.78-1.1 3-3.1Z"
        fill={fill}
        opacity={0.85}
      />
    </svg>
  );
}

export function Logo({
  className = "",
  tone = "pine",
}: {
  className?: string;
  tone?: "pine" | "cream";
}) {
  const color = tone === "cream" ? "text-cream" : "text-pine";
  return (
    <Link href="/" className={`group inline-flex items-center gap-2 ${className}`}>
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-pine text-gold shadow-soft transition-transform group-hover:scale-105">
        <GuideStar size={20} fill="var(--gold)" />
      </span>
      <span className={`font-display text-xl font-700 tracking-tight ${color}`}>
        Halda
      </span>
    </Link>
  );
}

export function Pill({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-600 ${className}`}
    >
      {children}
    </span>
  );
}
