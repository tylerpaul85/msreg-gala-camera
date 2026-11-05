import { supabaseAdmin, isSupabaseConfigured } from "./supabase";
import crypto from "crypto";
import sharp from "sharp";

export interface GuestRecord {
  id: string;
  name: string;
  email: string;
  session_token: string;
  shots_remaining: number;
  created_at: string;
}

export interface PhotoRecord {
  id: string;
  guest_id: string;
  storage_path: string;       // Private bucket path
  preview_path: string;       // Public bucket path (blurred)
  preview_url: string;        // Blurred URL
  original_url?: string;      // Only populated for admin or after reveal
  caption: string | null;
  exposure_number: number;
  created_at: string;
  guest_name?: string;
  guest_first_name?: string;
}

export interface AppSettings {
  revealed: boolean;
  updated_at: string;
}

// In-memory fallback store for development before Supabase is connected
const globalDevStore = global as unknown as {
  __devGuests?: Map<string, GuestRecord>;
  __devPhotos?: Array<
    PhotoRecord & {
      original_buffer?: Buffer;
      preview_buffer?: Buffer;
    }
  >;
  __devSettings?: AppSettings;
};

if (!globalDevStore.__devGuests) {
  globalDevStore.__devGuests = new Map();
}
if (!globalDevStore.__devPhotos) {
  globalDevStore.__devPhotos = [];
}
if (!globalDevStore.__devSettings) {
  globalDevStore.__devSettings = {
    revealed: false,
    updated_at: new Date().toISOString(),
  };
}

const ORIGINALS_BUCKET = process.env.ORIGINALS_BUCKET || "gala-originals";
const PREVIEWS_BUCKET = process.env.PREVIEWS_BUCKET || "gala-previews";

/**
 * Validates standard email address format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/**
 * Generates a heavily blurred, low-resolution thumbnail using sharp:
 * Resized to 64px width, heavy Gaussian blur applied, then scaled up to 600px.
 */
export async function generateBlurredPreview(imageBuffer: Buffer): Promise<Buffer> {
  return sharp(imageBuffer)
    .resize(64, null, { withoutEnlargement: true })
    .blur(18)
    .resize(600, null, { kernel: "cubic" })
    .jpeg({ quality: 60 })
    .toBuffer();
}

/**
 * Check whether photos have been developed/revealed by the admin
 */
export async function isRevealed(): Promise<boolean> {
  if (isSupabaseConfigured && supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from("app_settings")
      .select("revealed")
      .eq("id", "settings")
      .maybeSingle();

    if (!error && data) {
      return Boolean(data.revealed);
    }
  }
  return Boolean(globalDevStore.__devSettings?.revealed);
}

/**
 * Set the revealed state (admin action)
 */
export async function setRevealed(revealed: boolean): Promise<boolean> {
  if (isSupabaseConfigured && supabaseAdmin) {
    const { error } = await supabaseAdmin
      .from("app_settings")
      .upsert({
        id: "settings",
        revealed,
        updated_at: new Date().toISOString(),
      });

    if (error) {
      console.error("Error setting reveal state:", error);
      throw new Error(`Failed to update reveal state: ${error.message}`);
    }
    return revealed;
  }

  globalDevStore.__devSettings = {
    revealed,
    updated_at: new Date().toISOString(),
  };
  return revealed;
}

/**
 * Look up a guest by their secure session token
 */
export async function getGuestBySessionToken(
  sessionToken: string
): Promise<GuestRecord | null> {
  if (!sessionToken) return null;

  if (isSupabaseConfigured && supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from("guests")
      .select("*")
      .eq("session_token", sessionToken)
      .maybeSingle();

    if (error || !data) return null;
    return data as GuestRecord;
  }

  for (const guest of globalDevStore.__devGuests!.values()) {
    if (guest.session_token === sessionToken) {
      return guest;
    }
  }
  return null;
}

/**
 * Authenticate or register guest:
 * If email exists: retrieves existing guest record with their remaining shots.
 * If new: creates guest record with default 8 shots.
 */
