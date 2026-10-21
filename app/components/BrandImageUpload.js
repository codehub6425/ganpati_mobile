"use client";

import { apiUrl, productImageSrc } from "@/lib/basePath";
import { useCallback, useRef, useState } from "react";
import Cropper from "react-easy-crop";

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

/** Brand logo upload — same compression pipeline as product photos. */
export default function BrandImageUpload(props) {
  const {
    brandId = null,
    stagingToken,
    storageKey,
    previewUrl,
    onChange,
    disabled = false,
  } = props;

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

  const displayUrl = previewUrl ? productImageSrc(previewUrl) : "";

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
      form.append("file", blob, "logo.jpg");
      if (brandId) form.append("brand_id", String(brandId));
      else if (stagingToken) form.append("staging_token", stagingToken);
      if (skipCrop) form.append("skip_crop", "1");

      const res = await fetch(apiUrl("/api/admin/inventory/brands/image"), {
        method: "POST",
        credentials: "include",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Upload failed.");
        return;
      }
      onChange?.({ storage_key: data.storage_key, url: data.url, cleared: false });
      if (Number.isFinite(data.bytes) && data.bytes > 0) setSavedBytes(data.bytes);
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

  function removeImage() {
    onChange?.({ storage_key: null, url: null, cleared: true });
    setError("");
    setSavedBytes(null);
  }

  return (
    <div className="inv-product-image-upload">
      <div className="inv-product-image-upload-head">
        <span className="inv-product-image-upload-label">Brand logo</span>
        <span className="admin-muted">
          {savedBytes ?
            `Saved: ${Math.round(savedBytes / 1024)} KB (WebP)`
          : "Compressed WebP — same as product photos"}
        </span>
      </div>
      <div className="inv-product-image-upload-row">
        {displayUrl ?
          <img src={displayUrl} alt="" className="inv-product-image-preview" />
        : <div className="inv-product-image-preview is-empty">No logo</div>}
        <div className="inv-product-image-upload-actions">
          <button type="button" className="admin-btn admin-btn-secondary" disabled={disabled || uploading} onClick={pickFile}>
            {uploading ? "Uploading…" : displayUrl ? "Change logo" : "Upload logo"}
          </button>
          {displayUrl || storageKey ?
            <button type="button" className="admin-btn admin-btn-secondary" disabled={disabled || uploading} onClick={removeImage}>
              Remove
            </button>
          : null}
        </div>
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
              <h3>Brand logo</h3>
              <button type="button" className="ledger-modal-close" onClick={closeCrop} aria-label="Close">
                ×
              </button>
            </div>
            <div className="inv-product-crop-options">
              <label className="inv-product-crop-toggle">
                <input type="checkbox" checked={useCrop} onChange={(e) => setUseCrop(e.target.checked)} />
                <span>Crop image (square)</span>
              </label>
            </div>
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
                {uploading ? "Saving…" : "Use logo"}
              </button>
            </div>
          </div>
        </div>
      : null}
    </div>
  );
}
