import { createFileRoute } from '@tanstack/react-router'

import {
  CtaSection,
  Faq,
  Features,
  Footer,
  Hero,
  HowItWorks,
  Integrations,
  Pricing,
  Problem,
  Stats,
  Testimonials,
} from '@/components/block/landing/sections'
import { Navbar } from '@/components/layout/navbar'

export const Route = createFileRoute('/(marketing)/')({
  component: Home,
})

function Home() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <Problem />
        <Features />
        <HowItWorks />
        <Integrations />
        <Stats />
        <Testimonials />
        <Pricing />
        <Faq />
        <CtaSection />
      </main>
      <Footer />
    </>
  )
}
