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

const PHOTO_SOURCES = [
  { id: "camera-crop", label: "Take photo · crop", hint: "Camera, square crop", camera: true, crop: true },
  { id: "camera-full", label: "Take photo · no crop", hint: "Camera, full frame", camera: true, crop: false },
  { id: "gallery-crop", label: "Choose file · crop", hint: "Gallery, square crop", camera: false, crop: true },
  { id: "gallery-full", label: "Choose file · no crop", hint: "Gallery, full image", camera: false, crop: false },
];

export default function ProductImageUpload({
  productId = null,
  stagingToken,
  storageKey,
  previewUrl,
  onChange,
  disabled = false,
}) {
  const cameraRef = useRef(null);
  const galleryRef = useRef(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickIntent, setPickIntent] = useState(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [cropSrc, setCropSrc] = useState("");
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [pendingFile, setPendingFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [savedBytes, setSavedBytes] = useState(null);

  const displayUrl = previewUrl ? productImageSrc(previewUrl) : "";

  const onCropComplete = useCallback((_area, pixels) => {
    setCroppedAreaPixels(pixels);
  }, []);

  function openPicker() {
    if (disabled || uploading) return;
    setPickerOpen(true);
  }

  function closePicker() {
    setPickerOpen(false);
  }

  function startPick(option) {
    setPickIntent({ crop: option.crop });
    closePicker();
    if (option.camera) cameraRef.current?.click();
    else galleryRef.current?.click();
  }

  function onFileSelected(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    const intent = pickIntent;
    setPickIntent(null);
    if (!file) return;

    setError("");
    if (intent?.crop) {
      setPendingFile(file);
      const url = URL.createObjectURL(file);
      setCropSrc(url);
      setCropOpen(true);
      setZoom(1);
      setCrop({ x: 0, y: 0 });
      return;
    }

    void uploadBlob(file, null, true);
  }

  function closeCrop() {
    setCropOpen(false);
    if (cropSrc.startsWith("blob:")) URL.revokeObjectURL(cropSrc);
    setCropSrc("");
    setPendingFile(null);
  }

  async function uploadBlob(blob, cropPayload, skipCrop) {
    setUploading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", blob, "photo.jpg");
      if (productId) form.append("product_id", String(productId));
      else if (stagingToken) form.append("staging_token", stagingToken);
      if (skipCrop) form.append("skip_crop", "1");
      else if (cropPayload) form.append("crop", JSON.stringify(cropPayload));

      const res = await fetch(apiUrl("/api/admin/inventory/products/image"), {
        method: "POST",
        credentials: "include",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Upload failed.");
        return;
      }
      onChange?.({
        storage_key: data.storage_key,
        url: data.url,
        cleared: false,
      });
      if (Number.isFinite(data.bytes) && data.bytes > 0) {
        setSavedBytes(data.bytes);
      }
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
      if (croppedAreaPixels) {
        const blob = await cropImageToBlob(cropSrc, croppedAreaPixels);
        await uploadBlob(blob, null, true);
      } else {
        await uploadBlob(pendingFile, null, true);
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
        <span className="inv-product-image-upload-label">Product photo</span>
        <span className="admin-muted">
          {savedBytes ?
            `Saved on server: ${savedBytes < 1024 ? `${savedBytes} B` : `${Math.round(savedBytes / 1024)} KB`} (WebP)`
          : "Compressed WebP on save — target under 200 KB"}
        </span>
      </div>

      <div className="inv-product-image-upload-row">
        {displayUrl ?
          <img src={displayUrl} alt="" className="inv-product-image-preview" />
        : <div className="inv-product-image-preview is-empty">No photo</div>}

        <div className="inv-product-image-upload-actions">
          <button
            type="button"
            className="admin-btn admin-btn-secondary"
            disabled={disabled || uploading}
            onClick={openPicker}
          >
            {uploading ? "Uploading…" : displayUrl ? "Change photo" : "Add photo"}
          </button>
          {displayUrl || storageKey ?
            <button
              type="button"
              className="admin-btn admin-btn-secondary"
              disabled={disabled || uploading}
              onClick={removeImage}
            >
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

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="inv-product-image-file"
        onChange={onFileSelected}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        className="inv-product-image-file"
        onChange={onFileSelected}
      />

      {pickerOpen ?
        <div className="admin-modal inv-product-source-modal" role="dialog" aria-modal="true" aria-label="Photo source">
          <button type="button" className="admin-modal-backdrop" aria-label="Close" onClick={closePicker} />
          <div className="admin-modal-card inv-product-source-card">
            <div className="admin-modal-head">
              <h3>Product photo</h3>
              <button type="button" className="ledger-modal-close" onClick={closePicker} aria-label="Close">
                ×
              </button>
            </div>
            <p className="inv-product-source-lead">Pick how to add the image. All options save as compressed WebP.</p>
            <div className="inv-product-source-grid">
              {PHOTO_SOURCES.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className="inv-product-source-option"
                  disabled={uploading}
                  onClick={() => startPick(opt)}
                >
                  <span className={`inv-product-source-icon is-${opt.id}`} aria-hidden />
                  <span className="inv-product-source-copy">
                    <strong>{opt.label}</strong>
                    <small>{opt.hint}</small>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      : null}

      {cropOpen ?
        <div className="admin-modal inv-product-crop-modal" role="dialog" aria-modal="true">
          <button type="button" className="admin-modal-backdrop" aria-label="Close" onClick={closeCrop} />
          <div className="admin-modal-card inv-product-crop-card">
            <div className="admin-modal-head">
              <h3>Crop photo</h3>
              <button type="button" className="ledger-modal-close" onClick={closeCrop} aria-label="Close">
                ×
              </button>
            </div>
            <p className="admin-muted inv-product-crop-lead">Drag to frame the product. Saved as compressed WebP.</p>
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
            <label className="inv-product-crop-zoom">
              <span>Zoom</span>
              <input
                type="range"
                min="1"
                max="3"
                step="0.05"
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
              />
            </label>
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
