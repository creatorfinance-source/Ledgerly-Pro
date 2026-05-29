import axios from "axios";

// Use env var if set, otherwise derive from current host
// This allows accessing from both localhost:3000 and 192.168.0.2:3000
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL ||
  `http://${window.location.hostname}:5000`;

export { BACKEND_URL };
export const API_BASE = `${BACKEND_URL}/api`;

const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("ledgerly_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;

export const CURRENCIES = [
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "EUR", symbol: "€", name: "Euro" },
  { code: "BDT", symbol: "৳", name: "Bangladeshi Taka" },
  { code: "LKR", symbol: "Rs", name: "Sri Lankan Rupee" },
  { code: "MYR", symbol: "RM", name: "Malaysian Ringgit" },
];

export function fmtCurrency(amount, code = "USD") {
  const cur = CURRENCIES.find((c) => c.code === code);
  const symbol = cur ? cur.symbol : code + " ";
  const num = Number(amount || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${symbol}${num}`;
}

export function fmtDate(s) {
  if (!s) return "";
  try {
    return new Date(s).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
  } catch {
    return s;
  }
}