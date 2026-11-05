"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { playShutterAndMotorSound, playLeverClick } from "@/lib/audio";
import { compressImageToBlob } from "@/lib/image";

interface Guest {
  id: string;
  name: string;
  email: string;
  shots_remaining: number;
}

interface InstantCameraProps {
  guest: Guest;
  onLogout?: () => void;
  onRollExhausted?: () => void;
}

type UploadState = "idle" | "saving" | "retrying" | "success" | "failed";

export default function InstantCamera({
  guest: initialGuest,
  onLogout,
  onRollExhausted,
}: InstantCameraProps) {
  const [guest, setGuest] = useState<Guest>(initialGuest);
  const [facingMode, setFacingMode] = useState<"environment" | "user">(
    "environment"
  );
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isFlashing, setIsFlashing] = useState(false);

  // Captured snapshot state
  const [capturedDataUrl, setCapturedDataUrl] = useState<string | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [caption, setCaption] = useState("");
  const [isDeveloping, setIsDeveloping] = useState(false);
  const [developmentProgress, setDevelopmentProgress] = useState(0); // 0 to 100
  const [hasInteractedWithEmulsion, setHasInteractedWithEmulsion] = useState(false);

  // Resilient venue Wi-Fi upload state
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [uploadAttempt, setUploadAttempt] = useState(1);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingRetryFnRef = useRef<(() => void) | null>(null);

  // Stop camera stream cleanly
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {}
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  }, []);

  // Multi-tier progressive camera initialization for iOS Safari & Android Chrome
  const startCamera = useCallback(async () => {
    stopStream();
    setCameraError(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError(
        "Direct viewfinder unavailable on this browser. Tap below to capture with camera roll."
      );
      return;
    }

    const constraintTiers: MediaStreamConstraints[] = [
      {
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1920 },
          height: { ideal: 1920 },
        },
        audio: false,
      },
      {
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
        },
        audio: false,
      },
      {
        video: {
          facingMode: facingMode,
        },
        audio: false,
      },
      {
        video: true,
        audio: false,
      },
    ];

    let activeStream: MediaStream | null = null;
    let lastError: any = null;

    for (const constraints of constraintTiers) {
      try {
        activeStream = await navigator.mediaDevices.getUserMedia(constraints);
        if (activeStream) break;
      } catch (err: any) {
        lastError = err;
        if (
          err.name === "NotAllowedError" ||
          err.name === "PermissionDeniedError"
        ) {
          break;
        }
      }
    }

    if (!activeStream) {
      console.warn("Camera initialization failed through all tiers:", lastError);
      if (
        lastError?.name === "NotAllowedError" ||
        lastError?.name === "PermissionDeniedError"
      ) {
        setCameraError(
          "Camera access was declined. Allow permissions in your browser or load directly from your camera roll."
        );
      } else {
        setCameraError(
          "Aperture initialization unavailable. Tap below to capture with native camera."
        );
      }
      setIsCameraActive(false);
      return;
    }

    streamRef.current = activeStream;

    if (videoRef.current) {
      const vid = videoRef.current;
      vid.setAttribute("playsinline", "true");
      vid.setAttribute("webkit-playsinline", "true");
      vid.muted = true;
      vid.srcObject = activeStream;

      try {
        await vid.play();
        setIsCameraActive(true);
      } catch (playErr) {
        console.warn("Video playback deferred or restricted:", playErr);
        setIsCameraActive(true);
      }
    }
  }, [facingMode, stopStream]);

  // Manage camera lifecycle
  useEffect(() => {
    if (guest.shots_remaining > 0 && !capturedDataUrl) {
      startCamera();
    } else {
      stopStream();
    }

    return () => {
      stopStream();
    };
  }, [facingMode, guest.shots_remaining, capturedDataUrl, startCamera, stopStream]);

  // Clean up any pending retry timeouts
  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  // Listen to network reconnection on slow/flaky venue Wi-Fi
  useEffect(() => {
    const handleOnline = () => {
      if (pendingRetryFnRef.current) {
        console.log("Device reconnected to venue network. Triggering immediate exposure upload retry.");
        if (retryTimeoutRef.current) {
          clearTimeout(retryTimeoutRef.current);
          retryTimeoutRef.current = null;
        }
        pendingRetryFnRef.current();
      }
    };

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, []);

  // Flip lens between rear and front camera
  const handleFlipLens = () => {
    playLeverClick(isMuted);
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  };

  // Toggle audio
  const handleToggleMute = () => {
    setIsMuted((prev) => !prev);
    playLeverClick(false);
  };

  // Trigger capture via Shutter button
  const handleShutterPress = async () => {
    if (uploadState !== "idle" || isDeveloping || guest.shots_remaining <= 0) return;

    // Flash & haptics & audio
    setIsFlashing(true);
    setTimeout(() => setIsFlashing(false), 160);

    // Play 1970s instant camera shutter snap + mirror slap + motorized roller ejection sound
    playShutterAndMotorSound(isMuted);

    if (typeof navigator !== "undefined" && navigator.vibrate) {
      try {
        navigator.vibrate([30, 40, 20]);
      } catch {}
    }

    if (videoRef.current && isCameraActive) {
      try {
        const { blob, dataUrl } = await compressImageToBlob(
          videoRef.current,
          1600,
          0.8
        );
        stopStream();
        initiateDeveloping(dataUrl, blob);
      } catch (err) {
        console.error("Frame capture failed:", err);
        setUploadError(
          "A shutter jam occurred while capturing the frame. Please try again."
        );
      }
    } else {
      fileInputRef.current?.click();
    }
  };

  // Fallback file input handler (for denied permissions or unsupported environments)
  const handleFileInputChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const { blob, dataUrl } = await compressImageToBlob(file, 1600, 0.8);
      initiateDeveloping(dataUrl, blob);
    } catch (err) {
      console.error("Failed to process loaded plate:", err);
      setUploadError("Could not expose photograph from the selected file.");
    } finally {
      if (e.target) e.target.value = "";
    }
  };

  // Start developing simulation (~4 seconds photochemical emergence)
  const initiateDeveloping = (dataUrl: string, blob: Blob) => {
    setCapturedDataUrl(dataUrl);
    setCapturedBlob(blob);
    setCaption("");
    setIsDeveloping(true);
    setDevelopmentProgress(0);
    setHasInteractedWithEmulsion(false);
    setUploadError(null);
    setUploadState("idle");

    const startTime = Date.now();
    const duration = 4000;

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(100, Math.round((elapsed / duration) * 100));
      setDevelopmentProgress((curr) => Math.max(curr, progress));

      if (progress >= 100) {
        clearInterval(interval);
        setIsDeveloping(false);
      }
    }, 50);
  };

  // Interactive gesture: rubbing/swiping across the Polaroid surface clears the opacifier layer faster
  const handleEmulsionRub = () => {
    if (!isDeveloping) return;
    setHasInteractedWithEmulsion(true);
    setDevelopmentProgress((prev) => Math.min(100, prev + 8));
  };

  // Retake photo: discard without deducting exposure
  const handleRetake = () => {
    playLeverClick(isMuted);
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    pendingRetryFnRef.current = null;
    setCapturedDataUrl(null);
    setCapturedBlob(null);
    setCaption("");
    setIsDeveloping(false);
    setUploadState("idle");
    setUploadError(null);
  };

  // Execute upload with automatic retry queue for spotty ballroom Wi-Fi
  const executeUpload = async (blob: Blob, photoCaption: string, attemptNumber = 1) => {
    setUploadAttempt(attemptNumber);
    setUploadState(attemptNumber === 1 ? "saving" : "retrying");
    setUploadError(null);

    const maxAttempts = 4;
    const backoffDelays = [0, 2500, 5000, 10000];

    try {
      const formData = new FormData();
      formData.append("photo", blob, "exposure.jpg");
      if (photoCaption.trim()) {
        formData.append("caption", photoCaption.trim());
      }

      const headers: Record<string, string> = {};
      const localToken =
        typeof window !== "undefined"
          ? localStorage.getItem("msreg_gala_session_token")
          : null;
      if (localToken) {
        headers["x-session-token"] = localToken;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);

      const res = await fetch("/api/photos/upload", {
        method: "POST",
        headers,
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 403) {
          throw new Error(data.error || "Roll has reached capacity");
        }
        throw new Error(data.error || "Darkroom upload failed");
      }

      pendingRetryFnRef.current = null;
      setUploadState("success");

      const remaining = data.shots_remaining ?? Math.max(0, guest.shots_remaining - 1);
      setGuest((prev) => ({
        ...prev,
        shots_remaining: remaining,
      }));

      if (remaining === 0) {
        onRollExhausted?.();
      }

      setTimeout(() => {
        setCapturedDataUrl(null);
        setCapturedBlob(null);
        setCaption("");
        setUploadState("idle");
      }, 900);
    } catch (err: any) {
      console.warn(`Upload attempt ${attemptNumber} failed:`, err);

      if (attemptNumber < maxAttempts) {
        const nextAttempt = attemptNumber + 1;
        const delay = backoffDelays[attemptNumber] || 5000;
        setUploadState("retrying");
        setUploadAttempt(nextAttempt);

        const retryFn = () => {
          executeUpload(blob, photoCaption, nextAttempt);
        };
        pendingRetryFnRef.current = retryFn;

        retryTimeoutRef.current = setTimeout(() => {
          retryFn();
        }, delay);
      } else {
        pendingRetryFnRef.current = () => executeUpload(blob, photoCaption, 1);
        setUploadState("failed");
        setUploadError(
          "Weak ballroom signal. Your exposure is safe in buffer — tap below to re-transmit."
        );
      }
    }
  };

  // Confirm photo button handler
  const handleConfirmPhoto = () => {
    if (!capturedBlob || uploadState === "saving" || uploadState === "retrying" || uploadState === "success") {
      return;
    }
    executeUpload(capturedBlob, caption, 1);
  };

  // If all 8 exposures have been exhausted, display the archival closing roll screen
  if (guest.shots_remaining <= 0 && !capturedDataUrl) {
    return (
      <main className="relative min-h-screen flex flex-col justify-between px-4 py-8 sm:px-8 sm:py-12 max-w-xl mx-auto text-center safe-padding-top safe-padding-bottom">
        <div className="absolute inset-3 sm:inset-5 pointer-events-none border border-[#1E1C1A]/20" />
        <div className="absolute inset-4 sm:inset-6 pointer-events-none border border-[#1E1C1A]/35" />

        <div className="relative z-10 pt-8 space-y-3">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-[#6B2A2A] font-bold">
            Cartridge No. 1974-EXHAUSTED
          </p>
          <h1 className="text-4xl sm:text-5xl font-serif font-light text-[#1E1C1A]">
            That’s a Roll.
          </h1>
          <p className="font-serif italic text-lg text-[#5E5A54] max-w-sm mx-auto">
            Your eight exposures have been sealed in the gala vault.
          </p>
        </div>

        <div className="relative z-10 my-8 flex justify-center">
          <div className="polaroid-frame w-64 border border-[#1E1C1A]/25 rotate-[-1deg]">
            <div className="aspect-square bg-[#1E1C1A] flex flex-col items-center justify-center p-4 text-[#FAF7F0] border border-[#1E1C1A]/50">
              <span className="font-mono text-3xl font-light text-[#6B2A2A]">8 / 8</span>
              <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#FAF7F0]/60 mt-2">
                Exposures Completed
              </p>
              <p className="font-serif italic text-xs text-[#FAF7F0]/80 mt-1">
                Developing at midnight
              </p>
            </div>
            <div className="pt-3 pb-1 text-center">
              <p className="font-hand text-base text-[#1E1C1A]">
                {guest.name} • Completed Roll
              </p>
            </div>
          </div>
        </div>

        <div className="relative z-10 space-y-6 pb-6">
          <p className="font-mono text-xs text-[#5E5A54] leading-relaxed max-w-md mx-auto">
            All photographs remain blurred in the collective gallery until the
            formal reveal at the stroke of midnight.
          </p>

          <div className="space-y-3 max-w-xs mx-auto">
            <a
              href="/gallery"
              className="block w-full py-3.5 px-6 bg-[#1E1C1A] text-[#F4EEE1] hover:bg-[#6B2A2A] transition-colors border border-[#1E1C1A] font-mono text-xs uppercase tracking-[0.25em] text-center"
            >
              View Shared Gallery
            </a>

            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="block w-full py-2.5 text-[#5E5A54] hover:text-[#1E1C1A] font-mono text-[10px] uppercase tracking-[0.2em] transition-colors cursor-pointer"
              >
                Sign Out Guest
              </button>
            )}
          </div>
        </div>

        <footer className="relative z-10 border-t border-[#1E1C1A]/15 pt-3">
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#5E5A54]">
            MSREG Client Appreciation Gala • Archival Ledger
          </p>
        </footer>
      </main>
    );
  }

  const isBusy =
    uploadState === "saving" ||
    uploadState === "retrying" ||
    uploadState === "success";

  return (
    <main className="relative min-h-screen bg-[#F4EEE1] flex flex-col justify-between items-center px-3 py-4 sm:px-6 sm:py-6 max-w-md mx-auto overflow-hidden safe-padding-top safe-padding-bottom">
      {/* Hidden file input for native camera fallback */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileInputChange}
        className="hidden"
      />

      {/* Shutter Fullscreen White Flash Overlay */}
      <div
        className={`fixed inset-0 z-50 bg-[#FFFFFF] pointer-events-none transition-opacity duration-150 ${
          isFlashing ? "opacity-95" : "opacity-0"
        }`}
      />

      {/* Top Header Bar */}
      <div className="w-full flex items-center justify-between pb-3 border-b border-[#1E1C1A]/20 text-xs font-mono tracking-widest text-[#5E5A54]">
        <div className="flex items-center space-x-1.5">
          <span className="w-2 h-2 rounded-full bg-[#6B2A2A]" />
          <span className="uppercase text-[10px] tracking-[0.15em] font-medium text-[#1E1C1A]">
            {guest.name}
          </span>
        </div>

        <div className="flex items-center space-x-3 text-[10px] uppercase tracking-[0.18em]">
          <button
            type="button"
            onClick={handleToggleMute}
            className="hover:text-[#1E1C1A] transition-colors cursor-pointer"
            title="Toggle Shutter Audio"
          >
            {isMuted ? "Sound: Off" : "Sound: On"}
          </button>
          <span>•</span>
          <a
            href="/gallery"
            className="hover:text-[#6B2A2A] transition-colors"
          >
            Vault ↗
          </a>
          <span>•</span>
          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="hover:text-[#6B2A2A] transition-colors cursor-pointer"
            >
              Exit
            </button>
          )}
        </div>
      </div>

      {/* 1970s Instant Land Camera Chassis */}
      <div className="w-full my-auto flex flex-col items-center">
        <div className="w-full camera-chassis text-[#F4EEE1] border-2 border-[#1E1C1A] p-4 sm:p-5 relative shadow-none">
          {/* 1970s Iconic Racing Stripe Accent (Oxblood & Warm Brass) */}
          <div className="absolute top-0 left-0 right-0 h-1.5 flex">
            <div className="w-1/2 bg-[#6B2A2A]" />
            <div className="w-1/2 bg-[#B89758]" />
          </div>

          {/* Top Plate of the Camera: Controls & Mechanical Film Counter */}
          <div className="flex items-center justify-between pb-3 border-b border-[#FAF7F0]/15 mb-3 mt-1">
            {/* Vintage Mechanical Rotary Film Counter */}
            <div className="flex items-center space-x-2 bg-[#0E0D0C] border border-[#FAF7F0]/30 px-3 py-1.5 shadow-inner">
              <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#FAF7F0]/60">
                EXPOSURES
              </span>
              <span className="font-mono text-sm tracking-widest font-bold text-[#FAF7F0]">
                {guest.shots_remaining} / 8
              </span>
            </div>

            {/* Lens and Status Badges */}
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-1.5 px-2 py-1 bg-[#282624] border border-[#FAF7F0]/20 text-[9px] font-mono tracking-widest uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[#FAF7F0]/90">Aperture Ready</span>
              </div>

              {/* Flip Camera Control */}
              <button
                type="button"
                onClick={handleFlipLens}
                disabled={Boolean(capturedDataUrl)}
                className="px-2.5 py-1 bg-[#282624] hover:bg-[#383533] border border-[#FAF7F0]/25 text-[9px] font-mono tracking-widest uppercase text-[#FAF7F0] cursor-pointer transition-colors"
                title="Flip to front / rear lens"
              >
                Flip
              </button>
            </div>
          </div>

          {/* Camera Lens Nameplate Badge */}
          <div className="flex items-center justify-between pb-2 text-[8px] font-mono uppercase tracking-[0.25em] text-[#FAF7F0]/40">
            <span>MSREG 1974 LAND CAMERA</span>
            <span>116mm f/8.0 GLASS OPTIC</span>
          </div>

          {/* Viewfinder Glass Chamber */}
          <div className="relative aspect-square w-full bg-[#0C0B0A] border-2 border-[#FAF7F0]/25 overflow-hidden flex items-center justify-center">
            {/* Live Camera Video Feed */}
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className={`absolute inset-0 w-full h-full object-cover vintage-lens-feed transition-opacity duration-300 ${
                isCameraActive && !capturedDataUrl ? "opacity-100" : "opacity-0"
              }`}
            />

            {/* Optical Split-Image Rangefinder Prism Center Ring */}
            {isCameraActive && !capturedDataUrl && (
              <div className="rangefinder-split z-10 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-[#FAF7F0]/50" />
              </div>
            )}

            {/* Fallback View if camera permission denied or waiting */}
            {!isCameraActive && !capturedDataUrl && (
              <div className="p-6 text-center space-y-4 z-10 max-w-xs">
                <div className="w-16 h-16 rounded-full border border-[#FAF7F0]/20 mx-auto flex items-center justify-center">
                  <div className="w-8 h-8 rounded-full border border-[#6B2A2A]" />
                </div>
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#FAF7F0]/70 leading-relaxed">
                  {cameraError || "Initializing optical aperture..."}
                </p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-block py-2.5 px-4 bg-[#6B2A2A] hover:bg-[#853434] text-[#FAF7F0] border border-[#FAF7F0]/40 font-mono text-[10px] uppercase tracking-[0.2em] cursor-pointer"
                >
                  Engage Camera Roll
                </button>
              </div>
            )}

            {/* Viewfinder Crosshair & Corner Etchings */}
            {isCameraActive && !capturedDataUrl && (
              <div className="pointer-events-none absolute inset-0 p-4 flex flex-col justify-between z-10">
                <div className="flex justify-between">
                  <span className="w-3 h-3 border-t-2 border-l-2 border-[#FAF7F0]/60" />
                  <span className="w-3 h-3 border-t-2 border-r-2 border-[#FAF7F0]/60" />
                </div>
                <div className="flex justify-between">
                  <span className="w-3 h-3 border-b-2 border-l-2 border-[#FAF7F0]/60" />
                  <span className="w-3 h-3 border-b-2 border-r-2 border-[#FAF7F0]/60" />
                </div>
              </div>
            )}

            {/* Mechanical Film Ejection & Photochemical Developing Preview */}
            {capturedDataUrl && (
              <div className="absolute inset-0 bg-[#0C0B0A]/95 flex items-center justify-center p-3 z-30 animate-[fadeIn_0.3s_ease-out]">
                <div
                  onPointerMove={handleEmulsionRub}
                  onClick={handleEmulsionRub}
                  className="polaroid-frame w-full max-w-[280px] border border-[#1E1C1A]/40 transition-transform duration-500 ease-out select-none cursor-pointer"
                  title="Wipe or warm emulsion to accelerate development"
                >
                  {/* Photo area with chemical opacifier fading filter */}
                  <div className="aspect-square relative overflow-hidden bg-[#181615] border border-[#1E1C1A]/30">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={capturedDataUrl}
                      alt="Captured instant exposure"
                      className="w-full h-full object-cover transition-all duration-300"
                      style={{
                        filter: isDeveloping
                          ? `brightness(${0.22 + (developmentProgress / 100) * 0.78}) contrast(${
                              1.6 - (developmentProgress / 100) * 0.6
                            }) saturate(${
                              0.15 + (developmentProgress / 100) * 0.85
                            }) blur(${
                              (1 - developmentProgress / 100) * 2.2
                            }px)`
                          : "none",
                      }}
                    />

                    {/* Milky Chemical Opacifier Layer (authentic SX-70 blue/green opacifier) */}
                    {isDeveloping && (
                      <div
                        className="absolute inset-0 pointer-events-none transition-opacity duration-300 mix-blend-screen"
                        style={{
                          backgroundColor: "#3A4A48",
                          opacity: (1 - developmentProgress / 100) * 0.75,
                        }}
                      />
                    )}

                    {/* Developing Progress Bar & Gesture Prompt */}
                    {isDeveloping && (
                      <div className="absolute inset-x-0 bottom-0 bg-[#0E0D0C]/90 px-2 py-1.5 flex items-center justify-between text-[9px] font-mono uppercase tracking-widest text-[#FAF7F0]">
                        <span className="flex items-center space-x-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#B89758] animate-ping" />
                          <span>
                            {hasInteractedWithEmulsion
                              ? "Warming Emulsion..."
                              : "Rub to develop"}
                          </span>
                        </span>
                        <span className="font-bold text-[#B89758]">
                          {developmentProgress}%
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Handwritten Caption Chin */}
                  <div className="pt-2.5 pb-1">
                    <input
                      type="text"
                      maxLength={60}
                      placeholder="A handwritten note for the vault..."
                      value={caption}
                      onChange={(e) => setCaption(e.target.value)}
                      disabled={isBusy}
                      className="w-full text-center font-hand text-base sm:text-lg text-[#1E1C1A] placeholder:text-[#8A847C]/60 border-b border-[#1E1C1A]/20 bg-transparent py-1 focus:border-[#6B2A2A] outline-none"
                    />

                    {/* Subtle Polaroid status state */}
                    {uploadState !== "idle" && (
                      <div className="pt-1.5 pb-0.5 text-center">
                        {uploadState === "saving" && (
                          <span className="inline-flex items-center space-x-1.5 font-mono text-[9px] uppercase tracking-[0.18em] text-[#6B2A2A]">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#6B2A2A] animate-ping" />
                            <span>Saving exposure to gala vault...</span>
                          </span>
                        )}
                        {uploadState === "retrying" && (
                          <span className="inline-flex items-center space-x-1.5 font-mono text-[9px] uppercase tracking-[0.18em] text-[#6B2A2A]">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#6B2A2A] animate-pulse" />
                            <span>Slow venue signal — retrying ({uploadAttempt}/4)...</span>
                          </span>
                        )}
                        {uploadState === "success" && (
                          <span className="inline-flex items-center space-x-1.5 font-mono text-[9px] uppercase tracking-[0.18em] text-emerald-800">
                            <span>✓ Sealed in archival vault</span>
                          </span>
                        )}
                        {uploadState === "failed" && (
                          <span className="inline-flex items-center space-x-1.5 font-mono text-[9px] uppercase tracking-[0.18em] text-[#6B2A2A]">
                            <span>! Signal pending — tap confirm below</span>
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Camera Bottom Deck: Motor Roller Slit & Tactile Shutter */}
          <div className="pt-4 pb-1 flex flex-col items-center justify-center">
            {/* Physical Metallic Film Roller Delivery Slot */}
            <div className="w-48 h-1 bg-[#0A0908] border-b border-[#FAF7F0]/20 mb-4 rounded-full opacity-60" />

            {uploadError && (
              <div className="w-full mb-3 p-2 bg-[#FAF7F0] border border-[#6B2A2A] text-[#6B2A2A] font-mono text-[10px] uppercase tracking-wider text-center">
                {uploadError}
              </div>
            )}

            {!capturedDataUrl ? (
              /* Big Round Mechanical Shutter Button */
              <div className="flex flex-col items-center space-y-2">
                <button
                  type="button"
                  onClick={handleShutterPress}
                  className="group relative w-20 h-20 rounded-full bg-[#181615] border-4 border-[#3D3A37] flex items-center justify-center cursor-pointer active:scale-95 transition-transform focus:outline-none"
                  aria-label="Release Mechanical Shutter"
                >
                  <div className="w-16 h-16 rounded-full border border-[#FAF7F0]/20 flex items-center justify-center bg-[#252220]">
                    <div className="w-12 h-12 rounded-full bg-[#6B2A2A] group-hover:bg-[#853434] transition-colors border border-[#FAF7F0]/30 shadow-none flex items-center justify-center">
                      <div className="w-6 h-6 rounded-full border border-[#FAF7F0]/30" />
                    </div>
                  </div>
                </button>
                <span className="font-mono text-[9px] uppercase tracking-[0.25em] text-[#FAF7F0]/50">
                  Press Shutter
                </span>
              </div>
            ) : (
              /* Review Controls: Retake vs Confirm */
              <div className="w-full space-y-2">
                <button
                  type="button"
                  onClick={handleConfirmPhoto}
                  disabled={isBusy}
                  className="w-full py-3 px-4 bg-[#6B2A2A] hover:bg-[#853434] text-[#FAF7F0] border border-[#FAF7F0]/30 font-mono text-xs uppercase tracking-[0.22em] text-center cursor-pointer transition-colors disabled:opacity-60"
                >
                  {uploadState === "saving" ? (
                    <span className="flex items-center justify-center space-x-2">
                      <span className="inline-block w-2 h-2 bg-[#FAF7F0] animate-ping" />
                      <span>Sealing into Gala Vault...</span>
                    </span>
                  ) : uploadState === "retrying" ? (
                    <span className="flex items-center justify-center space-x-2">
                      <span className="inline-block w-2 h-2 bg-[#FAF7F0] animate-pulse" />
                      <span>Retransmitting plate...</span>
                    </span>
                  ) : uploadState === "failed" ? (
                    <span>Retry Saving Plate</span>
                  ) : (
                    <span>Confirm Exposure ({guest.shots_remaining} Remaining)</span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleRetake}
                  disabled={isBusy}
                  className="w-full py-2.5 px-4 bg-transparent hover:bg-[#FAF7F0]/10 text-[#FAF7F0]/75 hover:text-[#FAF7F0] border border-[#FAF7F0]/20 font-mono text-[10px] uppercase tracking-[0.2em] text-center cursor-pointer transition-colors"
                >
                  Discard & Retake (No Exposure Lost)
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Camera Base Footer / Colophon */}
      <footer className="w-full text-center pt-3 border-t border-[#1E1C1A]/15">
        <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#5E5A54]">
          1970s Instant Emulsion • MSREG Gala Camera No. 1974
        </p>
      </footer>
    </main>
  );
}
