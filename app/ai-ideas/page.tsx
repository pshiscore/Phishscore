import type { Metadata } from 'next'
import { Upload, Sparkles, ArrowRight, Lightbulb, Camera, MessageSquare, Zap } from 'lucide-react'
import Button from '@/components/ui/Button'
import CtaBanner from '@/components/home/CtaBanner'
import TrustBar from '@/components/layout/TrustBar'

export const metadata: Metadata = {
  title: 'AI Remodel Ideas',
  description: 'Upload a photo of your room and get AI-powered remodeling ideas from JN Remodeling.',
}

const STEPS = [
  { icon: Camera,       num: '1', title: 'Upload Your Photo',   desc: 'Take a photo of your kitchen, bathroom, or any room you want to transform.' },
  { icon: Sparkles,     num: '2', title: 'Choose Your Style',   desc: 'Select Modern, Coastal, Farmhouse, or Traditional — or let the AI surprise you.' },
  { icon: Lightbulb,    num: '3', title: 'Get AI Ideas',        desc: 'Receive a set of personalized design concepts and recommendations for your space.' },
  { icon: MessageSquare,num: '4', title: 'Request a Quote',     desc: 'Love an idea? Contact JN Remodeling for a free estimate to make it real.' },
]

const STYLE_OPTIONS = ['Modern', 'Coastal', 'Farmhouse', 'Traditional', 'Contemporary', 'Industrial']

export default function AiIdeasPage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-brand-dark pt-32 pb-16 overflow-hidden relative">
        {/* Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-teal-500/15 rounded-full blur-[80px]" />

        <div className="relative container-max px-4 sm:px-6 lg:px-8 text-center">
          {/* Beta badge */}
          <div className="inline-flex items-center gap-2 bg-teal-500/20 border border-teal-500/40 rounded-full px-4 py-1.5 mb-6">
            <Zap size={12} className="text-teal-400" />
            <span className="text-teal-300 text-xs font-bold tracking-widest uppercase font-body">
              Coming Soon · Beta Feature
            </span>
          </div>

          <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-black text-white leading-tight mb-4">
            AI Remodel Ideas
          </h1>
          <p className="text-white/60 text-lg max-w-xl mx-auto font-body leading-relaxed mb-8">
            Upload a photo of your space and get instant AI-powered remodeling ideas —
            then let JN Remodeling make them real.
          </p>
        </div>
      </section>

      <TrustBar />

      {/* How it works */}
      <section className="section-padding bg-white">
        <div className="container-max">
          <div className="text-center mb-12">
            <span className="inline-block text-xs font-bold tracking-[0.2em] uppercase text-teal-500 mb-3 font-body">
              The Process
            </span>
            <h2 className="font-display text-3xl lg:text-4xl font-black text-brand-dark">
              How It Works
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
            {STEPS.map(({ icon: Icon, num, title, desc }) => (
              <div key={num} className="relative text-center">
                {/* Connector line */}
                <div className="hidden lg:block absolute top-8 left-1/2 w-full h-px bg-brand-border -z-0" />

                <div className="relative z-10 inline-flex items-center justify-center w-16 h-16
                                rounded-2xl bg-teal-500 text-white mb-4 shadow-lg shadow-teal-500/30">
                  <Icon size={24} />
                  <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-brand-dark
                                   text-white text-xs font-black font-display flex items-center justify-center">
                    {num}
                  </span>
                </div>

                <h3 className="font-display font-bold text-brand-dark text-base mb-2">{title}</h3>
                <p className="text-brand-gray text-sm font-body leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>

          {/* Coming soon upload UI mockup */}
          <div className="max-w-3xl mx-auto">
            <div className="bg-brand-light border-2 border-dashed border-brand-border rounded-2xl p-10 text-center relative overflow-hidden">
              {/* Coming soon overlay */}
              <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center z-10 rounded-2xl">
                <div className="bg-teal-500 text-white px-6 py-3 rounded-full font-display font-black text-lg mb-3 shadow-lg">
                  Coming Soon
                </div>
                <p className="text-brand-gray text-sm font-body max-w-xs text-center">
                  This feature is in development. Sign up below to be notified when it launches!
                </p>
              </div>

              {/* Blurred mockup behind overlay */}
              <div className="blur-sm">
                <Upload size={48} className="text-brand-muted mx-auto mb-4" />
                <p className="font-display font-bold text-brand-dark text-lg mb-2">Upload Your Room Photo</p>
                <p className="text-brand-muted text-sm font-body mb-6">Drag & drop or click to browse · JPG, PNG up to 10MB</p>

                <div className="flex flex-wrap gap-2 justify-center mb-6">
                  {STYLE_OPTIONS.map((style) => (
                    <span key={style} className="px-4 py-2 rounded-lg border border-brand-border
                                                  text-sm font-semibold font-body text-brand-gray">
                      {style}
                    </span>
                  ))}
                </div>

                <div className="h-12 bg-teal-500 rounded-xl w-48 mx-auto" />
              </div>
            </div>

            {/* Email capture */}
            <div className="mt-8 bg-brand-dark rounded-2xl p-6 text-center">
              <h3 className="font-display font-bold text-white text-lg mb-2">
                Get Notified When It Launches
              </h3>
              <p className="text-white/60 text-sm font-body mb-5">
                Be the first to try AI-powered remodeling ideas from JN Remodeling.
              </p>
              <div className="flex gap-3 max-w-sm mx-auto">
                <input
                  type="email"
                  placeholder="your@email.com"
                  className="flex-grow px-4 py-3 rounded-xl bg-white/10 border border-white/20
                             text-white placeholder:text-white/40 text-sm font-body
                             focus:outline-none focus:border-teal-500 transition-colors"
                />
                <button className="px-5 py-3 bg-teal-500 hover:bg-teal-600 text-white
                                   rounded-xl font-semibold text-sm font-body transition-colors flex-shrink-0">
                  Notify Me
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <CtaBanner
        title="Don't Wait — Get Started Today"
        subtitle="While the AI tool is in development, our team is ready right now to help you plan and execute your dream remodel."
      />
    </>
  )
}
