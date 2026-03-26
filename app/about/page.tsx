import type { Metadata } from 'next'
import { CheckCircle2, Award, Users, MapPin, Star } from 'lucide-react'
import Button from '@/components/ui/Button'
import SectionHeader from '@/components/ui/SectionHeader'
import TestimonialsStrip from '@/components/home/TestimonialsStrip'
import CtaBanner from '@/components/home/CtaBanner'
import TrustBar from '@/components/layout/TrustBar'
import { STATS, CITIES_SERVED, BRAND } from '@/lib/data'

export const metadata: Metadata = {
  title: 'About Us',
  description: 'Meet Jacob Newman and the JN Remodeling team. Southwest Florida\'s trusted home remodeling specialists.',
}

const VALUES = [
  { title: 'Precision',      desc: 'Every corner mitered, every edge clean. We don\'t cut corners — literally.' },
  { title: 'Transparency',   desc: 'Honest quotes, no surprises. You always know what you\'re getting and what it costs.' },
  { title: 'Cleanliness',    desc: 'We respect your home. Jobsites are kept clean, tools are organized, and debris is removed daily.' },
  { title: 'Communication',  desc: 'You\'ll always know where your project stands. We pick up the phone.' },
]

export default function AboutPage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-brand-dark pt-32 pb-16">
        <div className="container-max px-4 sm:px-6 lg:px-8 text-center">
          <span className="inline-block text-xs font-bold tracking-[0.2em] uppercase text-teal-400 mb-4 font-body">
            Our Story
          </span>
          <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-black text-white leading-tight mb-4">
            About JN Remodeling
          </h1>
          <p className="text-white/60 text-lg max-w-xl mx-auto font-body leading-relaxed">
            Built on craftsmanship, driven by pride in every detail.
          </p>
        </div>
      </section>

      <TrustBar />

      {/* Owner bio */}
      <section className="section-padding bg-white">
        <div className="container-max">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Photo placeholder */}
            <div className="relative">
              <div className="rounded-2xl overflow-hidden aspect-[3/4] max-w-sm mx-auto
                              bg-gradient-to-br from-brand-light to-brand-border
                              flex items-center justify-center">
                <div className="text-center">
                  <div className="text-7xl mb-4">👷</div>
                  <p className="text-brand-muted text-sm font-body">Jacob Newman photo</p>
                </div>
                {/* Accent corners */}
                <div className="absolute top-0 left-0 w-16 h-16 border-t-4 border-l-4 border-teal-500 rounded-tl-2xl" />
                <div className="absolute bottom-0 right-0 w-16 h-16 border-b-4 border-r-4 border-teal-500 rounded-br-2xl" />
              </div>
              {/* Floating stat */}
              <div className="absolute -bottom-4 -right-4 bg-teal-500 text-white p-5 rounded-2xl shadow-xl">
                <div className="font-display font-black text-3xl">10+</div>
                <div className="text-white/80 text-xs font-body">Years Experience</div>
              </div>
            </div>

            {/* Text */}
            <div>
              <span className="inline-block text-xs font-bold tracking-[0.2em] uppercase text-teal-500 mb-4 font-body">
                Meet the Owner
              </span>
              <h2 className="font-display text-3xl font-black text-brand-dark mb-4">
                Jacob Newman
              </h2>
              <p className="text-brand-gray leading-relaxed mb-4 font-body">
                Jacob founded JN Remodeling with one core belief: every homeowner deserves
                the same level of craftsmanship and care you'd put into your own home. After
                years of honing his skills across Southwest Florida, Jacob built a reputation
                for precision, reliability, and getting it right the first time.
              </p>
              <p className="text-brand-gray leading-relaxed mb-6 font-body">
                From a single crown molding job to complete kitchen gut renovations, JN
                Remodeling approaches every project with the same dedication. No shortcuts,
                no excuses — just clean, quality work delivered on time.
              </p>

              <div className="grid grid-cols-2 gap-4 mb-8">
                {STATS.map(({ value, label }) => (
                  <div key={label} className="bg-brand-light rounded-xl p-4">
                    <div className="font-display font-black text-2xl text-teal-500">{value}</div>
                    <div className="text-brand-gray text-xs font-body mt-0.5">{label}</div>
                  </div>
                ))}
              </div>

              <Button href="/contact">Work With Jacob</Button>
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="section-padding bg-brand-light">
        <div className="container-max">
          <SectionHeader
            eyebrow="What We Stand For"
            title="Our Values"
            subtitle="The principles behind every project we take on."
          />
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {VALUES.map(({ title, desc }) => (
              <div key={title} className="bg-white rounded-2xl p-6 border border-brand-border">
                <div className="w-10 h-10 rounded-xl bg-teal-500 flex items-center justify-center mb-4">
                  <CheckCircle2 size={20} className="text-white" />
                </div>
                <h3 className="font-display font-bold text-brand-dark text-lg mb-2">{title}</h3>
                <p className="text-brand-gray text-sm font-body leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Service area */}
      <section className="section-padding bg-white">
        <div className="container-max">
          <SectionHeader
            eyebrow="Where We Work"
            title="Serving Southwest Florida"
            subtitle="From Cape Coral to Naples and everywhere in between."
          />
          <div className="flex flex-wrap justify-center gap-3 max-w-2xl mx-auto">
            {CITIES_SERVED.map((city) => (
              <div key={city} className="flex items-center gap-2 px-4 py-2 rounded-full
                                         bg-brand-light border border-brand-border">
                <MapPin size={12} className="text-teal-500" />
                <span className="text-brand-dark text-sm font-semibold font-body">{city}</span>
              </div>
            ))}
          </div>
          <p className="text-center text-brand-muted text-sm font-body mt-6">
            Don't see your city? Give us a call — we may still be able to help.
          </p>
        </div>
      </section>

      <TestimonialsStrip />
      <CtaBanner />
    </>
  )
}
