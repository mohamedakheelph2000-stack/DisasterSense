"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, KeyRound, ArrowRight } from "lucide-react";
import { useAuth } from "@/lib/auth/auth-context";
import { apiClient, errorMessage } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthShell, FieldError } from "@/components/auth/auth-shell";

const SEEDED_ACCOUNTS = [
  { label: "Admin", email: "admin@disastersense.org", note: "Full system", tone: "text-primary" },
  { label: "Responder", email: "responder@disastersense.org", note: "Operations", tone: "text-warning" },
  { label: "Citizen", email: "citizen@disastersense.org", note: "Monitoring", tone: "text-success" },
] as const;

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      // OAuth2 password flow expects form-encoded credentials.
      const formData = new URLSearchParams();
      formData.append("username", email.trim());
      formData.append("password", password);

      const res = await apiClient<{ access_token: string }>("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData.toString(),
      });

      await login(res.access_token);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Sign in"
      subtitle="Authenticate to reach the operations console."
      footer={
        <>
          No account yet?{" "}
          <Link href="/register" className="font-medium text-primary hover:underline">
            Create one
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="login-email"
            className="mb-1.5 block text-xs font-medium text-foreground/75"
          >
            Email address
          </label>
          <Input
            id="login-email"
            type="email"
            autoComplete="username"
            placeholder="you@organisation.org"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isSubmitting}
          />
        </div>

        <div>
          <label
            htmlFor="login-password"
            className="mb-1.5 block text-xs font-medium text-foreground/75"
          >
            Password
          </label>
          <Input
            id="login-password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={isSubmitting}
          />
        </div>

        <FieldError message={error} />

        <Button
          type="submit"
          disabled={isSubmitting}
          className="group h-11 w-full gap-2 text-[15px] font-semibold"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Authenticating…
            </>
          ) : (
            <>
              Enter console
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </>
          )}
        </Button>
      </form>

      <div className="mt-7 border-t border-border/70 pt-5">
        <p className="eyebrow mb-3 flex items-center gap-2">
          <KeyRound className="h-3 w-3" />
          Seeded demo accounts
        </p>
        <div className="grid grid-cols-3 gap-2">
          {SEEDED_ACCOUNTS.map((acct) => (
            <button
              key={acct.email}
              type="button"
              disabled={isSubmitting}
              onClick={() => {
                setEmail(acct.email);
                setPassword("Password123!");
                setError("");
              }}
              className="rounded-lg border border-border bg-surface/70 px-2 py-2.5 text-center transition-all hover:border-primary/40 hover:bg-surface-muted focus-visible:border-primary/60 disabled:opacity-50"
            >
              <span className={cnTone(acct.tone)}>{acct.label}</span>
              <span className="mt-0.5 block text-[10px] text-muted-foreground">
                {acct.note}
              </span>
            </button>
          ))}
        </div>
        <p className="mt-2.5 text-[11px] leading-relaxed text-muted-foreground/80">
          Password for all seeded accounts is <code className="font-mono">Password123!</code>.
          These exist only because <code className="font-mono">scripts/seed_demo_data.py</code>{" "}
          was run against this database.
        </p>
      </div>
    </AuthShell>
  );
}

function cnTone(tone: string) {
  return `block text-xs font-semibold ${tone}`;
}
