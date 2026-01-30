import axios from "axios";
//import { useAuthStore } from "../app/authStore";

const instance = axios.create({
  baseURL: "http://107.108.32.234:81",
  withCredentials: true,
});

instance.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default instance;