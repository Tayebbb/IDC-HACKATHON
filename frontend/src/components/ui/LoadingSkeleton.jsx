/**
 * LoadingSkeleton — shimmer placeholder primitives.
 */
export default function LoadingSkeleton({ className = '', style }) {
  return <div className={`skeleton ${className}`} style={style} aria-hidden />;
}

export function SkeletonText({ lines = 3, className = '' }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <LoadingSkeleton
          key={i}
          className="h-3"
          style={{ width: `${88 - i * 12}%` }}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ className = '' }) {
  return (
    <div className={`glass-card animate-pulse-soft ${className}`}>
      <div className="flex items-center gap-3 mb-4">
        <LoadingSkeleton className="w-10 h-10 rounded-xl" />
        <div className="flex-1 space-y-2">
          <LoadingSkeleton className="h-3 w-1/3" />
          <LoadingSkeleton className="h-3 w-2/3" />
        </div>
      </div>
      <SkeletonText lines={3} />
    </div>
  );
}