export async function registerOrLoginGuest(
  name: string,
  rawEmail: string
): Promise<{ guest: GuestRecord; isNew: boolean }> {
  const email = rawEmail.trim().toLowerCase();
  const cleanName = name.trim();

  if (!isValidEmail(email)) {
    throw new Error("Invalid email format");
  }

  if (isSupabaseConfigured && supabaseAdmin) {
    const { data: existing } = await supabaseAdmin
      .from("guests")
      .select("*")
      .eq("email", email)
      .maybeSingle();

    if (existing) {
      return {
        guest: existing as GuestRecord,
        isNew: false,
      };
    }

    const sessionToken = crypto.randomBytes(32).toString("hex");
    const newGuest = {
      name: cleanName,
      email,
      session_token: sessionToken,
      shots_remaining: 8,
    };

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("guests")
      .insert(newGuest)
      .select()
      .single();

    if (insertError || !inserted) {
      const { data: retryLookup } = await supabaseAdmin
        .from("guests")
        .select("*")
        .eq("email", email)
        .single();

      if (retryLookup) {
        return { guest: retryLookup as GuestRecord, isNew: false };
      }
      throw new Error(insertError?.message || "Failed to create guest record");
    }

    return { guest: inserted as GuestRecord, isNew: true };
  }

  const existingDev = globalDevStore.__devGuests!.get(email);
  if (existingDev) {
    return { guest: existingDev, isNew: false };
  }

  const sessionToken = crypto.randomBytes(32).toString("hex");
  const newGuest: GuestRecord = {
    id: crypto.randomUUID(),
    name: cleanName,
    email,
    session_token: sessionToken,
    shots_remaining: 8,
    created_at: new Date().toISOString(),
  };

  globalDevStore.__devGuests!.set(email, newGuest);
  return { guest: newGuest, isNew: true };
}

/**
 * Server-enforced photo upload and shot deduction.
 * Saves TWO files:
 * 1. Original to PRIVATE bucket 'gala-originals'.
 * 2. Low-resolution heavily Gaussian blurred version via sharp to PUBLIC bucket 'gala-previews'.
 */
