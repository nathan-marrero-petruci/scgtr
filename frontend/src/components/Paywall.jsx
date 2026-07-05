import { useState } from "react";
import { startCheckout } from "../services/subscription";

const PRICE_MONTHLY = import.meta.env.VITE_STRIPE_PRICE_MONTHLY;
const PRICE_ANNUAL = import.meta.env.VITE_STRIPE_PRICE_ANNUAL;

export default function Paywall({ onLogout }) {
  const [loading, setLoading] = useState(null);
  const [error, setError] = useState("");

  const handleCheckout = async (priceId, plan) => {
    if (!priceId) { setError("Plano não configurado. Entre em contato com o suporte."); return; }
    setLoading(plan);
    setError("");
    try {
      await startCheckout(priceId);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ maxWidth: 440 }}>

        <div className="auth-header">
          <div className="auth-logo">SC</div>
          <h1 className="auth-title">SCGTR</h1>
          <p className="auth-subtitle">Controle de ganhos para entregadores</p>
        </div>

        <div style={{
          background: "var(--blue-bg)",
          border: "1px solid var(--blue)",
          borderRadius: 10,
          padding: "10px 14px",
          textAlign: "center",
          marginBottom: 20,
          fontSize: 13,
          fontWeight: 700,
          color: "var(--blue)",
          letterSpacing: "0.04em",
          textTransform: "uppercase",
        }}>
          Período gratuito encerrado — escolha seu plano
        </div>

        {error && <div className="auth-error" style={{ marginBottom: 16 }}>{error}</div>}

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{
            background: "var(--surface)",
            border: "2px solid var(--green)",
            borderRadius: 14,
            padding: 20,
            position: "relative",
          }}>
            <div style={{
              position: "absolute",
              top: -12,
              left: 16,
              background: "var(--green)",
              color: "#fff",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.08em",
              padding: "3px 10px",
              borderRadius: 6,
            }}>
              MELHOR VALOR
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-1)" }}>Anual</div>
                <div style={{ color: "var(--text-3)", fontSize: 13, marginTop: 2 }}>R$ 249 cobrado uma vez</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: 800, fontSize: 24, color: "var(--green)" }}>R$ 20,75</div>
                <div style={{ color: "var(--text-3)", fontSize: 12 }}>/mês</div>
              </div>
            </div>
            <button
              className="btn-full btn-success"
              onClick={() => handleCheckout(PRICE_ANNUAL, "annual")}
              disabled={!!loading}
              style={{ marginTop: 16 }}
            >
              {loading === "annual" ? "Aguarde..." : "Assinar Anual"}
            </button>
          </div>

          <div style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 14,
            padding: 20,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-2)" }}>Mensal</div>
                <div style={{ color: "var(--text-3)", fontSize: 13, marginTop: 2 }}>Cobrado todo mês</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: 800, fontSize: 24, color: "var(--text-1)" }}>R$ 24,90</div>
                <div style={{ color: "var(--text-3)", fontSize: 12 }}>/mês</div>
              </div>
            </div>
            <button
              className="btn-full btn-ghost"
              onClick={() => handleCheckout(PRICE_MONTHLY, "monthly")}
              disabled={!!loading}
              style={{ marginTop: 16 }}
            >
              {loading === "monthly" ? "Aguarde..." : "Assinar Mensal"}
            </button>
          </div>
        </div>

        <div style={{ textAlign: "center", marginTop: 20 }}>
          <button
            onClick={onLogout}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-3)",
              fontSize: 13,
              cursor: "pointer",
              textDecoration: "underline",
              minHeight: "unset",
              padding: "4px 8px",
            }}
          >
            Sair da conta
          </button>
        </div>
      </div>
    </div>
  );
}
