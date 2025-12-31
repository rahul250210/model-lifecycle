import { Routes, Route, Navigate } from "react-router-dom";
import DashboardLayout from "../layouts/DashboardLayout";

import FactoryList from "../pages/factories/FactoryList";
import ModelsPage from "../pages/models/ModelsPage";
import VersionsPage from "../pages/versions/VersionsPage";
import ExperimentsPage from "../pages/experiments/ExperimentsPage";
import ArtifactsPage from "../pages/artifacts/ArtifactsPage";

export default function AppRoutes() {
  return (
    <Routes>
      <Route element={<DashboardLayout />}>
        <Route path="/" element={<Navigate to="/factories" />} />
        <Route path="/factories" element={<FactoryList />} />
        <Route path="/models" element={<ModelsPage />} />
        <Route path="/versions" element={<VersionsPage />} />
        <Route path="/experiments" element={<ExperimentsPage />} />
        <Route path="/artifacts" element={<ArtifactsPage />} />
      </Route>
    </Routes>
  );
}
