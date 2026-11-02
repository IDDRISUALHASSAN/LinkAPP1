const CLOUDINARY_VIDEO_UPLOAD_PATH = "/video/upload/";
const CLOUDINARY_VIDEO_FORMAT = "f_mp4,vc_h264,ac_aac,q_auto";
const MEDIA_SCHEME_PATTERN = /^(https?|file|content|blob|data):/i;
const CLOUDINARY_TRANSFORMATION_PATTERN =
  /^(a_|b_|bo_|c_|d_|e_|fl_|f_|g_|h_|ki_|l_|o_|q_|r_|so_|t_|vc_|w_|x_|y_|z_|ac_|br_)/i;

function isCloudinaryTransformation(segment) {
  return Boolean(
    segment &&
    (segment.includes(",") || CLOUDINARY_TRANSFORMATION_PATTERN.test(segment)),
  );
}

function getCloudinaryPathParts(pathname) {
  const uploadIndex = pathname.indexOf(CLOUDINARY_VIDEO_UPLOAD_PATH);
  if (uploadIndex === -1) return null;

  const transformStart = uploadIndex + CLOUDINARY_VIDEO_UPLOAD_PATH.length;
  const segments = pathname.slice(transformStart).split("/").filter(Boolean);
  if (segments.length === 0) return null;

  const firstSegment = segments[0];
  const hasTransformation = isCloudinaryTransformation(firstSegment);
  const transformation = hasTransformation ? firstSegment : null;
  const remaining = hasTransformation ? segments.slice(1) : segments;
  const version = /^v\d+$/i.test(remaining[0] || "") ? remaining.shift() : null;
  const publicPath = remaining.join("/");

  if (!publicPath) return null;

  return {
    uploadIndex,
    transformStart,
    transformation,
    version,
    publicPath,
  };
}

export function normalizeMediaUrl(value) {
  if (typeof value !== "string") return null;

  const url = value.trim();
  if (!url) return null;

  if (url.startsWith("//")) return `https:${url}`;
  if (/^http:\/\//i.test(url)) return url.replace(/^http:\/\//i, "https://");
  if (!MEDIA_SCHEME_PATTERN.test(url)) return null;

  return url;
}

export function getPlayableVideoUrl(value) {
  const url = normalizeMediaUrl(value);
  if (!url) return null;

  try {
    const parsed = new URL(url);
    if (
      parsed.protocol !== "https:" ||
      !parsed.hostname.toLowerCase().endsWith("cloudinary.com")
    ) {
      return url;
    }

    const parts = getCloudinaryPathParts(parsed.pathname);
    if (!parts) return url;

    const versionPath = parts.version ? `${parts.version}/` : "";
    const publicPath = parts.publicPath.replace(/\.[^/.]+$/, "") + ".mp4";
    parsed.pathname = `${parsed.pathname.slice(0, parts.transformStart)}${CLOUDINARY_VIDEO_FORMAT}/${versionPath}${publicPath}`;
    return parsed.toString();
  } catch {
    return null;
  }
}

export function getCloudinaryAttachmentUrl(value, fileName = "download") {
  const url = normalizeMediaUrl(value);
  if (!url) return null;

  try {
    const parsed = new URL(url);
    if (!parsed.hostname.toLowerCase().endsWith("cloudinary.com")) return url;

    const segments = parsed.pathname.split("/");
    const uploadIndex = segments.indexOf("upload");
    if (uploadIndex === -1) return url;

    const resourceTypeSegment = segments[uploadIndex - 1];

    // PDFs and other raw files uploaded as images need the raw delivery path
    const isRawFileByName =
      /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|zip|rar)$/i.test(fileName);

    const isAlreadyRaw = resourceTypeSegment === "raw";
    const needsRawRewrite = isRawFileByName && resourceTypeSegment === "image";

    if (needsRawRewrite) {
      segments[uploadIndex - 1] = "raw";
    }

    if (isAlreadyRaw || needsRawRewrite) {
      // Raw files don't support fl_attachment transformation
      return parsed.toString();
    }

    const safeName =
      String(fileName)
        .replace(/[\\/:*?\"<>|]/g, "_")
        .trim() || "download";
    const attachmentName = safeName.replace(/\.[^.]+$/, "") || "download";
    const attachmentSegment = `fl_attachment:${encodeURIComponent(attachmentName)}`;
    if (segments[uploadIndex + 1] !== attachmentSegment) {
      segments.splice(uploadIndex + 1, 0, attachmentSegment);
    }
    parsed.pathname = segments.join("/");
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
    if (!parsed.hostname.toLowerCase().endsWith("cloudinary.com")) return null;

    const parts = getCloudinaryPathParts(parsed.pathname);
    if (!parts) return null;

    const versionPath = parts.version ? `${parts.version}/` : "";
    const publicPath = parts.publicPath.replace(/\.[^/.]+$/, "");
    parsed.pathname = `${parsed.pathname.slice(0, parts.uploadIndex)}${CLOUDINARY_VIDEO_UPLOAD_PATH}so_0,f_jpg,q_auto/${versionPath}${publicPath}.jpg`;
    return parsed.toString();
  } catch {
    return null;
  }
}
