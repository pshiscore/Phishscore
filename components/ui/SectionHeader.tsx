import { clsx } from 'clsx'

interface SectionHeaderProps {
  eyebrow?:   string
  title:      string
  subtitle?:  string
  align?:     'left' | 'center'
  light?:     boolean
  className?: string
}

export default function SectionHeader({
  eyebrow,
  title,
  subtitle,
  align     = 'center',
  light     = false,
  className,
}: SectionHeaderProps) {
  return (
    <div
      className={clsx(
        'mb-12',
        align === 'center' ? 'text-center' : 'text-left',
        className,
      )}
    >
      {eyebrow && (
        <span
          className={clsx(
            'inline-block text-xs font-bold tracking-[0.2em] uppercase mb-3',
            light ? 'text-teal-300' : 'text-teal-500',
          )}
        >
          {eyebrow}
        </span>
      )}

      <h2
        className={clsx(
          'font-display text-2xl sm:text-3xl lg:text-4xl font-bold leading-tight',
          light ? 'text-white' : 'text-brand-dark',
        )}
      >
        {title}
      </h2>

      {subtitle && (
        <p
          className={clsx(
            'mt-4 text-base sm:text-lg max-w-2xl leading-relaxed',
            align === 'center' && 'mx-auto',
            light ? 'text-white/70' : 'text-brand-gray',
          )}
        >
          {subtitle}
        </p>
      )}

      {/* Teal accent line */}
      <div
        className={clsx(
          'mt-6 h-1 w-12 rounded-full bg-teal-500',
          align === 'center' && 'mx-auto',
        )}
      />
    </div>
  )
}
