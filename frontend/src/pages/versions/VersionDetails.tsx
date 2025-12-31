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
  IconButton,
  alpha,
  Container,
  Paper,
} from "@mui/material";

import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DownloadIcon from "@mui/icons-material/Download";
import VisibilityIcon from "@mui/icons-material/Visibility";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import ImageIcon from "@mui/icons-material/Image";
import HubIcon from "@mui/icons-material/Hub";
import CodeIcon from "@mui/icons-material/Code";
import AssessmentIcon from "@mui/icons-material/Assessment";
import HistoryIcon from "@mui/icons-material/History";

import { useNavigate, useParams } from "react-router-dom";
import axios from "../../api/axios";

/* ==========================================================================
   CONSISTENT THEME PALETTE
   ========================================================================== */
const themePalette = {
  primary: "#4F46E5",
  primaryLight: "#EEF2FF",
  textMain: "#1E293B",
  textMuted: "#64748B",
  background: "#F8FAFC",
  border: "#E2E8F0",
  white: "#FFFFFF",
  success: "#10B981",
  warning: "#F59E0B",
  error: "#EF4444",
};

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

export default function VersionDetails() {
  const { factoryId, algorithmId, modelId, versionId } = useParams();
  const navigate = useNavigate();

  const [version, setVersion] = useState<Version | null>(null);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [delta, setDelta] = useState<VersionDelta | null>(null);
  const [loading, setLoading] = useState(true);
  const [visibleImageCount, setVisibleImageCount] = useState(6);
  const [showFullDataset, setShowFullDataset] = useState(false);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [downloadSelect, setDownloadSelect] = useState({
    dataset: true,
    model: true,
    metrics: false,
    code: false,
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [versionRes, artifactsRes, deltaRes] = await Promise.all([
          axios.get(`/factories/${factoryId}/algorithms/${algorithmId}/models/${modelId}/versions/${versionId}`),
          axios.get(`/factories/${factoryId}/algorithms/${algorithmId}/models/${modelId}/versions/${versionId}/artifacts`),
          axios.get(`/factories/${factoryId}/algorithms/${algorithmId}/models/${modelId}/versions/${versionId}/delta`),
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
        <CircularProgress size={40} sx={{ color: themePalette.primary }} />
      </Box>
    );
  }

  if (!version || !delta) return <Typography color="error">Version not found</Typography>;

  const datasetFiles = artifacts.filter((a) => a.type === "dataset");
  const modelFiles = artifacts.filter((a) => a.type === "model");
  const codeFiles = artifacts.filter((a) => a.type === "code");
  const isFirstVersion = version.version_number === 1;
  const addedDatasetFiles = delta && delta.added > 0 ? datasetFiles.slice(0, delta.added) : [];
  const displayedDataset = isFirstVersion ? datasetFiles : showFullDataset ? datasetFiles : addedDatasetFiles;

  const metricColor = (v?: number | null) => {
    if (typeof v !== "number") return themePalette.textMuted;
    if (v >= 90) return themePalette.success;
    if (v >= 75) return themePalette.primary;
    if (v >= 50) return themePalette.warning;
    return themePalette.error;
  };

  const renderFileList = (items: Artifact[], icon: React.ReactNode) => {
    if (!items.length) return <Typography variant="body2" sx={{ color: themePalette.textMuted, py: 2 }}>No specific artifacts found.</Typography>;

    return (
      <Stack spacing={2}>
        {items.map((a) => (
          <Paper key={a.id} elevation={0} sx={{ p: 2, borderRadius: "16px", border: `1px solid ${themePalette.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Stack direction="row" spacing={2} alignItems="center">
              <Box sx={{ p: 1, bgcolor: themePalette.background, borderRadius: "10px", color: themePalette.primary }}>{icon}</Box>
              <Box>
                <Typography variant="body2" fontWeight={700}>{a.name}</Typography>
                <Typography variant="caption" sx={{ color: themePalette.textMuted }}>
                  {(a.size / 1024).toFixed(2)} KB • Checksum: {a.checksum.slice(0, 8)}
                </Typography>
              </Box>
            </Stack>
            <Stack direction="row" spacing={1}>
              <IconButton size="small" onClick={() => navigate(`/artifacts/${a.id}`)}><VisibilityIcon fontSize="small" /></IconButton>
              <IconButton size="small" component="a" href={`http://127.0.0.1:8000/artifacts/${a.id}/download`}><DownloadIcon fontSize="small" /></IconButton>
              <IconButton size="small" color="error" onClick={async () => { if (confirm("Delete this artifact?")) { await axios.delete(`/artifacts/${a.id}`); setArtifacts(prev => prev.filter(x => x.id !== a.id)); }}}><DeleteIcon fontSize="small" /></IconButton>
            </Stack>
          </Paper>
        ))}
      </Stack>
    );
  };

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: themePalette.background, pb: 10 }}>
      <Container maxWidth="xl">
        {/* Header Section */}
        <Box sx={{ pt: 4, pb: 6 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Box>
              <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
                <IconButton 
                  onClick={() => navigate(`/factories/${factoryId}/algorithms/${algorithmId}/models/${modelId}/versions`)}
                  sx={{ bgcolor: themePalette.white, border: `1px solid ${themePalette.border}` }}
                >
                  <ArrowBackIcon fontSize="small" />
                </IconButton>
                <Stack direction="row" spacing={1}>
                  <Chip label={`v${version.version_number}`} sx={{ fontWeight: 800, bgcolor: themePalette.primary, color: 'white' }} />
                  {version.is_active && <Chip label="ACTIVE" sx={{ fontWeight: 800, bgcolor: alpha(themePalette.success, 0.1), color: themePalette.success }} />}
                </Stack>
              </Stack>
              <Typography variant="h3" fontWeight={900} sx={{ color: themePalette.textMain, letterSpacing: "-0.04em" }}>Version Details</Typography>
            </Box>

            <Stack direction="row" spacing={2}>
              <Button 
                variant="outlined" 
                startIcon={<EditIcon />} 
                onClick={() => navigate(`/factories/${factoryId}/algorithms/${algorithmId}/models/${modelId}/versions/${versionId}/edit`)}
                sx={{ borderRadius: "12px", textTransform: 'none', fontWeight: 700 }}
              >
                Edit
              </Button>
              <Button 
                variant="contained" 
                startIcon={<DownloadIcon />} 
                onClick={() => setDownloadOpen(true)}
                sx={{ bgcolor: themePalette.primary, borderRadius: "12px", textTransform: 'none', fontWeight: 700, px: 3 }}
              >
                Download Package
              </Button>
            </Stack>
          </Stack>
        </Box>

        <Grid container spacing={4}>
          {/* Left Column: Metrics & Summary */}
          <Grid item xs={12} lg={8}>
            <Stack spacing={4}>
              {/* Summary Card */}
              <Card elevation={0} sx={{ borderRadius: "24px", border: `1px solid ${themePalette.border}` }}>
                <CardContent sx={{ p: 4 }}>
                  <Typography variant="h6" fontWeight={800} sx={{ mb: 2 }}>Summary & Notes</Typography>
                  <Typography variant="body1" sx={{ color: themePalette.textMuted, mb: 3, lineHeight: 1.7 }}>
                    {version.note || "No specific notes provided for this model iteration."}
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  <Typography variant="caption" fontWeight={700} sx={{ color: themePalette.textMuted }}>
                    REGISTERED ON {new Date(version.created_at).toLocaleString().toUpperCase()}
                  </Typography>
                </CardContent>
              </Card>

              {/* Evaluation Metrics Dashboard */}
              <Box>
                <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 3 }}>
                  <AssessmentIcon sx={{ color: themePalette.primary }} />
                  <Typography variant="h5" fontWeight={800}>Evaluation Metrics</Typography>
                </Stack>
                <Grid container spacing={3}>
                  {[
                    { label: "Accuracy", value: version.accuracy },
                    { label: "Precision", value: version.precision },
                    { label: "Recall", value: version.recall },
                    { label: "F1 Score", value: version.f1_score },
                  ].map((m) => (
                    <Grid item xs={12} sm={6} md={3} key={m.label}>
                      <Paper elevation={0} sx={{ p: 3, borderRadius: "20px", border: `1px solid ${themePalette.border}`, textAlign: 'center' }}>
                        <Typography variant="caption" fontWeight={800} sx={{ color: themePalette.textMuted, textTransform: 'uppercase' }}>{m.label}</Typography>
                        <Typography variant="h4" fontWeight={900} sx={{ my: 1.5, color: metricColor(m.value) }}>
                          {typeof m.value === "number" ? `${m.value.toFixed(1)}%` : "--"}
                        </Typography>
                        <Box sx={{ height: 6, bgcolor: themePalette.background, borderRadius: 3, overflow: 'hidden' }}>
                          <Box sx={{ height: '100%', width: `${m.value || 0}%`, bgcolor: metricColor(m.value) }} />
                        </Box>
                      </Paper>
                    </Grid>
                  ))}
                </Grid>
              </Box>

              {/* Dataset Browser */}
              <Card elevation={0} sx={{ borderRadius: "24px", border: `1px solid ${themePalette.border}` }}>
                <CardContent sx={{ p: 4 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 4 }}>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <ImageIcon sx={{ color: themePalette.primary }} />
                      <Typography variant="h6" fontWeight={800}>Dataset Browser</Typography>
                      <Chip label={`${datasetFiles.length} Total`} size="small" variant="outlined" />
                    </Stack>
                    {!isFirstVersion && (
                      <FormControlLabel
                        control={<Switch checked={showFullDataset} onChange={() => setShowFullDataset(v => !v)} color="primary" />}
                        label={<Typography variant="body2" fontWeight={700}>Show Full Dataset</Typography>}
                      />
                    )}
                  </Stack>

                  {delta && !isFirstVersion && (
                    <Stack direction="row" spacing={2} sx={{ mb: 4 }}>
                      <Chip label={`Added: ${delta.added}`} size="small" sx={{ bgcolor: alpha(themePalette.success, 0.1), color: themePalette.success, fontWeight: 700 }} />
                      <Chip label={`Removed: ${delta.removed}`} size="small" sx={{ bgcolor: alpha(themePalette.error, 0.1), color: themePalette.error, fontWeight: 700 }} />
                      <Chip label={`Unchanged: ${delta.unchanged}`} size="small" variant="outlined" sx={{ fontWeight: 700 }} />
                    </Stack>
                  )}

                  <Box sx={{ display: "flex", gap: 2, overflowX: "auto", pb: 2 }}>
                    {displayedDataset.slice(0, visibleImageCount).map(img => (
                      <Box key={img.id} sx={{ minWidth: 180, maxWidth: 180, flexShrink: 0 }}>
                        <Card elevation={0} sx={{ border: `1px solid ${themePalette.border}`, borderRadius: '12px', overflow: 'hidden' }}>
                          <img src={`http://127.0.0.1:8000/artifacts/${img.id}/image`} alt={img.name} style={{ width: "100%", height: 130, objectFit: "cover" }} />
                          <Typography variant="caption" sx={{ p: 1, display: 'block', textAlign: 'center', bgcolor: themePalette.background, noWrap: true }}>{img.name}</Typography>
                        </Card>
                      </Box>
                    ))}
                  </Box>

                  <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
                    {visibleImageCount < displayedDataset.length && <Button onClick={() => setVisibleImageCount(c => c + 6)} variant="text" sx={{ fontWeight: 700 }}>View More</Button>}
                    {visibleImageCount > 6 && <Button onClick={() => setVisibleImageCount(6)} variant="text" sx={{ fontWeight: 700 }}>View Less</Button>}
                  </Stack>
                </CardContent>
              </Card>
            </Stack>
          </Grid>

          {/* Right Column: Other Artifacts */}
          <Grid item xs={12} lg={4}>
            <Stack spacing={4}>
              <Box>
                <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 3 }}>
                  <HubIcon sx={{ color: themePalette.primary }} />
                  <Typography variant="h6" fontWeight={800}>Model Artifacts</Typography>
                </Stack>
                {renderFileList(modelFiles, <HistoryIcon fontSize="small" />)}
              </Box>

              <Box>
                <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 3 }}>
                  <CodeIcon sx={{ color: themePalette.primary }} />
                  <Typography variant="h6" fontWeight={800}>Source Code</Typography>
                </Stack>
                {renderFileList(codeFiles, <CodeIcon fontSize="small" />)}
              </Box>
            </Stack>
          </Grid>
        </Grid>
      </Container>

      {/* Download Dialog */}
      <Dialog open={downloadOpen} onClose={() => setDownloadOpen(false)} PaperProps={{ sx: { borderRadius: '20px', p: 1 } }}>
        <DialogTitle sx={{ fontWeight: 800 }}>Download Components</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: themePalette.textMuted, mb: 2 }}>Select the specific artifacts you want to include in the ZIP package.</Typography>
          <Stack spacing={1}>
            {["dataset", "model", "metrics", "code"].map((k) => (
              <FormControlLabel
                key={k}
                control={<Checkbox checked={(downloadSelect as any)[k]} onChange={(e) => setDownloadSelect({ ...downloadSelect, [k]: e.target.checked })} color="primary" />}
                label={<Typography variant="body2" fontWeight={700}>{k.toUpperCase()}</Typography>}
              />
            ))}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setDownloadOpen(false)} sx={{ fontWeight: 700, color: themePalette.textMuted }}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={() => {
              const params = new URLSearchParams(Object.entries(downloadSelect).filter(([_, v]) => v).map(([k]) => [k, "true"]));
              window.open(`http://127.0.0.1:8000/factories/${factoryId}/algorithms/${algorithmId}/models/${modelId}/versions/${versionId}/download?${params}`, "_blank");
              setDownloadOpen(false);
            }}
            sx={{ bgcolor: themePalette.primary, borderRadius: '10px', fontWeight: 700, px: 3 }}
          >
            Generate Bundle
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}