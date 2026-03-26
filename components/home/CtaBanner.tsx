import { Phone, ArrowRight } from 'lucide-react'
import Button from '@/components/ui/Button'
import { BRAND } from '@/lib/data'

interface CtaBannerProps {
  title?:    string
  subtitle?: string
  dark?:     boolean
}

export default function CtaBanner({
  title    = 'Ready to Transform Your Home?',
  subtitle = 'Call us today for a free estimate. No pressure, no obligation — just honest advice from Southwest Florida\'s trusted remodelers.',
  dark     = false,
}: CtaBannerProps) {
  return (
    <section className={`relative overflow-hidden ${dark ? 'bg-brand-dark' : 'bg-teal-500'}`}>
      {/* Background texture */}
      <div className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `repeating-linear-gradient(
            -45deg, transparent, transparent 30px,
            rgba(255,255,255,0.3) 30px, rgba(255,255,255,0.3) 31px
          )`,
        }}
      />

      <div className="relative container-max section-padding">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
          <div className="text-center lg:text-left max-w-xl">
            <h2 className="font-display text-2xl sm:text-3xl font-black text-white leading-tight mb-3">
              {title}
            </h2>
            <p className="text-white/80 text-base leading-relaxed font-body">
              {subtitle}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4 flex-shrink-0">
            <a
              href={`tel:${BRAND.phone}`}
              className="flex items-center gap-3 bg-white/20 hover:bg-white/30
                         backdrop-blur-sm border border-white/30 rounded-xl px-6 py-4
                         text-white font-semibold transition-all duration-200 font-body"
            >
              <Phone size={20} />
              <div className="text-left">
                <div className="text-xs opacity-80 uppercase tracking-wide">Call Now</div>
                <div className="text-lg font-black font-display">{BRAND.phone}</div>
              </div>
            </a>
            <Button
              href="/contact"
              variant="white"
              size="lg"
              className="w-full sm:w-auto"
            >
              Free Estimate
              <ArrowRight size={18} />
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
