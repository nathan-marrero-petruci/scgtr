const resolveApiBase = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl) {
    const configured = envUrl.replace(/\/+$/, "");
    return /\/api$/i.test(configured) ? configured : `${configured}/api`;
  }
  try {
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1")
      return "http://localhost:5151/api";
  } catch {}
  return "/api";
};

const API_BASE = resolveApiBase();

const authHeader = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const loadStatus = async () => {
  const res = await fetch(`${API_BASE}/subscriptions/status`, {
    headers: { ...authHeader(), "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error("Erro ao carregar status da assinatura.");
  return res.json();
};

export const startCheckout = async (priceId) => {
  const res = await fetch(`${API_BASE}/subscriptions/checkout`, {
    method: "POST",
    headers: { ...authHeader(), "Content-Type": "application/json" },
    body: JSON.stringify({ priceId }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || "Erro ao iniciar pagamento.");
  }
  const { url } = await res.json();
  window.location.href = url;
};

export const openPortal = async () => {
  const res = await fetch(`${API_BASE}/subscriptions/portal`, {
    method: "POST",
    headers: { ...authHeader(), "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || "Erro ao abrir portal.");
  }
  const { url } = await res.json();
  window.location.href = url;
};

export const isSubscriptionActive = (status, trialEndsAt) => {
  if (status === "active") return true;
  if (status === "trialing") return new Date(trialEndsAt) > new Date();
  return false;
};

export const trialDaysRemaining = (trialEndsAt) => {
  const diff = new Date(trialEndsAt) - new Date();
  return Math.max(0, Math.ceil(diff / 86400000));
};
