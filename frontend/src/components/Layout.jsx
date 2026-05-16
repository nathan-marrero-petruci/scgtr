import React from "react";
import { useNavigate } from "react-router-dom";
import authService from "../services/auth";

function Layout({ children }) {
  const navigate = useNavigate();
  const user = authService.getUser();

  const handleLogout = () => {
    authService.logout();
    navigate("/login");
  };

  return (
    <div>
      {/* Header */}
      <header
        style={{
          backgroundColor: "#2c3e50",
          color: "white",
          padding: "15px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h1 style={{ margin: 0 }}>SCGTR</h1>
        <div>
          <span style={{ marginRight: "15px" }}>Olá, {user?.email}</span>
          <button
            onClick={handleLogout}
            style={{
              padding: "5px 10px",
              backgroundColor: "#e74c3c",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Sair
          </button>
        </div>
      </header>

      {/* Menu */}
      <nav
        style={{
          backgroundColor: "#34495e",
          padding: "10px",
          display: "flex",
          gap: "20px",
        }}
      >
        <button style={menuButtonStyle}>Agenda</button>
        <button style={menuButtonStyle}>Registrar</button>
        <button style={menuButtonStyle}>Histórico</button>
        <button style={menuButtonStyle}>Config</button>
      </nav>

      {/* Conteúdo principal */}
      <main style={{ padding: "20px" }}>{children}</main>
    </div>
  );
}

const menuButtonStyle = {
  backgroundColor: "transparent",
  color: "white",
  border: "none",
  padding: "8px 16px",
  cursor: "pointer",
  fontSize: "16px",
};

export default Layout;
