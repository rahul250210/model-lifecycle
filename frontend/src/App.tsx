import Router from "./app/Router";
import DashboardLayout from "./layouts/DashboardLayout";
import { Routes, Route } from "react-router-dom";

export default function App() {
  return (
    <Routes>
      <Route element={<DashboardLayout />}>
        <Route path="/*" element={<Router />} />
      </Route>
    </Routes>
  );
}
