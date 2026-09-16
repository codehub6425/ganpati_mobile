"use client";

import { useEffect, useId, useRef, useState } from "react";
import { apiUrl, assetUrl } from "@/lib/basePath";
import { showError } from "@/lib/swal";

const BRANDS = [
  "Apple",
  "Samsung",
  "Xiaomi",
  "Vivo",
  "Oppo",
  "Realme",
  "OnePlus",
  "Motorola",
  "Other",
];

const PROBLEMS = [
  {
    value: "Screen",
    hint: "Cracked or dead display",
    icon: (
      <svg viewBox="0 0 24 24" fill="none">
        <rect x="7" y="3" width="10" height="18" rx="2" stroke="currentColor" strokeWidth="1.8" />
        <path d="M9 8l6 8M15 8l-6 8" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    ),
  },
  {
    value: "Battery",
    hint: "Drains fast or won't hold",
    icon: (
      <svg viewBox="0 0 24 24" fill="none">
        <rect x="3" y="8" width="16" height="8" rx="2" stroke="currentColor" strokeWidth="1.8" />
        <path d="M19 11h2v2h-2M7 10v4" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    ),
  },
  {
    value: "Charging",
    hint: "Port, cable or no power",
    icon: (
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M13 2L6 14h6l-1 8 7-12h-6l1-8z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    value: "Speaker/Mic",
    label: "Speaker / Mic",
    hint: "No sound or can't hear you",
    icon: (
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M4 10v4h4l5 4V6L8 10H4z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M16 9a4 4 0 010 6" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    ),
  },
  {
    value: "Camera",
    hint: "Blurry, black or cracked",
    icon: (
      <svg viewBox="0 0 24 24" fill="none">
        <rect x="3" y="6" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="12" cy="12.5" r="3.2" stroke="currentColor" strokeWidth="1.8" />
        <path d="M8 6l1.4-2h5.2L16 6" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    ),
  },
  {
    value: "Software",
    hint: "Hang, update or unlock",
    icon: (
      <svg viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
        <path d="M12 8v4l2.5 2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    value: "Other",
    hint: "Tell us in the note below",
    icon: (
      <svg viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
        <path d="M12 8v5M12 16.5h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  },
];

const empty = { name: "", phone: "", brand: "", problem: "", note: "" };

const SHOP_MOBILE = "9782932128";
const SHOP_TEL = `+91${SHOP_MOBILE}`;
const SHOP_TEL_LABEL = "+91 97829 32128";
const SHOP_WA = `91${SHOP_MOBILE}`;

function whatsappHref(text) {
  return `https://wa.me/${SHOP_WA}?text=${encodeURIComponent(text)}`;
}

function repairWhatsappMessage({ brand = "", problem = "", name = "", note = "" } = {}) {
  const lines = ["Hi Ganpati Mobile Point,"];
  if (problem) lines.push(`I need help with ${problem.toLowerCase()} repair.`);
  else lines.push("I need a phone repair.");
  if (brand) lines.push(`Brand: ${brand}.`);
  if (note) lines.push(`Details: ${note}.`);
  if (name) lines.push(`My name is ${name}.`);
  lines.push("Please share the price and time. Thank you.");
  return lines.join(" ");
}

function validateForm(values) {
  const errors = {};
  const name = String(values.name || "").trim();
  const phone = String(values.phone || "").replace(/\D/g, "");

  if (name.length < 2) errors.name = "Please enter your name.";
  if (!/^[6-9]\d{9}$/.test(phone)) {
    errors.phone = "Enter a valid 10-digit Indian mobile number.";
  }
  if (!values.brand) errors.brand = "Please select your phone brand.";
  if (!values.problem) errors.problem = "Please choose the problem type.";
  return errors;
}

function readLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  });
}

export default function RepairForm() {
  const formId = useId();
  const nameRef = useRef(null);
  const phoneRef = useRef(null);
  const brandRef = useRef(null);
  const problemRef = useRef(null);
  const scrollTimerRef = useRef(null);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const [values, setValues] = useState(empty);
  const [errors, setErrors] = useState({});
  const [focusTick, setFocusTick] = useState(0);
  const [saved, setSaved] = useState(null);
  const [busy, setBusy] = useState(false);
  const [location, setLocation] = useState(null);
  const [locationNote, setLocationNote] = useState("Asking for location to estimate distance to the shop...");

  useEffect(() => {
    let active = true;
    readLocation().then((coords) => {
      if (!active) return;
      if (coords) {
        setLocation(coords);
        setLocationNote("Location ready. We will show distance to the shop.");
      } else {
        setLocationNote("Location not shared. You can still submit the form.");
      }
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (saved) return undefined;
    const vv = window.visualViewport;
    if (!vv) return undefined;

    function syncViewport() {
      const inset = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
      setKeyboardInset(inset);
      document.documentElement.style.setProperty("--keyboard-inset", `${inset}px`);
    }

    syncViewport();
    vv.addEventListener("resize", syncViewport);
    vv.addEventListener("scroll", syncViewport);
    window.addEventListener("orientationchange", syncViewport);

    return () => {
      vv.removeEventListener("resize", syncViewport);
      vv.removeEventListener("scroll", syncViewport);
      window.removeEventListener("orientationchange", syncViewport);
      document.documentElement.style.removeProperty("--keyboard-inset");
    };
  }, [saved]);

  function scrollInputIntoView(el) {
    if (!el || typeof el.getBoundingClientRect !== "function") return;
    const vv = window.visualViewport;
    const rect = el.getBoundingClientRect();
    const inset =
      vv != null ? Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)) : keyboardInset;
    const stickyReserve = inset > 40 ? 118 : 200;
    const topPad = (vv?.offsetTop ?? 0) + 12;
    const visibleBottom = (vv?.height ?? window.innerHeight) + (vv?.offsetTop ?? 0) - stickyReserve;

    if (rect.top < topPad || rect.bottom > visibleBottom) {
      const nextTop = window.scrollY + rect.top - topPad - 8;
      window.scrollTo({ top: Math.max(0, nextTop), behavior: "smooth" });
    }
  }

  function handleFormFocusIn(event) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (!target.matches("input, textarea, select")) return;
    if (!target.closest(".repair-callback-form")) return;

    if (scrollTimerRef.current) window.clearTimeout(scrollTimerRef.current);
    scrollTimerRef.current = window.setTimeout(() => scrollInputIntoView(target), 350);
  }

  function update(name, value) {
    setValues((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
  }

  function scrollToField(node) {
    const block = node?.closest?.(".field, fieldset.chips-field") || node;
    block?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function focusFirstError(nextErrors) {
    const steps = [
      {
        key: "name",
        node: () => nameRef.current,
        focus: () => nameRef.current?.focus({ preventScroll: true }),
      },
      {
        key: "phone",
        node: () => phoneRef.current,
        focus: () => phoneRef.current?.focus({ preventScroll: true }),
      },
      {
        key: "brand",
        node: () => brandRef.current,
        focus: () => brandRef.current?.querySelector("input")?.focus(),
      },
      {
        key: "problem",
        node: () => problemRef.current,
        focus: () => problemRef.current?.querySelector("input")?.focus(),
      },
    ];

    const target = steps.find((step) => nextErrors[step.key]);
    const node = target?.node?.();
    if (!node) return;

    scrollToField(node);
    window.setTimeout(() => {
      target.focus();
      setFocusTick((n) => n + 1);
    }, 280);
  }

  async function onSubmit(event) {
    event.preventDefault();
    const nextErrors = validateForm(values);
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      focusFirstError(nextErrors);
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const coords = location || (await readLocation());
      if (coords) {
        setLocation(coords);
        setLocationNote("Location ready. We will show distance to the shop.");
      }
      const response = await fetch(apiUrl("/api/leads"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, ...(coords || {}) }),
      });
      const data = await response.json();
      if (!response.ok) {
        setErrors(data.errors || {});
        showError(data.message || "Could not submit your request. Please check the form.");
        return;
      }
      setSaved(data.lead);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      showError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const extra = saved?.note ? ` · ${saved.note}` : "";
  const selectedWhatsapp = whatsappHref(
    repairWhatsappMessage({
      brand: values.brand,
      problem: values.problem,
      name: values.name,
      note: values.note,
    })
  );
  const savedWhatsapp = saved
    ? whatsappHref(
        repairWhatsappMessage({
          brand: saved.brand,
          problem: saved.problem,
          name: saved.name,
          note: saved.note,
        })
      )
    : whatsappHref(repairWhatsappMessage());

  return (
    <>
      <div className="page-bg" aria-hidden="true" />
      <header className="site-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            G
          </span>
          <div>
            <p className="brand-name">Ganpati Mobile Point</p>
            <p className="brand-tag">Your mobile care partner</p>
          </div>
        </div>
        <div className="header-actions">
          <a className="wa-now" href={whatsappHref(repairWhatsappMessage())} target="_blank" rel="noopener noreferrer">
            WhatsApp
          </a>
          <a className="call-now" href={`tel:${SHOP_TEL}`}>
            Call now
          </a>
        </div>
      </header>

      <main className="page">
        <div className="hero-phones" aria-hidden="true" />
        <section className="hero">
          <p className="eyebrow">Jaipur · Broken today, fixed tomorrow</p>
          <h1>
            Phone problem? <span>Don't worry.</span> We'll fix it.
          </h1>
          <p className="hero-copy">
            Scan done. Pick your brand and problem — we will call you back. Or tap a problem to WhatsApp us with the message already filled.
          </p>
          <div className="wa-quick" aria-label="WhatsApp a repair request">
            {PROBLEMS.filter((item) => item.value !== "Other").map((item) => (
              <a
                key={item.value}
                className="wa-quick-link"
                href={whatsappHref(
                  repairWhatsappMessage({
                    brand: values.brand,
                    problem: item.label || item.value,
                  })
                )}
                target="_blank"
                rel="noopener noreferrer"
              >
                {item.label || item.value}
              </a>
            ))}
          </div>
        </section>

        <div className="layout">
          <div className="layout-main">
            {!saved ? (
              <section className="panel form-panel" aria-labelledby="form-title">
                <div className="panel-head">
                  <div className="form-head-row">
                    <p className="step-pill">Takes 20 seconds</p>
                    <p className="form-kicker">Repair form</p>
                  </div>
                  <h2 id="form-title">Request a callback</h2>
                  <p className="panel-lead">No login. We call you with a price and time.</p>
                  <p className="form-mobile-hint">
                    Fill name and mobile first. The submit button stays above your keyboard while typing.
                  </p>
                </div>

                <form
                  id={formId}
                  className="repair-callback-form"
                  onSubmit={onSubmit}
                  onFocusCapture={handleFormFocusIn}
                  noValidate
                >
                  <div className="field-row">
                    <label
                      className={`field${errors.name ? " is-invalid is-highlight" : ""}`}
                      data-focus={focusTick && errors.name ? "1" : undefined}
                    >
                      <span>Your name</span>
                      <input
                        ref={nameRef}
                        name="name"
                        type="text"
                        autoComplete="name"
                        maxLength={60}
                        placeholder="e.g. Rahul Sharma"
                        value={values.name}
                        onChange={(e) => update("name", e.target.value)}
                        aria-invalid={Boolean(errors.name)}
                      />
                      <small className="error">{errors.name || ""}</small>
                    </label>

                    <label
                      className={`field${errors.phone ? " is-invalid is-highlight" : ""}`}
                      data-focus={focusTick && errors.phone ? "1" : undefined}
                    >
                      <span>Mobile number</span>
                      <span className="phone-wrap">
                        <span className="phone-prefix">+91</span>
                        <input
                          ref={phoneRef}
                          name="phone"
                          type="tel"
                          inputMode="numeric"
                          autoComplete="tel"
                          maxLength={10}
                          placeholder="10-digit mobile number"
                          value={values.phone}
                          onChange={(e) =>
                            update("phone", e.target.value.replace(/\D/g, "").slice(0, 10))
                          }
                          aria-invalid={Boolean(errors.phone)}
                        />
                      </span>
                      <small className="error">{errors.phone || ""}</small>
                    </label>
                  </div>

                  <fieldset
                    ref={brandRef}
                    className={`field chips-field${errors.brand ? " is-invalid is-highlight" : ""}`}
                    data-focus={focusTick && errors.brand ? "1" : undefined}
                  >
                    <legend>Select your phone brand</legend>
                    <div className="choice-grid brand-grid" role="radiogroup" aria-label="Phone brand">
                      {BRANDS.map((brand) => (
                        <label className="choice" key={brand}>
                          <input
                            type="radio"
                            name="brand"
                            value={brand}
                            checked={values.brand === brand}
                            onChange={() => update("brand", brand)}
                          />
                          <span>
                            <b>{brand}</b>
                          </span>
                        </label>
                      ))}
                    </div>
                    <small className="error">{errors.brand || ""}</small>
                  </fieldset>

                  <fieldset
                    ref={problemRef}
                    className={`field chips-field${errors.problem ? " is-invalid is-highlight" : ""}`}
                    data-focus={focusTick && errors.problem ? "1" : undefined}
                  >
                    <legend>What is the problem?</legend>
                    <div className="choice-grid problem-grid" role="radiogroup" aria-label="Problem type">
                      {PROBLEMS.map((item) => (
                        <label className="choice problem" key={item.value}>
                          <input
                            type="radio"
                            name="problem"
                            value={item.value}
                            checked={values.problem === item.value}
                            onChange={() => update("problem", item.value)}
                          />
                          <span>
                            <i aria-hidden="true">{item.icon}</i>
                            <b>{item.label || item.value}</b>
                            <small>{item.hint}</small>
                          </span>
                        </label>
                      ))}
                    </div>
                    <small className="error">{errors.problem || ""}</small>
                  </fieldset>

                  <label className="field">
                    <span>
                      Phone model or extra detail <em>(optional)</em>
                    </span>
                    <input
                      name="note"
                      type="text"
                      maxLength={120}
                      placeholder="e.g. iPhone 13, glass cracked yesterday"
                      value={values.note}
                      onChange={(e) => update("note", e.target.value)}
                    />
                  </label>

                  <p className="location-note">{locationNote}</p>

                  <div className="form-actions-inline">
                    <button className="submit pulse" type="submit" disabled={busy}>
                      {busy ? "Sending..." : "Request a callback"}
                    </button>
                    <a
                      className="submit ghost wa-form-btn"
                      href={selectedWhatsapp}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      WhatsApp this request
                    </a>
                  </div>
                </form>
              </section>
            ) : (
              <section className="panel thanks">
                <div className="thanks-icon" aria-hidden="true">
                  ✓
                </div>
                <h2>Thank you</h2>
                <p className="panel-lead">
                  We have your request. Our team will call you shortly.
                </p>
                <p className="thanks-summary">
                  {saved.name} · {saved.phone} · {saved.brand} · {saved.problem}
                  {extra}
                </p>
                <div className="thanks-actions">
                  <a className="submit" href={`tel:${SHOP_TEL}`}>
                    Call the shop
                  </a>
                  <a className="submit ghost" href={savedWhatsapp} target="_blank" rel="noopener noreferrer">
                    WhatsApp
                  </a>
                </div>
                <p className="thanks-offer">
                  Your Rs 100 off offer is saved with this request.
                </p>
              </section>
            )}
          </div>

          <aside className="promo" aria-label="Offers and shop highlights">
            <article className="promo-card offer-card">
              <p className="promo-kicker">QR customer offer</p>
              <p className="promo-price">Rs 100 off</p>
              <p>Auto-applied on this repair request. No coupon code needed.</p>
            </article>

            <article className="promo-card">
              <p className="promo-kicker">Why people come here</p>
              <ul className="promo-list">
                <li>
                  <strong>1-hour repair</strong>
                  <span>Selected jobs finished the same visit.</span>
                </li>
                <li>
                  <strong>Genuine parts</strong>
                  <span>Quality screens, batteries and charging ports.</span>
                </li>
                <li>
                  <strong>All popular brands</strong>
                  <span>Apple, Samsung, Xiaomi, Vivo, Oppo and more.</span>
                </li>
                <li>
                  <strong>1000+ customers</strong>
                  <span>Trusted neighbourhood service in Nirman Nagar.</span>
                </li>
              </ul>
            </article>

            <article className="promo-card">
              <p className="promo-kicker">How it works</p>
              <ol className="steps">
                <li>
                  <b>1</b> Fill this short form
                </li>
                <li>
                  <b>2</b> We call you back
                </li>
                <li>
                  <b>3</b> Bring the phone and get it fixed
                </li>
              </ol>
            </article>
          </aside>
        </div>
      </main>

      {!saved ? (
        <div
          className={`form-sticky-wrap${keyboardInset > 40 ? " is-keyboard-open" : ""}`}
          style={keyboardInset > 0 ? { bottom: `${keyboardInset}px` } : undefined}
          role="region"
          aria-label="Send repair request"
        >
          {keyboardInset > 40 ? (
            <p className="form-sticky-keyboard-hint">Request a callback is right here ↑</p>
          ) : null}
          <div className="form-sticky-guide" aria-hidden="true">
            <img
              className="form-sticky-mascot"
              src={assetUrl("/images/form-guide-mascot.png")}
              alt=""
              width={120}
              height={160}
              loading="lazy"
              decoding="async"
            />
            <span className="form-sticky-pointer">Tap here</span>
          </div>
          <div className="form-sticky-bar">
            <p className="form-sticky-label">Send your request</p>
            <button className="submit pulse" type="submit" form={formId} disabled={busy}>
              {busy ? "Sending..." : "Request a callback"}
            </button>
            <a
              className="submit ghost wa-form-btn form-sticky-wa"
              href={selectedWhatsapp}
              target="_blank"
              rel="noopener noreferrer"
            >
              WhatsApp this request
            </a>
          </div>
        </div>
      ) : null}

      <footer className="site-footer">
        <p className="footer-name">Ganpati Mobile Point</p>
        <p>Nirman Nagar, Jaipur, Rajasthan 302019</p>
        <p className="footer-links">
          <a href={`tel:${SHOP_TEL}`}>{SHOP_TEL_LABEL}</a>
          <a href={whatsappHref(repairWhatsappMessage())} target="_blank" rel="noopener noreferrer">
            Chat on WhatsApp
          </a>
        </p>
      </footer>
    </>
  );
}
