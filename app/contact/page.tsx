import type { Metadata } from 'next'
import ContactForm from '@/components/contact/ContactForm'
import ContactInfo from '@/components/contact/ContactInfo'
import TrustBar from '@/components/layout/TrustBar'

export const metadata: Metadata = {
  title: 'Contact Us',
  description: 'Get a free estimate from JN Remodeling. Contact us for kitchen, bathroom, flooring, and all home remodeling projects in Southwest Florida.',
}

export default function ContactPage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-brand-dark pt-32 pb-16">
        <div className="container-max px-4 sm:px-6 lg:px-8 text-center">
          <span className="inline-block text-xs font-bold tracking-[0.2em] uppercase text-teal-400 mb-4 font-body">
            Free Estimates
          </span>
          <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-black text-white leading-tight mb-4">
            Let's Talk About Your Project
          </h1>
          <p className="text-white/60 text-lg max-w-xl mx-auto font-body leading-relaxed">
            Fill out the form below or give us a call. We'll get back to you within 24 hours.
          </p>
        </div>
      </section>

      <TrustBar />

      {/* Form + Info */}
      <section className="section-padding bg-brand-light">
        <div className="container-max">
          <div className="grid lg:grid-cols-3 gap-10 lg:gap-16">
            {/* Form - takes 2 cols */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-2xl p-6 lg:p-10 border border-brand-border shadow-sm">
                <h2 className="font-display text-2xl font-bold text-brand-dark mb-2">
                  Request a Free Estimate
                </h2>
                <p className="text-brand-gray text-sm font-body mb-8">
                  Tell us about your project and we'll be in touch within 24 hours.
                </p>
                <ContactForm />
              </div>
            </div>

            {/* Sidebar */}
            <div>
              <ContactInfo />
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