export async function uploadAndRecordPhoto(params: {
  guestId: string;
  fileBuffer: Buffer;
  mimeType: string;
  caption?: string | null;
}): Promise<{ guest: GuestRecord; photo: PhotoRecord }> {
  const { guestId, fileBuffer, mimeType, caption } = params;

  // Generate heavily blurred preview on server with sharp
  const blurredBuffer = await generateBlurredPreview(fileBuffer);

  if (isSupabaseConfigured && supabaseAdmin) {
    // 1. Fetch current guest state
    const { data: guest, error: guestError } = await supabaseAdmin
      .from("guests")
      .select("*")
      .eq("id", guestId)
      .single();

    if (guestError || !guest) {
      throw new Error("Guest cartridge not found.");
    }

    if (guest.shots_remaining <= 0) {
      throw new Error("EXHAUSTED_ROLL");
    }

    const currentShotNumber = 9 - guest.shots_remaining;
    const fileExt = mimeType.includes("png") ? "png" : "jpg";
    const baseFilename = `${guestId}/exp_${currentShotNumber}_${Date.now()}`;
    const originalPath = `${baseFilename}.${fileExt}`;
    const previewPath = `${baseFilename}_blurred.jpg`;

    // 2. Upload original to PRIVATE bucket
    const { error: origUploadErr } = await supabaseAdmin.storage
      .from(ORIGINALS_BUCKET)
      .upload(originalPath, fileBuffer, {
        contentType: mimeType,
        upsert: false,
      });

    if (origUploadErr) {
      console.error("Private bucket upload error:", origUploadErr);
      throw new Error(`Original storage failed: ${origUploadErr.message}`);
    }

    // 3. Upload blurred version to PUBLIC bucket
    const { error: prevUploadErr } = await supabaseAdmin.storage
      .from(PREVIEWS_BUCKET)
      .upload(previewPath, blurredBuffer, {
        contentType: "image/jpeg",
        upsert: false,
      });

    if (prevUploadErr) {
      console.error("Public preview bucket upload error:", prevUploadErr);
      throw new Error(`Blurred preview storage failed: ${prevUploadErr.message}`);
    }

    const { data: publicPreviewData } = supabaseAdmin.storage
      .from(PREVIEWS_BUCKET)
      .getPublicUrl(previewPath);

    const previewUrl = publicPreviewData.publicUrl;

    // 4. Atomically decrement remaining exposures
    const { data: updatedGuest, error: updateError } = await supabaseAdmin
      .from("guests")
      .update({ shots_remaining: guest.shots_remaining - 1 })
      .eq("id", guestId)
      .gt("shots_remaining", 0)
      .select()
      .single();

    if (updateError || !updatedGuest) {
      throw new Error("EXHAUSTED_ROLL");
    }

    // 5. Insert photo record
    const { data: photoRecord, error: photoError } = await supabaseAdmin
      .from("photos")
      .insert({
        guest_id: guestId,
        storage_path: originalPath,
        preview_path: previewPath,
        preview_url: previewUrl,
        caption: caption?.slice(0, 140) || null,
        exposure_number: currentShotNumber,
      })
      .select()
      .single();

    if (photoError) {
      console.error("Photo insertion error:", photoError);
    }

    return {
      guest: updatedGuest as GuestRecord,
      photo: (photoRecord || {
        id: crypto.randomUUID(),
        guest_id: guestId,
        storage_path: originalPath,
        preview_path: previewPath,
        preview_url: previewUrl,
        caption: caption || null,
        exposure_number: currentShotNumber,
        created_at: new Date().toISOString(),
      }) as PhotoRecord,
    };
  }

  // Dev fallback
  let foundGuest: GuestRecord | null = null;
  for (const g of globalDevStore.__devGuests!.values()) {
    if (g.id === guestId) {
      foundGuest = g;
      break;
    }
  }

  if (!foundGuest) {
    throw new Error("Guest cartridge not found.");
  }

  if (foundGuest.shots_remaining <= 0) {
    throw new Error("EXHAUSTED_ROLL");
  }

  foundGuest.shots_remaining -= 1;
  const currentExposure = 8 - foundGuest.shots_remaining;
  const originalDataUrl = `data:${mimeType};base64,${fileBuffer.toString("base64")}`;
  const blurredDataUrl = `data:image/jpeg;base64,${blurredBuffer.toString("base64")}`;

  const photoRecord: PhotoRecord & {
    original_buffer?: Buffer;
    preview_buffer?: Buffer;
  } = {
    id: crypto.randomUUID(),
    guest_id: guestId,
    storage_path: `dev_orig_${currentExposure}.jpg`,
    preview_path: `dev_blurred_${currentExposure}.jpg`,
    preview_url: blurredDataUrl,
    original_url: originalDataUrl,
    original_buffer: fileBuffer,
    preview_buffer: blurredBuffer,
    caption: caption?.slice(0, 140) || null,
    exposure_number: currentExposure,
    created_at: new Date().toISOString(),
    guest_name: foundGuest.name,
    guest_first_name: foundGuest.name.split(" ")[0],
  };

  globalDevStore.__devPhotos!.unshift(photoRecord);

  return {
    guest: { ...foundGuest },
    photo: photoRecord,
  };
}

/**
 * Public Gallery fetch:
 * Returns photos newest first.
 * BEFORE REVEAL: only returns the blurred preview_url. Original is NEVER exposed.
 * AFTER REVEAL: signs short-lived URLs for the original files from the private bucket.
 */
