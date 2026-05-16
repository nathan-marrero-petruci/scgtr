import React, { useState, useEffect } from "react";
import Layout from "./Layout";
import api from "../services/api";

function Dashboard() {
  const [ganhos, setGanhos] = useState([]);

  useEffect(() => {
    carregarGanhos();
  }, []);

  const carregarGanhos = async () => {
    try {
      const response = await api.get("/ganhos");
      setGanhos(response.data);
    } catch (error) {
      console.error("Erro ao carregar ganhos:", error);
    }
  };

  return (
    <Layout>
      <div>
        <h2>Próximos Recebimentos</h2>

        {/* Filtros */}
        <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
          <button>Futuros</button>
          <button>Recebidos</button>
          <button>Atrasados</button>
          <button>Todos</button>
        </div>

        {/* Lista de ganhos */}
        {ganhos.length === 0 ? (
          <p>Nenhum ganho cadastrado</p>
        ) : (
          ganhos.map((ganho) => (
            <div
              key={ganho.id}
              style={{
                border: "1px solid #ddd",
                borderRadius: "8px",
                padding: "15px",
                marginBottom: "15px",
                backgroundColor: "#f9f9f9",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <h3 style={{ margin: "0 0 5px 0" }}>{ganho.descricao}</h3>
                  <p style={{ margin: 0, color: "#666" }}>
                    Data: {new Date(ganho.data).toLocaleDateString()}
                  </p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p
                    style={{
                      margin: 0,
                      fontSize: "18px",
                      fontWeight: "bold",
                      color: "#27ae60",
                    }}
                  >
                    R$ {ganho.valor.toFixed(2)}
                  </p>
                  <button
                    style={{
                      marginTop: "5px",
                      padding: "5px 10px",
                      backgroundColor: "#3498db",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                    }}
                  >
                    Confirmar recebimento
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </Layout>
  );
}

export default Dashboard;
