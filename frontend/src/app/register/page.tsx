"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { ShieldAlert, Loader2 } from "lucide-react";
import Link from "next/link";
import { FadeIn } from "@/components/animations/fade-in";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("citizen");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);
    
    try {
      await apiClient("/auth/register", {
        method: "POST",
        body: JSON.stringify({
          email,
          plain_password: password,
          full_name: fullName,
          role
        })
      });
      // Automatically redirect to login after successful registration
      router.push("/login");
    } catch (err: any) {
      setError(err.message || "Failed to register.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-background py-12">
      {/* Background decorations */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-[20%] left-[-10%] w-[50%] h-[50%] bg-primary/10 blur-[100px] rounded-full mix-blend-screen opacity-50" />
      </div>

      <FadeIn className="z-10 w-full max-w-md">
        <div className="bg-surface/60 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl">
          <div className="flex justify-center mb-6">
            <div className="bg-primary/20 p-3 rounded-full border border-primary/30">
              <ShieldAlert className="w-8 h-8 text-primary" />
            </div>
          </div>
          
          <h1 className="text-2xl font-bold text-center text-foreground mb-2">Create Account</h1>
          <p className="text-foreground/60 text-center mb-8">Join the DisasterSense network</p>

          {error && (
            <div className="bg-danger/10 border border-danger/30 text-danger text-sm rounded-lg p-3 mb-6">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground/80 mb-1">Full Name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full bg-background/50 border border-white/10 rounded-lg px-4 py-2.5 text-foreground focus:outline-none focus:border-primary transition-colors"
                required
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground/80 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-background/50 border border-white/10 rounded-lg px-4 py-2.5 text-foreground focus:outline-none focus:border-primary transition-colors"
                required
                disabled={isSubmitting}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-foreground/80 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-background/50 border border-white/10 rounded-lg px-4 py-2.5 text-foreground focus:outline-none focus:border-primary transition-colors"
                required
                disabled={isSubmitting}
                minLength={8}
              />
            </div>

            <div>
               <label className="block text-sm font-medium text-foreground/80 mb-2">Role Request</label>
               <div className="flex space-x-4">
                 <label className="flex items-center space-x-2 cursor-pointer">
                   <input type="radio" value="citizen" checked={role === "citizen"} onChange={(e) => setRole(e.target.value)} className="text-primary focus:ring-primary" />
                   <span className="text-sm text-foreground/80">Citizen</span>
                 </label>
                 <label className="flex items-center space-x-2 cursor-pointer">
                   <input type="radio" value="responder" checked={role === "responder"} onChange={(e) => setRole(e.target.value)} className="text-primary focus:ring-primary" />
                   <span className="text-sm text-foreground/80">Responder</span>
                 </label>
               </div>
            </div>

            <Button type="submit" className="w-full mt-6 py-6" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Register"}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-foreground/60">
            Already have an account?{" "}
            <Link href="/login" className="text-primary hover:underline font-medium">
              Sign in
            </Link>
          </div>
        </div>
      </FadeIn>
    </div>
  );
}
