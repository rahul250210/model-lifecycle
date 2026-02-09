import axios from "axios";
//import { useAuthStore } from "../app/authStore";

// Dynamically determine the API base URL based on the current window location
const protocol = window.location.protocol;
export const API_BASE_URL = `${protocol}//localhost:8000`;

const instance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  timeout: 600000,
});

instance.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default instance;