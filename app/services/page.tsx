import type { Metadata } from 'next'
import { CheckCircle2, ArrowRight } from 'lucide-react'
import { SERVICES } from '@/lib/data'
import SectionHeader from '@/components/ui/SectionHeader'
import Button from '@/components/ui/Button'
import Tag from '@/components/ui/Tag'
import CtaBanner from '@/components/home/CtaBanner'
import TrustBar from '@/components/layout/TrustBar'

export const metadata: Metadata = {
  title: 'Services',
  description: 'Kitchen remodeling, bathrooms, cabinets, crown molding, accent walls, and flooring across Southwest Florida. Free estimates.',
}

export default function ServicesPage() {
  return (
    <>
      {/* Page Hero */}
      <section className="bg-brand-dark pt-32 pb-16">
        <div className="container-max px-4 sm:px-6 lg:px-8 text-center">
          <span className="inline-block text-xs font-bold tracking-[0.2em] uppercase text-teal-400 mb-4 font-body">
            What We Offer
          </span>
          <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-black text-white leading-tight mb-4">
            Our Services
          </h1>
          <p className="text-white/60 text-lg max-w-xl mx-auto font-body leading-relaxed">
            Full-service remodeling for every room in your home — across all of Southwest Florida.
          </p>
        </div>
      </section>

      <TrustBar />

      {/* Services list */}
      <section className="section-padding bg-white">
        <div className="container-max">
          <div className="space-y-24">
            {SERVICES.map((service, i) => (
              <div
                key={service.id}
                id={service.id}
                className={`grid lg:grid-cols-2 gap-12 lg:gap-20 items-center
                            ${i % 2 !== 0 ? 'lg:grid-flow-dense' : ''}`}
              >
                {/* Image side */}
                <div className={`${i % 2 !== 0 ? 'lg:col-start-2' : ''}`}>
                  <div className="relative rounded-2xl overflow-hidden aspect-[4/3]
                                  bg-gradient-to-br from-brand-light to-brand-border
                                  flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-6xl mb-4">{service.icon}</div>
                      <p className="text-brand-muted text-sm font-body">Project photo — {service.title}</p>
                    </div>
                    {/* Accent corners */}
                    <div className="absolute top-0 left-0 w-12 h-12 border-t-4 border-l-4 border-teal-500 rounded-tl-2xl" />
                    <div className="absolute bottom-0 right-0 w-12 h-12 border-b-4 border-r-4 border-teal-500 rounded-br-2xl" />
                  </div>
                </div>

                {/* Text side */}
                <div className={`${i % 2 !== 0 ? 'lg:col-start-1 lg:row-start-1' : ''}`}>
                  <span className="inline-block text-xs font-bold tracking-[0.2em] uppercase text-teal-500 mb-3 font-body">
                    Service
                  </span>
                  <h2 className="font-display text-2xl lg:text-3xl font-black text-brand-dark mb-4">
                    {service.title}
                  </h2>
                  <p className="text-brand-gray text-base leading-relaxed mb-6 font-body">
                    {service.desc}
                  </p>

                  {/* Bullets */}
                  <ul className="space-y-2.5 mb-6">
                    {service.bullets.map((b) => (
                      <li key={b} className="flex items-start gap-3">
                        <CheckCircle2 size={16} className="text-teal-500 flex-shrink-0 mt-0.5" />
                        <span className="text-brand-dark text-sm font-body">{b}</span>
                      </li>
                    ))}
                  </ul>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-2 mb-8">
                    {service.tags.map((tag) => (
                      <Tag key={tag} label={tag} />
                    ))}
                  </div>

                  <Button href="/contact">
                    Get a Quote for This Service
                    <ArrowRight size={16} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <CtaBanner
        title="Don't See What You Need?"
        subtitle="We handle a wide range of home improvement projects. Contact us and tell us what you have in mind — chances are we can help."
      />
    </>
  )
}
