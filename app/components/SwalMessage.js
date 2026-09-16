"use client";

import { useEffect, useRef } from "react";
import { showError, showInfo, showSuccess } from "@/lib/swal";

const handlers = {
  error: showError,
  success: showSuccess,
  info: showInfo,
};

export default function SwalMessage({ message, type = "error", title }) {
  const last = useRef("");

  useEffect(() => {
    const text = String(message || "").trim();
    if (!text || text === last.current) return;
    last.current = text;
    const fn = handlers[type] || showError;
    fn(text, title);
  }, [message, type, title]);

  return null;
}
