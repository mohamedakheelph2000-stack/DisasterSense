import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth/auth-context";

const outfit = Outfit({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "DisasterSense - AI-Assisted Disaster Intelligence",
  description: "AI-assisted disaster intelligence for flood and landslide risk, emergency-resource planning, alerts, maps, and analytics",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${outfit.className} font-sans antialiased bg-background text-foreground min-h-screen`}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
