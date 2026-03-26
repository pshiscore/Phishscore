import type { Metadata } from 'next'
import GalleryGrid from '@/components/gallery/GalleryGrid'
import CtaBanner from '@/components/home/CtaBanner'
import TrustBar from '@/components/layout/TrustBar'

export const metadata: Metadata = {
  title: 'Gallery',
  description: 'Browse our project gallery — kitchens, bathrooms, cabinets, accent walls, and flooring across Southwest Florida.',
}

export default function GalleryPage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-brand-dark pt-32 pb-16">
        <div className="container-max px-4 sm:px-6 lg:px-8 text-center">
          <span className="inline-block text-xs font-bold tracking-[0.2em] uppercase text-teal-400 mb-4 font-body">
            Portfolio
          </span>
          <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-black text-white leading-tight mb-4">
            Project Gallery
          </h1>
          <p className="text-white/60 text-lg max-w-xl mx-auto font-body leading-relaxed">
            Real projects. Real craftsmanship. Browse our work across Southwest Florida.
          </p>
        </div>
      </section>

      <TrustBar />

      {/* Gallery */}
      <section className="section-padding bg-brand-light">
        <div className="container-max">
          <GalleryGrid />
        </div>
      </section>

      <CtaBanner
        title="Like What You See?"
        subtitle="Let's talk about your project. We offer free estimates with no obligation — just honest advice."
      />
    </>
  )
}
