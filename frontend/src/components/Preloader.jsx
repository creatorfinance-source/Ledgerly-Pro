/**
 * Skeleton / preloader components.
 * Usage:
 *   import { SkeletonCard, SkeletonTable, SkeletonChart, PageLoader, SkeletonKPI } from "@/components/Preloader"
 */

export function Skeleton({ className = "", ...props }) {
  return (
    <div
      className={`skeleton ${className}`}
      aria-hidden="true"
      {...props}
    />
  );
}

export function SkeletonKPI() {
  return (
    <div className="surface-card p-5 space-y-3">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-8 w-36" />
      <Skeleton className="h-2.5 w-20" />
    </div>
  );
}

export function SkeletonCard({ lines = 3 }) {
  return (
    <div className="surface-card p-5 space-y-3">
      <Skeleton className="h-4 w-32" />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className="h-3" style={{ width: `${70 + (i % 3) * 10}%` }} />
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 4 }) {
  return (
    <div className="surface-card overflow-hidden">
      {/* Header */}
      <div className="border-b border-border px-4 py-3 flex gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3" style={{ flex: i === 0 ? 2 : 1 }} />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 px-4 py-3 border-b border-border last:border-0">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton
              key={c}
              className="h-3"
              style={{ flex: c === 0 ? 2 : 1, opacity: 1 - r * 0.1 }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonChart({ height = 220 }) {
  return (
    <div className="surface-card p-5">
      <Skeleton className="h-4 w-28 mb-4" />
      <Skeleton className="w-full" style={{ height }} />
    </div>
  );
}

export function SkeletonDashboard() {
  return (
    <div className="p-6 space-y-6 page-enter">
      <Skeleton className="h-7 w-48" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => <SkeletonKPI key={i} />)}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SkeletonChart height={240} />
        <SkeletonChart height={240} />
      </div>
      <SkeletonTable rows={6} cols={5} />
    </div>
  );
}

export function PageLoader({ label = "Loading…" }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 page-enter">
      {/* Spinning ring */}
      <div className="relative w-12 h-12">
        <div className="absolute inset-0 rounded-full border-2 border-border" />
        <div className="absolute inset-0 rounded-full border-2 border-t-primary animate-spin" />
        <div className="absolute inset-[6px] rounded-full bg-primary/8 animate-pulse" />
      </div>
      <p className="text-sm text-muted-foreground label-eyebrow">{label}</p>
    </div>
  );
}

export function InlineLoader({ size = 16 }) {
  return (
    <span
      className="inline-block rounded-full border-2 border-border border-t-primary animate-spin"
      style={{ width: size, height: size, flexShrink: 0 }}
    />
  );
}
