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
  Tooltip,
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
import DescriptionIcon from "@mui/icons-material/Description";

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
    labels: true,
    model: true,
    metrics: false,
    code: false,
  });
  const labelFiles = artifacts.filter((a) => a.type === "label");
  
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
      <Box sx={{ height: "100vh", display: "flex", justifyContent: "center", alignItems: "center", bgcolor: themePalette.background }}>
        <CircularProgress size={42} sx={{ color: themePalette.primary }} />
      </Box>
    );
  }

  if (!version || !delta) return <Typography color="error">Version not found</Typography>;

  const datasetFiles = artifacts.filter((a) => a.type === "dataset");
  const modelFiles = artifacts.filter((a) => a.type === "model");
  const codeFiles = artifacts.filter((a) => a.type === "code");
  const isFirstVersion = version.version_number === 1;
  const imageFiles = datasetFiles.filter(a =>
    a.name.match(/\.(jpg|jpeg|png|webp)$/i)
  );

  const displayedDataset = (() => {
    if (isFirstVersion || showFullDataset) return datasetFiles;
    return datasetFiles.slice(0, delta.dataset.new);
  })();

  const displayedLabels = (() => {
    if (isFirstVersion || showFullDataset) return labelFiles;
    return labelFiles.slice(0, delta.label.new);
  })();

  const metricColor = (v?: number | null) => {
    if (typeof v !== "number") return themePalette.textMuted;
    if (v >= 90) return themePalette.success;
    if (v >= 75) return themePalette.primary;
    return themePalette.warning;
  };

  const renderFileList = (items: Artifact[], icon: React.ReactNode) => {
    if (!items.length) return <Typography variant="caption" sx={{ color: themePalette.textMuted }}>No associated files</Typography>;

    return (
      <Stack spacing={1.5}>
        {items.map((a) => (
          <Paper key={a.id} elevation={0} sx={{ 
            p: 2, 
            borderRadius: "16px", 
            border: `1px solid ${themePalette.border}`, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            transition: 'all 0.2s ease',
            "&:hover": { borderColor: themePalette.primary, bgcolor: alpha(themePalette.primary, 0.02) }
          }}>
            <Stack direction="row" spacing={2} alignItems="center">
              <Box sx={{ p: 1, bgcolor: themePalette.primaryLight, borderRadius: "10px", color: themePalette.primary, display: 'flex' }}>{icon}</Box>
              <Box>
                <Typography variant="body2" fontWeight={700} sx={{ color: themePalette.textMain }}>{a.name}</Typography>
                <Typography variant="caption" sx={{ color: themePalette.textMuted }}>{(a.size / 1024).toFixed(2)} KB</Typography>
              </Box>
            </Stack>
            <Stack direction="row" spacing={0.5}>
              <Tooltip title="View Metadata"><IconButton size="small" onClick={() => navigate(`/artifacts/${a.id}`)}><VisibilityIcon fontSize="small" /></IconButton></Tooltip>
              <Tooltip title="Download"><IconButton size="small" component="a" href={`http://127.0.0.1:8000/artifacts/${a.id}/download`}><DownloadIcon fontSize="small" /></IconButton></Tooltip>
              <Tooltip title="Remove"><IconButton size="small" color="error" onClick={async () => { if (confirm("Delete this artifact?")) { await axios.delete(`/artifacts/${a.id}`); setArtifacts(prev => prev.filter(x => x.id !== a.id)); }}}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
            </Stack>
          </Paper>
        ))}
      </Stack>
    );
  };

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: themePalette.background, pb: 10 }}>
      <Container maxWidth="xl">
        {/* ================= HEADER SECTION ================= */}
        <Box sx={{ pt: 6, pb: 6 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} spacing={3}>
            <Box>
              <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
                <IconButton onClick={() => navigate(`/factories/${factoryId}/algorithms/${algorithmId}/models/${modelId}/versions`)} sx={{ bgcolor: themePalette.white, border: `1px solid ${themePalette.border}`, boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}>
                  <ArrowBackIcon fontSize="small" />
                </IconButton>
                <Stack direction="row" spacing={1}>
                  <Chip label={`Iteration v${version.version_number}`} sx={{ fontWeight: 800, bgcolor: themePalette.primary, color: 'white' }} />
                  {version.is_active && <Chip label="PRODUCTION ACTIVE" sx={{ fontWeight: 800, bgcolor: alpha(themePalette.success, 0.1), color: themePalette.success }} />}
                </Stack>
              </Stack>
              <Typography variant="h3" fontWeight={900} sx={{ color: themePalette.textMain, letterSpacing: "-0.04em" }}>Version Intelligence</Typography>
            </Box>

            <Stack direction="row" spacing={2}>
              <Button variant="outlined" startIcon={<EditIcon />} onClick={() => navigate(`/factories/${factoryId}/algorithms/${algorithmId}/models/${modelId}/versions/${versionId}/edit`)}
                sx={{ borderRadius: "12px", textTransform: 'none', fontWeight: 700, borderColor: themePalette.border, color: themePalette.textMain }}>
                Edit Details
              </Button>
              <Button variant="contained" startIcon={<DownloadIcon />} onClick={() => setDownloadOpen(true)}
                sx={{ bgcolor: themePalette.primary, borderRadius: "12px", textTransform: 'none', fontWeight: 700, px: 3, boxShadow: `0 10px 15px -3px ${alpha(themePalette.primary, 0.4)}` }}>
                Export Bundle
              </Button>
            </Stack>
          </Stack>
        </Box>

        <Grid container spacing={4}>
          <Grid item xs={12} lg={8}>
            <Stack spacing={4}>
              {/* SUMMARY CARD */}
              <Card elevation={0} sx={{ borderRadius: "24px", border: `1px solid ${themePalette.border}`, bgcolor: themePalette.white }}>
                <CardContent sx={{ p: 4 }}>
                  <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
                    <DescriptionIcon sx={{ color: themePalette.primary }} />
                    <Typography variant="h6" fontWeight={800}>Notes & Context</Typography>
                  </Stack>
                  <Typography variant="body1" sx={{ color: themePalette.textMain, mb: 3, lineHeight: 1.8, bgcolor: alpha(themePalette.background, 0.5), p: 2, borderRadius: '16px' }}>
                    {version.note || "No specific notes provided for this model iteration."}
                  </Typography>
                  <Typography variant="caption" fontWeight={800} sx={{ color: themePalette.textMuted }}>REGISTRATION DATE: {new Date(version.created_at).toLocaleString().toUpperCase()}</Typography>
                </CardContent>
              </Card>

              {/* EVALUATION DASHBOARD */}
              <Box>
                <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 3 }}>
                  <AssessmentIcon sx={{ color: themePalette.primary }} />
                  <Typography variant="h5" fontWeight={900}>Performance Scorecard</Typography>
                </Stack>
                <Grid container spacing={2}>
                  {[
                    { label: "Accuracy", value: version.accuracy },
                    { label: "Precision", value: version.precision },
                    { label: "Recall", value: version.recall },
                    { label: "F1 Score", value: version.f1_score },
                  ].map((m) => (
                    <Grid item xs={12} sm={6} md={3} key={m.label}>
                      <Paper elevation={0} sx={{ p: 3, borderRadius: "20px", border: `1px solid ${themePalette.border}`, textAlign: 'center', bgcolor: themePalette.white }}>
                        <Typography variant="caption" fontWeight={800} sx={{ color: themePalette.textMuted, textTransform: 'uppercase' }}>{m.label}</Typography>
                        <Typography variant="h4" fontWeight={900} sx={{ my: 1.5, color: metricColor(m.value) }}>{m.value ? `${m.value}%` : "--"}</Typography>
                        <Box sx={{ height: 6, bgcolor: alpha(themePalette.border, 0.5), borderRadius: 3, overflow: 'hidden' }}>
                          <Box sx={{ height: '100%', width: `${m.value || 0}%`, bgcolor: metricColor(m.value), transition: 'width 1s ease-in-out' }} />
                        </Box>
                      </Paper>
                    </Grid>
                  ))}
                </Grid>
              </Box>

              {/* DATASET EXPLORER */}
              <Card elevation={0} sx={{ borderRadius: "24px", border: `1px solid ${themePalette.border}`, bgcolor: themePalette.white }}>
                <CardContent sx={{ p: 4 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 4 }}>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <ImageIcon sx={{ color: themePalette.primary }} />
                      <Typography variant="h6" fontWeight={800}>Dataset Browser</Typography>
                      <Chip label={`${labelFiles.length} Images`} size="small" variant="outlined" sx={{ fontWeight: 700 }} />
                    </Stack>
                    {!isFirstVersion && (
                      <FormControlLabel
                        control={<Switch checked={showFullDataset} onChange={() => setShowFullDataset(v => !v)} color="primary" />}
                        label={<Typography variant="body2" fontWeight={700}>Show Full Repo</Typography>}
                      />
                    )}
                  </Stack>

                  {!isFirstVersion && (
                    <Stack direction="row" spacing={2} sx={{ mb: 4 }}>
                      <Chip label={`+ ${delta.dataset.new} New`} size="small" sx={{ bgcolor: alpha(themePalette.success, 0.1), color: themePalette.success, fontWeight: 700 }} />
                      <Chip label={`Δ ${delta.dataset.reused} Reused`} size="small" sx={{ bgcolor: alpha(themePalette.primary, 0.1), color: themePalette.primary, fontWeight: 700 }} />
                      <Chip label={`- ${delta.dataset.removed} Removed`} size="small" sx={{ bgcolor: alpha(themePalette.error, 0.1), color: themePalette.error, fontWeight: 700 }} />
                    </Stack>
                  )}

                  <Box sx={{ display: "flex", gap: 2.5, overflowX: "auto", pb: 2, cursor: 'grab', '&::-webkit-scrollbar': { height: '6px' }, '&::-webkit-scrollbar-thumb': { bgcolor: alpha(themePalette.primary, 0.1), borderRadius: '10px' } }}>
                    {displayedDataset.map(img => (
                      <Box key={img.id} sx={{ minWidth: 190, maxWidth: 190, flexShrink: 0 }}>
                        <Card elevation={0} sx={{ border: `1px solid ${themePalette.border}`, borderRadius: '16px', overflow: 'hidden', transition: '0.3s', "&:hover": { transform: 'scale(1.03)', borderColor: themePalette.primary } }}>
                          <img src={`http://127.0.0.1:8000/artifacts/${img.id}/image`} alt={img.name} style={{ width: "100%", height: 140, objectFit: "cover" }} />
                          <Typography variant="caption" sx={{ p: 1.5, display: 'block', textAlign: 'center', fontWeight: 700, bgcolor: themePalette.white, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{img.name}</Typography>
                        </Card>
                      </Box>
                    ))}
                  </Box>
                </CardContent>
              </Card>
            </Stack>
          </Grid>
          {/* DATASET LABELS EXPLORER */}
          <Card
            elevation={0}
            sx={{
              borderRadius: "24px",
              border: `1px solid ${themePalette.border}`,
              bgcolor: themePalette.white,
            }}
          >
            <CardContent sx={{ p: 4 }}>
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                sx={{ mb: 4 }}
              >
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <DescriptionIcon sx={{ color: themePalette.primary }} />
                  <Typography variant="h6" fontWeight={800}>
                    Dataset Labels
                  </Typography>
                  <Chip
                    label={`${labelFiles.length} Files`}
                    size="small"
                    variant="outlined"
                    sx={{ fontWeight: 700 }}
                  />
                </Stack>
              </Stack>

              {!isFirstVersion && (
                <Stack direction="row" spacing={2} sx={{ mb: 4 }}>
                  <Chip
                    label={`+ ${delta.label.new} New`}
                    size="small"
                    sx={{
                      bgcolor: alpha(themePalette.success, 0.1),
                      color: themePalette.success,
                      fontWeight: 700,
                    }}
                  />
                  <Chip
                    label={`Δ ${delta.label.reused} Reused`}
                    size="small"
                    sx={{
                      bgcolor: alpha(themePalette.primary, 0.1),
                      color: themePalette.primary,
                      fontWeight: 700,
                    }}
                  />
                  <Chip
                    label={`- ${delta.label.removed} Removed`}
                    size="small"
                    sx={{
                      bgcolor: alpha(themePalette.error, 0.1),
                      color: themePalette.error,
                      fontWeight: 700,
                    }}
                  />
                </Stack>
              )}

              <Box
                sx={{
                  display: "flex",
                  gap: 2,
                  overflowX: "auto",
                  pb: 1,
                  "&::-webkit-scrollbar": { height: "6px" },
                  "&::-webkit-scrollbar-thumb": {
                    bgcolor: alpha(themePalette.primary, 0.15),
                    borderRadius: "10px",
                  },
                }}
              >
                {displayedLabels.map((label) => (
                  <Box
                    key={label.id}
                    sx={{ minWidth: 220, maxWidth: 220, flexShrink: 0 }}
                  >
                    <Paper
                      elevation={0}
                      sx={{
                        p: 2,
                        borderRadius: "16px",
                        border: `1px solid ${themePalette.border}`,
                        bgcolor: themePalette.background,
                        transition: "0.25s",
                        "&:hover": {
                          borderColor: themePalette.primary,
                          bgcolor: alpha(themePalette.primary, 0.04),
                        },
                      }}
                    >
                      <Stack spacing={1}>
                        <Typography
                          variant="body2"
                          fontWeight={700}
                          sx={{
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {label.name}
                        </Typography>

                        <Typography variant="caption" color="text.secondary">
                          {(label.size / 1024).toFixed(2)} KB
                        </Typography>

                        <Stack direction="row" spacing={1}>
                          <Tooltip title="View Metadata">
                            <IconButton
                              size="small"
                              onClick={() => navigate(`/artifacts/${label.id}`)}
                            >
                              <VisibilityIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>

                          <Tooltip title="Download">
                            <IconButton
                              size="small"
                              component="a"
                              href={`http://127.0.0.1:8000/artifacts/${label.id}/download`}
                            >
                              <DownloadIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </Stack>
                    </Paper>
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>

          {/* ================= RIGHT COLUMN ================= */}
          <Grid item xs={12} lg={4}>
            <Stack spacing={4}>
              <Box>
                <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 3 }}>
                  <HubIcon sx={{ color: themePalette.primary }} />
                  <Typography variant="h6" fontWeight={800}>Model Weights</Typography>
                </Stack>
                {renderFileList(modelFiles, <HistoryIcon fontSize="small" />)}
              </Box>

              <Box>
                <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 3 }}>
                  <CodeIcon sx={{ color: themePalette.primary }} />
                  <Typography variant="h6" fontWeight={800}>Training Source</Typography>
                </Stack>
                {renderFileList(codeFiles, <CodeIcon fontSize="small" />)}
              </Box>

             
            </Stack>
          </Grid>
        </Grid>
      </Container>

      {/* ================= DOWNLOAD DIALOG ================= */}
      <Dialog open={downloadOpen} onClose={() => setDownloadOpen(false)} PaperProps={{ sx: { borderRadius: '24px', p: 1 } }}>
        <DialogTitle sx={{ fontWeight: 900, letterSpacing: "-0.02em" }}>Export Version Bundle</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: themePalette.textMuted, mb: 3 }}>Choose the data layers to include in the generated archive.</Typography>
          <Stack spacing={1}>
            {["dataset", "labels","model", "metrics", "code"].map((k) => (
              <FormControlLabel
                key={k}
                control={<Checkbox checked={(downloadSelect as any)[k]} onChange={(e) => setDownloadSelect({ ...downloadSelect, [k]: e.target.checked })} color="primary" />}
                label={<Typography variant="body2" fontWeight={700}>{k.toUpperCase()}</Typography>}
              />
            ))}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setDownloadOpen(false)} sx={{ fontWeight: 700, color: themePalette.textMuted, textTransform: 'none' }}>Cancel</Button>
          <Button variant="contained" onClick={() => {
              const params = new URLSearchParams(Object.entries(downloadSelect).filter(([_, v]) => v).map(([k]) => [k, "true"]));
              window.open(`http://127.0.0.1:8000/factories/${factoryId}/algorithms/${algorithmId}/models/${modelId}/versions/${versionId}/download?${params}`, "_blank");
              setDownloadOpen(false);
            }} sx={{ bgcolor: themePalette.primary, borderRadius: '12px', fontWeight: 700, px: 3, textTransform: 'none' }}>
            Generate ZIP
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}