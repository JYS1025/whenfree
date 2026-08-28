import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import { LanguageProvider } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "WhenFree - Agent-Native Scheduling Platform",
  description:
    "Zero-install, API-first scheduling platform for autonomous AI agents and humans. Inspired by When2meet, redesigned for the AI era.",
  icons: {
    icon: [
      { url: "/icon.svg?v=3", type: "image/svg+xml" },
      { url: "/favicon.ico?v=3" },
    ],
    shortcut: "/favicon.ico?v=3",
    apple: "/icon.svg?v=3",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="dark">
      <head>
        <link rel="icon" href="/icon.svg?v=3" type="image/svg+xml" />
        <link rel="alternate icon" href="/favicon.ico?v=3" />
        <link rel="shortcut icon" href="/favicon.ico?v=3" />
      </head>
      <body className="min-h-screen flex flex-col bg-zinc-950 text-zinc-100 antialiased selection:bg-zinc-800 selection:text-white">
        <LanguageProvider>
          <Navbar />
          <main className="flex-1">{children}</main>
          <footer className="border-t border-zinc-900 bg-zinc-950 py-6 text-center text-xs text-zinc-500">
            <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
              <span>WhenFree © 2026 — Zero-Install Agent Scheduling</span>
              <div className="flex items-center gap-4">
                <a href="/llms.txt" className="hover:text-zinc-300">LLM Docs</a>
                <a href="/.well-known/agent.json" className="hover:text-zinc-300">Agent Spec</a>
                <a href="/api/v1/openapi.json" className="hover:text-zinc-300">OpenAPI 3.1</a>
              </div>
            </div>
          </footer>
        </LanguageProvider>
      </body>
    </html>
  );
}
