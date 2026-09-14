const STORAGE_KEY = "gmp-repair-request";

const form = document.getElementById("repair-form");
const formPanel = document.getElementById("form-panel");
const thanksPanel = document.getElementById("thanks-panel");
const thanksSummary = document.getElementById("thanks-summary");

function clearErrors() {
  document.querySelectorAll(".error").forEach((el) => {
    el.textContent = "";
  });
  document.querySelectorAll(".field").forEach((el) => {
    el.classList.remove("is-invalid");
  });
}

function setError(name, message) {
  const errorEl = document.querySelector(`[data-error-for="${name}"]`);
  if (errorEl) {
    errorEl.textContent = message;
  }

  const field = errorEl?.closest(".field");
  if (field) {
    field.classList.add("is-invalid");
  }
}

function getFormData() {
  const data = new FormData(form);
  return {
    name: String(data.get("name") || "").trim(),
    phone: String(data.get("phone") || "").replace(/\D/g, ""),
    brand: String(data.get("brand") || "").trim(),
    problem: String(data.get("problem") || "").trim(),
    note: String(data.get("note") || "").trim(),
  };
}

function validate(values) {
  clearErrors();
  let valid = true;

  if (values.name.length < 2) {
    setError("name", "Please enter your name.");
    valid = false;
  }

  if (!/^[6-9]\d{9}$/.test(values.phone)) {
    setError("phone", "Enter a valid 10-digit Indian mobile number.");
    valid = false;
  }

  if (!values.brand) {
    setError("brand", "Please select your phone brand.");
    valid = false;
  }

  if (!values.problem) {
    setError("problem", "Please choose the problem type.");
    valid = false;
  }

  return valid;
}

function showThanks(values) {
  const extra = values.note ? ` · ${values.note}` : "";
  thanksSummary.textContent = `${values.name} · ${values.phone} · ${values.brand} · ${values.problem}${extra}`;
  formPanel.hidden = true;
  thanksPanel.hidden = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function restoreIfSubmitted() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (saved?.name && saved?.phone && saved?.brand && saved?.problem) {
      showThanks(saved);
    }
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const values = getFormData();
  if (!validate(values)) {
    form.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
  showThanks(values);
});

form.querySelectorAll('input[name="brand"], input[name="problem"]').forEach((input) => {
  input.addEventListener("change", () => {
    const key = input.name;
    const errorEl = document.querySelector(`[data-error-for="${key}"]`);
    if (errorEl) {
      errorEl.textContent = "";
    }
    errorEl?.closest(".field")?.classList.remove("is-invalid");
  });
});

document.getElementById("phone").addEventListener("input", (event) => {
  event.target.value = event.target.value.replace(/\D/g, "").slice(0, 10);
});

restoreIfSubmitted();