export async function getPublicGalleryPhotos(): Promise<{
  revealed: boolean;
  photos: PhotoRecord[];
}> {
  const revealed = await isRevealed();

  if (isSupabaseConfigured && supabaseAdmin) {
    const { data: photos, error } = await supabaseAdmin
      .from("photos")
      .select("id, guest_id, storage_path, preview_url, caption, exposure_number, created_at, guests(name)")
      .order("created_at", { ascending: false });

    if (error || !photos) {
      return { revealed, photos: [] };
    }

    const formattedPhotos: PhotoRecord[] = [];

    for (const p of photos as any[]) {
      const guestName = p.guests?.name || "Guest";
      const firstName = guestName.split(" ")[0];

      let originalUrl: string | undefined = undefined;

      if (revealed) {
        // Generate signed URL valid for 3600 seconds (1 hour) from private bucket
        const { data: signedData } = await supabaseAdmin.storage
          .from(ORIGINALS_BUCKET)
          .createSignedUrl(p.storage_path, 3600);

        originalUrl = signedData?.signedUrl;
      }

      formattedPhotos.push({
        id: p.id,
        guest_id: p.guest_id,
        storage_path: p.storage_path,
        preview_path: p.preview_path || "",
        preview_url: p.preview_url,
        original_url: originalUrl, // Undefined if not revealed
        caption: p.caption,
        exposure_number: p.exposure_number,
        created_at: p.created_at,
        guest_name: guestName,
        guest_first_name: firstName,
      });
    }

    return { revealed, photos: formattedPhotos };
  }

  // Dev fallback
  const photos = (globalDevStore.__devPhotos || []).map((p) => {
    return {
      id: p.id,
      guest_id: p.guest_id,
      storage_path: p.storage_path,
      preview_path: p.preview_path,
      preview_url: p.preview_url,
      original_url: revealed ? p.original_url : undefined,
      caption: p.caption,
      exposure_number: p.exposure_number,
      created_at: p.created_at,
      guest_name: p.guest_name || "Guest",
      guest_first_name: p.guest_first_name || "Guest",
    };
  });

  return { revealed, photos };
}

/**
 * Admin view of all photos:
 * Admin ALWAYS gets original images (signed URLs or base64) to allow pre-reveal moderation.
 */
export async function getAdminPhotos(): Promise<{
  revealed: boolean;
  photos: PhotoRecord[];
}> {
  const revealed = await isRevealed();

  if (isSupabaseConfigured && supabaseAdmin) {
    const { data: photos, error } = await supabaseAdmin
      .from("photos")
      .select("id, guest_id, storage_path, preview_url, caption, exposure_number, created_at, guests(name, email)")
      .order("created_at", { ascending: false });

    if (error || !photos) {
      return { revealed, photos: [] };
    }

    const formattedPhotos: PhotoRecord[] = [];

    for (const p of photos as any[]) {
      const guestName = p.guests?.name || "Guest";
      const firstName = guestName.split(" ")[0];

      // Admin always gets signed URL to original for moderation
      const { data: signedData } = await supabaseAdmin.storage
        .from(ORIGINALS_BUCKET)
        .createSignedUrl(p.storage_path, 3600);

      formattedPhotos.push({
        id: p.id,
        guest_id: p.guest_id,
        storage_path: p.storage_path,
        preview_path: p.preview_path || "",
        preview_url: p.preview_url,
        original_url: signedData?.signedUrl || p.preview_url,
        caption: p.caption,
        exposure_number: p.exposure_number,
        created_at: p.created_at,
        guest_name: guestName,
        guest_first_name: firstName,
      });
    }

    return { revealed, photos: formattedPhotos };
  }

  // Dev fallback
  const photos = (globalDevStore.__devPhotos || []).map((p) => ({
    ...p,
    original_url: p.original_url || p.preview_url,
  }));

  return { revealed, photos };
}

/**
 * Delete a photo by ID (moderation capability before or after reveal)
 */
export async function deletePhoto(photoId: string): Promise<boolean> {
  if (isSupabaseConfigured && supabaseAdmin) {
    // 1. Get photo storage paths
    const { data: photo } = await supabaseAdmin
      .from("photos")
      .select("storage_path, preview_path")
      .eq("id", photoId)
      .maybeSingle();

    if (photo) {
      if (photo.storage_path) {
        await supabaseAdmin.storage
          .from(ORIGINALS_BUCKET)
          .remove([photo.storage_path]);
      }
      if (photo.preview_path) {
        await supabaseAdmin.storage
          .from(PREVIEWS_BUCKET)
          .remove([photo.preview_path]);
      }
    }

    const { error } = await supabaseAdmin
      .from("photos")
      .delete()
      .eq("id", photoId);

    return !error;
  }

  const initialCount = globalDevStore.__devPhotos!.length;
  globalDevStore.__devPhotos = globalDevStore.__devPhotos!.filter(
    (p) => p.id !== photoId
  );
  return globalDevStore.__devPhotos.length < initialCount;
}

