"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  playPolaroidShutterSound,
  playFlashChargingWhine,
  playLeverClick,
} from "@/lib/audio";
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
type FlashState = "off" | "charging" | "ready";
type PhotoLifecycle = "idle" | "ejecting" | "inspecting" | "vaulting";

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

  // Innovation: Electronic Strobe Flash with Rising Capacitor Whine
  const [flashState, setFlashState] = useState<FlashState>("off");
  const stopWhineRef = useRef<(() => void) | null>(null);

  // Exposure compensation knob state (-1 = Darken, 0 = Normal, 1 = Lighten)
  const [exposureDial, setExposureDial] = useState<number>(0);

  // Captured snapshot state and physical Polaroid lifecycle
  const [lifecycle, setLifecycle] = useState<PhotoLifecycle>("idle");
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
    if (guest.shots_remaining > 0 && lifecycle === "idle") {
      startCamera();
    } else {
      stopStream();
    }

    return () => {
      stopStream();
    };
  }, [facingMode, guest.shots_remaining, lifecycle, startCamera, stopStream]);

  // Clean up any pending retry timeouts
  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
      if (stopWhineRef.current) {
        stopWhineRef.current();
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

  // Toggle Flash and trigger capacitor charging whine sound
  const handleToggleFlash = () => {
    playLeverClick(isMuted);

    if (flashState === "off") {
      setFlashState("charging");
      // Trigger classic Polaroid strobe capacitor whine
      const stopWhine = playFlashChargingWhine(isMuted);
      stopWhineRef.current = stopWhine;

      // Finish charging after 2.1 seconds
      setTimeout(() => {
        setFlashState("ready");
      }, 2100);
    } else {
      // Turn flash off
      if (stopWhineRef.current) {
        stopWhineRef.current();
        stopWhineRef.current = null;
      }
      setFlashState("off");
    }
  };

  // Rotate Lighten/Darken dial
  const handleRotateDial = () => {
    playLeverClick(isMuted);
    setExposureDial((prev) => (prev === 1 ? -1 : prev + 1));
  };

  // Trigger capture via Shutter button
  const handleShutterPress = async () => {
    if (uploadState !== "idle" || isDeveloping || guest.shots_remaining <= 0) return;

    const shouldFlash = flashState === "ready" || flashState === "charging";

    // Trigger instant strobe flash if flash was selected
    if (shouldFlash) {
      setIsFlashing(true);
      setTimeout(() => setIsFlashing(false), 450);

      // Attempt device torch if supported on mobile Safari/Chrome
      if (streamRef.current) {
        try {
          const track = streamRef.current.getVideoTracks()[0];
          const capabilities: any = track?.getCapabilities?.();
          if (capabilities && capabilities.torch) {
            await (track as any).applyConstraints({
              advanced: [{ torch: true }],
            });
            setTimeout(async () => {
              try {
                await (track as any).applyConstraints({
                  advanced: [{ torch: false }],
                });
              } catch {}
            }, 300);
          }
        } catch (torchErr) {
          console.log("Torch constraint not supported or restricted", torchErr);
        }
      }

      setFlashState("off"); // Discharged after pop
      if (stopWhineRef.current) {
        stopWhineRef.current();
        stopWhineRef.current = null;
      }
    }

    // Play authentic Polaroid solenoid click + gear motor whirr
    playPolaroidShutterSound(isMuted);

    if (typeof navigator !== "undefined" && navigator.vibrate) {
      try {
        navigator.vibrate([35, 45, 25]);
      } catch {}
    }

    if (videoRef.current && isCameraActive) {
      try {
        const { blob, dataUrl } = await compressImageToBlob(
          videoRef.current,
          1600,
          0.8,
          true // Square 1:1 Polaroid crop matching viewfinder
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

  // Start developing simulation with mechanical film ejection sequence
  const initiateDeveloping = (dataUrl: string, blob: Blob) => {
    setCapturedDataUrl(dataUrl);
    setCapturedBlob(blob);
    setCaption("");
    setLifecycle("ejecting");
    setIsDeveloping(true);
    setDevelopmentProgress(0);
    setHasInteractedWithEmulsion(false);
    setUploadError(null);
    setUploadState("idle");

    // Film takes ~1.45 seconds to roll out of the delivery slot between the rollers
    setTimeout(() => {
      setLifecycle("inspecting");
    }, 1450);

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
    setLifecycle("idle");
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
      setLifecycle("vaulting");

      const remaining = data.shots_remaining ?? Math.max(0, guest.shots_remaining - 1);
      setGuest((prev) => ({
        ...prev,
        shots_remaining: remaining,
      }));

      if (remaining === 0) {
        setTimeout(() => {
          onRollExhausted?.();
        }, 800);
      }

      setTimeout(() => {
        setCapturedDataUrl(null);
        setCapturedBlob(null);
        setCaption("");
        setUploadState("idle");
        setLifecycle("idle");
      }, 700);
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
                Photos release at 8:00 PM CST
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
            formal unveiling at 8:00 PM CST on November 14, 2026.
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
    <main className="relative min-h-screen bg-[#F4EEE1] flex flex-col justify-between items-center px-3 py-3 sm:px-6 sm:py-6 max-w-md mx-auto overflow-y-auto safe-padding-top safe-padding-bottom">
      {/* Hidden file input for native camera fallback */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileInputChange}
        className="hidden"
      />

      {/* Shutter Fullscreen Strobe Flash Overlay */}
      {isFlashing && (
        <div className="fixed inset-0 z-[99999] pointer-events-none animate-strobe" />
      )}

      {/* Top Header Bar */}
      <div className="w-full flex items-center justify-between pb-2.5 border-b border-[#1E1C1A]/20 text-xs font-mono tracking-widest text-[#5E5A54]">
        <div className="flex items-center space-x-1.5">
          <span className="w-2 h-2 rounded-full bg-[#6B2A2A]" />
          <span className="uppercase text-[10px] tracking-[0.15em] font-medium text-[#1E1C1A]">
            {guest.name}
          </span>
        </div>

        <div className="flex items-center space-x-2.5 text-[10px] uppercase tracking-[0.18em]">
          <button
            type="button"
            onClick={handleToggleMute}
            className="hover:text-[#1E1C1A] transition-colors cursor-pointer"
            title="Toggle Camera Audio"
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

      {/* ── CLASSIC POLAROID ONESTEP CAMERA HOUSING ── */}
      <div className="w-full my-auto flex flex-col items-center">
        {/* Camera Outer Body (Classic Two-Tone Ivory/Cream & Matte Black Casing) */}
        <div className="w-full polaroid-camera-body relative p-3 sm:p-4 text-[#1E1C1A]">
          {/* Top Flash Bar & Electronic Capacitor Charging Unit */}
          <div className="bg-[#1C1A18] text-[#F4EEE1] border border-[#1E1C1A] px-3 py-2 mb-3 flex items-center justify-between shadow-inner">
            {/* Flash Strobe Window & Status */}
            <div className="flex items-center space-x-2.5">
              {/* Physical Xenon Flash Reflector Bulb */}
              <div className="relative w-12 h-7 bg-[#252321] border border-[#FAF7F0]/40 rounded-xs overflow-hidden flex items-center justify-center shrink-0">
                <div className="w-full h-full bg-[radial-gradient(#5a5652_1px,transparent_1px)] [background-size:3px_3px] opacity-75" />
                <div className="absolute w-7 h-1.5 rounded-full bg-[#FAF7F0]/85 shadow-[0_0_8px_rgba(255,255,255,0.7)]" />
                {isFlashing && (
                  <div className="absolute inset-0 bg-white shadow-[0_0_50px_20px_rgba(255,255,255,1)] z-30 animate-ping" />
                )}
              </div>

              <button
                type="button"
                onClick={handleToggleFlash}
                className={`px-2.5 py-1 text-[9px] font-mono tracking-widest uppercase border transition-all cursor-pointer flex items-center space-x-1.5 ${
                  flashState === "ready"
                    ? "bg-emerald-800 text-[#FAF7F0] border-emerald-400"
                    : flashState === "charging"
                    ? "bg-[#6B2A2A] text-[#FAF7F0] border-amber-400 animate-pulse"
                    : "bg-[#2A2725] text-[#FAF7F0]/70 border-[#FAF7F0]/20 hover:text-[#FAF7F0]"
                }`}
                title="Tap to arm electronic Xenon flash"
              >
                <span>⚡</span>
                <span>
                  {flashState === "ready"
                    ? "Flash: Ready"
                    : flashState === "charging"
                    ? "Charging..."
                    : "Flash: Off"}
                </span>
              </button>

              {/* Capacitor Neon Ready LED */}
              <div className="hidden sm:flex items-center space-x-1">
                <span
                  className={`w-2 h-2 rounded-full border border-[#1E1C1A] ${
                    flashState === "ready"
                      ? "bg-emerald-400 shadow-[0_0_6px_#34d399]"
                      : flashState === "charging"
                      ? "bg-amber-400 animate-ping"
                      : "bg-[#3D3834]"
                  }`}
                />
                <span className="font-mono text-[8px] uppercase tracking-wider text-[#FAF7F0]/60">
                  {flashState === "ready" ? "Charged" : flashState === "charging" ? "Charging" : "Strobe"}
                </span>
              </div>
            </div>

            {/* Mechanical Film Exposure Counter Window */}
            <div className="flex items-center space-x-1.5 bg-[#0E0D0C] border border-[#FAF7F0]/30 px-2.5 py-1">
              <span className="font-mono text-[8px] uppercase tracking-[0.2em] text-[#FAF7F0]/60">
                EXP.
              </span>
              <span className="font-mono text-sm tracking-widest font-bold text-[#FAF7F0]">
                {guest.shots_remaining} / 8
              </span>
            </div>
          </div>

          {/* Main Camera Faceplate: Dark Charcoal Textured Housing */}
          <div className="bg-[#1C1A18] border-2 border-[#1E1C1A] p-3 sm:p-4 relative overflow-hidden">
            {/* The Iconic Polaroid Quad-Color Spectrum Stripe (running straight down) */}
            <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-4 polaroid-stripe opacity-90 pointer-events-none z-10" />

            {/* Header Plate on Camera Face */}
            <div className="flex items-center justify-between pb-2 text-[8px] font-mono uppercase tracking-[0.25em] text-[#FAF7F0]/60 z-20 relative">
              <span className="font-bold text-[#B89758]">POLAROID LAND CAMERA</span>
              <button
                type="button"
                onClick={handleFlipLens}
                disabled={Boolean(capturedDataUrl)}
                className="px-2 py-0.5 bg-[#2B2826] hover:bg-[#3D3A37] border border-[#FAF7F0]/25 text-[8px] font-mono tracking-widest uppercase text-[#FAF7F0] cursor-pointer transition-colors"
                title="Flip to front / rear camera"
              >
                Flip Lens ↻
              </button>
            </div>

            {/* Square Optical Viewfinder matching Polaroid Aspect Ratio */}
            <div className="relative mx-auto aspect-square w-full max-w-[270px] sm:max-w-[300px] viewfinder-square-housing p-2 flex items-center justify-center overflow-hidden z-20 border-2 border-[#1E1C1A]">
              {/* Live Viewfinder Feed inside square frame */}
              <div className="relative w-full h-full overflow-hidden bg-[#0A0908] border border-[#FAF7F0]/20 flex items-center justify-center">
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  autoPlay
                  className={`absolute inset-0 w-full h-full object-cover vintage-lens-feed transition-opacity duration-300 ${
                    isCameraActive && !capturedDataUrl ? "opacity-100" : "opacity-0"
                  }`}
                />

                {/* Rangefinder Optical Center and Square Framing Reticles */}
                {isCameraActive && !capturedDataUrl && (
                  <>
                    <div className="viewfinder-reticle-tl" />
                    <div className="viewfinder-reticle-tr" />
                    <div className="viewfinder-reticle-bl" />
                    <div className="viewfinder-reticle-br" />
                    <div className="rangefinder-split z-10 flex items-center justify-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#FAF7F0]/70" />
                    </div>
                  </>
                )}

                {/* Standby notice inside square viewfinder when film is ejected */}
                {capturedDataUrl && (
                  <div className="absolute inset-0 bg-[#0E0D0C]/90 flex flex-col items-center justify-center p-4 text-center space-y-2 z-10">
                    <div className="w-8 h-8 rounded-full border border-[#B89758]/50 flex items-center justify-center">
                      <span className="text-[#B89758] text-xs">▼</span>
                    </div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#FAF7F0]">
                      Plate Ejected
                    </p>
                    <p className="font-serif italic text-xs text-[#FAF7F0]/70 max-w-[180px]">
                      Review photograph in delivery tray below
                    </p>
                  </div>
                )}

                {/* Fallback View if camera permission denied */}
                {!isCameraActive && !capturedDataUrl && (
                  <div className="p-4 text-center space-y-3 z-10 max-w-[220px]">
                    <div className="w-12 h-12 border border-[#FAF7F0]/20 mx-auto flex items-center justify-center">
                      <div className="w-6 h-6 border border-[#6B2A2A]" />
                    </div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#FAF7F0]/70 leading-tight">
                      {cameraError || "Optical lens ready..."}
                    </p>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-block py-2 px-3 bg-[#6B2A2A] hover:bg-[#853434] text-[#FAF7F0] border border-[#FAF7F0]/40 font-mono text-[9px] uppercase tracking-[0.2em] cursor-pointer"
                    >
                      Camera Roll
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Front Controls Deck: Lighten/Darken Dial & The Iconic Shutter Button */}
            <div className="flex items-center justify-between pt-3 z-20 relative">
              {/* Exposure Compensation Dial (Lighten / Darken) */}
              <button
                type="button"
                onClick={handleRotateDial}
                className="flex items-center space-x-2 bg-[#121110] border border-[#FAF7F0]/20 px-2 py-1 cursor-pointer hover:border-[#FAF7F0]/40 transition-colors"
                title="Exposure Compensation: Lighten / Darken"
              >
                <div className="w-5 h-5 exposure-wheel" />
                <span className="font-mono text-[8px] uppercase tracking-wider text-[#FAF7F0]/70">
                  {exposureDial === 1
                    ? "Lighten"
                    : exposureDial === -1
                    ? "Darken"
                    : "Normal"}
                </span>
              </button>

              {/* The Iconic Round Polaroid Red/Oxblood Shutter Button */}
              {lifecycle === "idle" ? (
                <div className="flex items-center space-x-2">
                  <span className="font-mono text-[9px] uppercase tracking-widest text-[#FAF7F0]/60">
                    SHUTTER
                  </span>
                  <button
                    type="button"
                    onClick={handleShutterPress}
                    className="group relative w-16 h-16 rounded-full bg-[#151413] border-4 border-[#353230] flex items-center justify-center cursor-pointer active:scale-95 transition-transform focus:outline-none shadow-md"
                    aria-label="Release Polaroid Shutter"
                  >
                    <div className="w-12 h-12 rounded-full bg-[#6B2A2A] group-hover:bg-[#853434] transition-colors border border-[#FAF7F0]/40 flex items-center justify-center">
                      <div className="w-4 h-4 rounded-full border border-[#FAF7F0]/40" />
                    </div>
                  </button>
                </div>
              ) : (
                <div className="font-mono text-[8px] uppercase tracking-[0.2em] text-[#FAF7F0]/60">
                  {lifecycle === "ejecting" ? "EJECTING FILM..." : "FILM IN DARKROOM"}
                </div>
              )}
            </div>
          </div>

          {/* Bottom Ejection Mouth / Motorized Film Roller Lips */}
          <div className="mt-2.5 pt-2 border-t-2 border-[#1E1C1A] flex flex-col items-center relative overflow-hidden">
            {/* The Black Film Slot with the Roller Lip */}
            <div className="w-60 sm:w-68 h-3.5 bg-[#0A0908] border-2 border-[#1E1C1A] rounded-xs relative overflow-hidden flex items-center justify-center shadow-inner z-20">
              <div className="w-48 h-[1.5px] bg-[#FAF7F0]/30 shadow-[0_0_4px_rgba(255,255,255,0.4)]" />
              <div className="absolute left-2 w-3 h-1.5 bg-[#2B2826] rounded-xs" />
              <div className="absolute right-2 w-3 h-1.5 bg-[#2B2826] rounded-xs" />
            </div>

            {/* Realistic motorized film card physically emerging right through the roller slot! */}
            {lifecycle === "ejecting" && capturedDataUrl && (
              <div className="relative w-56 sm:w-64 h-[160px] overflow-hidden -mt-1 flex justify-center z-10 pointer-events-none">
                <div className="polaroid-frame w-52 sm:w-56 border border-[#1E1C1A]/50 shadow-md animate-film-roller-eject select-none">
                  <div className="aspect-square relative overflow-hidden bg-[#181615] border border-[#1E1C1A]/40">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={capturedDataUrl}
                      alt="Emerging film"
                      className="w-full h-full object-cover filter brightness-[0.22] contrast-[1.6] saturate-0 blur-[2px]"
                    />
                    <div className="absolute inset-0 bg-[#2D3F3C] opacity-85 mix-blend-screen" />
                  </div>
                  <div className="pt-2 pb-0.5 text-center">
                    <span className="font-mono text-[8px] uppercase tracking-[0.25em] text-[#5E5A54]">
                      ROLLER SPREAD • SX-70
                    </span>
                  </div>
                </div>
              </div>
            )}

            <span className="font-mono text-[8px] uppercase tracking-[0.25em] text-[#5E5A54] mt-1 z-20">
              ▼ FILM DELIVERY SLOT • 800 SPEED ▼
            </span>
          </div>
        </div>
      </div>

      {/* ── CENTERED INSPECTION STAGE FOR CAPTION & VAULT ── */}
      {(lifecycle === "inspecting" || lifecycle === "vaulting") && capturedDataUrl && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4 bg-[#1E1C1A]/80 backdrop-blur-xs animate-[fadeIn_0.3s_ease-out]">
          {/* Top Archival Header */}
          <div className="w-full max-w-[280px] sm:max-w-[310px] flex items-center justify-between pb-2 text-[9px] font-mono uppercase tracking-[0.2em] text-[#FAF7F0]/70">
            <span className="text-[#B89758] font-bold">Plate In Darkroom</span>
            <span>Exp. {guest.shots_remaining} / 8</span>
          </div>

          {/* The Centered Polaroid */}
          <div
            onPointerMove={handleEmulsionRub}
            onClick={handleEmulsionRub}
            className={`polaroid-frame w-full max-w-[280px] sm:max-w-[310px] border border-[#1E1C1A]/40 shadow-2xl transition-all duration-500 select-none cursor-pointer ${
              lifecycle === "vaulting" ? "animate-seal-vault" : "scale-100 opacity-100"
            }`}
            title="Rub emulsion to accelerate development"
          >
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
                      }) blur(${(1 - developmentProgress / 100) * 2.2}px)`
                    : "none",
                }}
              />

              {/* Milky Opacifier Layer */}
              {isDeveloping && (
                <div
                  className="absolute inset-0 pointer-events-none transition-opacity duration-300 mix-blend-screen"
                  style={{
                    backgroundColor: "#3A4A48",
                    opacity: (1 - developmentProgress / 100) * 0.75,
                  }}
                />
              )}

              {/* Progress Prompt */}
              {isDeveloping && (
                <div className="absolute inset-x-0 bottom-0 bg-[#0E0D0C]/90 px-2 py-1 flex items-center justify-between text-[8px] font-mono uppercase tracking-widest text-[#FAF7F0]">
                  <span>{hasInteractedWithEmulsion ? "Warming emulsion..." : "Rub to accelerate"}</span>
                  <span className="font-bold text-[#B89758]">{developmentProgress}%</span>
                </div>
              )}
            </div>

            {/* Handwritten Caption Chin */}
            <div className="pt-3 pb-1">
              <input
                type="text"
                maxLength={50}
                autoFocus
                placeholder="Add a handwritten message..."
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                disabled={isBusy}
                className="w-full text-center font-hand text-base sm:text-lg text-[#1E1C1A] placeholder:text-[#8A847C]/70 border-b border-[#1E1C1A]/20 bg-transparent py-1 focus:border-[#6B2A2A] outline-none"
              />

              {uploadState !== "idle" && (
                <div className="pt-1.5 text-center font-mono text-[9px] uppercase tracking-wider text-[#6B2A2A]">
                  {uploadState === "saving" && "Sealing plate into gala vault..."}
                  {uploadState === "retrying" && `Signal retry (${uploadAttempt}/4)...`}
                  {uploadState === "success" && "✓ Sealed in vault"}
                  {uploadState === "failed" && "! Signal pending"}
                </div>
              )}
            </div>
          </div>

          {/* Review Action Controls */}
          <div className="w-full max-w-[280px] sm:max-w-[310px] mt-4 flex items-center space-x-3">
            <button
              type="button"
              onClick={handleRetake}
              disabled={isBusy}
              className="flex-1 py-3 px-3 bg-[#FAF7F0]/15 hover:bg-[#FAF7F0]/25 text-[#FAF7F0] border border-[#FAF7F0]/40 font-mono text-[10px] uppercase tracking-widest cursor-pointer transition-colors text-center"
            >
              Retake Shot
            </button>
            <button
              type="button"
              onClick={handleConfirmPhoto}
              disabled={isBusy}
              className="flex-1 py-3 px-3 bg-[#6B2A2A] hover:bg-[#853434] text-[#FAF7F0] border border-[#FAF7F0]/40 font-mono text-[10px] uppercase tracking-widest font-bold cursor-pointer transition-colors text-center shadow-lg"
            >
              {uploadState === "saving" ? "Sealing..." : `Put in Vault (${guest.shots_remaining})`}
            </button>
          </div>
        </div>
      )}

      {/* Camera Base Footer / Colophon */}
      <footer className="w-full text-center pt-2 border-t border-[#1E1C1A]/15 mt-3">
        <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#5E5A54]">
          MSREG Client Gala • Photos Release at 8:00 PM CST
        </p>
      </footer>
    </main>
  );
}
