"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import QRCode from "qrcode";

interface Stats {
  totalGuests: number;
  totalPhotos: number;
  photosPerGuest: string;
  revealed: boolean;
}

interface AdminPhoto {
  id: string;
  guest_id: string;
  storage_path: string;
  preview_url: string;
  original_url?: string;
  caption: string | null;
  exposure_number: number;
  created_at: string;
  guest_name?: string;
  guest_first_name?: string;
}

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [passwordInput, setPasswordInput] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Admin Dashboard Data
  const [stats, setStats] = useState<Stats | null>(null);
  const [photos, setPhotos] = useState<AdminPhoto[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  // Reveal confirmation modal state
  const [showConfirmModal, setShowConfirmModal] = useState<"reveal" | "unreveal" | null>(null);
  const [actionInProgress, setActionInProgress] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Deletion confirmation
  const [photoToDelete, setPhotoToDelete] = useState<AdminPhoto | null>(null);

  // Printable QR Code Modal
  const [showTableTent, setShowTableTent] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  const checkAuth = async () => {
    try {
      const res = await fetch("/api/admin/auth");
      const data = await res.json();
      setIsAuthenticated(Boolean(data.authenticated));
      if (data.authenticated) {
        loadDashboardData();
      }
    } catch (e) {
      setIsAuthenticated(false);
    }
  };

  const loadDashboardData = useCallback(async () => {
    setLoadingData(true);
    try {
      const [statsRes, photosRes] = await Promise.all([
        fetch("/api/admin/stats"),
        fetch("/api/admin/photos"),
      ]);

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }
      if (photosRes.ok) {
        const photosData = await photosRes.json();
        setPhotos(photosData.photos || []);
      }
    } catch (err) {
      console.error("Dashboard data load error:", err);
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, []);

  // Generate QR Code for the live site
  useEffect(() => {
    if (typeof window !== "undefined") {
      const siteUrl = window.location.origin;
      QRCode.toDataURL(
        siteUrl,
        {
          width: 320,
          margin: 1,
          color: {
            dark: "#1E1C1A",
            light: "#FAF7F0",
          },
        },
        (err, url) => {
          if (!err && url) setQrDataUrl(url);
        }
      );
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setIsLoggingIn(true);

    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: passwordInput }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Invalid administrator credentials.");
      }

      setIsAuthenticated(true);
      loadDashboardData();
    } catch (err: any) {
      setLoginError(err.message || "Authentication error.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/admin/auth", { method: "DELETE" });
    setIsAuthenticated(false);
    setStats(null);
    setPhotos([]);
  };

  // Toggle Reveal State
  const handleToggleReveal = async (newRevealState: boolean) => {
    setActionInProgress(true);
    setActionMessage(null);

    try {
      const res = await fetch("/api/admin/reveal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revealed: newRevealState }),
      });

      if (!res.ok) throw new Error("Failed to update darkroom reveal seal.");

      setShowConfirmModal(null);
      await loadDashboardData();
      setActionMessage(
        newRevealState
          ? "The Gala Film has been DEVELOPED and unveiled across all guest devices!"
          : "The collective vault has been RE-BLURRED and placed back under darkroom seal."
      );
    } catch (err: any) {
      setActionMessage(err.message || "An error occurred.");
    } finally {
      setActionInProgress(false);
    }
  };

  // Delete a Photo
  const handleDeletePhoto = async (photoId: string) => {
    setActionInProgress(true);
    try {
      const res = await fetch(`/api/admin/photos/${photoId}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Could not discard plate.");

      setPhotoToDelete(null);
      setPhotos((prev) => prev.filter((p) => p.id !== photoId));
      if (stats) {
        setStats({
          ...stats,
          totalPhotos: Math.max(0, stats.totalPhotos - 1),
        });
      }
      setActionMessage("Photograph plate discarded permanently.");
    } catch (err: any) {
      setActionMessage(err.message || "Failed to delete photo.");
    } finally {
      setActionInProgress(false);
    }
  };

  // Export CSV
  const handleExportCsv = () => {
    window.location.href = "/api/admin/export/csv";
  };

  // Export ZIP
  const handleExportZip = () => {
    window.location.href = "/api/admin/export/zip";
  };

  // Loading state
  if (isAuthenticated === null) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <p className="font-mono text-xs uppercase tracking-[0.25em] text-[#5E5A54] animate-pulse">
          Verifying Darkroom Seal...
        </p>
      </main>
    );
  }

  // Login Gate
  if (!isAuthenticated) {
    return (
      <main className="relative min-h-screen flex flex-col justify-center items-center px-4 py-8 max-w-md mx-auto">
        <div className="absolute inset-4 pointer-events-none border border-[#1E1C1A]/20" />

        <div className="relative z-10 w-full p-8 bg-[#FAF7F0] border border-[#1E1C1A]/35 text-center space-y-6">
          <div className="space-y-1">
            <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-[#6B2A2A] font-bold">
              Restricted Vault
            </span>
            <h1 className="text-3xl font-serif font-light text-[#1E1C1A]">
              Curator Desk
            </h1>
            <p className="font-serif italic text-xs text-[#5E5A54]">
              MSREG Client Appreciation Gala • Admin Terminal
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4 pt-2">
            <div className="space-y-1.5 text-left">
              <label
                htmlFor="adminPass"
                className="block font-mono text-[10px] uppercase tracking-[0.18em] text-[#5E5A54]"
              >
                Administrator Password
              </label>
              <input
                id="adminPass"
                type="password"
                required
                placeholder="Administrative key..."
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="w-full px-3 py-2.5 text-sm bg-transparent border border-[#1E1C1A]/30 focus:border-[#6B2A2A] outline-none font-mono"
              />
            </div>

            {loginError && (
              <div className="p-2.5 bg-[#F4EEE1] border border-[#6B2A2A] text-[#6B2A2A] font-mono text-[11px] text-center">
                {loginError}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-3 px-4 bg-[#1E1C1A] text-[#F4EEE1] hover:bg-[#6B2A2A] transition-colors border border-[#1E1C1A] font-mono text-xs uppercase tracking-[0.25em] cursor-pointer"
            >
              {isLoggingIn ? "Verifying..." : "Unlock Terminal"}
            </button>
          </form>

          <div className="pt-2 border-t border-[#1E1C1A]/15 text-center">
            <Link
              href="/"
              className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#5E5A54] hover:text-[#1E1C1A]"
            >
              ← Return to Guest View
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // Authenticated Admin Dashboard
  return (
    <main className="relative min-h-screen bg-[#F4EEE1] text-[#1E1C1A] px-4 py-8 sm:px-8 sm:py-12 max-w-6xl mx-auto">
      {/* Top Admin Header */}
      <header className="relative z-10 pb-6 border-b border-[#1E1C1A]/25">
        <div className="flex items-center justify-between font-mono text-[10px] sm:text-xs uppercase tracking-[0.25em] text-[#5E5A54] pb-3">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-[#6B2A2A]" />
            <span className="font-semibold text-[#1E1C1A]">Curator Station</span>
          </div>

          <div className="flex items-center space-x-4">
            <Link
              href="/gallery"
              target="_blank"
              className="hover:text-[#6B2A2A] transition-colors"
            >
              Live Gallery ↗
            </Link>
            <button
              type="button"
              onClick={() => setShowTableTent(true)}
              className="hover:text-[#6B2A2A] transition-colors cursor-pointer text-[#6B2A2A] font-bold"
            >
              Table Tent QR
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="hover:text-[#6B2A2A] transition-colors cursor-pointer"
            >
              Exit
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end justify-between pt-4 gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-serif font-light text-[#1E1C1A]">
              MSREG Gala Moderation Desk
            </h1>
            <p className="font-serif italic text-sm text-[#5E5A54] mt-1">
              Live supervision and chemical development control for the 8-exposure rolls.
            </p>
          </div>

          {/* Quick Refresh */}
          <button
            type="button"
            onClick={loadDashboardData}
            disabled={loadingData}
            className="self-start sm:self-auto px-4 py-2 bg-[#FAF7F0] hover:bg-[#EAE2D2] border border-[#1E1C1A]/30 font-mono text-[10px] uppercase tracking-[0.2em] transition-colors cursor-pointer"
          >
            {loadingData ? "Refreshing..." : "↻ Refresh Ledger"}
          </button>
        </div>
      </header>

      {/* Action Notification Message */}
      {actionMessage && (
        <div className="my-6 p-4 bg-[#FAF7F0] border-2 border-[#6B2A2A] text-center font-mono text-xs uppercase tracking-[0.18em] text-[#6B2A2A]">
          {actionMessage}
        </div>
      )}

      {/* Section 1: Event Statistics */}
      <section className="relative z-10 my-8">
        <h2 className="font-mono text-xs uppercase tracking-[0.25em] text-[#5E5A54] mb-4">
          Gala Roll Metrics
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-5 bg-[#FAF7F0] border border-[#1E1C1A]/20">
            <span className="block font-mono text-[10px] uppercase tracking-[0.2em] text-[#5E5A54]">
              Total Registered Guests
            </span>
            <span className="block text-3xl sm:text-4xl font-serif text-[#1E1C1A] mt-2">
              {stats?.totalGuests ?? 0}
            </span>
          </div>

          <div className="p-5 bg-[#FAF7F0] border border-[#1E1C1A]/20">
            <span className="block font-mono text-[10px] uppercase tracking-[0.2em] text-[#5E5A54]">
              Total Exposures Captured
            </span>
            <span className="block text-3xl sm:text-4xl font-serif text-[#1E1C1A] mt-2">
              {stats?.totalPhotos ?? 0}
            </span>
          </div>

          <div className="p-5 bg-[#FAF7F0] border border-[#1E1C1A]/20">
            <span className="block font-mono text-[10px] uppercase tracking-[0.2em] text-[#5E5A54]">
              Exposures Per Guest (Avg)
            </span>
            <span className="block text-3xl sm:text-4xl font-serif text-[#1E1C1A] mt-2">
              {stats?.photosPerGuest ?? "0.0"}
            </span>
          </div>
        </div>
      </section>

      {/* Section 2: Chemical Reveal Master Switch */}
      <section className="relative z-10 my-8 p-6 bg-[#FAF7F0] border-2 border-[#1E1C1A]/40 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#1E1C1A]/15">
          <div>
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#6B2A2A] font-bold">
              8:00 PM CST Event Reveal Master Control
            </span>
            <h3 className="text-2xl font-serif text-[#1E1C1A] mt-1">
              Chemical Emulsion Status:{" "}
              <span className={stats?.revealed ? "text-emerald-700 italic" : "text-[#6B2A2A] italic"}>
                {stats?.revealed ? "DEVELOPED (Unveiled)" : "LATENT (Blurred)"}
              </span>
            </h3>
            <p className="font-serif italic text-xs text-[#5E5A54] mt-1">
              {stats?.revealed
                ? "The guest gallery is currently serving full-resolution originals via signed URLs."
                : "All guest browsers currently see only heavy blurred previews. Originals remain secure."}
            </p>
          </div>

          {/* Master Button */}
          <div className="flex flex-col sm:flex-row gap-2">
            {!stats?.revealed ? (
              <button
                type="button"
                onClick={() => setShowConfirmModal("reveal")}
                className="py-3.5 px-6 bg-[#6B2A2A] hover:bg-[#853434] text-[#FAF7F0] border border-[#6B2A2A] font-mono text-xs uppercase tracking-[0.25em] font-bold cursor-pointer transition-colors shadow-sm"
              >
                ✦ Develop the Film (8:00 PM CST Reveal)
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowConfirmModal("unreveal")}
                className="py-3 px-5 bg-transparent hover:bg-[#1E1C1A]/10 text-[#6B2A2A] border border-[#6B2A2A] font-mono text-xs uppercase tracking-[0.2em] cursor-pointer transition-colors"
              >
                ↺ Undo / Re-Blur Vault
              </button>
            )}
          </div>
        </div>

        {/* Section 3: Data & Photo Exports */}
        <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#5E5A54]">
            Archival Export Downloads:
          </span>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleExportZip}
              className="py-2 px-4 bg-[#1E1C1A] hover:bg-[#6B2A2A] text-[#F4EEE1] font-mono text-[10px] uppercase tracking-[0.2em] transition-colors cursor-pointer"
            >
              Download All Originals [ZIP]
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              className="py-2 px-4 bg-[#FAF7F0] hover:bg-[#EAE2D2] text-[#1E1C1A] border border-[#1E1C1A]/30 font-mono text-[10px] uppercase tracking-[0.2em] transition-colors cursor-pointer"
            >
              Export Guest Roster [CSV]
            </button>
          </div>
        </div>
      </section>

      {/* Section 4: Live Moderation Grid (Originals Visible to Admin Only) */}
      <section className="relative z-10 my-10">
        <div className="flex items-center justify-between pb-4 border-b border-[#1E1C1A]/20 mb-6">
          <div>
            <h2 className="font-mono text-xs uppercase tracking-[0.25em] text-[#1E1C1A] font-bold">
              Photographic Plates Moderation
            </h2>
            <p className="font-serif italic text-xs text-[#5E5A54] mt-0.5">
              Admin view displays true originals to screen for inappropriate captures prior to midnight reveal.
            </p>
          </div>
          <span className="font-mono text-xs text-[#5E5A54]">
            {photos.length} Captured
          </span>
        </div>

        {photos.length === 0 ? (
          <div className="p-12 text-center border border-[#1E1C1A]/20 bg-[#FAF7F0]/50 font-serif italic text-sm text-[#5E5A54]">
            No exposures have been taken yet tonight.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {photos.map((photo) => (
              <div
                key={photo.id}
                className="polaroid-frame border border-[#1E1C1A]/30 flex flex-col justify-between"
              >
                <div className="aspect-square relative overflow-hidden bg-[#1E1C1A] border border-[#1E1C1A]/20">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.original_url || photo.preview_url}
                    alt={photo.caption || "Gala plate"}
                    className="w-full h-full object-cover"
                  />
                  <span className="absolute top-2 right-2 bg-[#1E1C1A]/70 text-[#FAF7F0] px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-wider">
                    Exp. {photo.exposure_number}
                  </span>
                </div>

                <div className="pt-3 pb-2 text-center space-y-1">
                  <p className="font-hand text-base text-[#1E1C1A] truncate">
                    {photo.caption ? `"${photo.caption}"` : "Untitled"}
                  </p>
                  <p className="font-mono text-[10px] uppercase tracking-wider text-[#5E5A54]">
                    By {photo.guest_name || "Guest"}
                  </p>
                  <p className="font-mono text-[8px] text-[#8A847C]">
                    {new Date(photo.created_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>

                {/* Moderation Delete Button */}
                <div className="pt-2 border-t border-[#1E1C1A]/15">
                  <button
                    type="button"
                    onClick={() => setPhotoToDelete(photo)}
                    className="w-full py-1.5 bg-transparent hover:bg-[#6B2A2A] text-[#6B2A2A] hover:text-[#FAF7F0] border border-[#6B2A2A]/40 font-mono text-[9px] uppercase tracking-[0.2em] transition-colors cursor-pointer"
                  >
                    Delete Plate
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Modal: Reveal Confirmation */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-[#1E1C1A]/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-[#FAF7F0] border-2 border-[#1E1C1A] p-6 text-center space-y-4">
            <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-[#6B2A2A] font-bold">
              Curator Confirmation
            </span>

            <h3 className="text-2xl font-serif text-[#1E1C1A]">
              {showConfirmModal === "reveal"
                ? "Develop the Gala Film?"
                : "Re-Seal and Re-Blur the Vault?"}
            </h3>

            <p className="font-serif italic text-sm text-[#5E5A54] leading-relaxed">
              {showConfirmModal === "reveal"
                ? "This will unveil all guest photographs simultaneously across the collective gallery. Once initiated, all screens will begin developing into full focus."
                : "This will place the gallery back into latent state, replacing original exposures with heavy blurred previews across all guest screens."}
            </p>

            <div className="pt-3 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                disabled={actionInProgress}
                onClick={() =>
                  handleToggleReveal(showConfirmModal === "reveal")
                }
                className="flex-1 py-3 px-4 bg-[#6B2A2A] hover:bg-[#853434] text-[#FAF7F0] font-mono text-xs uppercase tracking-[0.2em] cursor-pointer"
              >
                {actionInProgress
                  ? "Processing Chemical Seal..."
                  : showConfirmModal === "reveal"
                  ? "Confirm & Develop Film"
                  : "Confirm & Re-Blur"}
              </button>

              <button
                type="button"
                onClick={() => setShowConfirmModal(null)}
                className="py-3 px-4 bg-transparent border border-[#1E1C1A]/30 text-[#1E1C1A] font-mono text-xs uppercase tracking-[0.2em] cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Delete Photo Confirmation */}
      {photoToDelete && (
        <div className="fixed inset-0 z-50 bg-[#1E1C1A]/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-sm w-full bg-[#FAF7F0] border-2 border-[#6B2A2A] p-6 text-center space-y-4">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#6B2A2A] font-bold">
              Permanent Disposal
            </span>
            <h3 className="text-xl font-serif text-[#1E1C1A]">
              Discard This Photograph?
            </h3>
            <p className="font-serif italic text-xs text-[#5E5A54]">
              This will permanently remove both the original and blurred plates from the storage vault.
            </p>

            <div className="pt-2 flex gap-3">
              <button
                type="button"
                disabled={actionInProgress}
                onClick={() => handleDeletePhoto(photoToDelete.id)}
                className="flex-1 py-2.5 bg-[#6B2A2A] text-[#FAF7F0] font-mono text-xs uppercase tracking-[0.2em] cursor-pointer"
              >
                {actionInProgress ? "Deleting..." : "Yes, Discard"}
              </button>
              <button
                type="button"
                onClick={() => setPhotoToDelete(null)}
                className="py-2.5 px-4 bg-transparent border border-[#1E1C1A]/30 text-[#1E1C1A] font-mono text-xs uppercase tracking-[0.2em] cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Printable Table Tent QR Modal */}
      {showTableTent && (
        <div className="fixed inset-0 z-50 bg-[#1E1C1A]/90 overflow-y-auto p-4 flex flex-col items-center justify-center">
          <div className="w-full max-w-lg bg-[#FAF7F0] border-2 border-[#1E1C1A] p-8 text-center space-y-6 relative print:border-none print:shadow-none print:p-0">
            {/* Action Bar (hidden in print) */}
            <div className="flex items-center justify-between border-b border-[#1E1C1A]/20 pb-3 print:hidden">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#6B2A2A] font-bold">
                Table Tent Print Layout
              </span>
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="py-1 px-3 bg-[#1E1C1A] text-[#FAF7F0] font-mono text-[10px] uppercase tracking-[0.2em] cursor-pointer"
                >
                  Print Tent
                </button>
                <button
                  type="button"
                  onClick={() => setShowTableTent(false)}
                  className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#5E5A54] hover:text-[#1E1C1A] cursor-pointer"
                >
                  Close [✕]
                </button>
              </div>
            </div>

            {/* The Printable Table Tent Face */}
            <div className="border border-[#1E1C1A]/30 p-8 space-y-5 bg-[#FAF7F0]">
              <div className="space-y-1">
                <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#5E5A54]">
                  MSREG Client Appreciation Gala
                </p>
                <h2 className="text-3xl font-serif font-light text-[#1E1C1A]">
                  Gala Disposable Camera
                </h2>
                <p className="font-serif italic text-sm text-[#6B2A2A]">
                  Saturday, November 14, 2026
                </p>
              </div>

              {/* QR Code Container */}
              <div className="flex justify-center my-4">
                <div className="p-3 bg-[#FAF7F0] border-2 border-[#1E1C1A]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {qrDataUrl && (
                    <img
                      src={qrDataUrl}
                      alt="Event QR Code"
                      className="w-48 h-48 mx-auto"
                    />
                  )}
                </div>
              </div>

              <div className="space-y-2 max-w-xs mx-auto">
                <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#1E1C1A] font-bold">
                  Scan to Load Your 8 Exposures
                </p>
                <p className="font-serif italic text-xs text-[#5E5A54] leading-relaxed">
                  Capture photographs throughout the night like a 1970s instant camera. All rolls remain latent until developing at 8:00 PM CST.
                </p>
              </div>

              <div className="pt-4 border-t border-[#1E1C1A]/15 font-mono text-[9px] uppercase tracking-[0.25em] text-[#8A847C]">
                Table Tent Fold Line • Archival Program
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