/**
 * Admin Stats: total guests, total photos, photos per guest
 */
export async function getAdminStats(): Promise<{
  totalGuests: number;
  totalPhotos: number;
  photosPerGuest: string;
  revealed: boolean;
}> {
  const revealed = await isRevealed();

  if (isSupabaseConfigured && supabaseAdmin) {
    const { count: totalGuests } = await supabaseAdmin
      .from("guests")
      .select("*", { count: "exact", head: true });

    const { count: totalPhotos } = await supabaseAdmin
      .from("photos")
      .select("*", { count: "exact", head: true });

    const guestCount = totalGuests || 0;
    const photoCount = totalPhotos || 0;
    const perGuest = guestCount > 0 ? (photoCount / guestCount).toFixed(1) : "0.0";

    return {
      totalGuests: guestCount,
      totalPhotos: photoCount,
      photosPerGuest: perGuest,
      revealed,
    };
  }

  const guestCount = globalDevStore.__devGuests!.size;
  const photoCount = globalDevStore.__devPhotos!.length;
  const perGuest = guestCount > 0 ? (photoCount / guestCount).toFixed(1) : "0.0";

  return {
    totalGuests: guestCount,
    totalPhotos: photoCount,
    photosPerGuest: perGuest,
    revealed,
  };
}

/**
 * Fetch all photos captured by a guest
 */
export async function getGuestPhotos(guestId: string): Promise<PhotoRecord[]> {
  if (isSupabaseConfigured && supabaseAdmin) {
    const { data } = await supabaseAdmin
      .from("photos")
      .select("*")
      .eq("guest_id", guestId)
      .order("exposure_number", { ascending: true });

    return (data as PhotoRecord[]) || [];
  }

  return (
    globalDevStore.__devPhotos?.filter((p) => p.guest_id === guestId) || []
  );
}

/**
 * Fetch all guests for CSV export
 */
export async function getAllGuestsForExport(): Promise<
  Array<{ name: string; email: string; shots_taken: number; created_at: string }>
> {
  if (isSupabaseConfigured && supabaseAdmin) {
    const { data: guests } = await supabaseAdmin
      .from("guests")
      .select("name, email, shots_remaining, created_at")
      .order("created_at", { ascending: true });

    return (
      guests?.map((g) => ({
        name: g.name,
        email: g.email,
        shots_taken: 8 - g.shots_remaining,
        created_at: g.created_at,
      })) || []
    );
  }

  return Array.from(globalDevStore.__devGuests!.values()).map((g) => ({
    name: g.name,
    email: g.email,
    shots_taken: 8 - g.shots_remaining,
    created_at: g.created_at,
  }));
}

/**
 * Fetch all original photo buffers for ZIP export
 */
export async function getAllOriginalsForZip(): Promise<
  Array<{ filename: string; buffer: Buffer }>
> {
  const results: Array<{ filename: string; buffer: Buffer }> = [];

  if (isSupabaseConfigured && supabaseAdmin) {
    const { data: photos } = await supabaseAdmin
      .from("photos")
      .select("id, storage_path, exposure_number, created_at, guests(name)");

    if (!photos) return results;

    for (const p of photos as any[]) {
      const guestName = (p.guests?.name || "Guest")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "_");
      const filename = `${guestName}_exp${p.exposure_number}_${p.id.slice(0, 8)}.jpg`;

      const { data: fileData, error } = await supabaseAdmin.storage
        .from(ORIGINALS_BUCKET)
        .download(p.storage_path);

      if (!error && fileData) {
        const buffer = Buffer.from(await fileData.arrayBuffer());
        results.push({ filename, buffer });
      }
    }

    return results;
  }

  // Dev fallback
  for (const p of globalDevStore.__devPhotos || []) {
    if (p.original_buffer) {
      const guestName = (p.guest_name || "Guest")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "_");
      const filename = `${guestName}_exp${p.exposure_number}_${p.id.slice(0, 8)}.jpg`;
      results.push({ filename, buffer: p.original_buffer });
    }
  }

  return results;
}
