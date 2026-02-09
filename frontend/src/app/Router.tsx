import { Suspense, lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Box, CircularProgress, Typography } from "@mui/material";

/* =======================
   Factory Pages (Lazy)
======================= */
const FactoryList = lazy(() => import("../pages/factories/FactoryList"));
const FactoryCreate = lazy(() => import("../pages/factories/FactoryCreate"));
const FactoryOverview = lazy(() => import("../pages/factories/FactoryOverview"));

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
        <Route path="/" element={<Navigate to="/factories" replace />} />

        {/* =======================
            Factories
        ======================= */}
        <Route path="/factories" element={<FactoryList />} />
        <Route path="/factories/create" element={<FactoryCreate />} />

        {/* OPTIONAL overview (not primary entry) */}
        <Route path="/factories/:factoryId/overview" element={<FactoryOverview />} />

        {/* =======================
            Algorithms (PRIMARY ENTRY AFTER FACTORY CLICK)
        ======================= */}
        <Route
          path="/factories/:factoryId/algorithms"
          element={<AlgorithmList />}
        />
        <Route
          path="/factories/:factoryId/algorithms/create"
          element={<AlgorithmCreate />}
        />

        {/* =======================
            Models
        ======================= */}
        <Route
          path="/factories/:factoryId/algorithms/:algorithmId/models"
          element={<ModelList />}
        />
        <Route
          path="/factories/:factoryId/algorithms/:algorithmId/models/create"
          element={<ModelCreate />}
        />
        <Route
          path="/factories/:factoryId/algorithms/:algorithmId/models/:modelId"
          element={<ModelOverview />}
        />

        {/* =======================
            Versions (DVC)
        ======================= */}
        <Route
          path="/factories/:factoryId/algorithms/:algorithmId/models/:modelId/versions"
          element={<VersionTimeline />}
        />
        <Route
          path="/factories/:factoryId/algorithms/:algorithmId/models/:modelId/versions/create"
          element={<VersionCreate />}
        />
        <Route
          path="/factories/:factoryId/algorithms/:algorithmId/models/:modelId/versions/:versionId"
          element={<VersionDetails />}
        />
        <Route
          path="/factories/:factoryId/algorithms/:algorithmId/models/:modelId/versions/compare"
          element={<VersionCompare />}
        />

        <Route
          path="/factories/:factoryId/algorithms/:algorithmId/models/:modelId/versions/:versionId/edit"
          element={<VersionEdit />}
        />

        {/* =======================
            Experiments (MLflow)
        ======================= */}
        <Route
          path="/factories/:factoryId/algorithms/:algorithmId/models/:modelId/experiments"
          element={<ExperimentList />}
        />
        <Route
          path="/factories/:factoryId/algorithms/:algorithmId/models/:modelId/experiments/create"
          element={<ExperimentCreate />}
        />
        <Route
          path="/factories/:factoryId/algorithms/:algorithmId/models/:modelId/experiments/:experimentId/runs/:runId"
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
          path="/factories/:factoryId/algorithms/:algorithmId/models/:modelId/versions/:versionId/artifacts/:artifactId"
          element={<ArtifactViewer />}
        />


        {/* =======================
            Fallback
        ======================= */}
        <Route path="*" element={<Navigate to="/factories" />} />
      </Routes>
    </Suspense>
  );
}
