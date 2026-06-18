"use client";

import { useState, type FormEvent, type HTMLAttributes } from "react";
import { useHalda, type SignInProfile } from "@/lib/useHalda";
import { Icon } from "./Icon";

const num = (v: string) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : undefined;
};

export default function AuthScreen() {
  const { signIn } = useHalda();
  const [form, setForm] = useState<Record<string, string>>({});
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
      <h1>Start with what Halda should already know</h1>
      <p>These basics go straight into your profile so the guide can skip intake questions.</p>
      <form onSubmit={submit} className="auth-form">
        <AuthInput label="Name" value={form.name || ""} onChange={set("name")} required />
        <div className="auth-grid">
          <AuthInput label="Age" value={form.age || ""} onChange={set("age")} inputMode="numeric" />
          <AuthInput label="Grade" value={form.grade || ""} onChange={set("grade")} inputMode="numeric" />
        </div>
        <AuthInput label="High school" value={form.highSchool || ""} onChange={set("highSchool")} />
        <AuthInput label="Location" value={form.location || ""} onChange={set("location")} placeholder="City, ST or ZIP" />
        <AuthInput label="Intended major" value={form.intendedMajor || ""} onChange={set("intendedMajor")} />
        <AuthInput label="Interests" value={form.interests || ""} onChange={set("interests")} placeholder="robotics, soccer, design" />
        <AuthInput label="Email" value={form.email || ""} onChange={set("email")} type="email" />
        <AuthInput label="Phone" value={form.phone || ""} onChange={set("phone")} inputMode="tel" />
        <button className="auth-submit" type="submit">Continue <Icon name="arrow_forward" /></button>
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
