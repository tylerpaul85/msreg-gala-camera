"use client";

import { useState, useEffect } from "react";
import InstantCamera from "@/components/InstantCamera";

interface Guest {
  id: string;
  name: string;
  email: string;
  shots_remaining: number;
  session_token?: string;
}

export default function Home() {
  const [guest, setGuest] = useState<Guest | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  // Form states
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  // Check existing session token on load with localStorage fallback
  useEffect(() => {
    async function checkSession() {
      try {
        const localToken =
          typeof window !== "undefined"
            ? localStorage.getItem("msreg_gala_session_token")
            : null;
        const headers: Record<string, string> = {};
        if (localToken) {
          headers["x-session-token"] = localToken;
        }

        const res = await fetch("/api/auth/session", { headers });
        const data = await res.json();
        if (data.authenticated && data.guest) {
          setGuest(data.guest);
          if (data.guest.session_token) {
            localStorage.setItem(
              "msreg_gala_session_token",
              data.guest.session_token
            );
          }
        }
      } catch (err) {
        console.warn("Session check bypassed:", err);
      } finally {
        setCheckingSession(false);
      }
    }
    checkSession();
  }, []);

  const handleLogout = async () => {
    try {
      if (typeof window !== "undefined") {
        localStorage.removeItem("msreg_gala_session_token");
      }
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (e) {
      // Ignored
    }
    setGuest(null);
    setStatusNotice(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setStatusNotice(null);

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setFormError(
        "Invalid electronic mail address. A valid address is required to deliver your developed gallery at midnight."
      );
      return;
    }

    if (!firstName.trim() || !lastName.trim()) {
      setFormError("Kindly provide both your first name and surname for the gala roll ledger.");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName, email }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "The registrar desk could not validate your cartridge.");
      }

      if (!data.isNew) {
        setStatusNotice(
          `Welcome back, ${data.guest.name}. Existing film roll restored (${data.guest.shots_remaining} exposures remaining).`
        );
      } else {
        setStatusNotice(`Film cartridge issued to ${data.guest.name}. 8 exposures loaded.`);
      }

      if (data.guest?.session_token && typeof window !== "undefined") {
        localStorage.setItem(
          "msreg_gala_session_token",
          data.guest.session_token
        );
      }

      // Transition into the instant camera view
      setGuest(data.guest);
    } catch (err: any) {
      setFormError(err.message || "An unexpected ledger error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (checkingSession) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center space-y-2">
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-[#5E5A54] animate-pulse">
            Checking Film Registry...
          </p>
        </div>
      </main>
    );
  }

  // Active camera view if guest is registered/logged in
  if (guest) {
    return <InstantCamera guest={guest} onLogout={handleLogout} />;
  }

  // Otherwise, render vintage letterpress landing page
  return (
    <main className="relative min-h-screen flex flex-col justify-between px-4 py-8 sm:px-8 sm:py-12 md:py-16 max-w-2xl mx-auto">
      {/* Outer printed program border frame */}
      <div className="absolute inset-3 sm:inset-5 pointer-events-none border border-[#1E1C1A]/15" />
      <div className="absolute inset-4 sm:inset-6 pointer-events-none border border-[#1E1C1A]/30" />

      {/* Top Program Header */}
      <header className="relative z-10 pt-4 sm:pt-6 text-center">
        <div className="flex items-center justify-between text-[10px] sm:text-xs font-mono uppercase tracking-[0.25em] text-[#5E5A54] pb-3 border-b border-[#1E1C1A]/20">
          <span>Edition No. 1974</span>
          <span className="font-semibold text-[#6B2A2A]">MSREG Client Gala</span>
          <span>Film Cartridge: 8 Exp.</span>
        </div>

        <div className="pt-8 sm:pt-10 space-y-2">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-[#5E5A54]">
            Annual Client Appreciation
          </p>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-serif font-light tracking-tight text-[#1E1C1A] leading-[1.05]">
            MSREG Gala Camera
          </h1>
          <p className="font-serif italic text-lg sm:text-xl text-[#6B2A2A] pt-1">
            November 14, 2026
          </p>
        </div>

        {/* Delicate divider rule */}
        <div className="my-6 flex items-center justify-center space-x-3">
          <span className="h-[1px] w-12 sm:w-20 bg-[#1E1C1A]/25" />
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#5E5A54]">
            Eight exposures. Develop at midnight.
          </span>
          <span className="h-[1px] w-12 sm:w-20 bg-[#1E1C1A]/25" />
        </div>
      </header>

      {/* Main Content: Polaroid Display + Guest Registry Form */}
      <section className="relative z-10 my-4 sm:my-6 space-y-8">
        {/* Authentic Polaroid Frame */}
        <div className="flex justify-center">
          <div className="polaroid-frame w-64 sm:w-72 border border-[#1E1C1A]/25 transition-transform hover:rotate-[0.5deg] duration-300">
            {/* The square photo aperture */}
            <div className="aspect-square bg-[#22201D] relative overflow-hidden flex flex-col items-center justify-center text-center p-4 border border-[#1E1C1A]/40">
              <div className="w-24 h-24 rounded-full border border-[#FAF7F0]/15 flex items-center justify-center mb-3">
                <div className="w-16 h-16 rounded-full border border-[#FAF7F0]/25 flex items-center justify-center">
                  <div className="w-8 h-8 rounded-full border border-[#6B2A2A]/60 flex items-center justify-center">
                    <span className="w-2 h-2 rounded-full bg-[#FAF7F0]/40" />
                  </div>
                </div>
              </div>

              <p className="font-mono text-[9px] uppercase tracking-[0.25em] text-[#FAF7F0]/50">
                Latent Film Chamber
              </p>
              <p className="font-serif italic text-sm text-[#FAF7F0]/85 mt-1">
                Awaiting your first exposure
              </p>
              <div className="absolute bottom-2 right-2 font-mono text-[8px] text-[#FAF7F0]/30 tracking-widest">
                8 OF 8 REMAINING
              </div>
            </div>

            {/* Handwritten caption in thick bottom border */}
            <div className="pt-4 pb-1 text-center">
              <p className="font-hand text-base sm:text-lg text-[#1E1C1A]/85 tracking-normal">
                MSREG Gala • Nov 14, 2026
              </p>
            </div>
          </div>
        </div>

        {/* Guest Registration Form */}
        <div className="border border-[#1E1C1A]/20 p-5 sm:p-7 bg-[#F4EEE1]/60">
          <div className="flex items-center justify-between pb-3 mb-5 border-b border-[#1E1C1A]/15">
            <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-[#1E1C1A] font-bold">
              Guest Registry & Cartridge Issue
            </h2>
            <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#6B2A2A]">
              Step 01 of 02
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="firstName"
                  className="block font-mono text-[10px] uppercase tracking-[0.18em] text-[#5E5A54]"
                >
                  First Name <span className="text-[#6B2A2A]">*</span>
                </label>
                <input
                  id="firstName"
                  type="text"
                  required
                  placeholder="e.g. Thomas"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full px-3 py-2.5 text-base sm:text-sm placeholder:text-[#8A847C]/70 focus:ring-0"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="lastName"
                  className="block font-mono text-[10px] uppercase tracking-[0.18em] text-[#5E5A54]"
                >
                  Last Name <span className="text-[#6B2A2A]">*</span>
                </label>
                <input
                  id="lastName"
                  type="text"
                  required
                  placeholder="e.g. Sinclair"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full px-3 py-2.5 text-base sm:text-sm placeholder:text-[#8A847C]/70 focus:ring-0"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="block font-mono text-[10px] uppercase tracking-[0.18em] text-[#5E5A54]"
              >
                Email Address <span className="text-[#6B2A2A]">*</span>
              </label>
              <input
                id="email"
                type="email"
                required
                placeholder="for your midnight gallery invitation"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2.5 text-base sm:text-sm placeholder:text-[#8A847C]/70 focus:ring-0"
              />
            </div>

            <div className="pt-2 text-[11px] font-mono text-[#5E5A54] leading-relaxed flex items-start space-x-2">
              <span className="text-[#6B2A2A] font-bold">¶</span>
              <span>
                Each guest receives 8 analog exposures. Returning guests are
                re-connected to their active cartridge. All photographs remain
                latent in the collective gallery until midnight.
              </span>
            </div>

            {/* Vintage error presentation - no generic red boxes */}
            {formError && (
              <div className="p-3 bg-[#FAF7F0] border-l-2 border-[#6B2A2A] border-t border-r border-b border-[#1E1C1A]/20 text-[#6B2A2A] font-mono text-[11px] leading-relaxed">
                <span className="font-bold uppercase tracking-wider block mb-0.5">
                  Registry Notice:
                </span>
                {formError}
              </div>
            )}

            {/* Status notice */}
            {statusNotice && (
              <div className="p-3 bg-[#FAF7F0] border border-[#1E1C1A]/25 text-[#1E1C1A] font-mono text-[11px] tracking-wide text-center">
                {statusNotice}
              </div>
            )}

            {/* Load Film Button - Crisp, rectangular, ink charcoal with oxblood hover */}
            <div className="pt-3">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full cursor-pointer py-3.5 px-6 bg-[#1E1C1A] text-[#F4EEE1] hover:bg-[#6B2A2A] active:bg-[#4A1A1A] transition-colors border border-[#1E1C1A] font-mono text-xs uppercase tracking-[0.25em] font-medium text-center focus:outline-none"
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center space-x-2">
                    <span className="inline-block w-2 h-2 bg-[#F4EEE1] animate-ping" />
                    <span>Engaging Cartridge Mechanism...</span>
                  </span>
                ) : (
                  <span>Load Film &nbsp;[ 8 Exposures ]</span>
                )}
              </button>
            </div>
          </form>
        </div>
      </section>

      {/* Program Colophon / Footer */}
      <footer className="relative z-10 pt-6 pb-2 text-center border-t border-[#1E1C1A]/15 space-y-2">
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 font-mono text-[10px] uppercase tracking-[0.2em] text-[#5E5A54]">
          <span>MSREG Private Event</span>
          <span>•</span>
          <span>Instant Emulsion Process</span>
          <span>•</span>
          <span>Archival Edition</span>
        </div>
        <p className="font-serif italic text-xs text-[#5E5A54]/80">
          Designed for handheld capture during the evening of November 14, 2026.
        </p>
      </footer>
    </main>
  );
}
