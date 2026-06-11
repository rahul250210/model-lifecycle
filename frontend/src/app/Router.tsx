import { Suspense, lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Box, CircularProgress, Typography } from "@mui/material";

/* =======================
   Factory Pages (Lazy)
======================= */
const FactoryList = lazy(() => import("../pages/factories/FactoryList"));
const FactoryCreate = lazy(() => import("../pages/factories/FactoryCreate"));
const FactoryOverview = lazy(() => import("../pages/factories/FactoryOverview"));
const FactoryListForAlgorithm = lazy(() => import("../pages/factories/FactoryListForAlgorithm"));

/* =======================
   Dashboard Page (Lazy)
======================= */
const Dashboard = lazy(() => import("../pages/dashboard/Dashboard"));

/* =======================
   Algorithm Pages (Lazy)
======================= */
const AlgorithmList = lazy(() => import("../pages/algorithms/AlgorithmList"));
const AlgorithmCreate = lazy(() => import("../pages/algorithms/AlgorithmCreate"));

/* =======================
   Model Pages (Lazy)
======================= */
const ModelList = lazy(() => import("../pages/models/ModelList"));
const ModelCreate = lazy(() => import("../pages/models/ModelCreate"));
const ModelOverview = lazy(() => import("../pages/models/ModelOverview"));

/* =======================
   Version Pages (Lazy)
======================= */
const VersionTimeline = lazy(() => import("../pages/versions/VersionTimeline"));
const VersionCreate = lazy(() => import("../pages/versions/VersionCreate"));
const VersionDetails = lazy(() => import("../pages/versions/VersionDetails"));
const VersionCompare = lazy(() => import("../pages/versions/VersionCompare"));
const VersionEdit = lazy(() => import("../pages/versions/VersionEdit"));

/* =======================
   Experiment Pages (Lazy)
======================= */
const ExperimentList = lazy(() => import("../pages/experiments/ExperimentList"));
const ExperimentCreate = lazy(() => import("../pages/experiments/ExperimentCreate"));
const ExperimentRun = lazy(() => import("../pages/experiments/ExperimentRun"));

/* =======================
   Artifact Pages (Lazy)
======================= */
const ArtifactBrowser = lazy(() => import("../pages/artifacts/ArtifactBrowser"));
const ArtifactViewer = lazy(() => import("../pages/artifacts/ArtifactViewer"));
const AlgorithmArtifactPage = lazy(() => import("../pages/artifacts/AlgorithmArtifactPage"));

// Simple Full Page Loader
const PageLoader = () => (
  <Box sx={{
    height: '100%',
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2
  }}>
    <CircularProgress size={40} thickness={4} />
    <Typography variant="body2" color="text.secondary">Loading...</Typography>
  </Box>
);

export default function Router() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* =======================
            Root
        ======================= */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        {/* =======================
            Dashboard
        ======================= */}
        <Route path="/dashboard" element={<Dashboard />} />

        {/* =======================
            Factories (Management)
        ======================= */}
        <Route path="/factories" element={<FactoryList />} />
        <Route path="/factories/create" element={<FactoryCreate />} />
        <Route path="/factories/:factoryId" element={<FactoryOverview />} />

        {/* =======================
            Algorithms (PRIMARY ENTRY)
        ======================= */}
        <Route path="/algorithms" element={<AlgorithmList />} />
        <Route path="/algorithms/create" element={<AlgorithmCreate />} />
        <Route path="/algorithms/:algorithmId/factories" element={<FactoryListForAlgorithm />} />

        {/* =======================
            Models
        ======================= */}
        <Route
          path="/algorithms/:algorithmId/factories/:factoryId/models"
          element={<ModelList />}
        />
        <Route
          path="/algorithms/:algorithmId/factories/:factoryId/models/create"
          element={<ModelCreate />}
        />
        <Route
          path="/algorithms/:algorithmId/factories/:factoryId/models/:modelId"
          element={<ModelOverview />}
        />

        {/* =======================
            Versions (DVC)
        ======================= */}
        <Route
          path="/algorithms/:algorithmId/factories/:factoryId/models/:modelId/versions"
          element={<VersionTimeline />}
        />
        <Route
          path="/algorithms/:algorithmId/factories/:factoryId/models/:modelId/versions/compare"
          element={<VersionCompare />}
        />
        <Route
          path="/algorithms/:algorithmId/factories/:factoryId/models/:modelId/versions/create"
          element={<VersionCreate />}
        />
        <Route
          path="/algorithms/:algorithmId/factories/:factoryId/models/:modelId/versions/:versionId"
          element={<VersionDetails />}
        />
        <Route
          path="/algorithms/:algorithmId/factories/:factoryId/models/:modelId/versions/:versionId/edit"
          element={<VersionEdit />}
        />

        {/* =======================
            Experiments (MLflow)
        ======================= */}
        <Route
          path="/algorithms/:algorithmId/factories/:factoryId/models/:modelId/experiments"
          element={<ExperimentList />}
        />
        <Route
          path="/algorithms/:algorithmId/factories/:factoryId/models/:modelId/experiments/create"
          element={<ExperimentCreate />}
        />
        <Route
          path="/algorithms/:algorithmId/factories/:factoryId/models/:modelId/experiments/:experimentId/runs/:runId"
          element={<ExperimentRun />}
        />

        {/* =======================
            Artifacts
        ======================= */}
        <Route path="/artifacts" element={<ArtifactBrowser />} />
        <Route
          path="/artifacts/algorithms/:algorithmId"
          element={<AlgorithmArtifactPage />}
        />

        {/* Version-level artifacts */}
        <Route
          path="/algorithms/:algorithmId/factories/:factoryId/models/:modelId/versions/:versionId/artifacts/:artifactId"
          element={<ArtifactViewer />}
        />

        {/* =======================
            Fallback
        ======================= */}
        <Route path="*" element={<Navigate to="/algorithms" />} />
      </Routes>
    </Suspense>
  );
}
