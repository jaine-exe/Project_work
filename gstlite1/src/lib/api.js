// Shared client for talking to the FastAPI backend.
// Every page should import from here instead of writing its own fetch logic —
// keeps the base URL, token handling, and error shape consistent everywhere.

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
const TOKEN_KEY = "gstlite_token";

export function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

/**
 * Core fetch wrapper. Adds the API base URL, JSON headers, and the auth
 * token (if present). Throws ApiError on non-2xx responses so callers can
 * catch a single error type.
 */
async function request(path, { method = "GET", body, isForm = false, auth = true } = {}) {
  const headers = {};
  if (!isForm) headers["Content-Type"] = "application/json";
  if (auth) {
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    // no JSON body (e.g. 204) — fine
  }

  if (!res.ok) {
    const message = data?.detail || `Request failed (${res.status})`;
    throw new ApiError(typeof message === "string" ? message : JSON.stringify(message), res.status);
  }

  return data;
}

// ---- Auth ----
export const auth = {
  login: (email, password) =>
    request("/api/auth/login-json", { method: "POST", body: { email, password }, auth: false }),
  register: (payload) =>
    request("/api/auth/register", { method: "POST", body: payload, auth: false }),
  me: () => request("/api/auth/me"),
};

// ---- Invoices ----
export const invoices = {
  upload: (file, documentType = "purchase") => {
    const form = new FormData();
    form.append("file", file);
    form.append("document_type", documentType);
    return request("/api/invoices", { method: "POST", body: form, isForm: true });
  },
  list: (period) => request(`/api/invoices${period ? `?period=${period}` : ""}`),
  get: (id) => request(`/api/invoices/${id}`),
  update: (id, payload) => request(`/api/invoices/${id}`, { method: "PATCH", body: payload }),
  getFileBlob: async (id) => {
    const token = getToken();
    const headers = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(`${API_BASE}/api/invoices/${id}/file`, { headers });
    if (!res.ok) throw new Error("Could not load invoice file");
    return await res.blob();
  },
};

// ---- Compliance ----
export const compliance = {
  issues: (severity) =>
    request(`/api/compliance/issues${severity && severity !== "all" ? `?severity=${severity}` : ""}`),
  readiness: () => request("/api/compliance/readiness"),
  reconciliation: (period) =>
    request(`/api/compliance/gstr2b/reconciliation${period ? `?period=${period}` : ""}`),
  upload2b: (file, period = "2026-07") => {
    const form = new FormData();
    form.append("file", file);
    form.append("period", period);
    return request("/api/compliance/gstr2b/upload", { method: "POST", body: form, isForm: true });
  },
  seedDemo2b: (period = "2026-07") => {
    const form = new FormData();
    form.append("period", period);
    return request("/api/compliance/gstr2b/demo", { method: "POST", body: form, isForm: true });
  },
};

// ---- GST ----
export const gst = {
  periods: () => request("/api/gst/periods"),
  summary: (period) => request(`/api/gst/summary${period ? `?period=${period}` : ""}`),
  generateReturn: (period, returnType = "GSTR-3B") =>
    request("/api/gst/returns/generate", {
      method: "POST",
      body: { period, return_type: returnType },
    }),
  fileReturn: (returnId) => request(`/api/gst/returns/${returnId}/file`, { method: "POST" }),
  downloadSummaryPdf: async (period = "2026-08") => {
    const token = getToken();
    const headers = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE}/api/gst/summary/export-pdf?period=${period}`, {
      headers,
    });
    if (!res.ok) {
      throw new Error(`Failed to download PDF (${res.status})`);
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `GST_Summary_${period}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  },
};

// ---- Chat ----
export const chat = {
  history: () => request("/api/chat/history"),
  ask: (message, invoiceId) =>
    request("/api/chat/ask", { method: "POST", body: { message, invoice_id: invoiceId ?? null } }),
  clear: () => request("/api/chat/history", { method: "DELETE" }),
};

export { API_BASE };
