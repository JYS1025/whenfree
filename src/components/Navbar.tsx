"use client";

import Link from "next/link";
import { useLanguage } from "@/lib/i18n";

export default function Navbar() {
  const { lang, setLang, t } = useLanguage();

  return (
    <header className="border-b border-zinc-800/80 bg-zinc-950/70 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-13 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group flex-shrink-0">
          <div className="w-5 h-5 rounded bg-emerald-500 flex items-center justify-center text-zinc-950 font-black text-xs tracking-tighter shadow-sm">
            W
          </div>
          <span className="font-semibold text-sm text-zinc-100 tracking-tight">WhenFree</span>
        </Link>

        <div className="flex items-center gap-2.5 text-xs flex-shrink-0">
          {/* Language Toggle: KO | EN (Fixed width container) */}
          <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-md p-0.5 text-[11px] font-mono w-16 justify-between">
            <button
              onClick={() => setLang("ko")}
              className={`w-7 py-0.5 text-center rounded transition-colors ${
                lang === "ko"
                  ? "bg-zinc-100 text-zinc-950 font-bold"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              KO
            </button>
            <button
              onClick={() => setLang("en")}
              className={`w-7 py-0.5 text-center rounded transition-colors ${
                lang === "en"
                  ? "bg-zinc-100 text-zinc-950 font-bold"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              EN
            </button>
          </div>

          {/* New Poll Button with Fixed Width (w-32) to prevent any navbar jitter */}
          <Link
            href="/"
            className="w-32 text-center bg-zinc-100 hover:bg-white text-zinc-950 font-medium text-xs py-1.5 rounded-md transition-colors flex items-center justify-center flex-shrink-0"
          >
            {t.newPoll}
          </Link>
        </div>
      </div>
    </header>
  );
}
