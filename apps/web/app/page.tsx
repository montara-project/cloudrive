import { Navbar } from "./components/navbar";
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
} from "./components/sections";

export default function Home() {
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
  );
}
