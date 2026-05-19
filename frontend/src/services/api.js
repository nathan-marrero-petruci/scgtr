import axios from "axios";
import authService from "./auth";

// FORÇANDO URL CORRETA
const API_URL = "http://localhost:5151/api";

console.log("🚀 API URL sendo usada:", API_URL);

const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
});

// Interceptor para adicionar token
api.interceptors.request.use(
  (config) => {
    console.log("📡 Fazendo requisição para:", config.baseURL + config.url);
    const token = authService.getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor para tratar erro 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error("❌ Erro na requisição:", error.config?.url, error.message);
    if (error.response?.status === 401) {
      authService.logout();
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default api;
