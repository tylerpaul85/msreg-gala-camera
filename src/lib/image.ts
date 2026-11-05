/**
 * Compresses an image element, video snapshot, or File to a maximum of 1600px on the long edge,
 * encoded as JPEG at approximately 0.8 quality.
 */
export async function compressImageToBlob(
  source: HTMLVideoElement | HTMLImageElement | File | Blob,
  maxDimension: number = 1600,
  quality: number = 0.8
): Promise<{ blob: Blob; dataUrl: string; width: number; height: number }> {
  let sourceWidth = 0;
  let sourceHeight = 0;
  let drawable: CanvasImageSource;

  if (source instanceof HTMLVideoElement) {
    sourceWidth = source.videoWidth;
    sourceHeight = source.videoHeight;
    drawable = source;
  } else if (source instanceof HTMLImageElement) {
    sourceWidth = source.naturalWidth;
    sourceHeight = source.naturalHeight;
    drawable = source;
  } else {
    // File or Blob
    const img = new Image();
    const objectUrl = URL.createObjectURL(source);
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Failed to decode image file"));
      img.src = objectUrl;
    });
    URL.revokeObjectURL(objectUrl);
    sourceWidth = img.naturalWidth;
    sourceHeight = img.naturalHeight;
    drawable = img;
  }

  if (!sourceWidth || !sourceHeight) {
    throw new Error("Invalid image source dimensions");
  }

  // Calculate scaled dimensions preserving aspect ratio
  let targetWidth = sourceWidth;
  let targetHeight = sourceHeight;

  if (sourceWidth > maxDimension || sourceHeight > maxDimension) {
    if (sourceWidth >= sourceHeight) {
      targetWidth = maxDimension;
      targetHeight = Math.round((sourceHeight * maxDimension) / sourceWidth);
    } else {
      targetHeight = maxDimension;
      targetWidth = Math.round((sourceWidth * maxDimension) / sourceHeight);
    }
  }

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Unable to create canvas rendering context");
  }

  // Draw image to canvas
  ctx.drawImage(drawable, 0, 0, targetWidth, targetHeight);

  // Convert to high efficiency JPEG
  const dataUrl = canvas.toDataURL("image/jpeg", quality);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error("Canvas blob conversion failed"));
      },
      "image/jpeg",
      quality
    );
  });

  return {
    blob,
    dataUrl,
    width: targetWidth,
    height: targetHeight,
  };
}

