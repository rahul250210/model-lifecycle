import { Routes, Route, Navigate } from "react-router-dom";

/* =======================
   Factory Pages
======================= */
import FactoryList from "../pages/factories/FactoryList";
import FactoryCreate from "../pages/factories/FactoryCreate";
import FactoryOverview from "../pages/factories/FactoryOverview";

/* =======================
   Algorithm Pages
======================= */
import AlgorithmList from "../pages/algorithms/AlgorithmList";
import AlgorithmCreate from "../pages/algorithms/AlgorithmCreate";

/* =======================
   Model Pages
======================= */
import ModelList from "../pages/models/ModelList";
import ModelCreate from "../pages/models/ModelCreate";
import ModelOverview from "../pages/models/ModelOverview";

/* =======================
   Version Pages
======================= */
import VersionTimeline from "../pages/versions/VersionTimeline";
import VersionCreate from "../pages/versions/VersionCreate";
import VersionDetails from "../pages/versions/VersionDetails";
import VersionCompare from "../pages/versions/VersionCompare";
import VersionEdit from "../pages/versions/VersionEdit";


/* =======================
   Experiment Pages
======================= */
import ExperimentList from "../pages/experiments/ExperimentList";
import ExperimentCreate from "../pages/experiments/ExperimentCreate";
import ExperimentRun from "../pages/experiments/ExperimentRun";

/* =======================
   Artifact Pages
======================= */
import ArtifactBrowser from "../pages/artifacts/ArtifactBrowser";
import ArtifactViewer from "../pages/artifacts/ArtifactViewer";

export default function Router() {
  return (
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
      <Route
        path="/factories/:factoryId/algorithms/:algorithmId/models/:modelId/versions/:versionId/artifacts"
        element={<ArtifactBrowser />}
      />
      <Route
        path="/artifacts/:artifactId"
        element={<ArtifactViewer />}
      />

      {/* =======================
          Fallback
      ======================= */}
      <Route path="*" element={<Navigate to="/factories" />} />
    </Routes>
  );
}
