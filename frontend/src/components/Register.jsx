import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import authService from "../services/auth";

export default function Register({ onLogin }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [referralCode, setReferralCode] = useState(searchParams.get("ref") ?? "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await authService.register(email, password, referralCode || undefined);
      onLogin();
    } catch (err) {
      setError(err.message || "Erro ao criar conta");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo">SC</div>
          <h1 className="auth-title">SCGTR</h1>
          <p className="auth-subtitle">30 dias grátis, sem cartão</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {error && <div className="auth-error">{error}</div>}

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>
              Email
              <input
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                autoFocus
              />
            </label>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>
              Senha
              <input
                type="password"
                placeholder="Mín. 8 chars, maiúscula, número e especial"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
            </label>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>
              Código de indicação (opcional)
              <input
                type="text"
                placeholder="Ex: A1B2C3D4"
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                maxLength={8}
              />
            </label>
          </div>

          <div className="auth-actions">
            <button type="submit" className="btn-full" disabled={loading}>
              {loading ? "Criando conta..." : "Criar conta grátis"}
            </button>
            <button
              type="button"
              className="btn-full btn-ghost"
              onClick={() => navigate("/login")}
            >
              Já tenho conta
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
