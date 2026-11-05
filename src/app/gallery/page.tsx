"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";

interface GalleryPhoto {
  id: string;
  guest_id: string;
  preview_url: string;
  original_url?: string;
  caption: string | null;
  exposure_number: number;
  created_at: string;
  guest_name?: string;
  guest_first_name?: string;
}

export default function GalleryPage() {
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activePhoto, setActivePhoto] = useState<GalleryPhoto | null>(null);

  // Live developing transition state when status changes to revealed in real-time
  const [justRevealed, setJustRevealed] = useState(false);
  const prevRevealedRef = useRef<boolean | null>(null);

  const fetchGallery = async () => {
    try {
      const res = await fetch("/api/gallery", { cache: "no-store" });
      const data = await res.json();

      if (data && Array.isArray(data.photos)) {
        setPhotos(data.photos);

        // Detect live reveal event
        if (
          prevRevealedRef.current !== null &&
          !prevRevealedRef.current &&
          data.revealed
        ) {
          setJustRevealed(true);
          setTimeout(() => setJustRevealed(false), 5000);
        }

        prevRevealedRef.current = data.revealed;
        setRevealed(data.revealed);
      }
    } catch (err) {
      console.warn("Gallery sync skipped:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGallery();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchGallery, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleDownload = (photo: GalleryPhoto) => {
    const url = photo.original_url || photo.preview_url;
    const link = document.createElement("a");
    link.href = url;
    link.download = `MSREG_Gala_${photo.guest_first_name || "Photo"}_Exp${photo.exposure_number}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <main className="relative min-h-screen bg-[#F4EEE1] text-[#1E1C1A] px-4 py-8 sm:px-8 sm:py-12 max-w-6xl mx-auto">
      {/* Top Header / Navigation */}
      <header className="relative z-10 pb-6 border-b border-[#1E1C1A]/20">
        <div className="flex items-center justify-between font-mono text-[10px] sm:text-xs uppercase tracking-[0.25em] text-[#5E5A54] pb-4">
          <Link
            href="/"
            className="hover:text-[#6B2A2A] transition-colors flex items-center space-x-1"
          >
            <span>←</span>
            <span>Return to Camera</span>
          </Link>
          <span className="font-semibold text-[#6B2A2A]">MSREG Collective Vault</span>
          <span>{photos.length} Exposures</span>
        </div>

        <div className="text-center pt-4 sm:pt-6 space-y-2">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-[#5E5A54]">
            Saturday, November 14, 2026
          </p>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-serif font-light text-[#1E1C1A]">
            Gala Shared Gallery
          </h1>

          {/* Subtitle / Status indicator */}
          <div className="pt-2">
            {!revealed ? (
              <div className="inline-flex items-center space-x-2 px-3 py-1 bg-[#FAF7F0] border border-[#1E1C1A]/20">
                <span className="w-1.5 h-1.5 rounded-full bg-[#6B2A2A] animate-ping" />
                <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#6B2A2A]">
                  Developing. Check back at the end of the night.
                </span>
              </div>
            ) : (
              <div className="inline-flex items-center space-x-2 px-3 py-1 bg-[#FAF7F0] border border-[#6B2A2A]/40 text-[#6B2A2A]">
                <span className="w-2 h-2 rounded-full bg-emerald-600" />
                <span className="font-mono text-[11px] uppercase tracking-[0.2em]">
                  Midnight Unveiling • All Exposures Developed
                </span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Live developing notification banner if reveal just occurred */}
      {justRevealed && (
        <div className="my-6 p-4 bg-[#FAF7F0] border-2 border-[#6B2A2A] text-center space-y-1 animate-pulse">
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-[#6B2A2A] font-bold">
            The Darkroom Seal Has Lifted
          </p>
          <p className="font-serif italic text-sm text-[#1E1C1A]">
            Watch your exposures emerge into clarity...
          </p>
        </div>
      )}

      {/* Gallery Content */}
      <section className="relative z-10 my-8 sm:my-12">
        {loading ? (
          <div className="py-24 text-center font-mono text-xs uppercase tracking-[0.25em] text-[#5E5A54] animate-pulse">
            Opening Chemical Vault...
          </div>
        ) : photos.length === 0 ? (
          <div className="py-24 text-center space-y-3 border border-[#1E1C1A]/15 bg-[#FAF7F0]/40 p-8">
            <p className="font-serif italic text-lg text-[#5E5A54]">
              No exposures have been loaded into the vault yet.
            </p>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#8A847C]">
              Be the first guest to release a mechanical shutter.
            </p>
            <div className="pt-4">
              <Link
                href="/"
                className="inline-block py-2.5 px-6 bg-[#1E1C1A] text-[#F4EEE1] hover:bg-[#6B2A2A] font-mono text-xs uppercase tracking-[0.2em] transition-colors"
              >
                Open Camera
              </Link>
            </div>
          </div>
        ) : (
          /* Masonry Grid of Polaroids */
          <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-6 space-y-6">
            {photos.map((photo, index) => {
              const displayUrl =
                revealed && photo.original_url
                  ? photo.original_url
                  : photo.preview_url;

              return (
                <div
                  key={photo.id}
                  onClick={() => setActivePhoto(photo)}
                  className="break-inside-avoid cursor-pointer polaroid-frame transition-all duration-300 hover:-translate-y-1 hover:border-[#1E1C1A]/50 group"
                >
                  {/* Photo frame */}
                  <div className="aspect-square relative overflow-hidden bg-[#201E1C] border border-[#1E1C1A]/20">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={displayUrl}
                      alt={photo.caption || "Gala instant photograph"}
                      className={`w-full h-full object-cover transition-all duration-1000 ${
                        !revealed
                          ? "blur-md scale-105"
                          : justRevealed
                          ? "animate-[pulse_3s_ease-out]"
                          : "blur-none scale-100"
                      }`}
                    />

                    {/* Pre-reveal watermark badge */}
                    {!revealed && (
                      <div className="absolute inset-0 bg-[#1E1C1A]/35 flex flex-col items-center justify-center p-3 text-center pointer-events-none">
                        <span className="font-mono text-[9px] uppercase tracking-[0.25em] text-[#FAF7F0]/85 bg-[#1E1C1A]/70 px-2 py-1 border border-[#FAF7F0]/20">
                          Latent Emulsion
                        </span>
                      </div>
                    )}

                    <div className="absolute top-2 right-2 font-mono text-[8px] uppercase tracking-widest text-[#FAF7F0]/60 bg-[#1E1C1A]/60 px-1.5 py-0.5">
                      Exp. {photo.exposure_number}
                    </div>
                  </div>

                  {/* Handwritten caption and photographer's first name */}
                  <div className="pt-3 pb-1 text-center space-y-1">
                    <p className="font-hand text-base sm:text-lg text-[#1E1C1A] leading-snug">
                      {photo.caption
                        ? `"${photo.caption}"`
                        : "Gala Exposure"}
                    </p>
                    <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#5E5A54]">
                      By {photo.guest_first_name || "Guest"}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Fullscreen Lightbox Modal */}
      {activePhoto && (
        <div
          className="fixed inset-0 z-50 bg-[#1E1C1A]/90 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setActivePhoto(null)}
        >
          <div
            className="relative polaroid-frame w-full max-w-md border-2 border-[#1E1C1A] bg-[#FAF7F0]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              type="button"
              onClick={() => setActivePhoto(null)}
              className="absolute -top-10 right-0 font-mono text-xs uppercase tracking-[0.2em] text-[#FAF7F0] hover:text-[#EAE2D2] cursor-pointer"
            >
              [ Close ✕ ]
            </button>

            {/* Photo aperture */}
            <div className="aspect-square relative overflow-hidden bg-[#1E1C1A] border border-[#1E1C1A]/30">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={
                  revealed && activePhoto.original_url
                    ? activePhoto.original_url
                    : activePhoto.preview_url
                }
                alt={activePhoto.caption || "Full exposure"}
                className={`w-full h-full object-cover ${
                  !revealed ? "blur-md scale-105" : "blur-none"
                }`}
              />

              {!revealed && (
                <div className="absolute inset-0 bg-[#1E1C1A]/40 flex flex-col items-center justify-center p-4 text-center">
                  <span className="font-mono text-xs uppercase tracking-[0.25em] text-[#FAF7F0] bg-[#1E1C1A]/80 px-3 py-1.5 border border-[#FAF7F0]/30">
                    Developing at Midnight
                  </span>
                  <p className="font-serif italic text-xs text-[#FAF7F0]/80 mt-2">
                    Original clarity will be unveiled at midnight.
                  </p>
                </div>
              )}
            </div>

            {/* Handwritten details and actions */}
            <div className="pt-4 pb-2 text-center space-y-3">
              <div>
                <p className="font-hand text-xl text-[#1E1C1A]">
                  {activePhoto.caption
                    ? `"${activePhoto.caption}"`
                    : "Gala Exposure"}
                </p>
                <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#5E5A54] mt-1">
                  Photographer: {activePhoto.guest_first_name || activePhoto.guest_name}
                </p>
              </div>

              {revealed && (
                <div className="pt-2 border-t border-[#1E1C1A]/15">
                  <button
                    type="button"
                    onClick={() => handleDownload(activePhoto)}
                    className="w-full py-2.5 px-4 bg-[#1E1C1A] hover:bg-[#6B2A2A] text-[#F4EEE1] font-mono text-xs uppercase tracking-[0.2em] transition-colors cursor-pointer"
                  >
                    Download Archival Plate
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Footer Colophon */}
      <footer className="relative z-10 pt-8 pb-4 text-center border-t border-[#1E1C1A]/15 space-y-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#5E5A54]">
          MSREG Client Appreciation Gala • Archival Gallery
        </p>
        <p className="font-serif italic text-xs text-[#5E5A54]/80">
          Photographs synchronized every 30 seconds.
        </p>
      </footer>
    </main>
  );
}
