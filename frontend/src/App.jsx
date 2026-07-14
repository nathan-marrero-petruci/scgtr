import { useEffect, useState, useCallback } from "react";
import "./App.css";
import { HistoricoChart } from "./Charts";
import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./components/Login";
import Register from "./components/Register";
import HelpTab from "./components/HelpTab";
import Paywall from "./components/Paywall";
import Subscription from "./components/Subscription";
import authService from "./services/auth";
import { isSubscriptionActive, trialDaysRemaining } from "./services/subscription";

// ─── API ────────────────────────────────────────────────────────────────────

const resolveApiBase = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl) {
    const configured = envUrl.replace(/\/+$/, "");
    return /\/api$/i.test(configured) ? configured : `${configured}/api`;
  }
  try {
    const host = typeof window !== "undefined" ? window.location.hostname : "";
    if (host === "localhost" || host === "127.0.0.1")
      return "http://localhost:5151/api";
  } catch (e) {
    /* ignore */
  }
  return import.meta.env.VITE_API_URL || "/api";
};

const API_BASE = resolveApiBase();

const request = async (path, options = {}) => {
  const token = localStorage.getItem("token");

  const headers = {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE}${path}`, {
    headers,
    ...options,
  });

  if (response.status === 401) {
    authService.logout();
    window.location.reload();
    throw new Error("Sessão expirada. Faça login novamente.");
  }

  if (response.status === 402) {
    localStorage.removeItem("subscription");
    window.dispatchEvent(new CustomEvent("subscription-required"));
    throw new Error("Assinatura necessária.");
  }

  if (!response.ok) {
    const text = await response.text();
    try {
      const json = JSON.parse(text);
      const msg =
        json.detail || json.title || json.error || JSON.stringify(json);
      throw new Error(msg);
    } catch (parseErr) {
      if (parseErr instanceof SyntaxError) {
        throw new Error(text || "Erro ao processar requisição");
      }
      throw parseErr;
    }
  }
  if (response.status === 204) return null;
  return response.json();
};

// ─── Helpers ────────────────────────────────────────────────────────────────

const fmt = (value) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number(value ?? 0)
  );

const fmtDate = (dateStr) => {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
};

const fmtDateShort = (dateStr) => {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  const currentYear = new Date().getFullYear().toString();
  return y === currentYear ? `${d}/${m}` : `${d}/${m}/${y}`;
};

const WEEKDAY_FULL = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
];

const getDateLabel = (dateStr) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((date - today) / 86400000);
  const dayName = WEEKDAY_FULL[date.getDay()];
  const formatted = `${String(d).padStart(2, "0")}/${String(m).padStart(
    2,
    "0"
  )}`;

  if (diffDays < 0)
    return {
      date: `${dayName}, ${formatted}`,
      label: "ATRASADO",
      type: "overdue",
    };
  if (diffDays === 0)
    return { date: `${dayName}, ${formatted}`, label: "Hoje", type: "soon" };
  if (diffDays === 1)
    return { date: `${dayName}, ${formatted}`, label: "Amanhã", type: "soon" };
  if (diffDays <= 7)
    return {
      date: `${dayName}, ${formatted}`,
      label: `em ${diffDays} dias`,
      type: "soon",
    };
  return {
    date: `${dayName}, ${formatted}`,
    label: `em ${diffDays} dias`,
    type: "normal",
  };
};

const todayStr = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const addDays = (dateStr, days) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d + days);
  return date.toISOString().slice(0, 10);
};

const scheduleLabel = (schedule) => {
  if (!schedule) return "Sem agendamento";
  if (schedule.frequency === "weekly") {
    const payDay = WEEKDAY_FULL[schedule.weekday] ?? "?";
    const startDay =
      schedule.weekStartDay != null
        ? WEEKDAY_FULL[schedule.weekStartDay]
        : null;
    if (startDay)
      return `Semanal • Paga na ${payDay} • Semana começa ${startDay}`;
    return `Semanal • Paga na ${payDay}`;
  }
  if (schedule.frequency === "quinzena") {
    const secondDay = schedule.secondDayOfMonth ?? "fim do mês";
    return `Quinzenal • Dia ${schedule.dayOfMonth} e ${secondDay}`;
  }
  return schedule.frequency;
};

// ─── Icons ──────────────────────────────────────────────────────────────────

const IconAgenda = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const IconRegister = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="16" />
    <line x1="8" y1="12" x2="16" y2="12" />
  </svg>
);

const IconHistory = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);

const IconHelp = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10" />
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const IconConta = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
);

// ─── App ────────────────────────────────────────────────────────────────────

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("agenda");
  const [theme, setTheme] = useState(
    () => localStorage.getItem("theme") || "light"
  );
  const [carriers, setCarriers] = useState([]);
  const [error, setError] = useState("");
  const [agendaRefreshKey, setAgendaRefreshKey] = useState(0);
  const [subscription, setSubscription] = useState(() => {
    const sub = localStorage.getItem("subscription");
    return sub ? JSON.parse(sub) : null;
  });
  const [subscriptionLoading, setSubscriptionLoading] = useState(() => {
    return !!localStorage.getItem("token") && !localStorage.getItem("subscription");
  });

  // Verificar autenticação ao iniciar
  useEffect(() => {
    const checkAuth = () => {
      const authenticated = authService.isAuthenticated();
      setIsAuthenticated(authenticated);
      if (!authenticated) setSubscriptionLoading(false);
      setLoading(false);
    };
    checkAuth();
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    const token = localStorage.getItem("token");
    setSubscriptionLoading(true);
    fetch(`${API_BASE}/subscriptions/status`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        const sub = { status: data.status, trialEndsAt: data.trialEndsAt, referralCode: data.referralCode };
        localStorage.setItem("subscription", JSON.stringify(sub));
        setSubscription(sub);
      })
      .catch((err) => { console.error(err); })
      .finally(() => setSubscriptionLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  useEffect(() => {
    const handler = () => {
      const sub = localStorage.getItem("subscription");
      setSubscription(sub ? JSON.parse(sub) : null);
    };
    window.addEventListener("subscription-required", handler);
    return () => window.removeEventListener("subscription-required", handler);
  }, []);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(""), 5000);
    return () => clearTimeout(t);
  }, [error]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const loadCarriers = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const data = await request("/carriers?includeInactive=true");
      setCarriers(data);
    } catch (err) {
      setError(err.message);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      loadCarriers();
    }
  }, [loadCarriers, isAuthenticated]);

  const handleTabChange = useCallback(
    async (newTab) => {
      setTab(newTab);
      if (newTab === "agenda") {
        await loadCarriers();
        setAgendaRefreshKey((k) => k + 1);
      }
    },
    [loadCarriers]
  );

  const handleLogin = useCallback(() => {
    setIsAuthenticated(true);
    const sub = localStorage.getItem("subscription");
    setSubscription(sub ? JSON.parse(sub) : null);
  }, []);

  const handleLogout = () => {
    authService.logout();
    setIsAuthenticated(false);
    setSubscription(null);
    setTab("agenda");
  };

  const activeCarriers = carriers.filter((c) => c.isActive);

  const TABS = [
    { id: "agenda", label: "Agenda", Icon: IconAgenda },
    { id: "registrar", label: "Registrar", Icon: IconRegister },
    { id: "historico", label: "Histórico", Icon: IconHistory },
    { id: "conta", label: "Conta", Icon: IconConta },
    { id: "ajuda", label: "Ajuda", Icon: IconHelp },
  ];

  const tabTitles = {
    agenda: "Próximos Recebimentos",
    registrar: "Registrar",
    historico: "Histórico",
    conta: "Minha Conta",
    ajuda: "Central de Ajuda",
  };

  if (loading || subscriptionLoading) {
    return (
      <div
        className="app-shell"
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
        }}
      >
        Carregando...
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login onLogin={handleLogin} />} />
          <Route path="/register" element={<Register onLogin={handleLogin} />} />
          <Route path="*" element={<Navigate to="/login" />} />
        </Routes>
      </BrowserRouter>
    );
  }

  if (!isSubscriptionActive(subscription?.status, subscription?.trialEndsAt)) {
    return <Paywall onLogout={handleLogout} />;
  }

  return (
    <div className="app-shell">
      {subscription?.status === "trialing" && (
        <div style={{ background: "var(--blue-bg)", borderBottom: "1px solid var(--border)", color: "var(--text-1)", textAlign: "center", padding: "8px 16px", fontSize: 13, fontWeight: 500 }}>
          Faltam <strong>{trialDaysRemaining(subscription.trialEndsAt)} dias</strong> de teste grátis.{" "}
          <button onClick={() => setTab("conta")} style={{ background: "none", border: "none", color: "var(--blue)", cursor: "pointer", fontWeight: 700, fontSize: 13, padding: 0, minHeight: 0, borderRadius: 0 }}>
            Assinar agora →
          </button>
        </div>
      )}
      <header className="app-header">
        <h1>{tabTitles[tab]}</h1>
        <div className="app-header-right">
          <button
            className="theme-btn"
            onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
            title={theme === "dark" ? "Modo claro" : "Modo escuro"}
            aria-label={theme === "dark" ? "Mudar para modo claro" : "Mudar para modo escuro"}
          >
            <span key={theme} className="theme-btn-icon">
              {theme === "dark" ? "🌙" : "☀️"}
            </span>
          </button>
          <button onClick={handleLogout} className="btn-ghost btn-small">
            Sair
          </button>
        </div>
      </header>

      <main className="tab-content">
        {error && (
          <div className="error">
            {error}
            <button
              className="btn-ghost btn-small"
              style={{ marginLeft: 8 }}
              onClick={() => setError("")}
            >
              ✕
            </button>
          </div>
        )}

        {tab === "agenda" && (
          <AgendaTab
            key={agendaRefreshKey}
            carriers={carriers}
            onError={setError}
          />
        )}
        {tab === "registrar" && (
          <RegistrarTab
            activeCarriers={activeCarriers}
            carriers={carriers}
            onRefresh={async () => {
              await loadCarriers();
              setAgendaRefreshKey((k) => k + 1);
            }}
            onError={setError}
          />
        )}
        {tab === "historico" && (
          <HistoricoTab activeCarriers={activeCarriers} onError={setError} />
        )}
        {tab === "conta" && <Subscription />}
        {tab === "ajuda" && <HelpTab />}
      </main>

      <nav className="bottom-nav">
        <div className="sidebar-logo">SCGTR</div>
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            className={tab === id ? "active" : ""}
            onClick={() => handleTabChange(id)}
            aria-label={label}
          >
            <Icon />
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}

// ─── Agenda Tab ─────────────────────────────────────────────────────────────

function AgendaTab({ carriers, onError }) {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("upcoming");
  const [confirmingId, setConfirmingId] = useState(null);

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      const today = todayStr();
      const start = addDays(today, -365);
      const end = addDays(today, 30);
      const data = await request(`/payments?startDate=${start}&endDate=${end}`);
      setPayments(data);
    } catch (err) {
      onError(err.message);
    } finally {
      setLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const handleConfirm = async (payment) => {
    const key = `${payment.carrierId}-${payment.scheduledDate}-${payment.periodStart}`;
    setConfirmingId(key);
    try {
      await request("/payments", {
        method: "POST",
        body: JSON.stringify({
          carrierId: payment.carrierId,
          periodStart: payment.periodStart,
          periodEnd: payment.periodEnd,
          scheduledDate: payment.scheduledDate,
          amountReceived: payment.amountDue,
          notes: null,
        }),
      });
      await fetchPayments();
    } catch (err) {
      onError(err.message);
    } finally {
      setConfirmingId(null);
    }
  };

  const today = todayStr();

  const carriersWithPayments = new Set(payments.map((p) => p.carrierId));
  const noSchedule = carriers.filter(
    (c) => c.isActive && !carriersWithPayments.has(c.id)
  );

  const filtered = payments.filter((p) => {
    const temValor = Number(p.amountDue ?? 0) > 0 || p.paid;

    if (filter === "overdue")
      return temValor && !p.paid && p.scheduledDate < today;
    if (filter === "upcoming")
      return temValor && p.scheduledDate >= today && !p.paid;
    if (filter === "paid") return p.paid;
    return temValor;
  });

  const grouped = filtered.reduce((acc, p) => {
    if (!acc[p.scheduledDate]) acc[p.scheduledDate] = [];
    acc[p.scheduledDate].push(p);
    return acc;
  }, {});

  const sortedDates = Object.keys(grouped).sort();

  const FILTERS = [
    { id: "upcoming", label: "Futuros" },
    { id: "paid", label: "Recebidos" },
    { id: "overdue", label: "Atrasados" },
    { id: "all", label: "Todos" },
  ];

  const nextPayment = !loading
    ? [...payments]
        .filter(
          (p) =>
            !p.paid &&
            p.scheduledDate >= today &&
            Number(p.amountDue ?? 0) > 0
        )
        .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate))[0]
    : null;

  const overduePayments = !loading
    ? payments.filter(
        (p) =>
          !p.paid &&
          p.scheduledDate < today &&
          Number(p.amountDue ?? 0) > 0
      )
    : [];

  const overdueTotal = overduePayments.reduce(
    (s, p) => s + Number(p.amountDue ?? 0),
    0
  );

  const fmtNumber = (n) =>
    new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2 }).format(
      Number(n ?? 0)
    );

  return (
    <div>
      {!loading && (overduePayments.length > 0 || nextPayment) && (
        <div
          className={`hero-card ${overduePayments.length > 0 ? "overdue" : "upcoming"}`}
        >
          {overduePayments.length > 0 ? (
            <>
              <div className="hero-eyebrow">Atenção</div>
              <div className="hero-sub">
                {overduePayments.length === 1
                  ? "1 pagamento em atraso"
                  : `${overduePayments.length} pagamentos em atraso`}
              </div>
              <div className="hero-amount danger">
                <span className="currency">R$</span>
                {fmtNumber(overdueTotal)}
              </div>
              <span className="hero-pill red">● Atrasado</span>
            </>
          ) : (
            <>
              <div className="hero-eyebrow">Próximo recebimento</div>
              <div className="hero-sub">
                {nextPayment.carrierName} ·{" "}
                {getDateLabel(nextPayment.scheduledDate).date}
              </div>
              <div className="hero-amount">
                <span className="currency">R$</span>
                {fmtNumber(nextPayment.amountDue)}
              </div>
              <span
                className={`hero-pill ${
                  getDateLabel(nextPayment.scheduledDate).type === "soon"
                    ? "orange"
                    : "green"
                }`}
              >
                ● {getDateLabel(nextPayment.scheduledDate).label}
              </span>
            </>
          )}
        </div>
      )}

      <div className="agenda-filter">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            className={`filter-chip ${filter === f.id ? "active" : ""}`}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {!loading && noSchedule.length > 0 && (
        <div
          style={{
            background: "var(--badge-pending-bg)",
            borderRadius: 10,
            padding: "10px 14px",
            marginBottom: 14,
            fontSize: 13,
            color: "var(--badge-pending-text)",
          }}
        >
          <strong>Sem agendamento:</strong>{" "}
          {noSchedule.map((c) => c.name).join(", ")}. Configure em{" "}
          <strong>Registrar → Transportadoras</strong>.
        </div>
      )}

      {loading && <div className="loading-text">Carregando...</div>}

      {!loading && sortedDates.length === 0 && (
        <div className="agenda-empty">
          <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
          <div>Nenhum recebimento encontrado.</div>
          <div style={{ fontSize: 13, marginTop: 8 }}>
            {noSchedule.length > 0
              ? "Configure o agendamento das transportadoras."
              : "Nenhum pagamento pendente neste período."}
          </div>
        </div>
      )}

      {sortedDates.map((dateStr) => {
        const items = grouped[dateStr];
        const { date, label, type } = getDateLabel(dateStr);
        const totalDue = items.reduce(
          (s, p) => s + (p.paid ? 0 : Number(p.amountDue ?? 0)),
          0
        );
        const totalReceived = items.reduce(
          (s, p) => s + (p.paid ? Number(p.amountReceived ?? 0) : 0),
          0
        );
        const allPaid = items.every((p) => p.paid);
        const hasMultiple = items.length > 1;

        return (
          <div key={dateStr} className="payment-group">
            <div className="payment-group-header">
              <span className="payment-group-date">{date}</span>
              {!allPaid && (
                <span className={`payment-group-label ${type}`}>{label}</span>
              )}
            </div>

            {items.map((p, idx) => {
              const key = `${p.carrierId}-${p.scheduledDate}-${p.periodStart}`;
              const isConfirming = confirmingId === key;
              const statusClass = p.paid
                ? "status-paid"
                : type === "overdue"
                ? "status-overdue"
                : "status-pending";
              return (
                <div key={idx} className={`payment-item ${statusClass}`}>
                  <div className="payment-item-row">
                    <div>
                      <div className="payment-item-name">{p.carrierName}</div>
                      <div className="payment-item-period">
                        {fmtDateShort(p.periodStart)} → {fmtDateShort(p.periodEnd)}
                      </div>
                    </div>
                    <div className="payment-item-amount">
                      {fmt(p.paid ? p.amountReceived : p.amountDue)}
                    </div>
                  </div>
                  <div className="payment-item-footer">
                    {p.paid ? (
                      <span className="badge badge-paid">✓ Recebido</span>
                    ) : type === "overdue" ? (
                      <span className="badge badge-overdue">Atrasado</span>
                    ) : (
                      <span className="badge badge-pending">Pendente</span>
                    )}
                    {!p.paid && (
                      <button
                        className="btn-confirm"
                        disabled={isConfirming}
                        onClick={() => handleConfirm(p)}
                      >
                        {isConfirming ? "..." : "✓ Confirmar"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {hasMultiple && !allPaid && (
              <div className="payment-group-total">
                <span>Total do dia</span>
                <span>{fmt(totalDue > 0 ? totalDue : totalReceived)}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Currency Input ──────────────────────────────────────────────────────────

function CurrencyInput({ value, onChange, placeholder = "0,00", required }) {
  const handleChange = (e) => {
    let raw = e.target.value.replace(/[^\d,]/g, "").replace(",", ".");
    const parts = raw.split(".");
    if (parts.length > 2) raw = parts[0] + "." + parts[1];
    onChange(raw);
  };
  const display = value === "" ? "" : String(value).replace(".", ",");
  return (
    <div className="currency-wrap">
      <span className="currency-prefix">R$</span>
      <input type="text" inputMode="decimal" value={display} onChange={handleChange} placeholder={placeholder} required={required} />
    </div>
  );
}

// ─── Registrar Tab ───────────────────────────────────────────────────────────

function RegistrarTab({ activeCarriers, carriers, onRefresh, onError }) {
  const [openSheet, setOpenSheet] = useState(null);

  const TILES = [
    { id: "route",   icon: "🚚", color: "green",  label: "Rota",            sub: "Registrar entrega" },
    { id: "fuel",    icon: "⛽", color: "blue",   label: "Combustível",     sub: "Abastecimento" },
    { id: "carrier", icon: "🏢", color: "orange", label: "Transportadoras", sub: "Gerenciar" },
    { id: "pnr",     icon: "🏷️", color: "red",    label: "PNR",             sub: "Descontos" },
  ];

  const SHEET_TITLES = {
    route:   "Registrar Rota",
    fuel:    "Combustível",
    carrier: "Transportadoras",
    pnr:     "Desconto PNR",
  };

  return (
    <div>
      <div className="action-grid">
        {TILES.map(({ id, icon, color, label, sub }) => (
          <button
            key={id}
            className="action-tile"
            onClick={() => setOpenSheet(id)}
          >
            <span className={`action-tile-icon ${color}`}>{icon}</span>
            <span className="action-tile-label">{label}</span>
            <span className="action-tile-sub">{sub}</span>
          </button>
        ))}
      </div>

      {openSheet && (
        <div className="modal-overlay" onClick={() => setOpenSheet(null)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="sheet-header">
              <h2>{SHEET_TITLES[openSheet]}</h2>
              <button
                className="btn-ghost btn-small"
                onClick={() => setOpenSheet(null)}
              >
                ✕
              </button>
            </div>
            {openSheet === "route" && (
              <RouteForm
                activeCarriers={activeCarriers}
                onError={onError}
                onSuccess={() => setOpenSheet(null)}
              />
            )}
            {openSheet === "fuel" && (
              <FuelForm
                onError={onError}
                onSuccess={() => setOpenSheet(null)}
              />
            )}
            {openSheet === "carrier" && (
              <CarrierManager
                carriers={carriers}
                onRefresh={onRefresh}
                onError={onError}
              />
            )}
            {openSheet === "pnr" && (
              <DiscountRegistrar onError={onError} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function RouteForm({ activeCarriers, onError, onSuccess }) {
  const lastCarrierId = localStorage.getItem("lastCarrierId") || "";
  const [form, setForm] = useState({
    carrierId: lastCarrierId,
    routeDate: todayStr(),
    fixedAmount: "",
    amountPerPackage: "",
    packageCount: "",
    notes: "",
    packageMode: "fixed",
    packageValues: [""],
  });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const setPackageValue = (idx, value) =>
    setForm((prev) => {
      const next = [...prev.packageValues];
      next[idx] = value;
      return { ...prev, packageValues: next };
    });

  const addPackage = () =>
    setForm((prev) => ({ ...prev, packageValues: [...prev.packageValues, ""] }));

  const removePackage = (idx) =>
    setForm((prev) => ({
      ...prev,
      packageValues: prev.packageValues.filter((_, i) => i !== idx),
    }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSuccess(false);
    try {
      const isCustom = form.packageMode === "custom";
      const cleanValues = form.packageValues
        .map((v) => Number(v))
        .filter((v) => v > 0);
      if (isCustom && cleanValues.length === 0) {
        onError("Adicione pelo menos um valor de pacote.");
        return;
      }
      await request("/routes", {
        method: "POST",
        body: JSON.stringify({
          carrierId: Number(form.carrierId),
          routeDate: form.routeDate,
          fixedAmount:
            form.fixedAmount === "" ? null : Number(form.fixedAmount),
          amountPerPackage:
            isCustom || form.amountPerPackage === ""
              ? null
              : Number(form.amountPerPackage),
          packageCount: isCustom
            ? cleanValues.length
            : Number(form.packageCount || 0),
          packageValues: isCustom ? cleanValues : null,
          notes: form.notes || null,
        }),
      });
      localStorage.setItem("lastCarrierId", form.carrierId);
      setForm((prev) => ({
        ...prev,
        routeDate: todayStr(),
        fixedAmount: "",
        amountPerPackage: "",
        packageCount: "",
        notes: "",
        packageMode: "fixed",
        packageValues: [""],
      }));
      if (onSuccess) {
        onSuccess();
      } else {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (err) {
      onError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const previewTotal = (() => {
    const fixo = Number(form.fixedAmount || 0);
    if (form.packageMode === "custom") {
      const soma = form.packageValues.reduce((s, v) => s + Number(v || 0), 0);
      const total = fixo + soma;
      return total > 0 ? fmt(total) : null;
    }
    const porPacote = Number(form.amountPerPackage || 0);
    const qtd = Number(form.packageCount || 0);
    const total = fixo + porPacote * qtd;
    return total > 0 ? fmt(total) : null;
  })();

  return (
    <div>
      {success && (
        <div className="success-msg">Rota cadastrada com sucesso!</div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="card">
          <div className="form-group">
            <label>Transportadora</label>
            <div className="carrier-chips">
              {activeCarriers.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`carrier-chip${
                    form.carrierId === String(c.id) ? " active" : ""
                  }`}
                  onClick={() => set("carrierId", String(c.id))}
                >
                  {c.name}
                </button>
              ))}
              {activeCarriers.length === 0 && (
                <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
                  Nenhuma transportadora ativa.
                </span>
              )}
            </div>
          </div>

          <div className="form-group">
            <label>
              Data da rota
              <input
                type="date"
                value={form.routeDate}
                onChange={(e) => set("routeDate", e.target.value)}
                required
              />
            </label>
          </div>

          <hr className="divider" />

          <div className="form-group">
            <label>
              Valor fixo (R$)
              <CurrencyInput value={form.fixedAmount} onChange={(v) => set("fixedAmount", v)} />
            </label>
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <button
              type="button"
              className={`filter-chip${
                form.packageMode === "fixed" ? " active" : ""
              }`}
              onClick={() => set("packageMode", "fixed")}
            >
              Mesmo valor/pacote
            </button>
            <button
              type="button"
              className={`filter-chip${
                form.packageMode === "custom" ? " active" : ""
              }`}
              onClick={() => set("packageMode", "custom")}
            >
              Valores diferentes
            </button>
          </div>

          {form.packageMode === "fixed" ? (
            <>
              <div className="form-group">
                <label>
                  Valor/pacote (R$)
                  <CurrencyInput value={form.amountPerPackage} onChange={(v) => set("amountPerPackage", v)} />
                </label>
              </div>
              {form.amountPerPackage !== "" &&
                Number(form.amountPerPackage) > 0 && (
                  <div className="form-group">
                    <label>
                      Qtde de pacotes
                      <input
                        type="number"
                        min="1"
                        placeholder="0"
                        value={form.packageCount}
                        onChange={(e) => set("packageCount", e.target.value)}
                        required
                      />
                    </label>
                  </div>
                )}
            </>
          ) : (
            <div className="form-group">
              <label>Valor de cada pacote (R$)</label>
              {form.packageValues.map((v, idx) => (
                <div
                  key={idx}
                  style={{ display: "flex", gap: 8, marginBottom: 8 }}
                >
                  <CurrencyInput value={v} onChange={(val) => setPackageValue(idx, val)} placeholder={`Pacote ${idx + 1}`} />
                  {form.packageValues.length > 1 && (
                    <button
                      type="button"
                      className="btn-ghost btn-small"
                      onClick={() => removePackage(idx)}
                      style={{ flexShrink: 0 }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                className="btn-ghost btn-small"
                onClick={addPackage}
              >
                + Adicionar pacote
              </button>
            </div>
          )}

          {previewTotal && (
            <div className="preview-total">
              <span className="preview-total-label">Total desta rota</span>
              <strong className="preview-total-value">{previewTotal}</strong>
            </div>
          )}

          <hr className="divider" />

          <div className="form-group">
            <label>
              Observação (opcional)
              <input
                type="text"
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
                placeholder="Ex: Ambulancia, ajudei um cara a terminar a rota, etc ..."
                maxLength={300}
              />
            </label>
          </div>
        </div>

        <button type="submit" className="btn-full" disabled={saving}>
          {saving ? "Salvando..." : "Cadastrar Rota"}
        </button>
      </form>
    </div>
  );
}

function FuelForm({ onError, onSuccess }) {
  const [form, setForm] = useState({
    entryDate: todayStr(),
    fuelType: "gasoline",
    liters: "",
    totalCost: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSuccess(false);
    try {
      await request("/fuel-entries", {
        method: "POST",
        body: JSON.stringify({
          entryDate: form.entryDate,
          fuelType: form.fuelType,
          liters: form.liters === "" ? null : Number(form.liters),
          totalCost: Number(form.totalCost),
          notes: form.notes || null,
        }),
      });
      setForm({
        entryDate: todayStr(),
        fuelType: "gasoline",
        liters: "",
        totalCost: "",
        notes: "",
      });
      if (onSuccess) {
        onSuccess();
      } else {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (err) {
      onError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const pricePerLiter =
    form.liters && form.totalCost
      ? (Number(form.totalCost) / Number(form.liters)).toFixed(3)
      : null;

  return (
    <div>
      {success && (
        <div className="success-msg">Abastecimento registrado com sucesso!</div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="card">
          <div className="form-group">
            <label>
              Data do abastecimento
              <input
                type="date"
                value={form.entryDate}
                onChange={(e) => set("entryDate", e.target.value)}
                required
              />
            </label>
          </div>

          <div className="form-group">
            <label>
              Tipo de combustível
              <select
                value={form.fuelType}
                onChange={(e) => set("fuelType", e.target.value)}
              >
                <option value="gasoline">Gasolina</option>
                <option value="ethanol">Etanol</option>
              </select>
            </label>
          </div>

          <hr className="divider" />

          <div className="form-row">
            <div className="form-group">
              <label>
                Valor total (R$)
                <CurrencyInput value={form.totalCost} onChange={(v) => set("totalCost", v)} required />
              </label>
            </div>
            <div className="form-group">
              <label>
                Litros (opcional)
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0,000"
                  value={form.liters}
                  onChange={(e) => set("liters", e.target.value.replace(/[^\d.,]/g, ""))}
                />
              </label>
            </div>
          </div>

          {pricePerLiter && (
            <div className="preview-total">
              <span className="preview-total-label">Preço/litro</span>
              <strong className="preview-total-value">R$ {pricePerLiter}</strong>
            </div>
          )}

          <hr className="divider" />

          <div className="form-group">
            <label>
              Observação (opcional)
              <input
                type="text"
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
                placeholder="Ex: Peguei promoção de combustível no posto X"
                maxLength={300}
              />
            </label>
          </div>
        </div>

        <button type="submit" className="btn-full" disabled={saving}>
          {saving ? "Salvando..." : "Registrar Combustível"}
        </button>
      </form>
    </div>
  );
}

// ─── Carrier Manager ─────────────────────────────────────────────────────────

function CarrierManager({ carriers, onRefresh, onError }) {
  const [showAddCarrier, setShowAddCarrier] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(null);
  const [carrierForm, setCarrierForm] = useState({ name: "" });
  const [scheduleForm, setScheduleForm] = useState({ frequency: "", weekday: "", dayOfMonth: "", secondDayOfMonth: "", weekStartDay: "" });
  const [saving, setSaving] = useState(false);
  const [deletingCarrierId, setDeletingCarrierId] = useState(null);
  const [carrierError, setCarrierError] = useState("");

  const openSchedule = async (c) => {
    try {
      const s = await request(`/carriers/${c.id}/payment-schedule`);
      setScheduleForm({
        frequency: s.frequency || "",
        weekday: s.weekday != null ? String(s.weekday) : "",
        dayOfMonth: s.dayOfMonth != null ? String(s.dayOfMonth) : "",
        secondDayOfMonth: s.secondDayOfMonth != null ? String(s.secondDayOfMonth) : "",
        weekStartDay: s.weekStartDay != null ? String(s.weekStartDay) : "",
      });
    } catch {
      setScheduleForm({ frequency: "", weekday: "", dayOfMonth: "", secondDayOfMonth: "", weekStartDay: "" });
    }
    setShowScheduleModal(c);
  };

  const handleCreateCarrier = async (e) => {
    e.preventDefault();
    setSaving(true);
    setCarrierError("");
    try {
      await request("/carriers", { method: "POST", body: JSON.stringify({ name: carrierForm.name }) });
      setCarrierForm({ name: "" });
      setShowAddCarrier(false);
      await onRefresh();
    } catch (err) {
      setCarrierError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSchedule = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body = {
        frequency: scheduleForm.frequency,
        weekday: scheduleForm.frequency === "weekly" && scheduleForm.weekday !== "" ? Number(scheduleForm.weekday) : null,
        dayOfMonth: scheduleForm.frequency === "quinzena" && scheduleForm.dayOfMonth !== "" ? Number(scheduleForm.dayOfMonth) : null,
        secondDayOfMonth: scheduleForm.frequency === "quinzena" && scheduleForm.secondDayOfMonth !== "" ? Number(scheduleForm.secondDayOfMonth) : null,
        weekStartDay: scheduleForm.frequency === "weekly" && scheduleForm.weekStartDay !== "" ? Number(scheduleForm.weekStartDay) : null,
      };
      await request(`/carriers/${showScheduleModal.id}/payment-schedule`, { method: "PUT", body: JSON.stringify(body) });
      setShowScheduleModal(null);
      await onRefresh();
    } catch (err) {
      onError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleCarrier = async (c) => {
    try {
      const action = c.isActive ? "deactivate" : "reactivate";
      await request(`/carriers/${c.id}/${action}`, { method: "PATCH" });
      await onRefresh();
    } catch (err) {
      onError(err.message);
    }
  };

  const handleDeleteCarrier = async (c) => {
    try {
      await request(`/carriers/${c.id}`, { method: "DELETE" });
      setDeletingCarrierId(null);
      await onRefresh();
    } catch (err) {
      setDeletingCarrierId(null);
      onError(err.message);
    }
  };

  return (
    <div>
      <div className="card">
        {carriers.map((c) => (
          <div key={c.id} className="carrier-item">
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="carrier-name">{c.name}</div>
              <div className="carrier-meta">
                {c.isActive ? "Ativa" : "Inativa"}
                {c.paymentSchedule && ` • ${scheduleLabel(c.paymentSchedule)}`}
              </div>
            </div>
            {deletingCarrierId === c.id ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
                <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>Excluir "{c.name}"?</span>
                <div style={{ display: "flex", gap: 6 }}>
                  <button className="btn-danger btn-small" onClick={() => handleDeleteCarrier(c)}>Confirmar</button>
                  <button className="btn-ghost btn-small" onClick={() => setDeletingCarrierId(null)}>Cancelar</button>
                </div>
              </div>
            ) : (
              <div className="carrier-actions">
                <button className="btn-ghost btn-small" onClick={() => openSchedule(c)}>Agenda</button>
                <button className={`btn-small ${c.isActive ? "btn-danger" : "btn-success"}`} onClick={() => handleToggleCarrier(c)}>
                  {c.isActive ? "Inativar" : "Reativar"}
                </button>
                <button className="btn-ghost btn-small" onClick={() => setDeletingCarrierId(c.id)} title="Excluir">🗑</button>
              </div>
            )}
          </div>
        ))}
        {!showAddCarrier ? (
          <button className="btn-ghost btn-small" style={{ marginTop: 8 }} onClick={() => setShowAddCarrier(true)}>+ Adicionar transportadora</button>
        ) : (
          <form onSubmit={handleCreateCarrier} style={{ marginTop: 12 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={carrierForm.name}
                onChange={(e) => { setCarrierForm({ name: e.target.value }); setCarrierError(""); }}
                placeholder="Nome da transportadora"
                required
                autoFocus
                style={carrierError ? { borderColor: "var(--badge-overdue-border, #c0392b)" } : undefined}
              />
              <button type="submit" disabled={saving} style={{ whiteSpace: "nowrap", flexShrink: 0 }}>{saving ? "..." : "Salvar"}</button>
              <button type="button" className="btn-ghost" onClick={() => { setShowAddCarrier(false); setCarrierError(""); }} style={{ flexShrink: 0 }}>✕</button>
            </div>
            {carrierError && <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--badge-overdue-text, #e74c3c)" }}>{carrierError}</p>}
          </form>
        )}
      </div>

      {showScheduleModal && (
        <div className="modal-overlay">
          <div className="modal-sheet">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 18 }}>Agendamento — {showScheduleModal.name}</h2>
              <button className="btn-ghost btn-small" onClick={() => setShowScheduleModal(null)}>✕</button>
            </div>
            <form onSubmit={handleSaveSchedule}>
              <div className="form-group">
                <label>
                  Tipo de pagamento
                  <select value={scheduleForm.frequency} onChange={(e) => setScheduleForm((p) => ({ ...p, frequency: e.target.value }))} required>
                    <option value="">Selecione...</option>
                    <option value="weekly">Semanal (toda semana)</option>
                    <option value="quinzena">Quinzenal (dois dias do mês)</option>
                  </select>
                </label>
              </div>
              {scheduleForm.frequency === "weekly" && (
                <>
                  <div className="form-group">
                    <label>
                      Dia do pagamento
                      <select value={scheduleForm.weekday} onChange={(e) => setScheduleForm((p) => ({ ...p, weekday: e.target.value }))} required>
                        <option value="">Selecione...</option>
                        {WEEKDAY_FULL.map((d, i) => <option key={i} value={i}>{d}</option>)}
                      </select>
                    </label>
                  </div>
                  <div className="form-group">
                    <label>
                      Dia que a semana começa (opcional)
                      <select value={scheduleForm.weekStartDay} onChange={(e) => setScheduleForm((p) => ({ ...p, weekStartDay: e.target.value }))}>
                        <option value="">Padrão (semana começa no sábado)</option>
                        {WEEKDAY_FULL.map((d, i) => <option key={i} value={i}>{d}</option>)}
                      </select>
                    </label>
                  </div>
                  {scheduleForm.weekday !== "" && (
                    <div style={{ background: "var(--bg-secondary)", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "var(--text-secondary)", marginBottom: 14 }}>
                      {scheduleForm.weekStartDay !== ""
                        ? `Semana de ${WEEKDAY_FULL[scheduleForm.weekStartDay]} a ${WEEKDAY_FULL[(Number(scheduleForm.weekStartDay) - 1 + 7) % 7]}, recebe toda ${WEEKDAY_FULL[scheduleForm.weekday]}.`
                        : `Recebe toda ${WEEKDAY_FULL[scheduleForm.weekday]}.`}
                    </div>
                  )}
                </>
              )}
              {scheduleForm.frequency === "quinzena" && (
                <div className="form-group">
                  <label>
                    1º dia de pagamento
                    <input type="number" min="1" max="31" placeholder="Ex: 10" value={scheduleForm.dayOfMonth} onChange={(e) => setScheduleForm((p) => ({ ...p, dayOfMonth: e.target.value }))} required />
                  </label>
                  <label>
                    2º dia de pagamento
                    <input type="number" min="1" max="31" placeholder="Ex: 25 (opcional, padrão: último dia do mês)" value={scheduleForm.secondDayOfMonth} onChange={(e) => setScheduleForm((p) => ({ ...p, secondDayOfMonth: e.target.value }))} />
                  </label>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                    Pagamento no dia {scheduleForm.dayOfMonth || "?"} e no dia {scheduleForm.secondDayOfMonth || "último dia do mês"}.
                  </div>
                </div>
              )}
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button type="submit" className="btn-full" disabled={saving}>{saving ? "Salvando..." : "Salvar agendamento"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Discount Registrar ───────────────────────────────────────────────────────

function DiscountRegistrar({ onError }) {
  const [discountForm, setDiscountForm] = useState({ routeId: "", discountDate: todayStr(), discountAmount: "", notes: "" });
  const [routes, setRoutes] = useState([]);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    request("/routes")
      .then(setRoutes)
      .catch((e) => onError(e.message));
  }, [onError]);

  const handleCreateDiscount = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await request("/discounts", {
        method: "POST",
        body: JSON.stringify({
          routeId: Number(discountForm.routeId),
          discountDate: discountForm.discountDate,
          discountAmount: Number(discountForm.discountAmount),
          notes: discountForm.notes || null,
        }),
      });
      setDiscountForm({ routeId: "", discountDate: todayStr(), discountAmount: "", notes: "" });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      onError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      {success && <div className="success-msg">PNR registrado com sucesso!</div>}
      <form onSubmit={handleCreateDiscount}>
        <div className="card">
          <div className="form-group">
            <label>
              Rota
              <select value={discountForm.routeId} onChange={(e) => setDiscountForm((p) => ({ ...p, routeId: e.target.value }))} required>
                <option value="">Selecione a rota...</option>
                {routes.map((r) => (
                  <option key={r.id} value={r.id}>#{r.id} — {r.carrierName} ({fmtDate(r.routeDate)}) {fmt(r.totalAmount)}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>
                Data do PNR
                <input type="date" value={discountForm.discountDate} onChange={(e) => setDiscountForm((p) => ({ ...p, discountDate: e.target.value }))} required />
              </label>
            </div>
            <div className="form-group">
              <label>
                Valor (R$)
                <CurrencyInput value={discountForm.discountAmount} onChange={(v) => setDiscountForm((p) => ({ ...p, discountAmount: v }))} required />
              </label>
            </div>
          </div>
          <div className="form-group">
            <label>
              Observação (opcional)
              <input value={discountForm.notes} onChange={(e) => setDiscountForm((p) => ({ ...p, notes: e.target.value }))} placeholder="Ex: pacote danificado" />
            </label>
          </div>
        </div>
        <button type="submit" className="btn-full" disabled={saving}>{saving ? "Salvando..." : "Registrar PNR"}</button>
      </form>
    </div>
  );
}

// ─── Histórico Tab ───────────────────────────────────────────────────────────

function HistoricoTab({ activeCarriers, onError }) {
  const [routes, setRoutes] = useState([]);
  const [discounts, setDiscounts] = useState([]);
  const [fuelEntries, setFuelEntries] = useState([]);
  const [summary, setSummary] = useState(null);
  const [history, setHistory] = useState([]);

  const [loading, setLoading] = useState(true);
  const [showChart, setShowChart] = useState(false);
  const [startDate, setStartDate] = useState(() => addDays(todayStr(), -30));
  const [endDate, setEndDate] = useState(todayStr);
  const [activePreset, setActivePreset] = useState(30);
  const [editingRoute, setEditingRoute] = useState(null);
  const [deletingRoute, setDeletingRoute] = useState(null);
  const [selectedCarrier, setSelectedCarrier] = useState("");

  const load = useCallback(
    async (start, end, cId) => {
      setLoading(true);
      try {
        const cParam = cId ? `&carrierId=${cId}` : "";
        const [routesData, summaryData, historyData, discountsData, fuelData] =
          await Promise.all([
            request(`/routes?startDate=${start}&endDate=${end}${cParam}`),
            request(
              `/dashboard/summary?startDate=${start}&endDate=${end}${cParam}`
            ),
            request(
              `/dashboard/history?startDate=${start}&endDate=${end}${cParam}`
            ),
            request(`/discounts?startDate=${start}&endDate=${end}`),
            request(`/fuel-entries?startDate=${start}&endDate=${end}`),
          ]);
        setRoutes(routesData);
        setSummary(summaryData);
        setHistory(historyData);
        setFuelEntries(fuelData);
        if (cId) {
          const cName = activeCarriers.find(
            (c) => String(c.id) === String(cId)
          )?.name;
          setDiscounts(
            cName
              ? discountsData.filter((d) => d.carrierName === cName)
              : discountsData
          );
        } else {
          setDiscounts(discountsData);
        }
      } catch (err) {
        onError(err.message);
      } finally {
        setLoading(false);
      }
    },
    [onError, activeCarriers]
  );

  const handleDeleteRoute = async (id) => {
    try {
      await request(`/routes/${id}`, { method: "DELETE" });
      setDeletingRoute(null);
      load(startDate, endDate, selectedCarrier);
    } catch (err) {
      onError(err.message);
    }
  };

  const handleDeleteDiscount = async (id) => {
    try {
      await request(`/discounts/${id}`, { method: "DELETE" });
      load(startDate, endDate, selectedCarrier);
    } catch (err) {
      onError(err.message);
    }
  };

  const handleDeleteFuelEntry = async (id) => {
    try {
      await request(`/fuel-entries/${id}`, { method: "DELETE" });
      load(startDate, endDate, selectedCarrier);
    } catch (err) {
      onError(err.message);
    }
  };

  useEffect(() => {
    if (startDate && endDate) load(startDate, endDate, selectedCarrier);
  }, [startDate, endDate, selectedCarrier, load]);

  const applyPreset = (d) => {
    const end = todayStr();
    setStartDate(addDays(end, -d));
    setEndDate(end);
    setActivePreset(d);
  };

  return (
    <div>
      <div className="historico-filters">
        <div className="historico-filters-row">
          <div className="historico-presets">
            {[7, 15, 30, 90].map((d) => (
              <button
                key={d}
                className={`filter-chip ${activePreset === d ? "active" : ""}`}
                onClick={() => applyPreset(d)}
              >
                {d}d
              </button>
            ))}
          </div>
          <button
            className={`filter-chip ${showChart ? "active" : ""}`}
            onClick={() => setShowChart((v) => !v)}
          >
            Gráfico
          </button>
        </div>
        <div className="historico-dates">
          <div className="historico-date-field">
            <span>De</span>
            <input
              type="date"
              value={startDate}
              max={endDate}
              className={!startDate ? "input-error" : ""}
              onChange={(e) => {
                setStartDate(e.target.value);
                setActivePreset(null);
              }}
            />
            {!startDate && (
              <span className="date-required">Data obrigatória</span>
            )}
          </div>
          <div className="historico-date-field">
            <span>Até</span>
            <input
              type="date"
              value={endDate}
              min={startDate}
              className={!endDate ? "input-error" : ""}
              onChange={(e) => {
                setEndDate(e.target.value);
                setActivePreset(null);
              }}
            />
            {!endDate && (
              <span className="date-required">Data obrigatória</span>
            )}
          </div>
        </div>
        {activeCarriers.length > 0 && (
          <select
            value={selectedCarrier}
            onChange={(e) => setSelectedCarrier(e.target.value)}
          >
            <option value="">Todas as transportadoras</option>
            {activeCarriers.map((c) => (
              <option key={c.id} value={String(c.id)}>
                {c.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {loading && <div className="loading-text">Carregando...</div>}

      {!loading && summary && (
        <>
          <div
            className="metrics-grid"
            style={{ gridTemplateColumns: "repeat(3, 1fr)", marginBottom: 12 }}
          >
            <div className="metric-card">
              <span>Rotas</span>
              <strong>{summary.totalRoutes}</strong>
            </div>
            <div className="metric-card">
              <span>Pacotes</span>
              <strong>{summary.totalPackages}</strong>
            </div>
            <div className="metric-card">
              <span>Dias trabalhados</span>
              <strong>{summary.workingDays}</strong>
            </div>
            <div className="metric-card">
              <span>Bruto</span>
              <strong>{fmt(summary.grossEarnings)}</strong>
            </div>
            <div className="metric-card">
              <span>Descontos</span>
              <strong>{fmt(summary.totalDiscounts)}</strong>
            </div>
            <div className="metric-card">
              <span>Líquido</span>
              <strong>{fmt(summary.netEarnings)}</strong>
            </div>
            <div className="metric-card">
              <span>Combustível</span>
              <strong style={{ color: "var(--color-danger, #ef4444)" }}>
                -{fmt(summary.totalFuel)}
              </strong>
            </div>
            <div className="metric-card highlight" style={{ gridColumn: "span 2" }}>
              <span>Ganho Real</span>
              <strong>{fmt(summary.realEarnings)}</strong>
            </div>
          </div>

          {showChart && history.length > 0 && (
            <div className="card">
              <div className="chart-wrapper-tall">
                <HistoricoChart historico={history} />
              </div>
            </div>
          )}

          <div className="card">
            <p className="card-title">Rotas</p>
            {routes.length === 0 && (
              <div
                style={{
                  color: "var(--text-muted)",
                  fontSize: 14,
                  textAlign: "center",
                  padding: "12px 0",
                }}
              >
                Nenhuma rota neste período.
              </div>
            )}
            {routes.slice(0, 50).map((r) => (
              <div key={r.id} className="route-item">
                <div className="route-item-left">
                  <div className="route-item-name">{r.carrierName}</div>
                  <div className="route-item-meta">
                    {fmtDate(r.routeDate)}
                    {r.packageCount > 0 ? ` • ${r.packageCount} pct` : ""}
                    {r.packageValues && r.packageValues.length > 0
                      ? ` • ${r.packageValues.map((v) => fmt(v)).join(", ")}`
                      : ""}
                    {r.totalDiscounts > 0
                      ? ` • PNR ${fmt(r.totalDiscounts)}`
                      : ""}
                    {r.notes ? ` • ${r.notes}` : ""}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div className="route-item-amount">{fmt(r.netAmount)}</div>
                  <button
                    className="btn-ghost btn-small"
                    onClick={() => setEditingRoute(r)}
                  >
                    Editar
                  </button>
                  <button
                    className="btn-ghost btn-small"
                    onClick={() => setDeletingRoute(r)}
                    title="Excluir rota"
                  >
                    🗑
                  </button>
                </div>
              </div>
            ))}
          </div>

          {discounts.length > 0 && (
            <div className="card">
              <p className="card-title">Descontos PNR</p>
              {discounts.map((d) => (
                <div key={d.id} className="route-item">
                  <div className="route-item-left">
                    <div className="route-item-name">{d.carrierName}</div>
                    <div className="route-item-meta">
                      Rota: {fmtDate(d.routeDate)} • PNR:{" "}
                      {fmtDate(d.discountDate)}
                      {d.notes ? ` • ${d.notes}` : ""}
                    </div>
                  </div>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <div
                      className="route-item-amount"
                      style={{ color: "var(--color-danger, #ef4444)" }}
                    >
                      -{fmt(d.discountAmount)}
                    </div>
                    <button
                      className="btn-ghost btn-small"
                      onClick={() => handleDeleteDiscount(d.id)}
                      title="Remover PNR"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {fuelEntries.length > 0 && (
            <div className="card">
              <p className="card-title">Combustível</p>
              {fuelEntries.map((f) => (
                <div key={f.id} className="route-item">
                  <div className="route-item-left">
                    <div className="route-item-name">
                      {f.fuelType === "gasoline" ? "Gasolina" : "Etanol"}
                    </div>
                    <div className="route-item-meta">
                      {fmtDate(f.entryDate)}
                      {f.liters ? ` • ${f.liters}L` : ""}
                      {f.liters && f.totalCost
                        ? ` • R$ ${(f.totalCost / f.liters).toFixed(3)}/L`
                        : ""}
                      {f.notes ? ` • ${f.notes}` : ""}
                    </div>
                  </div>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <div
                      className="route-item-amount"
                      style={{ color: "var(--color-danger, #ef4444)" }}
                    >
                      -{fmt(f.totalCost)}
                    </div>
                    <button
                      className="btn-ghost btn-small"
                      onClick={() => handleDeleteFuelEntry(f.id)}
                      title="Remover"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {editingRoute && (
        <EditRouteModal
          route={editingRoute}
          activeCarriers={activeCarriers}
          onClose={() => setEditingRoute(null)}
          onSaved={() => {
            setEditingRoute(null);
            load(startDate, endDate, selectedCarrier);
          }}
          onError={onError}
        />
      )}

      {deletingRoute && (
        <div className="modal-overlay" onClick={() => setDeletingRoute(null)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h2 style={{ margin: 0, fontSize: 18 }}>Excluir rota</h2>
              <button className="btn-ghost btn-small" onClick={() => setDeletingRoute(null)}>✕</button>
            </div>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 20 }}>
              Excluir a rota de <strong>{deletingRoute.carrierName}</strong> do dia{" "}
              <strong>{fmtDate(deletingRoute.routeDate)}</strong>? Descontos vinculados também serão removidos. Esta ação não pode ser desfeita.
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn-danger btn-full" onClick={() => handleDeleteRoute(deletingRoute.id)}>Excluir</button>
              <button className="btn-ghost btn-full" onClick={() => setDeletingRoute(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EditRouteModal({ route, activeCarriers, onClose, onSaved, onError }) {
  const hasCustom = route.packageValues && route.packageValues.length > 0;
  const [form, setForm] = useState({
    carrierId: String(route.carrierId),
    routeDate: route.routeDate,
    fixedAmount: route.fixedAmount != null ? String(route.fixedAmount) : "",
    amountPerPackage:
      route.amountPerPackage != null ? String(route.amountPerPackage) : "",
    packageCount: route.packageCount > 0 ? String(route.packageCount) : "",
    notes: route.notes || "",
    packageMode: hasCustom ? "custom" : "fixed",
    packageValues: hasCustom ? route.packageValues.map((v) => String(v)) : [""],
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const setPackageValue = (idx, value) =>
    setForm((p) => {
      const next = [...p.packageValues];
      next[idx] = value;
      return { ...p, packageValues: next };
    });

  const addPackage = () =>
    setForm((p) => ({ ...p, packageValues: [...p.packageValues, ""] }));

  const removePackage = (idx) =>
    setForm((p) => ({
      ...p,
      packageValues: p.packageValues.filter((_, i) => i !== idx),
    }));

  const previewTotal = (() => {
    const fixo = Number(form.fixedAmount || 0);
    if (form.packageMode === "custom") {
      const soma = form.packageValues.reduce((s, v) => s + Number(v || 0), 0);
      const total = fixo + soma;
      return total > 0 ? fmt(total) : null;
    }
    const porPacote = Number(form.amountPerPackage || 0);
    const qtd = Number(form.packageCount || 0);
    const total = fixo + porPacote * qtd;
    return total > 0 ? fmt(total) : null;
  })();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const isCustom = form.packageMode === "custom";
      const cleanValues = form.packageValues
        .map((v) => Number(v))
        .filter((v) => v > 0);
      if (isCustom && cleanValues.length === 0) {
        onError("Adicione pelo menos um valor de pacote.");
        return;
      }
      await request(`/routes/${route.id}`, {
        method: "PUT",
        body: JSON.stringify({
          carrierId: Number(form.carrierId),
          routeDate: form.routeDate,
          fixedAmount:
            form.fixedAmount === "" ? null : Number(form.fixedAmount),
          amountPerPackage:
            isCustom || form.amountPerPackage === ""
              ? null
              : Number(form.amountPerPackage),
          packageCount: isCustom
            ? cleanValues.length
            : Number(form.packageCount || 0),
          packageValues: isCustom ? cleanValues : null,
          notes: form.notes || null,
        }),
      });
      onSaved();
    } catch (err) {
      onError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-sheet">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 18 }}>Editar Rota #{route.id}</h2>
          <button className="btn-ghost btn-small" onClick={onClose}>
            ✕
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>
              Transportadora
              <select
                value={form.carrierId}
                onChange={(e) => set("carrierId", e.target.value)}
                required
              >
                <option value="">Selecione...</option>
                {activeCarriers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="form-group">
            <label>
              Data da rota
              <input
                type="date"
                value={form.routeDate}
                onChange={(e) => set("routeDate", e.target.value)}
                required
              />
            </label>
          </div>
          <div className="form-group">
            <label>
              Valor fixo (R$)
              <CurrencyInput value={form.fixedAmount} onChange={(v) => set("fixedAmount", v)} />
            </label>
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <button
              type="button"
              className={`filter-chip${
                form.packageMode === "fixed" ? " active" : ""
              }`}
              onClick={() => set("packageMode", "fixed")}
            >
              Mesmo valor/pacote
            </button>
            <button
              type="button"
              className={`filter-chip${
                form.packageMode === "custom" ? " active" : ""
              }`}
              onClick={() => set("packageMode", "custom")}
            >
              Valores diferentes
            </button>
          </div>
          {form.packageMode === "fixed" ? (
            <>
              <div className="form-group">
                <label>
                  Valor/pacote (R$)
                  <CurrencyInput value={form.amountPerPackage} onChange={(v) => set("amountPerPackage", v)} />
                </label>
              </div>
              {form.amountPerPackage !== "" &&
                Number(form.amountPerPackage) > 0 && (
                  <div className="form-group">
                    <label>
                      Qtde de pacotes
                      <input
                        type="number"
                        min="1"
                        value={form.packageCount}
                        onChange={(e) => set("packageCount", e.target.value)}
                        required
                      />
                    </label>
                  </div>
                )}
            </>
          ) : (
            <div className="form-group">
              <label>Valor de cada pacote (R$)</label>
              {form.packageValues.map((v, idx) => (
                <div
                  key={idx}
                  style={{ display: "flex", gap: 8, marginBottom: 8 }}
                >
                  <CurrencyInput value={v} onChange={(val) => setPackageValue(idx, val)} placeholder={`Pacote ${idx + 1}`} />
                  {form.packageValues.length > 1 && (
                    <button
                      type="button"
                      className="btn-ghost btn-small"
                      onClick={() => removePackage(idx)}
                      style={{ flexShrink: 0 }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                className="btn-ghost btn-small"
                onClick={addPackage}
              >
                + Adicionar pacote
              </button>
            </div>
          )}
          {previewTotal && (
            <div
              style={{
                background: "var(--bg-secondary)",
                borderRadius: 8,
                padding: "10px 14px",
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 14,
              }}
            >
              <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>
                Total
              </span>
              <strong>{previewTotal}</strong>
            </div>
          )}
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label>
              Observação (opcional)
              <input
                type="text"
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
                placeholder="Ex: rota especial, entrega difícil..."
                maxLength={300}
              />
            </label>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="submit" className="btn-full" disabled={saving}>
              {saving ? "Salvando..." : "Salvar alterações"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

