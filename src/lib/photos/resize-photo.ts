const MAX_WIDTH = 800;
const JPEG_QUALITY = 0.7;

async function decode(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      // Respects the photo's EXIF orientation (phone photos are often rotated).
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      // Fall through to <img> decoding (older Safari).
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = url;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Resizes an image in the browser to at most 800px wide and re-encodes it
 * as a ~0.7 quality JPEG. Throws if the browser can't decode the file
 * (e.g. HEIC in Chrome).
 */
export async function resizePhoto(file: Blob): Promise<Blob> {
  const image = await decode(file);
  const width = "naturalWidth" in image ? image.naturalWidth : image.width;
  const height = "naturalHeight" in image ? image.naturalHeight : image.height;
  if (!width || !height) throw new Error("Empty image");

  const scale = Math.min(1, MAX_WIDTH / width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("No canvas context");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  if ("close" in image) image.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Encoding failed"))),
      "image/jpeg",
      JPEG_QUALITY,
    );
  });
}
