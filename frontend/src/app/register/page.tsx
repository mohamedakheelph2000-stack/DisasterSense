"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, ArrowRight, ShieldCheck, Smartphone, Mail, Eye, EyeOff } from "lucide-react";
import { apiClient, errorMessage } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthShell, FieldError } from "@/components/auth/auth-shell";
import { cn } from "@/lib/utils";

const E164 = /^\+[1-9]\d{1,14}$/;
const TRIVIAL = new Set(["password", "12345678", "disastersense"]);

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const strength = passwordStrength(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (TRIVIAL.has(password.toLowerCase())) {
      setError("That password is too common. Choose a stronger one.");
      return;
    }

    let cleanPhone = phone ? phone.replace(/[\s\-()]+/g, "") : "";
    if (cleanPhone) {
      if (cleanPhone.startsWith("0") && cleanPhone.length === 11 && /^\d+$/.test(cleanPhone)) {
        cleanPhone = "+91" + cleanPhone.slice(1);
      } else if (cleanPhone.length === 10 && /^\d+$/.test(cleanPhone)) {
        cleanPhone = "+91" + cleanPhone;
      } else if (!cleanPhone.startsWith("+")) {
        cleanPhone = "+" + cleanPhone;
      }

      if (!E164.test(cleanPhone)) {
        setError("Phone number must follow international format, e.g. +919876543210 or 10-digit mobile.");
        return;
      }
    }

    setIsSubmitting(true);
    try {
      await apiClient("/auth/register", {
        method: "POST",
        body: JSON.stringify({
          email: email.trim(),
          full_name: fullName.trim(),
          plain_password: password,
          phone_number: cleanPhone || null,
          email_enabled: emailEnabled,
          sms_enabled: smsEnabled,
        }),
      });
      router.push("/login?registered=1");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Create account"
      subtitle="Self-registration always creates an active citizen account."
      footer={
        <>
          Already registered?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <FieldError message={error} />

        <div>
          <label htmlFor="reg-name" className="mb-1.5 block text-xs font-medium text-foreground/75">
            Full name
          </label>
          <Input
            id="reg-name"
            type="text"
            autoComplete="name"
            placeholder="Asha Krishnan"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            minLength={2}
            maxLength={200}
            disabled={isSubmitting}
          />
        </div>

        <div>
          <label htmlFor="reg-email" className="mb-1.5 block text-xs font-medium text-foreground/75">
            Email address
          </label>
          <Input
            id="reg-email"
            type="email"
            autoComplete="email"
            placeholder="you@organisation.org"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isSubmitting}
          />
        </div>

        <div>
          <label htmlFor="reg-phone" className="mb-1.5 block text-xs font-medium text-foreground/75">
            Mobile number{" "}
            <span className="font-normal text-muted-foreground">(optional, e.g. 9876543210)</span>
          </label>
          <Input
            id="reg-phone"
            type="tel"
            autoComplete="tel"
            placeholder="+919876543210"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={isSubmitting}
            className="font-mono"
          />
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="reg-password" className="block text-xs font-medium text-foreground/75">
              Password
            </label>
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
              tabIndex={-1}
            >
              {showPassword ? (
                <>
                  <EyeOff className="h-3 w-3" />
                  <span>Hide</span>
                </>
              ) : (
                <>
                  <Eye className="h-3 w-3" />
                  <span>Show</span>
                </>
              )}
            </button>
          </div>
          <div className="relative">
            <Input
              id="reg-password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              maxLength={128}
              disabled={isSubmitting}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground focus:outline-none"
              title={showPassword ? "Hide password" : "Show password"}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <div className="flex h-1 flex-1 gap-1">
              {[0, 1, 2, 3].map((i) => (
                <span
                  key={i}
                  className={cn(
                    "h-full flex-1 rounded-full transition-colors duration-300",
                    i < strength.score
                      ? strength.score >= 3
                        ? "bg-success"
                        : "bg-warning"
                      : "bg-muted"
                  )}
                />
              ))}
            </div>
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              {strength.label}
            </span>
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="reg-confirm" className="block text-xs font-medium text-foreground/75">
              Confirm password
            </label>
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              className="flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
              tabIndex={-1}
            >
              {showConfirm ? (
                <>
                  <EyeOff className="h-3 w-3" />
                  <span>Hide</span>
                </>
              ) : (
                <>
                  <Eye className="h-3 w-3" />
                  <span>Show</span>
                </>
              )}
            </button>
          </div>
          <div className="relative">
            <Input
              id="reg-confirm"
              type={showConfirm ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Repeat password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              disabled={isSubmitting}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground focus:outline-none"
              title={showConfirm ? "Hide password" : "Show password"}
              aria-label={showConfirm ? "Hide password" : "Show password"}
            >
              {showConfirm ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
          {confirm && confirm !== password && (
            <p className="mt-1.5 text-[11px] text-danger">Passwords do not match.</p>
          )}
        </div>

        <fieldset className="space-y-2.5 rounded-lg border border-border/70 bg-surface/50 p-3.5">
          <legend className="eyebrow px-1.5">Alert channels</legend>
          <Toggle
            icon={<Mail className="h-3.5 w-3.5" />}
            label="Email notifications"
            checked={emailEnabled}
            onChange={setEmailEnabled}
            disabled={isSubmitting}
          />
          <Toggle
            icon={<Smartphone className="h-3.5 w-3.5" />}
            label="SMS notifications"
            checked={smsEnabled}
            onChange={setSmsEnabled}
            disabled={isSubmitting}
          />
        </fieldset>

        <Button
          type="submit"
          disabled={isSubmitting}
          className="group h-11 w-full gap-2 text-[15px] font-semibold"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Creating account…
            </>
          ) : (
            <>
              Create account
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </>
          )}
        </Button>
      </form>

      <p className="mt-5 flex items-start gap-2 text-[11px] leading-relaxed text-muted-foreground">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
        <span>
          Roles cannot be self-assigned. New accounts start as <strong>citizen</strong>; an
          administrator promotes responders and admins through{" "}
          <code className="font-mono">PATCH /users/&#123;id&#125;</code>.
        </span>
      </p>
    </AuthShell>
  );
}

function Toggle({
  icon,
  label,
  checked,
  onChange,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-xs text-foreground/80">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="h-3.5 w-3.5 rounded border-border accent-[hsl(var(--primary))]"
      />
      {icon}
      <span>{label}</span>
    </label>
  );
}

function passwordStrength(pw: string): { score: number; label: string } {
  if (!pw) return { score: 0, label: "empty" };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
  const labels = ["too short", "weak", "fair", "strong", "excellent"];
  return { score, label: labels[score] };
}
