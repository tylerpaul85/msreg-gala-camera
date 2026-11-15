"use client";

import { useEffect, useState, useMemo } from "react";
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

export default function Home() {
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePhoto, setActivePhoto] = useState<GalleryPhoto | null>(null);
  const [isSafelightMode, setIsSafelightMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchGallery = async () => {
    try {
      const res = await fetch("/api/gallery", { cache: "no-store" });
      const data = await res.json();

      if (data && Array.isArray(data.photos)) {
        setPhotos(data.photos);
      }
    } catch (err) {
      console.warn("Gallery sync skipped:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGallery();
    const interval = setInterval(fetchGallery, 30000);
    return () => clearInterval(interval);
  }, []);

  // Filtered photos based on guest search
  const filteredPhotos = useMemo(() => {
    if (!searchQuery.trim()) return photos;
    const query = searchQuery.toLowerCase().trim();
    return photos.filter((p) => {
      const name = (p.guest_name || "").toLowerCase();
      const caption = (p.caption || "").toLowerCase();
      return name.includes(query) || caption.includes(query);
    });
  }, [photos, searchQuery]);

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
    <main
      className={`relative min-h-screen px-4 py-8 sm:px-8 sm:py-12 transition-colors duration-500 safe-padding-top safe-padding-bottom ${
        isSafelightMode ? "safelight-theme" : "bg-[#F4EEE1] text-[#1E1C1A]"
      }`}
    >
      <div className="max-w-6xl mx-auto">
        {/* Top Header / Archival Program Navigation */}
        <header className="relative z-10 pb-6 border-b border-vintage">
          <div className="flex items-center justify-between font-mono text-[10px] sm:text-xs uppercase tracking-[0.25em] text-[#5E5A54] pb-4">
            <span className="font-semibold text-[#6B2A2A]">
              MSREG Client Gala • Archival Ledger
            </span>

            <div className="flex items-center space-x-3">
              {/* Safe-Light Mode Toggle */}
              <button
                type="button"
                onClick={() => setIsSafelightMode(!isSafelightMode)}
                className={`px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.2em] border transition-colors cursor-pointer flex items-center space-x-1.5 ${
                  isSafelightMode
                    ? "bg-[#6B2A2A] text-[#FAF7F0] border-[#E65A5A]"
                    : "bg-[#FAF7F0] text-[#1E1C1A] border-[#1E1C1A]/20 hover:border-[#6B2A2A]"
                }`}
                title="Toggle 1970s Darkroom Safe-Light Ambience"
              >
                <span>💡</span>
                <span>{isSafelightMode ? "Safelight: On" : "Safelight"}</span>
              </button>

              <span className="font-semibold text-[#6B2A2A]">Vault</span>
              <span>{photos.length} Plates</span>
            </div>
          </div>

          <div className="text-center pt-4 sm:pt-6 space-y-3">
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-[#5E5A54]">
              Saturday, November 14, 2026 • Annual Client Appreciation
            </p>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-serif font-light tracking-tight">
              MSREG Gala Vault
            </h1>

            {/* Event Concluded & All Photos Developed Banner */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <div className="inline-flex items-center space-x-2 px-4 py-1.5 bg-[#FAF7F0] border-2 border-[#6B2A2A] text-[#6B2A2A]">
                <span className="w-2 h-2 rounded-full bg-emerald-600 shadow-[0_0_6px_#10b981]" />
                <span className="font-mono text-xs uppercase tracking-[0.22em] font-bold">
                  Event Concluded • All Exposures Developed
                </span>
              </div>
            </div>

            <p className="font-serif italic text-base sm:text-lg text-[#5E5A54] max-w-lg mx-auto pt-2">
              The camera rolls have concluded and all 1970s instant exposures
              have been sealed and developed from the darkroom vault.
            </p>
          </div>

          {/* Search / Filter Toolbar */}
          {photos.length > 0 && (
            <div className="mt-8 max-w-md mx-auto">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Filter by guest name or handwritten caption..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-2.5 bg-[#FAF7F0] border border-[#1E1C1A]/25 text-sm font-serif placeholder:font-mono placeholder:text-xs placeholder:tracking-wider focus:border-[#6B2A2A] outline-none"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono text-[#5E5A54] hover:text-[#1E1C1A]"
                  >
                    ✕ Clear
                  </button>
                )}
              </div>
              {searchQuery && (
                <p className="text-center font-mono text-[10px] uppercase tracking-wider text-[#5E5A54] mt-2">
                  Showing {filteredPhotos.length} of {photos.length} developed plates
                </p>
              )}
            </div>
          )}
        </header>

        {/* Gallery Content */}
        <section className="relative z-10 my-8 sm:my-12">
          {loading ? (
            <div className="py-24 text-center font-mono text-xs uppercase tracking-[0.25em] text-[#5E5A54] animate-pulse">
              Unsealing Chemical Vault...
            </div>
          ) : photos.length === 0 ? (
            <div className="py-24 text-center space-y-3 border border-vintage bg-[#FAF7F0]/40 p-8 max-w-lg mx-auto">
              <p className="font-serif italic text-xl text-[#5E5A54]">
                The gala darkroom is finalizing chemical development.
              </p>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#8A847C]">
                Check back shortly as photographs are archived into the collective vault.
              </p>
            </div>
          ) : filteredPhotos.length === 0 ? (
            <div className="py-16 text-center space-y-2 border border-vintage bg-[#FAF7F0]/40 p-6 max-w-md mx-auto">
              <p className="font-serif italic text-base text-[#5E5A54]">
                No exposures found matching &ldquo;{searchQuery}&rdquo;.
              </p>
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="font-mono text-xs uppercase tracking-wider text-[#6B2A2A] underline cursor-pointer"
              >
                View all {photos.length} plates
              </button>
            </div>
          ) : (
            /* Masonry Grid of Developed Polaroids */
            <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-6 space-y-6">
              {filteredPhotos.map((photo) => {
                const displayUrl = photo.original_url || photo.preview_url;

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
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                      />

                      {/* Exposure index badge */}
                      <div className="absolute top-2 right-2 font-mono text-[8px] uppercase tracking-widest text-[#FAF7F0]/80 bg-[#1E1C1A]/75 px-1.5 py-0.5 border border-[#FAF7F0]/20">
                        Exp. {photo.exposure_number}
                      </div>
                    </div>

                    {/* Handwritten caption chin in Homemade Apple font */}
                    <div className="pt-3 pb-1 text-center space-y-1">
                      {photo.caption ? (
                        <p className="font-hand text-base sm:text-lg text-[#1E1C1A] leading-tight line-clamp-2">
                          &ldquo;{photo.caption}&rdquo;
                        </p>
                      ) : (
                        <p className="font-serif italic text-sm text-[#8A847C]">
                          MSREG Gala • Nov 14
                        </p>
                      )}

                      <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#5E5A54] pt-0.5">
                        {photo.guest_name || "Guest"}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Full-Screen Inspection Modal */}
        {activePhoto && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1E1C1A]/85 backdrop-blur-xs animate-[fadeIn_0.2s_ease-out]"
            onClick={() => setActivePhoto(null)}
          >
            <div
              className="polaroid-frame max-w-lg w-full border border-[#1E1C1A] shadow-2xl relative"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close button */}
              <button
                type="button"
                onClick={() => setActivePhoto(null)}
                className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center font-mono text-xs uppercase bg-[#1E1C1A] text-[#FAF7F0] hover:bg-[#6B2A2A] transition-colors cursor-pointer border border-[#FAF7F0]/20 z-10"
                aria-label="Close"
              >
                ✕
              </button>

              {/* Photo Area */}
              <div className="aspect-square relative overflow-hidden bg-[#1E1C1A] border border-[#1E1C1A]/30">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={activePhoto.original_url || activePhoto.preview_url}
                  alt={activePhoto.caption || "Full resolution photograph"}
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Details & Handwritten Caption Chin */}
              <div className="pt-4 pb-2 text-center space-y-3">
                {activePhoto.caption && (
                  <p className="font-hand text-xl sm:text-2xl text-[#1E1C1A] px-2 leading-relaxed">
                    &ldquo;{activePhoto.caption}&rdquo;
                  </p>
                )}

                <div className="space-y-1 font-mono text-[10px] uppercase tracking-[0.22em] text-[#5E5A54]">
                  <p className="font-bold text-[#1E1C1A]">
                    Photographer: {activePhoto.guest_name || "Guest"}
                  </p>
                  <p>
                    Exposure No. {activePhoto.exposure_number} • Sealed into Vault
                  </p>
                </div>

                {/* Download Button */}
                <div className="pt-2 flex justify-center">
                  <button
                    type="button"
                    onClick={() => handleDownload(activePhoto)}
                    className="py-2.5 px-6 bg-[#1E1C1A] hover:bg-[#6B2A2A] text-[#FAF7F0] border border-[#1E1C1A] font-mono text-[11px] uppercase tracking-[0.25em] transition-colors cursor-pointer flex items-center space-x-2"
                  >
                    <span>↓</span>
                    <span>Download Photograph</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Archival Program Footer */}
        <footer className="relative z-10 pt-8 pb-4 text-center border-t border-vintage space-y-3">
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 font-mono text-[10px] uppercase tracking-[0.2em] text-[#5E5A54]">
            <span>MSREG Gala 2026</span>
            <span>•</span>
            <span>Client Appreciation Edition</span>
            <span>•</span>
            <span>Archival Photographic Ledger</span>
          </div>

          <p className="font-serif italic text-xs text-[#5E5A54]/80">
            All instant photographs preserved and developed courtesy of Matt Smith Real Estate Group.
          </p>

          <div className="pt-2">
            <Link
              href="/admin"
              className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#8A847C] hover:text-[#6B2A2A] transition-colors"
            >
              Archival Admin Desk →
            </Link>
          </div>
        </footer>
      </div>
    </main>
  );
}
