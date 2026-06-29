export function Skeleton({ className = '' }) {
  return (
    <div className={`relative rounded-md bg-td-surface dark:bg-tn-surface overflow-hidden ${className}`}>
      <div className="absolute inset-0 motion-safe:animate-shimmer motion-reduce:hidden bg-gradient-to-r from-transparent via-white/20 to-transparent" />
    </div>
  )
}
