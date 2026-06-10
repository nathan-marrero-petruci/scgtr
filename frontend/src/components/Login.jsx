import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import authService from "../services/auth";

function Login({ onLogin }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await authService.login(email, password);
      onLogin();
    } catch (err) {
      setError(err.message || "Erro ao fazer login");
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
          <p className="auth-subtitle">Controle de Ganhos</p>
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
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </label>
          </div>

          <div className="auth-actions">
            <button type="submit" className="btn-full" disabled={loading}>
              {loading ? "Entrando..." : "Entrar"}
            </button>
            <button
              type="button"
              className="btn-full btn-ghost"
              onClick={() => navigate("/register")}
            >
              Criar conta
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Login;
