import { CheckCircle2 } from 'lucide-react'
import Button from '@/components/ui/Button'
import { BRAND } from '@/lib/data'

const HIGHLIGHTS = [
  'Fully licensed & insured LLC',
  'Precision craftsmanship on every project',
  'Clean jobsites — we respect your home',
  'Transparent pricing, no hidden costs',
  'Responsive communication throughout',
]

export default function AboutStrip() {
  return (
    <section className="section-padding bg-white">
      <div className="container-max">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">

          {/* Left: Text */}
          <div>
            <span className="inline-block text-xs font-bold tracking-[0.2em] uppercase text-teal-500 mb-4 font-body">
              About JN Remodeling
            </span>
            <h2 className="font-display text-3xl lg:text-4xl font-black text-brand-dark leading-tight mb-6">
              Southwest Florida's Trusted
              <span className="text-teal-500"> Remodeling Experts</span>
            </h2>
            <p className="text-brand-gray text-base leading-relaxed mb-6 font-body">
              Jacob Newman founded JN Remodeling with a simple belief: every home deserves
              the same precision and care you'd put into your own. From a first bathroom
              refresh to a full kitchen transformation, we bring the same level of
              craftsmanship to every project — no matter the size.
            </p>
            <p className="text-brand-gray text-base leading-relaxed mb-8 font-body">
              We're a fully insured LLC serving Cape Coral, Fort Myers, Naples, and all
              of Southwest Florida. When we quote a project, we stand behind it.
            </p>

            <ul className="space-y-3 mb-8">
              {HIGHLIGHTS.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <CheckCircle2 size={18} className="text-teal-500 flex-shrink-0 mt-0.5" />
                  <span className="text-brand-dark text-sm font-body">{item}</span>
                </li>
              ))}
            </ul>

            <div className="flex items-center gap-4">
              <Button href="/contact">Get Free Estimate</Button>
              <Button href="/about" variant="ghost">
                Meet Jacob →
              </Button>
            </div>
          </div>

          {/* Right: Image placeholder + quote card */}
          <div className="relative">
            {/* Main image placeholder */}
            <div className="relative rounded-2xl overflow-hidden aspect-[4/3] bg-gradient-to-br from-brand-light to-brand-border flex items-center justify-center">
              {/* TODO: Replace with actual Image component */}
              <div className="text-center">
                <div className="text-4xl mb-3">🏠</div>
                <p className="text-brand-muted text-sm font-body">Project photo here</p>
              </div>
              {/* Teal accent border */}
              <div className="absolute top-0 left-0 w-16 h-16 border-t-4 border-l-4 border-teal-500 rounded-tl-2xl" />
              <div className="absolute bottom-0 right-0 w-16 h-16 border-b-4 border-r-4 border-teal-500 rounded-br-2xl" />
            </div>

            {/* Floating quote card */}
            <div className="absolute -bottom-6 -left-6 bg-brand-dark text-white p-6 rounded-2xl shadow-2xl max-w-[220px]">
              <div className="text-teal-400 text-3xl font-black font-display mb-1">200+</div>
              <div className="text-white/70 text-xs font-body leading-snug">
                Projects completed across Southwest Florida
              </div>
            </div>

            {/* Floating badge */}
            <div className="absolute -top-4 -right-4 bg-teal-500 text-white p-4 rounded-2xl shadow-xl">
              <div className="text-2xl mb-1">⭐</div>
              <div className="font-display font-black text-lg leading-none">5.0</div>
              <div className="text-white/80 text-[10px] font-body">Rating</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
