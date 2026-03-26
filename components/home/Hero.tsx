import { Phone, ArrowRight, Play } from 'lucide-react'
import Button from '@/components/ui/Button'
import { BRAND } from '@/lib/data'

export default function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-brand-dark">

      {/* Background pattern overlay */}
      <div className="absolute inset-0 opacity-5">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `repeating-linear-gradient(
              45deg,
              transparent,
              transparent 40px,
              rgba(27,156,181,0.3) 40px,
              rgba(27,156,181,0.3) 41px
            )`,
          }}
        />
      </div>

      {/* Background image placeholder — replace src with real photo */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-dark via-brand-dark/90 to-teal-950/80 z-10" />
        {/* TODO: Replace with <Image> component pointing to real hero photo */}
        <div className="w-full h-full bg-gradient-to-br from-gray-900 to-gray-800" />
      </div>

      {/* Teal accent glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-teal-500/10 rounded-full blur-[120px] z-10" />

      {/* Content */}
      <div className="relative z-20 container-max px-4 sm:px-6 lg:px-8 pt-24 pb-16 text-center">

        {/* Eyebrow badge */}
        <div className="inline-flex items-center gap-2 bg-teal-500/20 border border-teal-500/30 rounded-full px-4 py-1.5 mb-8">
          <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
          <span className="text-teal-300 text-xs font-bold tracking-widest uppercase font-body">
            Southwest Florida's #1 Remodelers
          </span>
        </div>

        {/* Headline */}
        <h1 className="font-display text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-white leading-[1.0] tracking-tight mb-5">
          <span className="block">WE DON'T</span>
          <span className="block text-teal-400">CUT CORNERS,</span>
          <span className="block">WE MITER THEM.</span>
        </h1>

        {/* Subheadline */}
        <p className="text-white/70 text-sm sm:text-base max-w-lg mx-auto leading-relaxed mb-8 font-body">
          Professional home remodeling across Southwest Florida.
          Kitchens, bathrooms, cabinets, flooring & more — done right, the first time.
        </p>

        {/* CTA buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-10">
          <Button href="/contact" size="md" className="w-full sm:w-auto">
            Get Free Estimate
            <ArrowRight size={16} />
          </Button>
          <Button href="/gallery" variant="outline" size="md" className="w-full sm:w-auto border-white/40 text-white hover:bg-white/10 hover:text-white hover:border-white/60">
            View Our Work
          </Button>
          <a
            href={`tel:${BRAND.phone}`}
            className="flex items-center gap-2 text-white/70 hover:text-teal-400 transition-colors text-sm font-semibold font-body"
          >
            <Phone size={15} />
            {BRAND.phone}
          </a>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-4 gap-2 sm:gap-4 max-w-xl mx-auto">
          {[
            { val: '200+', lbl: 'Projects' },
            { val: '5★',   lbl: 'Rating' },
            { val: '10+',  lbl: 'Years Exp.' },
            { val: '100%', lbl: 'Insured' },
          ].map(({ val, lbl }) => (
            <div
              key={lbl}
              className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-2 sm:p-4 text-center"
            >
              <div className="font-display text-lg sm:text-2xl font-black text-teal-400">{val}</div>
              <div className="text-white/50 text-[10px] sm:text-xs font-body mt-0.5">{lbl}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2 animate-bounce">
        <span className="text-white/30 text-xs font-body tracking-widest uppercase">Scroll</span>
        <div className="w-px h-8 bg-gradient-to-b from-white/30 to-transparent" />
      </div>
    </section>
  )
}
