"use client";

import { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  CircularProgress,
  Chip,
  Button,
  Divider,
  Stack,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Checkbox,
  FormControlLabel,
  Switch,
} from "@mui/material";

import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DownloadIcon from "@mui/icons-material/Download";
import VisibilityIcon from "@mui/icons-material/Visibility";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import ImageIcon from "@mui/icons-material/Image";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

import { useNavigate, useParams } from "react-router-dom";
import axios from "../../api/axios";

/* =======================
   Types
======================= */

interface Version {
  id: number;
  version_number: number;
  note?: string;
  is_active: boolean;
  created_at: string;

  accuracy?: number;
  precision?: number;
  recall?: number;
  f1_score?: number;
}

interface Artifact {
  id: number;
  name: string;
  type: "dataset" | "model" | "metrics" | "code" | string;
  size: number;
  checksum: string;
}

interface VersionDelta {
  added: number;
  removed: number;
  unchanged: number;
}

/* =======================
   Component
======================= */

export default function VersionDetails() {
  const { factoryId, algorithmId, modelId, versionId } = useParams();
  const navigate = useNavigate();

  const [version, setVersion] = useState<Version | null>(null);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [delta, setDelta] = useState<VersionDelta | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDatasetImages, setShowDatasetImages] = useState(false);
  const [visibleImageCount, setVisibleImageCount] = useState(6);
 
  const [showFullDataset, setShowFullDataset] = useState(false);
 

  /* Download dialog state */
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [downloadSelect, setDownloadSelect] = useState({
    dataset: true,
    model: true,
    metrics: false,
    code: false,
  });

  /* =======================
     Fetch data
  ======================= */

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [versionRes, artifactsRes, deltaRes] = await Promise.all([
          axios.get(
            `/factories/${factoryId}/algorithms/${algorithmId}/models/${modelId}/versions/${versionId}`
          ),
          axios.get(
            `/factories/${factoryId}/algorithms/${algorithmId}/models/${modelId}/versions/${versionId}/artifacts`
          ),
          axios.get(
            `/factories/${factoryId}/algorithms/${algorithmId}/models/${modelId}/versions/${versionId}/delta`
          ),
        ]);

        setVersion(versionRes.data);
        setArtifacts(artifactsRes.data);
        setDelta(deltaRes.data);
      } catch (err) {
        console.error("Failed to load version details", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [factoryId, algorithmId, modelId, versionId]);

  if (loading) {
    return (
      <Box sx={{ height: "70vh", display: "flex", justifyContent: "center", alignItems: "center" }}>
        <CircularProgress size={42} />
      </Box>
    );
  }

  if (!version || !delta) {
    return <Typography color="error">Version not found</Typography>;
  }

  /* =======================
     Group artifacts
  ======================= */

  const datasetFiles = artifacts.filter((a) => a.type === "dataset");
  const modelFiles = artifacts.filter((a) => a.type === "model");
  const addedDatasetFiles=delta && delta.added >0 ? datasetFiles.slice(0,delta.added) : [];
   const isFirstVersion = version.version_number === 1;
  const displayedDataset = isFirstVersion 
    ? datasetFiles : showFullDataset ? datasetFiles 
    : addedDatasetFiles;

  const codeFiles = artifacts.filter((a) => a.type === "code");
  
 
  /* =======================
     File Renderer
  ======================= */

  const renderFileList = (items: Artifact[]) => {
    if (!items.length) {
      return <Typography color="text.secondary">No files uploaded.</Typography>;
    }

    return (
      <Stack spacing={2}>
        {items.map((a) => (
          <Card key={a.id} variant="outlined">
            <CardContent>
              <Typography fontWeight={600}>{a.name}</Typography>
              <Typography variant="caption" color="text.secondary">
                {(a.size / 1024).toFixed(2)} KB · {a.checksum.slice(0, 8)}
              </Typography>

              <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                <Button
                  size="small"
                  startIcon={<VisibilityIcon />}
                  onClick={() => navigate(`/artifacts/${a.id}`)}
                >
                  Preview
                </Button>

                <Button
                  size="small"
                  startIcon={<DownloadIcon />}
                  href={`http://127.0.0.1:8000/artifacts/${a.id}/download`}
                >
                  Download
                </Button>

                <Button
                  size="small"
                  color="error"
                  startIcon={<DeleteIcon />}
                  onClick={async () => {
                    if (!confirm("Delete this artifact?")) return;
                    await axios.delete(`/artifacts/${a.id}`);
                    setArtifacts((prev) => prev.filter((x) => x.id !== a.id));
                  }}
                >
                  Delete
                </Button>
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Stack>
    );
  };

   const metricColor = (v?: number | null) => {
  if (typeof v !== "number") return "grey.400";
  if (v >= 90) return "success.main";
  if (v >= 75) return "info.main";
  if (v >= 50) return "warning.main";
  return "error.main";
};

const metricLabel = (v?: number | null) => {
  if (typeof v !== "number") return "N/A";
  if (v >= 90) return "Excellent";
  if (v >= 75) return "Good";
  if (v >= 50) return "Average";
  return "Needs Improvement";
};

  /* =======================
     Render
  ======================= */

  return (
    <Box sx={{ p: 4 }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", mb: 3 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() =>
            navigate(`/factories/${factoryId}/algorithms/${algorithmId}/models/${modelId}/versions`)
          }
          sx={{ mr: 2 }}
        >
          Back
        </Button>

        <Typography variant="h4" fontWeight={700}>
          Version v{version.version_number}
        </Typography>

        {version.is_active && <Chip label="ACTIVE" color="success" sx={{ ml: 2 }} />}

        <Box sx={{ ml: "auto", display: "flex", gap: 1 }}>
          <Button
            variant="contained"
            startIcon={<DownloadIcon />}
            onClick={() => setDownloadOpen(true)}
          >
            Download Version
          </Button>

          <Button
            startIcon={<EditIcon />}
            onClick={() =>
              navigate(
                `/factories/${factoryId}/algorithms/${algorithmId}/models/${modelId}/versions/${versionId}/edit`
              )
            }
          >
            Edit
          </Button>

          <Button
            color="error"
            startIcon={<DeleteIcon />}
            onClick={async () => {
              if (!confirm("Delete this version?")) return;
              await axios.delete(
                `/factories/${factoryId}/algorithms/${algorithmId}/models/${modelId}/versions/${versionId}`
              );
              navigate(
                `/factories/${factoryId}/algorithms/${algorithmId}/models/${modelId}/versions`
              );
            }}
          >
            Delete
          </Button>
        </Box>
      </Box>

      {/* Summary */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Typography variant="h6" fontWeight={600}>
            Version Summary
          </Typography>
          <Divider sx={{ my: 2 }} />
          {version.note && <Typography>{version.note}</Typography>}
          <Typography color="text.secondary">
            Created on {new Date(version.created_at).toLocaleString()}
          </Typography>
        </CardContent>
      </Card>

      {/* Dataset */}
      <Typography variant="h5" fontWeight={600} sx={{ mb: 2 }}>
        Dataset
      </Typography>

      <Card variant="outlined" sx={{ mb: 4 }}>
  <CardContent
    sx={{
      maxHeight: 420,
      overflowX: "auto",
      overflowY: "hidden",
    }}
  >
    {/* Header */}
    <Box sx={{ display: "flex", justifyContent: "space-between", mb: 2 }}>
      <Box>
        <Typography fontWeight={600}>Dataset</Typography>
        <Typography variant="caption" color="text.secondary">
          {displayedDataset.length} images
        </Typography>
      </Box>

      {/* Toggle ONLY for version > 1 */}
      {!isFirstVersion && (
        <FormControlLabel
          control={
            <Switch
              checked={showFullDataset}
              onChange={() => setShowFullDataset(v => !v)}
            />
          }
          label="Show full dataset"
        />
      )}
    </Box>

    {/* Delta chips */}
    {delta && !isFirstVersion && (
      <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
        <Chip label={`➕ Added: ${delta.added}`} color="success" />
        <Chip label={`➖ Removed: ${delta.removed}`} color="error" />
        <Chip label={`✓ Unchanged: ${delta.unchanged}`} />
      </Stack>
    )}

    {/* IMAGE STRIP */}
    <Box sx={{ display: "flex", gap: 2 }}>
      {displayedDataset.slice(0, visibleImageCount).map(img => (
        <Box
          key={img.id}
          sx={{ minWidth: 160, maxWidth: 160, flexShrink: 0 }}
        >
          <Card variant="outlined">
            <img
              src={`http://127.0.0.1:8000/artifacts/${img.id}/image`}
              alt={img.name}
              loading="lazy"
              style={{
                width: "100%",
                height: 120,
                objectFit: "cover",
              }}
            />
            <Typography
              variant="caption"
              sx={{
                display: "block",
                textAlign: "center",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                p: 0.5,
              }}
            >
              {img.name}
            </Typography>
          </Card>
        </Box>
      ))}
    </Box>

    {/* VIEW CONTROLS — ALWAYS PRESENT */}
    <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
      {visibleImageCount < displayedDataset.length && (
        <Button
          size="small"
          onClick={() =>
            setVisibleImageCount(c =>
              Math.min(c + 6, displayedDataset.length)
            )
          }
        >
          View More
        </Button>
      )}

      {visibleImageCount > 6 && (
        <Button size="small" onClick={() => setVisibleImageCount(6)}>
          View Less
        </Button>
      )}
    </Stack>
  </CardContent>
</Card>


      {/* Other Artifacts */}
      <Typography variant="h5" fontWeight={600}>Model</Typography>
      {renderFileList(modelFiles)}

      {/* ================= METRICS DASHBOARD ================= */}
<Typography variant="h5" fontWeight={600} sx={{ mt: 4, mb: 2 }}>
  Model Evaluation Metrics
</Typography>

<Card variant="outlined">
  <CardContent>
    <Grid container spacing={3}>
      {[
        { label: "Accuracy", value: version.accuracy },
        { label: "Precision", value: version.precision },
        { label: "Recall", value: version.recall },
        { label: "F1 Score", value: version.f1_score },
      ].map((m) => (
        <Grid item xs={12} sm={6} md={3} key={m.label}>
          <Card
            variant="outlined"
            sx={{
              textAlign: "center",
              borderRadius: 3,
              p: 2,
              height: "100%",
            }}
          >
            <Typography variant="subtitle2" color="text.secondary">
              {m.label}
            </Typography>

            <Typography
              variant="h4"
              fontWeight={700}
              sx={{ mt: 1, color: metricColor(m.value) }}
            >
              {typeof m.value === "number" ? `${m.value.toFixed(2)}%` : "--"}
            </Typography>

            {/* Progress Bar */}
            <Box
              sx={{
                height: 8,
                borderRadius: 4,
                backgroundColor: "grey.200",
                mt: 2,
                overflow: "hidden",
              }}
            >
              <Box
                sx={{
                  height: "100%",
                 width: `${Math.min(m.value ?? 0, 100)}%`,
                  backgroundColor: metricColor(m.value),
                }}
              />
            </Box>

            <Chip
              size="small"
              label={metricLabel(m.value)}
              sx={{
                mt: 1.5,
                fontWeight: 500,
                bgcolor: metricColor(m.value),
                color: "#fff",
              }}
            />
          </Card>
        </Grid>
      ))}
    </Grid>
  </CardContent>
</Card>


      <Typography variant="h5" fontWeight={600} sx={{ mt: 4 }}>Code</Typography>
      {renderFileList(codeFiles)}

      {/* Download Dialog */}
      <Dialog open={downloadOpen} onClose={() => setDownloadOpen(false)}>
        <DialogTitle>Select artifacts to download</DialogTitle>
        <DialogContent>
          {["dataset", "model", "metrics", "code"].map((k) => (
            <FormControlLabel
              key={k}
              control={
                <Checkbox
                  checked={(downloadSelect as any)[k]}
                  onChange={(e) =>
                    setDownloadSelect({ ...downloadSelect, [k]: e.target.checked })
                  }
                />
              }
              label={k.toUpperCase()}
            />
          ))}
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setDownloadOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => {
              const params = new URLSearchParams(
                Object.entries(downloadSelect)
                  .filter(([_, v]) => v)
                  .map(([k]) => [k, "true"])
              );

              window.open(
                `http://127.0.0.1:8000/factories/${factoryId}/algorithms/${algorithmId}/models/${modelId}/versions/${versionId}/download?${params}`,
                "_blank"
              );
              setDownloadOpen(false);
            }}
          >
            Download
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
