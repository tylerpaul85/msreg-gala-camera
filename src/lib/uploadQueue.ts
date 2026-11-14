"use client";

/**
 * Offline-First Resilient Background Upload Queue for Venue Conditions.
 * Ensures zero blocking: guests tap "Put in Vault" and immediately return to the camera,
 * while exposures transmit securely in the background even across spotty/dropping cell networks.
 */

export interface QueuedExposure {
  id: string;
  dataUrl: string;
  caption: string;
  createdAt: number;
  attempts: number;
}

export interface QueueStatus {
  pendingCount: number;
  isUploading: boolean;
  isOffline: boolean;
  lastError: string | null;
  lastServerShotsRemaining?: number | null;
}

const STORAGE_KEY = "msreg_gala_upload_queue";
let queue: QueuedExposure[] = [];
let isProcessing = false;
let retryTimer: NodeJS.Timeout | null = null;
const listeners = new Set<(status: QueueStatus) => void>();

// Helper to convert base64 DataURL back to a lightweight binary Blob
function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(",");
  const byteString = atob(parts[1]);
  const mimeString = parts[0].split(":")[1].split(";")[0];
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return new Blob([ab], { type: mimeString });
}

// Load persisted queue from localStorage
function loadQueue(): QueuedExposure[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn("Could not load stored exposure queue:", err);
    return [];
  }
}

// Save queue to localStorage
function saveQueue(items: QueuedExposure[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (err) {
    console.warn("Storage quota exceeded or error saving queue:", err);
  }
}

// Broadcast current status to all subscribed UI components
function broadcastStatus(
  isUploading: boolean,
  lastError: string | null = null,
  shotsRemaining: number | null = null
) {
  const isOffline = typeof navigator !== "undefined" ? !navigator.onLine : false;
  const status: QueueStatus = {
    pendingCount: queue.length,
    isUploading,
    isOffline,
    lastError,
    lastServerShotsRemaining: shotsRemaining,
  };
  listeners.forEach((listener) => {
    try {
      listener(status);
    } catch {}
  });
}

/**
 * Enqueue an exposure for non-blocking background transmission.
 */
export function enqueueExposure(exposure: {
  dataUrl: string;
  caption: string;
}): QueuedExposure {
  const item: QueuedExposure = {
    id: `exp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    dataUrl: exposure.dataUrl,
    caption: exposure.caption,
    createdAt: Date.now(),
    attempts: 0,
  };

  queue = [...queue, item];
  saveQueue(queue);
  broadcastStatus(isProcessing, null);
  processQueue();

  return item;
}

/**
 * Subscribe to upload queue status changes.
 */
export function subscribeToQueue(callback: (status: QueueStatus) => void): () => void {
  listeners.add(callback);
  // Send immediate initial status
  callback({
    pendingCount: queue.length,
    isUploading: isProcessing,
    isOffline: typeof navigator !== "undefined" ? !navigator.onLine : false,
    lastError: null,
  });

  return () => {
    listeners.delete(callback);
  };
}

/**
 * Get count of exposures currently waiting in buffer.
 */
export function getPendingQueueCount(): number {
  return queue.length;
}

/**
 * Process the queue in the background.
 */
export async function processQueue() {
  if (isProcessing) return;
  if (queue.length === 0) {
    broadcastStatus(false, null);
    return;
  }

  isProcessing = true;
  broadcastStatus(true, null);

  const currentItem = queue[0];

  try {
    const blob = dataUrlToBlob(currentItem.dataUrl);
    const formData = new FormData();
    formData.append("photo", blob, "exposure.jpg");
    if (currentItem.caption.trim()) {
      formData.append("caption", currentItem.caption.trim());
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
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    const res = await fetch("/api/photos/upload", {
      method: "POST",
      headers,
      body: formData,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const data = await res.json();

    if (!res.ok) {
      // If server rejected because the guest's 8-shot roll is already filled, remove item
      if (res.status === 403) {
        console.warn("Roll exhausted on server; clearing pending plate.");
        queue = queue.filter((item) => item.id !== currentItem.id);
        saveQueue(queue);
        isProcessing = false;
        broadcastStatus(false, null, 0);
        return;
      }
      throw new Error(data.error || "Vault upload rejected");
    }

    // Success! Remove from queue and persist
    queue = queue.filter((item) => item.id !== currentItem.id);
    saveQueue(queue);

    isProcessing = false;
    broadcastStatus(false, null, data.shots_remaining);

    // Process next item if any remain in queue
    if (queue.length > 0) {
      setTimeout(() => processQueue(), 400);
    }
  } catch (err: any) {
    console.warn(`Background plate transmission failed for ${currentItem.id}:`, err);
    currentItem.attempts += 1;
    saveQueue(queue);

    isProcessing = false;
    const isOffline = typeof navigator !== "undefined" ? !navigator.onLine : false;
    const errMessage = isOffline
      ? "Signal offline — plate held in memory"
      : "Weak ballroom signal — auto-retrying in background";

    broadcastStatus(false, errMessage);

    // Exponential backoff retry: 2s, 4s, 8s, up to max 20s
    const backoff = Math.min(20000, 2000 * Math.pow(1.6, currentItem.attempts));
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = setTimeout(() => {
      processQueue();
    }, backoff);
  }
}

// Auto-trigger sync when device regains connectivity
function initQueueService() {
  if (typeof window === "undefined") return;

  queue = loadQueue();

  window.addEventListener("online", () => {
    console.log("Device reconnected to venue network. Triggering background vault sync.");
    if (retryTimer) clearTimeout(retryTimer);
    processQueue();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && queue.length > 0) {
      processQueue();
    }
  });

  // Check periodically (every 20s) if items remain
  setInterval(() => {
    if (queue.length > 0 && !isProcessing) {
      processQueue();
    }
  }, 20000);

  // If there were pending items from a previous reload, start sending now
  if (queue.length > 0) {
    setTimeout(() => processQueue(), 1200);
  }
}

if (typeof window !== "undefined") {
  initQueueService();
}
