// Goldex brand mark — gold star inside a thin ring. Inherits `currentColor`,
// so wrap it in a element with `text-gold` (or any color) to tint it.
export function StarMark({ size = 34, className = '' }) {
  return (
    <span
      className={`relative inline-grid shrink-0 place-items-center rounded-full ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <span className="absolute inset-0 rounded-full" style={{ border: '1.5px solid currentColor' }} />
      <span
        style={{
          width: size * 0.46,
          height: size * 0.46,
          background: 'currentColor',
          clipPath: 'polygon(50% 0,64% 36%,100% 50%,64% 64%,50% 100%,36% 64%,0 50%,36% 36%)',
        }}
      />
    </span>
  )
}

export default StarMark
