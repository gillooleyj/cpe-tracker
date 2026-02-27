"use client";

import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">

      {/* Nav */}
      <nav className="border-b border-gray-800 bg-gray-950/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M14 2L4 7V14C4 19.5 8.5 24.7 14 26C19.5 24.7 24 19.5 24 14V7L14 2Z" fill="#1e40af" stroke="#3b82f6" strokeWidth="1.5"/>
              <path d="M10 14L13 17L18 11" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="text-lg font-bold tracking-tight">
              <span className="text-white">Cred</span><span className="text-blue-400">Vault</span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-gray-400 hover:text-white transition-colors px-3 py-1.5">
              Sign In
            </Link>
            <Link href="/signup" className="text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded-lg transition-colors">
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 bg-blue-950/50 border border-blue-800/50 text-blue-300 text-xs font-medium px-3 py-1.5 rounded-full mb-8">
          <span className="w-1.5 h-1.5 bg-blue-400 rounded-full"></span>
          Built for cybersecurity & IT professionals
        </div>

        <h1 className="text-5xl sm:text-6xl font-bold tracking-tight text-white mb-6 leading-tight">
          Never let a certification
          <br />
          <span className="text-blue-400">expire on you again.</span>
        </h1>

        <p className="text-lg text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
          CredVault tracks your professional certifications, CPD progress, and renewal deadlines
          across every credential you hold — all in one place.
        </p>

        <div className="flex items-center justify-center gap-4 flex-wrap">
          <Link href="/signup" className="bg-blue-600 hover:bg-blue-500 text-white font-medium px-8 py-3 rounded-lg transition-colors text-sm">
            Start Tracking Free
          </Link>
          <Link href="/login" className="border border-gray-700 hover:border-gray-500 text-gray-300 hover:text-white font-medium px-8 py-3 rounded-lg transition-colors text-sm">
            Sign In
          </Link>
        </div>
      </section>

      {/* Dashboard Preview */}
      <section className="max-w-5xl mx-auto px-6 pb-20">
        <div className="relative rounded-xl overflow-hidden border border-gray-800 shadow-2xl shadow-black/50">
          <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-transparent to-transparent z-10 pointer-events-none" style={{height: "100%", top: "60%"}}></div>
          <Image
            src="/images/dashboard-preview.png"
            alt="CredVault dashboard showing certification tracking"
            width={1200}
            height={750}
            className="w-full"
            priority
          />
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 pb-24">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold text-white mb-3">Everything you need to stay certified</h2>
          <p className="text-gray-400">Designed for professionals who hold multiple credentials across different bodies.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <div className="w-10 h-10 bg-blue-950 border border-blue-800 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h3 className="font-semibold text-white mb-2">Multi-Certification Tracking</h3>
            <p className="text-sm text-gray-400 leading-relaxed">
              Track CISSP, CISM, PMP, CompTIA, and dozens more. Each cert shows CPD progress, expiration countdowns, and pace indicators.
            </p>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <div className="w-10 h-10 bg-blue-950 border border-blue-800 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="font-semibold text-white mb-2">CPD Activity Logging</h3>
            <p className="text-sm text-gray-400 leading-relaxed">
              Log continuing education activities once and apply them to multiple certifications simultaneously. Attach proof and track submission status.
            </p>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <div className="w-10 h-10 bg-blue-950 border border-blue-800 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <h3 className="font-semibold text-white mb-2">Pace Intelligence</h3>
            <p className="text-sm text-gray-400 leading-relaxed">
              Know exactly how many CPD hours per month you need to hit renewal deadlines. Stay on track before it becomes urgent.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-gray-800 bg-gray-900/50">
        <div className="max-w-6xl mx-auto px-6 py-16 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Start tracking your credentials today.</h2>
          <p className="text-gray-400 mb-8">Free to use. No credit card required.</p>
          <Link href="/signup" className="inline-flex bg-blue-600 hover:bg-blue-500 text-white font-medium px-8 py-3 rounded-lg transition-colors text-sm">
            Create Your Account
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800">
        <div className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <svg width="20" height="20" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M14 2L4 7V14C4 19.5 8.5 24.7 14 26C19.5 24.7 24 19.5 24 14V7L14 2Z" fill="#1e40af" stroke="#3b82f6" strokeWidth="1.5"/>
              <path d="M10 14L13 17L18 11" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="text-sm text-gray-500">
              © 2026 COOEY Tools. All rights reserved.
            </span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/login" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">Sign In</Link>
            <Link href="/signup" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">Sign Up</Link>
          </div>
        </div>
      </footer>

    </div>
  );
}
