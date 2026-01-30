import Router from "./app/Router";
import DashboardLayout from "./layouts/DashboardLayout";
// import Login from "./pages/auth/Login";
// import Signup from "./pages/auth/Signup";
// import { ProtectedRoute } from "./app/ProtectedRoute";
import { Routes, Route, Navigate } from "react-router-dom";
// import { useEffect } from "react";
// import { useAuthStore } from "./app/authStore";

export default function App() {
  // const { checkAuth } = useAuthStore();

  // useEffect(() => {
  //   // Check authentication on app startup
  //   console.log("App mounted - checking authentication");
  //   checkAuth();
  // }, [checkAuth]);

  return (
    <Routes>
      {/* Auth routes (no layout) - COMMENTED FOR TESTING */}
      {/* <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} /> */}

      {/* Dashboard routes with layout - protected */}
      <Route
        element={
          // <ProtectedRoute>
            <DashboardLayout />
          // </ProtectedRoute>
        }
      >
        <Route path="/*" element={<Router />} />
      </Route>

      {/* Root redirect */}
      <Route path="/" element={<Navigate to="/factories" replace />} />
    </Routes>
  );
}
