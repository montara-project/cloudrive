"use client";

import { useId, useState } from "react";
import { CheckIcon } from "./icons";

const API_URL =
  (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_API_URL) || "http://localhost:8080";

type Status =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "success"; position: number; email: string }
  | { state: "error"; message: string };

export function WaitlistForm() {
  const inputId = useId();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>({ state: "idle" });

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setStatus({ state: "error", message: "Please enter a valid email address." });
      return;
    }

    setStatus({ state: "loading" });
    try {
      const res = await fetch(`${API_URL}/api/v1/waitlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: value }),
      });
      const data = (await res.json()) as { ok: boolean; position?: number; error?: string };
      if (!res.ok || !data.ok) {
        setStatus({
          state: "error",
          message:
            data.error === "invalid_email"
              ? "Please enter a valid email address."
              : "Something went wrong. Please try again.",
        });
        return;
      }
      setStatus({ state: "success", position: data.position ?? 0, email: value });
    } catch {
      setStatus({ state: "error", message: "Could not reach the server. Please try again." });
    }
  }

  if (status.state === "success") {
    return (
      <div
        className="mx-auto flex w-full max-w-md items-center gap-3 rounded-xl border border-white/20 bg-white/10 px-5 py-4 text-left"
        role="status"
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-amber-400 text-foreground">
          <CheckIcon className="size-4" />
        </span>
        <p className="text-sm leading-6 text-white">
          You&apos;re <strong>#{status.position.toLocaleString("en-US")}</strong> on the list. We&apos;ll
          email <strong>{status.email}</strong> when your invite is ready.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="mx-auto w-full max-w-md">
      <label htmlFor={inputId} className="mb-2 block text-left text-sm font-semibold text-white">
        Work email
      </label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          id={inputId}
          type="email"
          name="email"
          autoComplete="email"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (status.state === "error") setStatus({ state: "idle" });
          }}
          aria-invalid={status.state === "error"}
          aria-describedby={status.state === "error" ? `${inputId}-error` : undefined}
          className="h-12 w-full rounded-xl border border-white/25 bg-white px-4 text-sm text-foreground placeholder:text-slate-400 focus:outline-2 focus:outline-offset-0 focus:outline-amber-400"
        />
        <button
          type="submit"
          disabled={status.state === "loading"}
          className="h-12 shrink-0 rounded-xl bg-primary px-6 text-sm font-semibold whitespace-nowrap text-primary-foreground transition-colors duration-200 hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status.state === "loading" ? "Joining…" : "Join the waitlist"}
        </button>
      </div>
      <div aria-live="polite" className="min-h-5 mt-2 text-left text-xs">
        {status.state === "error" && (
          <p id={`${inputId}-error`} className="font-medium text-amber-400" role="alert">
            {status.message}
          </p>
        )}
        {status.state === "idle" && (
          <p className="text-white/60">Free during beta. No credit card required.</p>
        )}
      </div>
    </form>
  );
}
