import Link from "next/link";
import type { ComponentProps } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-brand text-white hover:bg-brand-hover",
  secondary: "bg-white text-ink ring-1 ring-rule hover:bg-parchment-deep",
  ghost: "text-ink-soft hover:text-ink hover:bg-parchment-deep",
};

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60";

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant }) {
  return <button className={`${BASE} ${VARIANTS[variant]} ${className}`} {...props} />;
}

export function ButtonLink({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<typeof Link> & { variant?: ButtonVariant }) {
  return <Link className={`${BASE} ${VARIANTS[variant]} ${className}`} {...props} />;
}

export function Card({ className = "", ...props }: ComponentProps<"div">) {
  return (
    <div className={`rounded-lg border border-rule bg-white p-5 ${className}`} {...props} />
  );
}

export function Field({
  label,
  hint,
  errors,
  children,
}: {
  label: string;
  hint?: string;
  errors?: string[];
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-ink">{label}</span>
      {hint ? <span className="mt-0.5 block text-xs text-ink-faint">{hint}</span> : null}
      <div className="mt-1.5">{children}</div>
      {errors?.length ? (
        <span role="alert" className="mt-1 block text-xs text-brand">
          {errors[0]}
        </span>
      ) : null}
    </label>
  );
}

const CONTROL =
  "w-full rounded-md border border-rule bg-white px-3 py-2 text-sm text-ink placeholder:text-ink-faint";

export function Input({ className = "", ...props }: ComponentProps<"input">) {
  return <input className={`${CONTROL} ${className}`} {...props} />;
}

export function Select({ className = "", ...props }: ComponentProps<"select">) {
  return <select className={`${CONTROL} ${className}`} {...props} />;
}

export function Textarea({ className = "", ...props }: ComponentProps<"textarea">) {
  return <textarea className={`${CONTROL} ${className}`} {...props} />;
}

export function Alert({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="alert"
      className="rounded-md border border-brand/25 bg-brand-tint px-3 py-2 text-sm text-brand"
    >
      {children}
    </div>
  );
}

const SUPPORT_COPY = {
  native: { label: "Bede teaches this", tone: "bg-emerald-50 text-emerald-800 ring-emerald-200" },
  assisted: { label: "Bede assists", tone: "bg-amber-50 text-amber-800 ring-amber-200" },
  unsupported: { label: "Not yet supported", tone: "bg-stone-100 text-stone-600 ring-stone-200" },
} as const;

/**
 * Shown in the public directory as well as the wizard. Setting expectations
 * about depth of support before a parent pays is the point.
 */
export function SupportBadge({ level }: { level: keyof typeof SUPPORT_COPY }) {
  const { label, tone } = SUPPORT_COPY[level] ?? SUPPORT_COPY.assisted;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${tone}`}
    >
      {label}
    </span>
  );
}
