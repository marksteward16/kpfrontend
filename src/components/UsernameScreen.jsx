import { useRef, useState } from "react";

const MAX_FILE_SIZE_BYTES = 3 * 1024 * 1024;
const MAX_PHOTO_DIMENSION = 1280;
const MAX_PHOTO_DATA_URL_LENGTH = 500 * 1024;
const HEIC_MIME_TYPES = new Set([
  "image/heic",
  "image/heif",
  "image/heic-sequence",
  "image/heif-sequence",
]);

function isHeicFile(file) {
  const lowerName = (file.name || "").toLowerCase();
  return HEIC_MIME_TYPES.has(file.type) || /\.(heic|heif)$/i.test(lowerName);
}

async function convertHeicToJpegFile(file) {
  const { default: heic2any } = await import("heic2any");
  const converted = await heic2any({
    blob: file,
    toType: "image/jpeg",
    quality: 0.9,
  });

  const outputBlob = Array.isArray(converted) ? converted[0] : converted;
  if (!(outputBlob instanceof Blob)) {
    throw new Error("HEIC conversion failed");
  }

  const outputName = (file.name || "photo")
    .replace(/\.(heic|heif)$/i, "")
    .concat(".jpg");

  return new File([outputBlob], outputName, { type: "image/jpeg" });
}

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not decode image"));
    };

    image.src = objectUrl;
  });
}

function renderCompressedDataUrl(image, quality) {
  const sourceWidth = image.naturalWidth || image.width || 1;
  const sourceHeight = image.naturalHeight || image.height || 1;
  const scale = Math.min(
    1,
    MAX_PHOTO_DIMENSION / Math.max(sourceWidth, sourceHeight),
  );

  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Could not process image");
  }

  context.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", quality);
}

async function toOptimizedDataUrl(file) {
  const image = await loadImageFromFile(file);
  const qualities = [0.82, 0.74, 0.66, 0.58, 0.5, 0.42, 0.34];
  let fallback = null;

  for (const quality of qualities) {
    const dataUrl = renderCompressedDataUrl(image, quality);
    fallback = dataUrl;
    if (dataUrl.length <= MAX_PHOTO_DATA_URL_LENGTH) {
      return dataUrl;
    }
  }

  return fallback;
}

export default function UsernameScreen({ onStart }) {
  const [username, setUsername] = useState("");
  const [photoData, setPhotoData] = useState(null);
  const [fileError, setFileError] = useState("");
  const [skipPhotoUpload, setSkipPhotoUpload] = useState(false);
  const fileInputRef = useRef(null);

  function toDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function handlePhotoChange(e) {
    const file = e.target.files?.[0];
    if (!file) {
      setPhotoData(null);
      setFileError("");
      return;
    }

    const hasImageMime = file.type.startsWith("image/");
    if (!hasImageMime && !isHeicFile(file)) {
      setFileError("Please choose an image file.");
      setPhotoData(null);
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setFileError("Image must be 10MB or smaller.");
      setPhotoData(null);
      return;
    }

    try {
      let normalizedFile = file;
      if (isHeicFile(file)) {
        normalizedFile = await convertHeicToJpegFile(file);
      }

      let dataUrl = await toOptimizedDataUrl(normalizedFile);

      if (typeof dataUrl !== "string" || dataUrl.length === 0) {
        const fallback = await toDataUrl(normalizedFile);
        dataUrl = typeof fallback === "string" ? fallback : "";
      }

      if (!dataUrl) {
        throw new Error("Could not read image");
      }

      if (dataUrl.length > MAX_PHOTO_DATA_URL_LENGTH) {
        setFileError(
          "Image is too large after processing. Please choose a smaller photo.",
        );
        setPhotoData(null);
        return;
      }

      setPhotoData(dataUrl);
      setFileError("");
    } catch {
      setFileError("Could not read that image. Please try another one.");
      setPhotoData(null);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    const trimmed = username.trim();
    if (trimmed.length === 0) return;
    onStart(trimmed, skipPhotoUpload ? null : photoData);
  }

  function handleSkipPhotoToggle(e) {
    const checked = e.target.checked;
    setSkipPhotoUpload(checked);
    if (checked) {
      setPhotoData(null);
      setFileError("");
    }
  }

  function handleUploadPhotoClick() {
    fileInputRef.current?.click();
  }

  return (
    <div className="bg-[#F5F7F5] min-h-screen flex flex-col items-center justify-center px-4">
      {/* Logo / Title */}

      <div className="text-center my-10 md:my-0  max-w-6xl mx-auto">
        <h1 className="text-6xl mb-10 font-extrabold text-gray-900 tracking-tight animate-wiggle animate-delay-1500 animate-duration-400">
          Koopals
        </h1>
        <p className="mt-3 text-3xl mb-5 font-bold text-[#1E2925] animate-fade-right animate-delay-200">
          Where Every Chat Could Be the Start of Something New 🤩
        </p>
        <p className="mt-1 text-md mb-5 text-[#1E2925] animate-fade-left animate-delay-400">
          💬 Talk freely. Connect unexpectedly. Whether you're looking for a
          moment of distraction, a time killer, or just someone to talk to,
          Koopals is your space to meet and chat with random people from all
          walks of life. 🤝🤩
        </p>
      </div>

      <div className="w-full max-w-md animate-fade-up animate-delay-550">
        {/* Card */}
        <form
          onSubmit={handleSubmit}
          className="bg-[#FFFFFF] border border-[#6F826A] rounded-2xl p-8 shadow-xl"
        >
          {photoData && (
            <div className="mb-10  flex justify-center">
              <img
                src={photoData}
                alt="Your preview"
                className="size-40 rounded-full object-cover border-2 border-gray-100 animate-jump-in"
              />
            </div>
          )}
          <label className="block text-sm font-medium text-[#1E2925] mb-2">
            Choose a username
          </label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="e.g. coolstranger42"
            maxLength={24}
            className="w-full bg-[#fafff5] text-gray-700 font-semibold placeholder-gray-500 border border-[#36442b] rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#36442b] transition"
            autoFocus
          />

          {!skipPhotoUpload && (
            <>
              <label className="block text-sm font-medium text-[#1E2925] mt-4 mb-2">
                Optional photo
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.heic,.heif,image/heic,image/heif"
                onChange={handlePhotoChange}
                className="hidden"
              />
              <input
                type="button"
                value={photoData ? "Change Photo" : "Upload Photo"}
                onClick={handleUploadPhotoClick}
                className=" rounded-xl  bg-[#E2E8E4] border-gray-700 py-3 px-2 text-left text-sm text-[#2A443B] transition"
              />
              <p className="mt-2 text-xs text-gray-500 italic">
                *If both users upload a photo, photos unlock after 1 minute of
                chatting.
              </p>
              {fileError && (
                <p className="mt-2 text-xs text-red-400">{fileError}</p>
              )}
            </>
          )}

          <label className="mt-4 flex items-center gap-2 text-sm text-[#1E2925]">
            <input
              type="checkbox"
              checked={skipPhotoUpload}
              onChange={handleSkipPhotoToggle}
              className="h-4 w-4 rounded border-gray-600 bg-gray-800 text-indigo-500 focus:ring-indigo-500"
            />
            I dont want to upload photo
          </label>

          <button
            type="submit"
            disabled={username.trim().length === 0}
            className="mt-5 w-full bg-[#2A443B] disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl py-3 transition"
          >
            Start Chatting
          </button>
        </form>
      </div>
    </div>
  );
}
