"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeftRight, BadgeCheck, Coins, GraduationCap, Lock, MapPin,
  ShieldCheck, Sparkles, TrendingUp, Unlock, Users,
} from "lucide-react";
import type { Lead } from "@/lib/types";
import type { Tenant } from "@/lib/store";
import { schoolById } from "@/lib/schools";
import { Logo } from "@/components/brand";
import GTMPanel from "@/components/GTMPanel";

export default function PartnerPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [slug, setSlug] = useState<string>("");
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/tenants")
      .then((r) => r.json())
      .then((d) => {
        setTenants(d.tenants);
        setSlug(d.tenants[0]?.slug ?? "");
      });
  }, []);

  const load = useCallback((s: string) => {
    if (!s) return;
    setLoading(true);
    fetch(`/api/tenants/${s}/leads`)
      .then((r) => r.json())
      .then((d) => {
        setTenant(d.tenant);
        setLeads(d.leads ?? []);
        setLoading(false);
      });
  }, []);

  useEffect(() => { load(slug); }, [slug, load]);

  const purchase = async (lead: Lead) => {
    const r = await fetch(`/api/tenants/${slug}/leads/${lead.id}/purchase`, { method: "POST" });
    const d = await r.json();
    if (d.ok) {
      setLeads((cur) => cur.map((l) => (l.id === d.lead.id ? d.lead : l)));
      setTenant((t) => (t ? { ...t, leadCredits: d.credits } : t));
    }
  };

  const cpl = tenant ? schoolById(tenant.schoolId)?.cpl ?? 0 : 0;
  const purchased = leads.filter((l) => l.status === "purchased").length;

  return (
    <div className="min-h-screen bg-[#f4f6f7]">
      <header className="sticky top-0 z-30 border-b border-line bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
          <Logo />
          <span className="ml-1 rounded-full bg-pine/8 px-2.5 py-1 text-[11px] font-700 text-pine">
            partner console
          </span>
          <Link href="/app" className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-[12px] font-600 text-pine hover:shadow-soft">
            <GraduationCap size={14} /> Student view
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-5">
        <div className="grid gap-5 lg:grid-cols-12">
          {/* Tenant switcher — the isolation proof */}
          <aside className="lg:col-span-3">
            <div className="mb-2 flex items-center gap-1.5 px-1 text-[11px] font-700 uppercase tracking-wide text-sage">
              <ArrowLeftRight size={12} /> Switch tenant
            </div>
            <div className="space-y-2">
              {tenants.map((t) => {
                const active = t.slug === slug;
                const s = schoolById(t.schoolId)!;
                return (
                  <button
                    key={t.slug}
                    onClick={() => setSlug(t.slug)}
                    className={`flex w-full items-center gap-2.5 rounded-xl2 border p-2.5 text-left transition ${
                      active ? "border-pine bg-white shadow-soft" : "border-line bg-white/60 hover:bg-white"
                    }`}
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg font-display text-xs font-700 text-white" style={{ background: t.brand }}>
                      {s.short.slice(0, 2)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-700 text-pine">{s.short}</span>
                      <span className="block truncate text-[10.5px] text-sage">{s.city}, {s.state}</span>
                    </span>
                    {active && <BadgeCheck size={16} className="shrink-0 text-success" />}
                  </button>
                );
              })}
            </div>

            <div className="mt-3 rounded-xl2 border border-line bg-white p-3">
              <div className="flex items-center gap-1.5 text-[11px] font-700 text-pine">
                <ShieldCheck size={13} className="text-success" /> Data isolation
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-sage">
                Every query runs through <code className="rounded bg-[#eef1f0] px-1 font-mono text-[10px] text-pine">withTenant()</code>.
                You are scoped to <b className="text-pine">{tenant?.name?.replace(" — Admissions", "") ?? "—"}</b> and
                literally cannot read another school's leads. Switch tenants — the list changes completely.
              </p>
            </div>
          </aside>

          {/* Leads */}
          <section className="lg:col-span-9">
            <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl2 border border-line bg-white p-4 shadow-soft">
              <div>
                <h1 className="font-display text-lg font-700 text-pine">
                  {tenant?.name ?? "Loading…"}
                </h1>
                <p className="text-[12px] text-sage">
                  Intent-signaled, consented student leads matched to your programs.
                </p>
              </div>
              <div className="ml-auto flex items-center gap-4">
                <Stat icon={<Users size={14} />} label="matched" value={leads.length} />
                <Stat icon={<Unlock size={14} />} label="purchased" value={purchased} />
                <Stat icon={<Coins size={14} />} label="credits" value={tenant?.leadCredits ?? 0} accent />
              </div>
            </div>

            {loading ? (
              <div className="grid h-40 place-items-center text-sage">Loading leads…</div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {leads.map((l) => (
                  <LeadCard key={l.id} lead={l} cpl={cpl} onBuy={() => purchase(l)} />
                ))}
              </div>
            )}

            <div className="mt-5">
              <GTMPanel />
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

function Stat({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: number; accent?: boolean }) {
  return (
    <div className="text-center">
      <div className={`flex items-center justify-center gap-1 font-display text-lg font-700 tnum ${accent ? "text-coral" : "text-pine"}`}>
        {value}
      </div>
      <div className="flex items-center gap-1 text-[10px] font-600 text-sage">{icon}{label}</div>
    </div>
  );
}

function LeadCard({ lead, cpl, onBuy }: { lead: Lead; cpl: number; onBuy: () => void }) {
  const bought = lead.status === "purchased";
  return (
    <motion.div layout className={`rounded-xl2 border bg-white p-4 shadow-soft ${bought ? "border-success/40" : "border-line"}`}>
      <div className="flex items-start gap-3">
        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl font-display text-sm font-700 ${bought ? "bg-success text-white" : "bg-pine text-cream"}`}>
          {bought && lead.revealed ? lead.revealed.name.split(" ").map((w) => w[0]).slice(0, 2).join("") : lead.masked.initials}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-display text-[15px] font-700 text-pine">
              {bought && lead.revealed ? lead.revealed.name : `${lead.masked.gradeLabel} · ${lead.masked.initials}`}
            </h3>
            <span className="rounded-full bg-coral/12 px-2 py-0.5 text-[10px] font-700 capitalize text-coral-ink">{lead.reach}</span>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-sage">
            <MapPin size={11} /> {lead.masked.region} · {lead.masked.distanceMi} mi
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-display text-xl font-700 text-coral tnum">{lead.fit}</div>
          <div className="text-[9px] font-600 text-sage">FIT</div>
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {lead.masked.intent.map((i) => (
          <span key={i} className="inline-flex items-center gap-1 rounded-full bg-[#eef1f0] px-2 py-0.5 text-[10.5px] font-600 text-pine">
            <Sparkles size={10} className="text-coral" /> {i}
          </span>
        ))}
      </div>

      <div className="mt-2 flex items-center gap-1.5 text-[11px] font-600 text-success">
        <TrendingUp size={12} /> {lead.masked.engagement}
      </div>
      <p className="mt-1.5 text-[11.5px] leading-snug text-sage">{lead.masked.fitBlurb}</p>

      {bought && lead.revealed ? (
        <div className="mt-3 rounded-xl border border-success/30 bg-success/6 p-3">
          <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-700 text-success">
            <BadgeCheck size={13} /> Purchased — consented snapshot
          </div>
          <dl className="space-y-0.5 text-[11.5px] text-pine">
            {lead.revealed.highSchool && <Row k="School" v={lead.revealed.highSchool} />}
            {lead.revealed.intendedMajors.length > 0 && <Row k="Intent" v={lead.revealed.intendedMajors.join(", ")} />}
            {lead.revealed.interests.length > 0 && <Row k="Interests" v={lead.revealed.interests.join(", ")} />}
            {lead.revealed.careerGoal && <Row k="Goal" v={lead.revealed.careerGoal} />}
            <Row k="Reach out" v={lead.revealed.contact.handle} mono />
          </dl>
        </div>
      ) : (
        <button
          onClick={onBuy}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-pine py-2 text-[12.5px] font-700 text-cream transition hover:bg-pine-deep"
        >
          <Lock size={13} /> Purchase lead · {cpl} credits
        </button>
      )}
    </motion.div>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex gap-2">
      <dt className="w-16 shrink-0 text-sage">{k}</dt>
      <dd className={`font-600 ${mono ? "font-mono text-[10.5px]" : ""}`}>{v}</dd>
    </div>
  );
}
