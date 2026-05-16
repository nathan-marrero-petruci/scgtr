import axios from "axios";
import { jwtDecode } from "jwt-decode";

const resolveApiUrl = () => {
  const env = import.meta.env.VITE_API_URL;
  if (env) return env.replace(/\/+$/, "").replace(/\/api$/i, "") + "/api";
  try {
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1")
      return "http://localhost:5151/api";
  } catch {}
  return "/api";
};

const API_URL = resolveApiUrl();

class AuthService {
  async register(email, password) {
    try {
      const response = await axios.post(`${API_URL}/auth/register`, {
        email,
        password,
      });
      if (response.data.token) this.setAuthData(response.data);
      return response.data;
    } catch (error) {
      console.error(error?.response?.status ?? "auth error");
      throw error.response?.data || { message: "Erro ao registrar" };
    }
  }

  async login(email, password) {
    try {
      const response = await axios.post(`${API_URL}/auth/login`, {
        email,
        password,
      });
      if (response.data.token) this.setAuthData(response.data);
      return response.data;
    } catch (error) {
      console.error(error?.response?.status ?? "auth error");
      throw error.response?.data || { message: "Erro ao fazer login" };
    }
  }

  setAuthData(data) {
    localStorage.setItem("token", data.token);
    localStorage.setItem(
      "user",
      JSON.stringify({
        email: data.email,
        userId: data.userId,
      })
    );
  }

  logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  }

  getToken() {
    return localStorage.getItem("token");
  }

  getUser() {
    const user = localStorage.getItem("user");
    return user ? JSON.parse(user) : null;
  }

  isAuthenticated() {
    const token = this.getToken();
    if (!token) return false;

    try {
      const decoded = jwtDecode(token);
      return decoded.exp > Date.now() / 1000;
    } catch {
      return false;
    }
  }
}

export default new AuthService();
