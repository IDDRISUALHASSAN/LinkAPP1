const CLOUDINARY_VIDEO_UPLOAD_PATH = "/video/upload/";
const CLOUDINARY_VIDEO_FORMAT = "f_mp4,vc_h264,ac_aac,q_auto";

export function normalizeMediaUrl(value) {
  if (typeof value !== "string") return null;

  const url = value.trim();
  if (!url) return null;

  if (/^http:\/\//i.test(url)) {
    return url.replace(/^http:\/\//i, "https://");
  }

  return url;
}

export function getPlayableVideoUrl(value) {
  const url = normalizeMediaUrl(value);
  if (!url) return null;

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || !parsed.hostname.endsWith("cloudinary.com")) {
      return url;
    }

    const uploadIndex = parsed.pathname.indexOf(CLOUDINARY_VIDEO_UPLOAD_PATH);
    if (uploadIndex === -1) return url;

    const transformStart = uploadIndex + CLOUDINARY_VIDEO_UPLOAD_PATH.length;
    const existingTransformations = parsed.pathname.slice(transformStart);
    const firstPathSegment = existingTransformations.split("/")[0];

    if (firstPathSegment.split(",").some((part) => part === "f_mp4" || part.startsWith("vc_"))) {
      return url;
    }

    parsed.pathname = `${parsed.pathname.slice(0, transformStart)}${CLOUDINARY_VIDEO_FORMAT},${firstPathSegment}/${existingTransformations.slice(firstPathSegment.length + 1)}`;
    return parsed.toString();
  } catch {
    return url;
  }
}

export function getPosterUrl(value) {
  const url = normalizeMediaUrl(value);
  if (!url) return null;

  try {
    const parsed = new URL(url);
    if (!parsed.hostname.endsWith("cloudinary.com")) return null;

    const uploadIndex = parsed.pathname.indexOf(CLOUDINARY_VIDEO_UPLOAD_PATH);
    if (uploadIndex === -1) return null;

    const transformStart = uploadIndex + CLOUDINARY_VIDEO_UPLOAD_PATH.length;
    const existingTransformations = parsed.pathname.slice(transformStart);
    const firstPathSegment = existingTransformations.split("/")[0];
    const publicId = existingTransformations.slice(firstPathSegment.length + 1);

    parsed.pathname = `${parsed.pathname.slice(0, uploadIndex)}${CLOUDINARY_VIDEO_UPLOAD_PATH}so_0,f_jpg,q_auto/${publicId.replace(/\.[^/.]+$/, "")}.jpg`;
    return parsed.toString();
  } catch {
    return null;
  }
}
