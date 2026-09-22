"use client";

import Swal from "sweetalert2";

const swalDefaults = {
  confirmButtonColor: "#111318",
  cancelButtonColor: "#878d9a",
  heightAuto: false,
  /** Above ledger add modal (.admin-modal z-index 9999) */
  zIndex: 10050,
};

export function showError(message, title = "Error") {
  if (!message) return Promise.resolve();
  return Swal.fire({
    ...swalDefaults,
    icon: "error",
    title,
    text: message,
  });
}

export function showSuccess(message, title = "Done") {
  if (!message) return Promise.resolve();
  return Swal.fire({
    ...swalDefaults,
    icon: "success",
    title,
    text: message,
    timer: 2200,
    timerProgressBar: true,
    showConfirmButton: false,
  });
}

export function showInfo(message, title = "Notice") {
  if (!message) return Promise.resolve();
  return Swal.fire({
    ...swalDefaults,
    icon: "info",
    title,
    text: message,
  });
}

export async function confirmAction({
  title = "Are you sure?",
  text = "",
  confirmText = "Yes",
  cancelText = "Cancel",
  icon = "warning",
} = {}) {
  const result = await Swal.fire({
    ...swalDefaults,
    icon,
    title,
    text,
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: cancelText,
    reverseButtons: true,
  });
  return result.isConfirmed;
}
