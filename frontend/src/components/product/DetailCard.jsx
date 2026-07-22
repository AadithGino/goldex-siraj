export function DetailCard({ icon: Icon, title, rows, className = '' }) {
  const visible = rows.filter((r) => r.value != null && r.value !== '')
  if (!visible.length) return null

  return (
    <div
      className={`rounded-xl border border-line bg-white p-3.5 shadow-[0_1px_3px_rgba(20,33,61,0.04)] sm:p-4 ${className}`}
    >
      <div className="mb-2.5 flex items-center gap-2 border-b border-line pb-2">
        {Icon && (
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gold/10 text-gold">
            <Icon className="h-3.5 w-3.5" />
          </span>
        )}
        <h3 className="text-xs font-semibold text-navy sm:text-sm">{title}</h3>
      </div>
      <dl className="space-y-2">
        {visible.map((row) => (
          <div key={row.label} className="flex items-start justify-between gap-2 text-xs sm:text-sm">
            <dt className="text-muted">{row.label}</dt>
            <dd className="text-right font-medium text-ink">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
