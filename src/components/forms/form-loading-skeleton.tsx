export function FormLoadingSkeleton() {
  return (
    <div className="space-y-4" aria-busy>
      {[0, 1, 2].map((i) => (
        <div key={i} className="space-y-1.5">
          <div className="h-4 w-24 rounded bg-slate-100" />
          <div className="h-9 w-full rounded bg-slate-100" />
        </div>
      ))}
    </div>
  )
}
