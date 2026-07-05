import { useState, useEffect } from "react";
import { loadStatus, openPortal, startCheckout, trialDaysRemaining } from "../services/subscription";

const PRICE_MONTHLY = import.meta.env.VITE_STRIPE_PRICE_MONTHLY;
const PRICE_ANNUAL = import.meta.env.VITE_STRIPE_PRICE_ANNUAL;

const STATUS_LABELS = {
  active:   { text: "Ativa",              color: "var(--green)" },
  trialing: { text: "Período de teste",   color: "var(--blue)" },
  past_due: { text: "Pagamento pendente", color: "var(--orange)" },
  canceled: { text: "Cancelada",          color: "var(--text-3)" },
  inactive: { text: "Inativa",            color: "var(--text-3)" },
};

const rowStyle = { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 };
const labelStyle = { fontSize: 12, color: "var(--text-2)", textTransform: "uppercase", fontWeight: 600, letterSpacing: "0.06em" };

export default function Subscription() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadStatus()
      .then(setStatus)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handlePortal = async () => {
    setActionLoading("portal");
    setError("");
    try { await openPortal(); }
    catch (err) { setError(err.message); }
    finally { setActionLoading(null); }
  };

  const handleCheckout = async (priceId, plan) => {
    if (!priceId) { setError("Plano não configurado. Entre em contato com o suporte."); return; }
    setActionLoading(plan);
    setError("");
    try { await startCheckout(priceId); }
    catch (err) { setError(err.message); }
    finally { setActionLoading(null); }
  };

  const handleCopyReferral = () => {
    navigator.clipboard.writeText(status?.referralCode ?? "").then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (loading) return <div style={{ color: "var(--text-2)" }}>Carregando...</div>;
  if (error && !status) return <div style={{ color: "var(--error-text)" }}>{error}</div>;

  const sl = STATUS_LABELS[status?.status] ?? { text: status?.status, color: "var(--text-3)" };

  return (
    <div style={{ maxWidth: 480 }}>
      {error && (
        <div style={{ background: "var(--error-bg)", border: "1px solid var(--error-border)", borderRadius: 10, padding: "10px 14px", color: "var(--error-text)", fontSize: 14, marginBottom: 16 }}>
          {error}
        </div>
      )}

      <div className="card" style={{ padding: 20 }}>
        <p className="card-title">Assinatura</p>

        <div style={rowStyle}>
          <span style={labelStyle}>Status</span>
          <span style={{ fontWeight: 700, color: sl.color }}>{sl.text}</span>
        </div>

        {status?.status === "trialing" && (
          <div style={rowStyle}>
            <span style={labelStyle}>Teste restante</span>
            <span style={{ fontWeight: 700, color: "var(--text-1)" }}>{trialDaysRemaining(status.trialEndsAt)} dias</span>
          </div>
        )}

        {status?.status === "active" && status?.subscriptionEndsAt && (
          <div style={rowStyle}>
            <span style={labelStyle}>Próxima cobrança</span>
            <span style={{ fontWeight: 700, color: "var(--text-1)" }}>{new Date(status.subscriptionEndsAt).toLocaleDateString("pt-BR")}</span>
          </div>
        )}

        {status?.status === "trialing" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", top: -9, right: 14, background: "#FFFFFF", color: "var(--green)", boxShadow: "0 1px 4px rgba(0,0,0,0.25)", fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", padding: "2px 8px", borderRadius: 999, zIndex: 1 }}>
                2 meses grátis
              </span>
              <button className="btn-full btn-success" onClick={() => handleCheckout(PRICE_ANNUAL, "annual")} disabled={!!actionLoading}>
                {actionLoading === "annual" ? "Aguarde..." : "Plano Anual por R$ 299,00"}
              </button>
            </div>
            <button className="btn-full btn-ghost" onClick={() => handleCheckout(PRICE_MONTHLY, "monthly")} disabled={!!actionLoading}>
              {actionLoading === "monthly" ? "Aguarde..." : "Plano Mensal por R$ 29,90"}
            </button>
          </div>
        )}

        {status?.status === "active" && (
          <button className="btn-full" onClick={handlePortal} disabled={!!actionLoading} style={{ marginTop: 6 }}>
            {actionLoading === "portal" ? "Abrindo..." : "Gerenciar Assinatura"}
          </button>
        )}
      </div>

      {status?.referralCode && (
        <div className="card" style={{ padding: 20 }}>
          <p className="card-title">Indique e Ganhe</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
            {[
              { n: "1ª", reward: "25% OFF", highlight: false },
              { n: "2ª", reward: "50% OFF", highlight: false },
              { n: "3ª", reward: "MÊS GRÁTIS", highlight: true },
            ].map((tier) => (
              <div key={tier.n} style={{
                background: tier.highlight ? "var(--green-bg)" : "var(--surface-2)",
                border: `1px solid ${tier.highlight ? "var(--green)" : "var(--border)"}`,
                borderRadius: 10, padding: "10px 4px", textAlign: "center",
              }}>
                <div style={{ fontSize: 11, color: "var(--text-2)", fontWeight: 600, marginBottom: 2 }}>{tier.n} indicação</div>
                <div style={{ fontSize: 13, fontWeight: 800, color: tier.highlight ? "var(--green)" : "var(--text-1)" }}>{tier.reward}</div>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 12, color: "var(--text-2)", margin: "0 0 14px", lineHeight: 1.5, textAlign: "center" }}>
            Vale quando a indicação paga a 1ª fatura · plano mensal.
          </p>
          <div style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px", fontSize: 20, fontWeight: 700, letterSpacing: "0.15em", textAlign: "center", marginBottom: 10, color: "var(--text-1)", fontFamily: "monospace" }}>
            {status.referralCode}
          </div>
          <button className={`btn-full${copied ? " btn-success" : ""}`} onClick={handleCopyReferral}>
            {copied ? "✓ Copiado!" : "Copiar Código"}
          </button>
        </div>
      )}
    </div>
  );
}
