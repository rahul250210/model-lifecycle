import { Routes, Route, Navigate } from "react-router-dom";
import DashboardLayout from "../layouts/DashboardLayout";
import { useState, useEffect } from "react";

import FactoryList from "../pages/factories/FactoryList";
import ArtifactsDashboard from "../pages/artifacts/ArtifactsDashboard";
import axios from "../api/axios";

interface Artifact {
  id: number;
  name: string;
  type: string;
  size: number;
}

export default function AppRoutes() {
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);

  useEffect(() => {
    const fetchArtifacts = async () => {
      try {
        const res = await axios.get("/artifacts");
        setArtifacts(res.data);
      } catch (err) {
        console.error("Failed to load artifacts", err);
      }
    };
    fetchArtifacts();
  }, []);

  return (
    <Routes>
      <Route element={<DashboardLayout />}>
        <Route path="/" element={<Navigate to="/factories" />} />
        <Route path="/factories" element={<FactoryList />} />
        <Route path="/artifacts" element={<ArtifactsDashboard artifacts={artifacts} />} />
      </Route>
    </Routes>
  );
}
