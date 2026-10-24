"use client";

import { useCallback, useRef, useState } from "react";
import Cropper from "react-easy-crop";
import { apiUrl, productImageSrc } from "@/lib/basePath";

async function cropImageToBlob(imageSrc, pixelCrop) {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error("Could not process image."));
        else resolve(blob);
      },
      "image/jpeg",
      0.92
    );
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener("load", () => resolve(img));
    img.addEventListener("error", reject);
    img.crossOrigin = "anonymous";
    img.src = src;
  });
}

/** Crop + compress upload to a staff API (multipart: file, role, crop). */
export default function CompressedPhotoUpload({
  label,
  uploadUrl,
  extraFormFields = {},
  previewPath,
  disabled = false,
  onUploaded,
}) {
  const fileRef = useRef(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [cropSrc, setCropSrc] = useState("");
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [useCrop, setUseCrop] = useState(true);
  const [pendingFile, setPendingFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [savedBytes, setSavedBytes] = useState(null);
  const [localPreview, setLocalPreview] = useState("");

  const displayUrl = localPreview || (previewPath ? productImageSrc(`/api/media/${previewPath}`) : "");

  const onCropComplete = useCallback((_area, pixels) => {
    setCroppedAreaPixels(pixels);
  }, []);

  function pickFile() {
    if (disabled || uploading) return;
    fileRef.current?.click();
  }

  function onFileChange(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError("");
    setPendingFile(file);
    const url = URL.createObjectURL(file);
    setCropSrc(url);
    setCropOpen(true);
    setZoom(1);
    setCrop({ x: 0, y: 0 });
  }

  function closeCrop() {
    setCropOpen(false);
    if (cropSrc.startsWith("blob:")) URL.revokeObjectURL(cropSrc);
    setCropSrc("");
    setPendingFile(null);
  }

  async function uploadBlob(blob, skipCrop) {
    setUploading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", blob, "photo.jpg");
      for (const [key, val] of Object.entries(extraFormFields)) {
        if (val != null && val !== "") form.append(key, String(val));
      }
      if (skipCrop) form.append("skip_crop", "1");

      const res = await fetch(apiUrl(uploadUrl), {
        method: "POST",
        credentials: "include",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Upload failed.");
        return;
      }
      if (data.storage_key) {
        setLocalPreview(productImageSrc(`/api/media/${data.storage_key}`));
      }
      if (Number.isFinite(data.bytes) && data.bytes > 0) setSavedBytes(data.bytes);
      onUploaded?.(data);
      closeCrop();
    } catch {
      setError("Network error during upload.");
    } finally {
      setUploading(false);
    }
  }

  async function confirmCrop() {
    if (!pendingFile) return;
    try {
      if (useCrop && croppedAreaPixels) {
        const blob = await cropImageToBlob(cropSrc, croppedAreaPixels);
        await uploadBlob(blob, true);
      } else {
        await uploadBlob(pendingFile, true);
      }
    } catch {
      setError("Could not prepare image.");
    }
  }

  return (
    <div className="compressed-photo-upload">
      <div className="compressed-photo-upload-head">
        <span className="compressed-photo-upload-label">{label}</span>
        {savedBytes ?
          <span className="admin-muted">
            {savedBytes < 1024 ? `${savedBytes} B` : `${Math.round(savedBytes / 1024)} KB`} WebP
          </span>
        : null}
      </div>
      <div className="compressed-photo-upload-row">
        {displayUrl ?
          <img src={displayUrl} alt="" className="compressed-photo-preview" />
        : <div className="compressed-photo-preview is-empty">No photo</div>}
        <button type="button" className="admin-btn admin-btn-secondary admin-btn-sm" disabled={disabled || uploading} onClick={pickFile}>
          {uploading ? "Saving…" : displayUrl ? "Change" : "Add photo"}
        </button>
      </div>
      {error ?
        <p className="inv-product-image-error" role="alert">
          {error}
        </p>
      : null}
      <input ref={fileRef} type="file" accept="image/*" className="inv-product-image-file" onChange={onFileChange} />
      {cropOpen ?
        <div className="admin-modal inv-product-crop-modal" role="dialog" aria-modal="true">
          <button type="button" className="admin-modal-backdrop" aria-label="Close" onClick={closeCrop} />
          <div className="admin-modal-card inv-product-crop-card">
            <div className="admin-modal-head">
              <h3>{label}</h3>
              <button type="button" className="ledger-modal-close" onClick={closeCrop} aria-label="Close">
                ×
              </button>
            </div>
            <label className="inv-product-crop-toggle">
              <input type="checkbox" checked={useCrop} onChange={(e) => setUseCrop(e.target.checked)} />
              <span>Crop (square)</span>
            </label>
            {useCrop ?
              <div className="inv-product-crop-area">
                <Cropper
                  image={cropSrc}
                  crop={crop}
                  zoom={zoom}
                  aspect={1}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={onCropComplete}
                />
              </div>
            : <div className="inv-product-crop-preview-only">
                <img src={cropSrc} alt="" />
              </div>
            }
            <div className="inv-product-crop-foot">
              <button type="button" className="admin-btn admin-btn-secondary" onClick={closeCrop}>
                Cancel
              </button>
              <button type="button" className="admin-btn" disabled={uploading} onClick={confirmCrop}>
                {uploading ? "Saving…" : "Use photo"}
              </button>
            </div>
          </div>
        </div>
      : null}
    </div>
  );
}
