import { create } from "zustand";
import axios from "axios";

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
}

interface AuthStore {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (firstName: string, lastName: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true, // Start as true to prevent premature redirect

  login: async (email: string, password: string) => {
    set({ isLoading: true });
    try {
      const response = await axios.post("http://localhost:8000/api/auth/login", {
        email,
        password,
      });
      const { access_token, user } = response.data;
      
      console.log("Login successful, token:", access_token);
      localStorage.setItem("access_token", access_token);
      localStorage.setItem("user", JSON.stringify(user));
      
      // Set default authorization header
      axios.defaults.headers.common["Authorization"] = `Bearer ${access_token}`;
      
      set({
        token: access_token,
        user,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      set({ isAuthenticated: false, isLoading: false });
      throw error;
    }
  },

  signup: async (firstName: string, lastName: string, email: string, password: string) => {
    set({ isLoading: true });
    try {
      const response = await axios.post("http://localhost:8000/api/auth/signup", {
        first_name: firstName,
        last_name: lastName,
        email,
        password,
      });
      const { access_token, user } = response.data;
      
      console.log("Signup successful, token:", access_token);
      localStorage.setItem("access_token", access_token);
      localStorage.setItem("user", JSON.stringify(user));
      
      // Set default authorization header
      axios.defaults.headers.common["Authorization"] = `Bearer ${access_token}`;
      
      set({
        token: access_token,
        user,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      set({ isAuthenticated: false, isLoading: false });
      throw error;
    }
  },

  logout: () => {
    console.log("Logging out");
    localStorage.removeItem("access_token");
    localStorage.removeItem("user");
    delete axios.defaults.headers.common["Authorization"];
    set({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
    });
  },

  checkAuth: () => {
    console.log("Checking auth...");
    const token = localStorage.getItem("access_token");
    const user = localStorage.getItem("user");
    
    console.log("Token from localStorage:", token ? "exists" : "not found");
    console.log("User from localStorage:", user ? "exists" : "not found");
    
    if (token && user) {
      try {
        axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
        set({
          token,
          user: JSON.parse(user),
          isAuthenticated: true,
          isLoading: false,
        });
        console.log("Auth restored from localStorage");
      } catch (error) {
        console.error("Error parsing user from localStorage:", error);
        set({
          isAuthenticated: false,
          isLoading: false,
        });
      }
    } else {
      console.log("No token/user in localStorage, setting not authenticated");
      set({
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },
}));
