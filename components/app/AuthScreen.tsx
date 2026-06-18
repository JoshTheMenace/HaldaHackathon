"use client";

import { useState, type FormEvent, type HTMLAttributes } from "react";
import { useHalda, type SignInProfile } from "@/lib/useHalda";
import { tr } from "@/lib/i18n";
import type { Language } from "@/lib/types";
import { Icon } from "./Icon";

const num = (v: string) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : undefined;
};

export default function AuthScreen() {
  const { language, setLanguage, signIn } = useHalda();
  const [form, setForm] = useState<Record<string, string>>({});
  const t = (key: string, fallback: string) => tr(language, key, fallback);
  const set = (key: string) => (value: string) => setForm((cur) => ({ ...cur, [key]: value }));
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.name?.trim()) return;
    signIn({
      name: form.name,
      age: num(form.age || ""),
      grade: num(form.grade || ""),
      highSchool: form.highSchool,
      location: form.location,
      email: form.email,
      phone: form.phone,
      intendedMajor: form.intendedMajor,
      interests: form.interests,
    } satisfies SignInProfile);
  };

  return (
    <main className="auth">
      <div className="auth-mark"><Icon name="auto_awesome" /></div>
      <div className="lang-pick" aria-label={t("auth.pick", "Choose your language")}>
        {(["en", "es"] as Language[]).map((lang) => (
          <button key={lang} className={language === lang ? "on" : ""} onClick={() => setLanguage(lang)}>
            {t(`auth.${lang}`, lang === "es" ? "Español" : "English")}
          </button>
        ))}
      </div>
      <h1>{t("auth.title", "Start with what Halda should already know")}</h1>
      <p>{t("auth.sub", "These basics go straight into your profile so the guide can skip intake questions.")}</p>
      <form onSubmit={submit} className="auth-form">
        <AuthInput label={t("auth.name", "Name")} value={form.name || ""} onChange={set("name")} required />
        <div className="auth-grid">
          <AuthInput label={t("auth.age", "Age")} value={form.age || ""} onChange={set("age")} inputMode="numeric" />
          <AuthInput label={t("auth.grade", "Grade")} value={form.grade || ""} onChange={set("grade")} inputMode="numeric" />
        </div>
        <AuthInput label={t("auth.school", "High school")} value={form.highSchool || ""} onChange={set("highSchool")} />
        <AuthInput label={t("auth.location", "Location")} value={form.location || ""} onChange={set("location")} placeholder={t("auth.locationPh", "City, ST or ZIP")} />
        <AuthInput label={t("auth.major", "Intended major")} value={form.intendedMajor || ""} onChange={set("intendedMajor")} />
        <AuthInput label={t("auth.interests", "Interests")} value={form.interests || ""} onChange={set("interests")} placeholder={t("auth.interestsPh", "robotics, soccer, design")} />
        <AuthInput label={t("auth.email", "Email")} value={form.email || ""} onChange={set("email")} type="email" />
        <AuthInput label={t("auth.phone", "Phone")} value={form.phone || ""} onChange={set("phone")} inputMode="tel" />
        <button className="auth-submit" type="submit">{t("auth.continue", "Continue")} <Icon name="arrow_forward" /></button>
      </form>
    </main>
  );
}

function AuthInput({ label, value, onChange, type = "text", required, placeholder, inputMode }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
  inputMode?: HTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  return (
    <label className="auth-field">
      <span>{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} type={type} required={required} placeholder={placeholder} inputMode={inputMode} />
    </label>
  );
}
