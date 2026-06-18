"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Building2, Mic, RotateCcw, Sparkles } from "lucide-react";
import { useHalda } from "@/lib/useHalda";
import { Logo, Pill } from "@/components/brand";
import Conversation from "@/components/Conversation";
import EditableProfile from "@/components/EditableProfile";
import InterestMatches from "@/components/InterestMatches";
import Community from "@/components/Community";
import TasksPanel from "@/components/TasksPanel";
import CreditWallet from "@/components/CreditWallet";
import { PlayerHeader } from "@/components/dashboard";
import Constellation from "@/components/Constellation";

export default function Home() {
  const { profile, hasSaved, reset } = useHalda();
  const started = !!profile.name || profile.interestSignals.length > 0;

  return (
    <div className="min-h-screen bg-cream">
      <header className="sticky top-0 z-30 border-b border-line bg-cream/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
          <Logo />
          <span className="ml-1 hidden rounded-full bg-mist px-2.5 py-1 text-[11px] font-600 text-coral-ink sm:inline">
            student
          </span>
          {hasSaved && (
            <button onClick={reset} className="ml-1 hidden items-center gap-1 rounded-full border border-line px-2.5 py-1 text-[11px] font-600 text-sage hover:text-pine sm:flex">
              <RotateCcw size={11} /> start over
            </button>
          )}
          <Link href="/partner" className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-line bg-paper px-3 py-1.5 text-[12px] font-600 text-pine transition hover:shadow-soft">
            <Building2 size={14} /> University view
          </Link>
        </div>
      </header>

      {/* intro — collapses once the conversation begins */}
      {!started && (
        <section className="mx-auto max-w-7xl px-4 pt-8">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-xl3 border border-line">
            <div className="starfield absolute inset-0" />
            <div className="relative grid items-center gap-4 p-7 md:grid-cols-[1.4fr_1fr] md:p-9">
              <div>
                <Pill className="border-gold/40 bg-gold/15 text-gold-ink"><Sparkles size={12} /> talk or type — your call</Pill>
                <h1 className="mt-3 font-display text-3xl font-700 leading-tight text-cream md:text-4xl">
                  Tell me what you <span className="text-gold">care about</span>.
                </h1>
                <p className="mt-2 max-w-md text-[14px] leading-relaxed text-cream/85">
                  I'm Halda. I learn what you're actually into — and find schools where that becomes a path,
                  a community, and a future. Not just a major on a list. Hit <b className="text-cream">Voice</b> and
                  just talk, or type. I'll remember everything.
                </p>
              </div>
              <div className="flex items-center justify-center gap-2 text-cream/80">
                <span className="grid h-16 w-16 place-items-center rounded-full bg-coral text-white shadow-lift"><Mic size={26} /></span>
                <span className="text-[12px]">→ live voice with Gemini</span>
              </div>
            </div>
          </motion.div>
        </section>
      )}

      <main className="mx-auto max-w-7xl px-4 py-5">
        <div className="grid gap-4 lg:grid-cols-12">
          <section className="lg:col-span-5">
            <div className="card h-[78vh] min-h-[560px] overflow-hidden">
              <Conversation />
            </div>
          </section>

          <section className="space-y-4 lg:col-span-7">
            {started && <PlayerHeader />}
            <Constellation />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-4">
                <EditableProfile />
                <CreditWallet />
                <TasksPanel />
              </div>
              <div className="space-y-4">
                <InterestMatches />
                <Community />
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
