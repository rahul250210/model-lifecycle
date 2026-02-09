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
  Breadcrumbs,
  Link,
} from "@mui/material";

import NavigateNextIcon from "@mui/icons-material/NavigateNext";

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
import SettingsIcon from "@mui/icons-material/Settings";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import CategoryIcon from "@mui/icons-material/Category";

import { useNavigate, useParams } from "react-router-dom";
import axios, { API_BASE_URL } from "../../api/axios";

import { useTheme } from "../../theme/ThemeContext";

interface Version {
  id: number;
  version: string;
  version_number: number;
  note?: string;
  parameters?: Record<string, unknown>;
  accuracy?: number;
  precision?: number;
  recall?: number;
  f1_score?: number;
  tp?: number;
  tn?: number;
  fp?: number;
  fn?: number;
  metrics?: Record<string, number>;
  created_at: string;
  is_active: boolean;
}

interface Artifact {
  id: number;
  name: string;
  type: string;
  size: number;
}

interface VersionDelta {
  id: number;
  created_at: string;
  [key: string]: any;
}

export default function VersionDetails() {
  const { factoryId, algorithmId, modelId, versionId } = useParams();
  const navigate = useNavigate();
  const { theme } = useTheme();

  const [version, setVersion] = useState<Version | null>(null);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [delta, setDelta] = useState<VersionDelta | null>(null);
  const [loading, setLoading] = useState(true);
  const [showFullDataset, setShowFullDataset] = useState(false);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [downloadSelect, setDownloadSelect] = useState({
    dataset: false,
    labels: false,
    model: false,
    code: false,
  });

  const [datasetVisibleCount, setDatasetVisibleCount] = useState(10);
  const [labelsVisibleCount, setLabelsVisibleCount] = useState(10);
  const [netronOpen, setNetronOpen] = useState(false);
  const [activeModel, setActiveModel] = useState<Artifact | null>(null);

  const labelFiles = artifacts.filter((a) => a.type === "label");

  const [downloadLoading, setDownloadLoading] = useState(false);

  const handleDownload = () => {
    setDownloadLoading(true);

    // Construct URL
    const params = new URLSearchParams(
      Object.entries(downloadSelect)
        .filter(([_, v]) => v)
        .map(([k]) => [k, "true"])
    );

    const downloadUrl = `${API_BASE_URL}/factories/${factoryId}/algorithms/${algorithmId}/models/${modelId}/versions/${versionId}/download?${params.toString()}`;

    // Delay slightly to allow UI to update, then trigger download
    setTimeout(() => {
      window.location.href = downloadUrl;

      // Close dialog after a delay to allow user to see the "Starting" state
      // We can't detect exactly when the browser starts the download without cookies/backend changes,
      // but 3 seconds is usually enough for the browser to register the request.
      setTimeout(() => {
        setDownloadLoading(false);
        setDownloadOpen(false);
      }, 3000);
    }, 500);
  };

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
      <Box sx={{ height: "100vh", display: "flex", justifyContent: "center", alignItems: "center", bgcolor: theme.background }}>
        <CircularProgress size={42} sx={{ color: theme.primary }} />
      </Box>
    );
  }

  if (!version || !delta) return <Typography color="error">Version not found</Typography>;

  const datasetFiles = artifacts.filter((a) => a.type === "dataset");
  const modelFiles = artifacts.filter((a) => a.type === "model");
  const codeFiles = artifacts.filter((a) => a.type === "code");
  const isFirstVersion = version.version_number === 1;


  const displayedDataset = (() => {
    if (isFirstVersion || showFullDataset) return datasetFiles;
    return datasetFiles.slice(0, delta.dataset.new);
  })();

  const displayedLabels = (() => {
    if (isFirstVersion || showFullDataset) return labelFiles;
    return labelFiles.slice(0, delta.label.new);
  })();

  const metricColor = (v?: number | null) => {
    if (typeof v !== "number") return theme.textMuted;
    if (v >= 90) return theme.success;
    if (v >= 75) return theme.primary;
    return theme.warning;
  };

  const renderFileList = (items: Artifact[], icon: React.ReactNode, showMetadata: boolean = true) => {
    if (!items.length) return <Typography variant="caption" sx={{ color: theme.textMuted }}>No associated files</Typography>;

    return (
      <Stack spacing={1.5}>
        {items.map((a) => (
          <Paper key={a.id} elevation={0} sx={{
            p: 2,
            borderRadius: "16px",
            border: `1px solid ${theme.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            bgcolor: theme.paper,
            transition: 'all 0.2s ease',
            "&:hover": { borderColor: theme.primary, bgcolor: alpha(theme.primary, 0.02) }
          }}>
            <Stack direction="row" spacing={2} alignItems="center">
              <Box sx={{ p: 1, bgcolor: theme.primaryLight, borderRadius: "10px", color: theme.primary, display: 'flex' }}>{icon}</Box>
              <Box>
                <Typography variant="body2" fontWeight={700} sx={{ color: theme.textMain }}>{a.name.split('/').pop()}</Typography>
                <Typography variant="caption" sx={{ color: theme.textMuted }}>{(a.size / 1024).toFixed(2)} KB</Typography>
              </Box>
            </Stack>
            <Stack direction="row" spacing={0.5}>
              {items.length > 0 && items[0].type === "model" && (
                <Tooltip title="View in Netron">
                  <IconButton
                    size="small"
                    onClick={() => {
                      // Always open Netron in a new tab and show the helper dialog
                      // This ensures a consistent experience and avoids "redirect" feelings
                      setActiveModel(a);
                      setNetronOpen(true);
                      window.open("https://netron.app", "_blank");
                    }}
                    sx={{ color: theme.primary }}
                  >
                    <VisibilityIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
              {showMetadata && (
                <Tooltip title="View Metadata">
                  <IconButton
                    size="small"
                    onClick={() =>
                      navigate(
                        `/factories/${factoryId}/algorithms/${algorithmId}/models/${modelId}/versions/${versionId}/artifacts/${a.id}`
                      )
                    }
                  >
                    <VisibilityIcon fontSize="small" sx={{ color: theme.textMuted }} />
                  </IconButton>
                </Tooltip>
              )}
              <Tooltip title="Download"><IconButton size="small" component="a" href={`${API_BASE_URL}/artifacts/${a.id}/download`}><DownloadIcon fontSize="small" sx={{ color: theme.textMuted }} /></IconButton></Tooltip>
              <Tooltip title="Remove"><IconButton size="small" color="error" onClick={async () => { if (confirm("Delete this artifact?")) { await axios.delete(`/artifacts/${a.id}`); setArtifacts(prev => prev.filter(x => x.id !== a.id)); } }}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
            </Stack>
          </Paper>
        ))
        }
      </Stack >
    );
  };

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: theme.background, pb: 10 }}>
      <Container maxWidth="xl">
        {/* ================= HEADER SECTION ================= */}
        <Box sx={{ pt: 6, pb: 6 }}>
          <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
            <Breadcrumbs separator={<NavigateNextIcon fontSize="small" sx={{ color: theme.textMuted }} />} aria-label="breadcrumb">
              <Link
                underline="hover"
                color="inherit"
                onClick={() => navigate("/factories")}
                sx={{ cursor: 'pointer', display: 'flex', alignItems: 'center', fontWeight: 500, fontSize: '1.2rem', color: theme.textMuted }}
              >
                Factories
              </Link>
              <Link
                underline="hover"
                color="inherit"
                onClick={() => navigate(`/factories/${factoryId}/algorithms`)}
                sx={{ cursor: 'pointer', display: 'flex', alignItems: 'center', fontWeight: 500, fontSize: '1.2rem', color: theme.textMuted }}
              >
                Algorithm
              </Link>
              <Link
                underline="hover"
                color="inherit"
                onClick={() => navigate(`/factories/${factoryId}/algorithms/${algorithmId}/models/${modelId}`)}
                sx={{ cursor: 'pointer', display: 'flex', alignItems: 'center', fontWeight: 500, fontSize: '1.2rem', color: theme.textMuted }}
              >
                Model
              </Link>
              <Typography color={theme.textMain} fontWeight={700} sx={{ fontSize: '1.2rem' }}>
                v{version.version_number}
              </Typography>
            </Breadcrumbs>
          </Stack>
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} spacing={3}>
            <Box>
              <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
                <IconButton onClick={() => navigate(`/factories/${factoryId}/algorithms/${algorithmId}/models/${modelId}/versions`)} sx={{ bgcolor: theme.paper, border: `1px solid ${theme.border}`, boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}>
                  <ArrowBackIcon fontSize="small" sx={{ color: theme.textMain }} />
                </IconButton>
                <Stack direction="row" spacing={1}>
                  {/* Removed Iteration Version Number text as requested */}
                  {version.is_active && <Chip label="PRODUCTION ACTIVE" sx={{ fontWeight: 500, bgcolor: alpha(theme.success, 0.1), color: theme.success }} />}
                </Stack>
              </Stack>
              <Typography variant="h5" fontWeight={800} sx={{ color: theme.textMain, letterSpacing: "-0.04em" }}>Version Intelligence</Typography>
            </Box>

            <Stack direction="row" spacing={2}>
              <Button variant="outlined" startIcon={<EditIcon />} onClick={() => navigate(`/factories/${factoryId}/algorithms/${algorithmId}/models/${modelId}/versions/${versionId}/edit`)}
                sx={{ borderRadius: "12px", textTransform: 'none', fontWeight: 700, borderColor: theme.border, color: theme.textMain }}>
                Edit Details
              </Button>
              <Button variant="contained" startIcon={<DownloadIcon />} onClick={() => setDownloadOpen(true)}
                sx={{ bgcolor: theme.primary, borderRadius: "12px", textTransform: 'none', fontWeight: 700, px: 3, boxShadow: `0 10px 15px -3px ${alpha(theme.primary, 0.4)}` }}>
                Export Bundle
              </Button>
            </Stack>
          </Stack>
        </Box>

        <Box sx={{ mt: 4 }}>
          <Stack spacing={4}>
            {/* SUMMARY CARD */}
            <Card elevation={0} sx={{ borderRadius: "24px", border: `1px solid ${theme.border}`, bgcolor: theme.paper }}>
              <CardContent sx={{ p: 4 }}>
                <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
                  <DescriptionIcon sx={{ color: theme.primary }} />
                  <Typography variant="h6" fontWeight={600} sx={{ color: theme.textMain }}>Notes & Context</Typography>
                </Stack>
                <Typography variant="body1" sx={{ color: theme.textMain, mb: 3, lineHeight: 1.8, bgcolor: alpha(theme.background, 0.5), p: 2, borderRadius: '16px' }}>
                  {version.note || "No specific notes provided for this model iteration."}
                </Typography>
                <Typography variant="caption" fontWeight={600} sx={{ color: theme.textMuted }}>REGISTRATION DATE: {new Date(version.created_at).toLocaleString().toUpperCase()}</Typography>
              </CardContent>
            </Card>

            <Card elevation={0} sx={{ borderRadius: "24px", border: `1px solid ${theme.border}`, bgcolor: theme.paper }}>
              <CardContent sx={{ p: 4 }}>
                <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 3 }}>
                  <SettingsIcon sx={{ color: theme.primary }} />
                  <Typography variant="h6" fontWeight={600} sx={{ color: theme.textMain }}>
                    Training Parameters
                  </Typography>
                </Stack>

                {Object.entries(version.parameters || {}).length === 0 ? (
                  <Typography variant="body2" color={theme.textMuted}>
                    No parameters recorded.
                  </Typography>
                ) : (
                  <Grid container spacing={2}>
                    {Object.entries(version.parameters || {}).map(([key, value]) => (
                      <Grid size={{ xs: 6, md: 4 }} key={key}>
                        <Paper
                          elevation={0}
                          sx={{
                            p: 2,
                            borderRadius: "16px",
                            border: `1px solid ${theme.border}`,
                            textAlign: "center",
                            bgcolor: theme.background
                          }}
                        >
                          <Typography variant="caption" fontWeight={600} color={theme.textMuted}>
                            {key.toUpperCase()}
                          </Typography>
                          <Typography variant="h6" fontWeight={700} sx={{ color: theme.textMain }}>
                            {String(value)}
                          </Typography>
                        </Paper>
                      </Grid>
                    ))}
                  </Grid>
                )}
              </CardContent>
            </Card>

            {/* EVALUATION DASHBOARD */}
            <Card elevation={0} sx={{ borderRadius: "24px", border: `1px solid ${theme.border}`, bgcolor: theme.paper }}>
              <CardContent sx={{ p: 4 }}>
                <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 4 }}>
                  <AssessmentIcon sx={{ color: theme.primary }} />
                  <Typography variant="h6" fontWeight={600} sx={{ color: theme.textMain }}>Model Performance</Typography>
                </Stack>

                <Grid container spacing={4}>
                  {/* METRICS SECTION */}
                  <Grid size={{ xs: 12, md: (version as any).tp !== undefined && (version as any).tp !== null ? 7 : 12 }}>
                    <Typography variant="subtitle2" fontWeight={700} sx={{ color: theme.textSecondary, mb: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Key Metrics
                    </Typography>
                    <Grid container spacing={2}>
                      {[
                        { label: "Accuracy", value: version.accuracy, desc: "Overall correctness", formula: "(TP + TN) / Total" },
                        { label: "Precision", value: version.precision, desc: "False positive control", formula: "TP / (TP + FP)" },
                        { label: "Recall", value: version.recall, desc: "False negative control", formula: "TP / (TP + FN)" },
                        { label: "F1 Score", value: version.f1_score, desc: "Harmonic mean", formula: "2TP / (2TP + FP + FN)" },
                      ].map((m) => (
                        <Grid size={{ xs: 12, sm: 6 }} key={m.label}>
                          <Paper elevation={0} sx={{ p: 2.5, borderRadius: "16px", border: `1px solid ${theme.border}`, bgcolor: alpha(theme.background, 0.5) }}>
                            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                              <Typography variant="caption" fontWeight={600} sx={{ color: theme.textMuted, textTransform: 'uppercase' }}>{m.label}</Typography>
                              <Tooltip title={m.desc} arrow placement="top">
                                <Chip
                                  label={m.formula}
                                  size="small"
                                  sx={{
                                    height: 20,
                                    fontSize: '0.65rem',
                                    fontFamily: 'monospace',
                                    bgcolor: alpha(theme.textMain, 0.05),
                                    color: theme.textSecondary,
                                    fontWeight: 600,
                                    border: `1px solid ${alpha(theme.border, 0.5)}`
                                  }}
                                />
                              </Tooltip>
                            </Stack>

                            <Typography variant="h5" fontWeight={700} sx={{ mt: 0.5, mb: 1.5, color: metricColor(m.value) }}>{m.value ? `${m.value}%` : "--"}</Typography>

                            <Box sx={{ height: 4, bgcolor: alpha(theme.border, 0.5), borderRadius: 2, overflow: 'hidden' }}>
                              <Box sx={{ height: '100%', width: `${m.value || 0}%`, bgcolor: metricColor(m.value) }} />
                            </Box>
                          </Paper>
                        </Grid>
                      ))}
                    </Grid>
                  </Grid>

                  {/* CONFUSION MATRIX SECTION */}
                  {(version as any).tp !== undefined && (version as any).tp !== null && (
                    <Grid size={{ xs: 12, md: 5 }}>
                      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', bgcolor: alpha(theme.background, 0.3), borderRadius: "20px", p: 3, border: `1px dashed ${theme.border}` }}>
                        <Typography variant="subtitle2" fontWeight={700} sx={{ color: theme.textSecondary, mb: 3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Confusion Matrix
                        </Typography>

                        <Box sx={{ display: 'grid', gridTemplateColumns: 'auto 100px 100px', gap: 1.5, alignItems: 'center' }}>
                          {/* Header Row */}
                          <Box></Box>
                          <Typography variant="caption" fontWeight={700} align="center" sx={{ color: theme.textMuted }}>PREDICTED<br />YES</Typography>
                          <Typography variant="caption" fontWeight={700} align="center" sx={{ color: theme.textMuted }}>PREDICTED<br />NO</Typography>

                          {/* Row 1: Actual YES */}
                          <Typography variant="caption" fontWeight={700} sx={{ color: theme.textMuted, writingMode: 'vertical-rl', transform: 'rotate(180deg)', height: 80, textAlign: 'center' }}>ACTUAL YES</Typography>

                          <Paper elevation={0} sx={{ p: 1, bgcolor: alpha(theme.success, 0.1), border: `1px solid ${theme.success}`, borderRadius: '12px', textAlign: 'center', height: 80, width: 100, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                            <Typography variant="h5" fontWeight={700} sx={{ color: theme.success }}>{(version as any).tp}</Typography>
                            <Typography variant="caption" fontWeight={700} sx={{ color: theme.success, opacity: 0.8 }}>TP</Typography>
                          </Paper>

                          <Paper elevation={0} sx={{ p: 1, bgcolor: alpha(theme.error, 0.05), border: `1px solid ${theme.error}`, borderRadius: '12px', textAlign: 'center', height: 80, width: 100, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                            <Typography variant="h5" fontWeight={700} sx={{ color: theme.error }}>{(version as any).fn}</Typography>
                            <Typography variant="caption" fontWeight={700} sx={{ color: theme.error, opacity: 0.8 }}>FN</Typography>
                          </Paper>

                          {/* Row 2: Actual NO */}
                          <Typography variant="caption" fontWeight={700} sx={{ color: theme.textMuted, writingMode: 'vertical-rl', transform: 'rotate(180deg)', height: 80, textAlign: 'center' }}>ACTUAL NO</Typography>

                          <Paper elevation={0} sx={{ p: 1, bgcolor: alpha(theme.warning, 0.1), border: `1px solid ${theme.warning}`, borderRadius: '12px', textAlign: 'center', height: 80, width: 100, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                            <Typography variant="h5" fontWeight={700} sx={{ color: theme.warning }}>{(version as any).fp}</Typography>
                            <Typography variant="caption" fontWeight={700} sx={{ color: theme.warning, opacity: 0.8 }}>FP</Typography>
                          </Paper>

                          <Paper elevation={0} sx={{ p: 1, bgcolor: alpha(theme.info, 0.1), border: `1px solid ${theme.info}`, borderRadius: '12px', textAlign: 'center', height: 80, width: 100, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                            <Typography variant="h5" fontWeight={700} sx={{ color: theme.info }}>{(version as any).tn}</Typography>
                            <Typography variant="caption" fontWeight={700} sx={{ color: theme.info, opacity: 0.8 }}>TN</Typography>
                          </Paper>

                        </Box>
                      </Box>
                    </Grid>
                  )}
                </Grid>
              </CardContent>
            </Card>

            {/* DATASET EXPLORER */}
            <Card elevation={0} sx={{ borderRadius: "24px", border: `1px solid ${theme.border}`, bgcolor: theme.paper, overflow: "hidden" }}>
              <CardContent sx={{ p: 4 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <ImageIcon sx={{ color: theme.primary }} />
                    <Typography variant="h6" fontWeight={600} sx={{ color: theme.textMain }}>Dataset Browser</Typography>
                    <Chip label={`${datasetFiles.length} Images`} size="small" variant="outlined" sx={{ fontWeight: 700, color: theme.textMain, borderColor: theme.border }} />
                  </Stack>
                  {!isFirstVersion && (
                    <FormControlLabel
                      sx={{ color: theme.textMain }}
                      control={
                        <Switch
                          checked={showFullDataset}
                          onChange={() => setShowFullDataset(v => !v)}
                          color="primary"
                          sx={{
                            "& .MuiSwitch-track": { bgcolor: theme.textSecondary },
                            "& .MuiSwitch-thumb": { color: theme.primary }
                          }}
                        />
                      }
                      label={<Typography variant="body2" fontWeight={700} sx={{ color: theme.textMain }}>Show Full Repo</Typography>}
                    />
                  )}
                </Stack>

                {!isFirstVersion && (
                  <Stack direction="row" spacing={2} sx={{ mb: 4 }}>
                    <Chip label={`+ ${delta.dataset.new} New`} size="small" sx={{ bgcolor: alpha(theme.success, 0.1), color: theme.success, fontWeight: 700 }} />
                    <Chip label={`Δ ${delta.dataset.reused} Reused`} size="small" sx={{ bgcolor: alpha(theme.primary, 0.1), color: theme.primary, fontWeight: 700 }} />
                  </Stack>
                )}

                <Box sx={{ width: "100%", maxWidth: { xs: "85vw", md: "100%" }, minWidth: 0, display: "flex", gap: 2.5, overflowX: "auto", pb: 2, cursor: 'grab', minHeight: displayedDataset.length === 0 ? 200 : 'auto', '&::-webkit-scrollbar': { height: '8px' }, '&::-webkit-scrollbar-thumb': { bgcolor: alpha(theme.primary, 0.3), borderRadius: '10px', '&:hover': { bgcolor: alpha(theme.primary, 0.5) } } }}>
                  {displayedDataset.length === 0 ? (
                    <Box sx={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
                      <Typography variant="body2" color={theme.textMuted}>No dataset images available</Typography>
                    </Box>
                  ) : (
                    <>
                      {displayedDataset.slice(0, datasetVisibleCount).map(img => (
                        <Box key={img.id} sx={{ minWidth: 240, maxWidth: 240, flexShrink: 0 }}>
                          <Card elevation={0} sx={{ border: `1px solid ${theme.border}`, borderRadius: '16px', overflow: 'hidden', transition: '0.3s', "&:hover": { transform: 'scale(1.03)', borderColor: theme.primary } }}>
                            <img src={`${API_BASE_URL}/artifacts/${img.id}/image`} alt={img.name} style={{ width: "100%", height: 180, objectFit: "cover" }} />
                            <Typography variant="caption" sx={{ p: 1.5, display: 'block', textAlign: 'center', fontWeight: 700, bgcolor: theme.paper, color: theme.textMain, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{img.name.split('/').pop()}</Typography>
                          </Card>
                        </Box>
                      ))}

                      {/* DATASET PAGINATION CONTROLS */}
                      {displayedDataset.length > 5 && (
                        <Card
                          elevation={0}
                          sx={{
                            minWidth: 240,
                            maxWidth: 240,
                            borderRadius: "24px",
                            border: `1px solid ${theme.border}`,
                            bgcolor: alpha(theme.paper, 0.6),
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            p: 2.5,
                            flexShrink: 0,
                            transition: "all 0.2s",
                            "&:hover": {
                              bgcolor: theme.paper,
                              boxShadow: `0 12px 32px -8px ${alpha(theme.textMain, 0.08)}`,
                              borderColor: alpha(theme.primary, 0.3)
                            }
                          }}
                        >
                          <Box sx={{ mb: 2, p: 1.5, borderRadius: "50%", bgcolor: alpha(theme.primary, 0.08), color: theme.primary }}>
                            <CategoryIcon fontSize="small" />
                          </Box>
                          <Typography variant="caption" fontWeight={700} sx={{ color: theme.textSecondary, mb: 0.5 }}>Viewing</Typography>
                          <Typography variant="h6" fontWeight={900} sx={{ color: theme.textMain, mb: 2 }}>
                            {Math.min(datasetVisibleCount, displayedDataset.length)} <Box component="span" sx={{ color: theme.textMuted, fontSize: '0.75em' }}>/ {displayedDataset.length}</Box>
                          </Typography>
                          <Stack spacing={1.5} width="100%">
                            <Button
                              fullWidth
                              disabled={displayedDataset.length <= datasetVisibleCount}
                              variant="contained"
                              size="small"
                              startIcon={<AddIcon />}
                              onClick={() => setDatasetVisibleCount(prev => prev + 5)}
                              sx={{ borderRadius: "10px", textTransform: 'none', fontWeight: 700, boxShadow: 'none', bgcolor: theme.primary, '&:hover': { bgcolor: theme.primaryDark, boxShadow: 'none' }, '&.Mui-disabled': { bgcolor: alpha(theme.textMain, 0.05), color: theme.textMuted } }}
                            >
                              Show More
                            </Button>
                            <Button
                              fullWidth
                              disabled={datasetVisibleCount <= 5}
                              variant="outlined"
                              size="small"
                              startIcon={<RemoveIcon />}
                              onClick={() => setDatasetVisibleCount(prev => Math.max(5, prev - 5))}
                              sx={{ borderRadius: "10px", textTransform: 'none', fontWeight: 700, borderWidth: "2px", borderColor: alpha(theme.textMain, 0.1), color: theme.textSecondary, '&:hover': { borderColor: theme.textMain, bgcolor: alpha(theme.textMain, 0.02), color: theme.textMain }, '&.Mui-disabled': { borderWidth: "1px", borderColor: alpha(theme.textMain, 0.05) } }}
                            >
                              Show Less
                            </Button>
                          </Stack>
                        </Card>
                      )}
                    </>
                  )}
                </Box>
              </CardContent>
            </Card>

            {/* DATASET LABELS EXPLORER */}
            <Card
              elevation={0}
              sx={{
                borderRadius: "24px",
                border: `1px solid ${theme.border}`,
                bgcolor: theme.paper,
                overflow: "hidden"
              }}
            >
              <CardContent sx={{ pt: 4, px: 4, pb: 1.5 }}>
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                  sx={{ mb: 4 }}
                >
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <DescriptionIcon sx={{ color: theme.primary }} />
                    <Typography variant="h6" fontWeight={600} sx={{ color: theme.textMain }}>
                      Dataset Labels
                    </Typography>
                    <Chip
                      label={`${labelFiles.length} Files`}
                      size="small"
                      variant="outlined"
                      sx={{ fontWeight: 700, color: theme.textMain, borderColor: theme.border }}
                    />
                  </Stack>
                </Stack>

                {!isFirstVersion && (
                  <Stack direction="row" spacing={2} sx={{ mb: 4 }}>
                    <Chip
                      label={`+ ${delta.label.new} New`}
                      size="small"
                      sx={{
                        bgcolor: alpha(theme.success, 0.1),
                        color: theme.success,
                        fontWeight: 700,
                      }}
                    />
                    <Chip
                      label={`Δ ${delta.label.reused} Reused`}
                      size="small"
                      sx={{
                        bgcolor: alpha(theme.primary, 0.1),
                        color: theme.primary,
                        fontWeight: 700,
                      }}
                    />

                  </Stack>
                )}

                <Box
                  sx={{
                    width: "100%",
                    maxWidth: { xs: "85vw", md: "100%" },
                    minWidth: 0,
                    display: "flex",
                    gap: 2,
                    overflowX: "auto",
                    pb: 1,
                    minHeight: displayedLabels.length === 0 ? 200 : 'auto',
                    "&::-webkit-scrollbar": { height: "8px" },
                    "&::-webkit-scrollbar-thumb": {
                      bgcolor: alpha(theme.primary, 0.3),
                      borderRadius: "10px",
                      '&:hover': { bgcolor: alpha(theme.primary, 0.5) }
                    },
                  }}
                >
                  {displayedLabels.length === 0 ? (
                    <Box sx={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
                      <Typography variant="body2" color={theme.textMuted}>No label files available</Typography>
                    </Box>
                  ) : (
                    <>
                      {displayedLabels.slice(0, labelsVisibleCount).map((label) => (
                        <Box
                          key={label.id}
                          sx={{ minWidth: 240, maxWidth: 240, flexShrink: 0 }}
                        >
                          <Paper
                            elevation={0}
                            sx={{
                              p: 1,
                              borderRadius: "16px",
                              border: `1px solid ${theme.border}`,
                              bgcolor: theme.background,
                              transition: "0.25s",
                              "&:hover": {
                                borderColor: theme.primary,
                                bgcolor: alpha(theme.primary, 0.04),
                              },
                            }}
                          >
                            <Stack spacing={0.5}>
                              <Typography
                                variant="body2"
                                fontWeight={700}
                                sx={{
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  color: theme.textMain
                                }}
                              >
                                {label.name.split('/').pop()}
                              </Typography>

                              <Typography variant="caption" color={theme.textMuted} sx={{ mb: 0.5, display: 'block' }}>
                                {(label.size / 1024).toFixed(2)} KB
                              </Typography>

                              <Stack direction="row" spacing={1}>
                                <Tooltip title="View Metadata">
                                  <IconButton
                                    size="small"
                                    onClick={() =>
                                      navigate(
                                        `/factories/${factoryId}/algorithms/${algorithmId}/models/${modelId}/versions/${versionId}/artifacts/${label.id}`
                                      )
                                    }
                                  >
                                    <VisibilityIcon fontSize="small" sx={{ color: theme.textMuted }} />
                                  </IconButton>
                                </Tooltip>

                                <Tooltip title="Download">
                                  <IconButton
                                    size="small"
                                    component="a"
                                    href={`${API_BASE_URL}/artifacts/${label.id}/download`}
                                  >
                                    <DownloadIcon fontSize="small" sx={{ color: theme.textMuted }} />
                                  </IconButton>
                                </Tooltip>
                              </Stack>
                            </Stack>
                          </Paper>
                        </Box>
                      ))}

                      {/* LABELS PAGINATION CONTROLS */}
                      {displayedLabels.length > 5 && (
                        <Card
                          elevation={0}
                          sx={{
                            minWidth: 240,
                            maxWidth: 240,
                            borderRadius: "24px",
                            border: `1px solid ${theme.border}`,
                            bgcolor: alpha(theme.paper, 0.6),
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            p: 2,
                            flexShrink: 0,
                            transition: "all 0.2s",
                            "&:hover": {
                              bgcolor: theme.paper,
                              boxShadow: `0 12px 32px -8px ${alpha(theme.textMain, 0.08)}`,
                              borderColor: alpha(theme.primary, 0.3)
                            }
                          }}
                        >
                          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                            <CategoryIcon fontSize="small" sx={{ color: theme.primary, opacity: 0.8 }} />
                            <Typography variant="body2" fontWeight={700} sx={{ color: theme.textMain }}>
                              {Math.min(labelsVisibleCount, displayedLabels.length)} <Box component="span" sx={{ color: theme.textMuted }}>/ {displayedLabels.length}</Box>
                            </Typography>
                          </Stack>
                          <Stack spacing={1} width="100%">
                            <Button
                              fullWidth
                              disabled={displayedLabels.length <= labelsVisibleCount}
                              variant="contained"
                              size="small"
                              startIcon={<AddIcon />}
                              onClick={() => setLabelsVisibleCount(prev => prev + 5)}
                              sx={{ borderRadius: "10px", textTransform: 'none', fontWeight: 700, boxShadow: 'none', bgcolor: theme.primary, '&:hover': { bgcolor: theme.primaryDark, boxShadow: 'none' }, '&.Mui-disabled': { bgcolor: alpha(theme.textMain, 0.05), color: theme.textMuted } }}
                            >
                              More
                            </Button>
                            <Button
                              fullWidth
                              disabled={labelsVisibleCount <= 5}
                              variant="outlined"
                              size="small"
                              startIcon={<RemoveIcon />}
                              onClick={() => setLabelsVisibleCount(prev => Math.max(5, prev - 5))}
                              sx={{ borderRadius: "10px", textTransform: 'none', fontWeight: 700, borderWidth: "2px", borderColor: alpha(theme.textMain, 0.1), color: theme.textSecondary, '&:hover': { borderColor: theme.textMain, bgcolor: alpha(theme.textMain, 0.02), color: theme.textMain }, '&.Mui-disabled': { borderWidth: "1px", borderColor: alpha(theme.textMain, 0.05) } }}
                            >
                              Less
                            </Button>
                          </Stack>
                        </Card>
                      )}
                    </>
                  )}
                </Box>
              </CardContent>
            </Card>

            {/* MODEL WEIGHTS */}
            <Box>
              <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 3 }}>
                <HubIcon sx={{ color: theme.primary }} />
                <Typography variant="h6" fontWeight={600} sx={{ color: theme.textMain }}>Model Weights</Typography>
              </Stack>
              {renderFileList(modelFiles, <HistoryIcon fontSize="small" />, false)}
            </Box>

            {/* TRAINING SOURCE */}
            <Box>
              <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 3 }}>
                <CodeIcon sx={{ color: theme.primary }} />
                <Typography variant="h6" fontWeight={600} sx={{ color: theme.textMain }}>Training Source</Typography>
              </Stack>
              {renderFileList(codeFiles, <CodeIcon fontSize="small" />)}
            </Box>
          </Stack>
        </Box>
      </Container >

      {/* ================= DOWNLOAD DIALOG ================= */}
      < Dialog open={downloadOpen} onClose={() => setDownloadOpen(false)
      } PaperProps={{ sx: { borderRadius: '24px', p: 1, bgcolor: theme.background } }}>
        <DialogTitle sx={{ fontWeight: 700, letterSpacing: "-0.02em", color: theme.textMain }}>Export Version Bundle</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: theme.textMuted, mb: 3 }}>Choose the data layers to include in the generated archive.</Typography>
          <Stack spacing={1}>
            {["dataset", "labels", "model", "code"].map((k) => {
              const isDisabled =
                (k === "dataset" && datasetFiles.length === 0) ||
                (k === "labels" && labelFiles.length === 0) ||
                (k === "model" && modelFiles.length === 0) ||
                (k === "code" && codeFiles.length === 0);

              return (
                <FormControlLabel
                  key={k}
                  control={
                    <Checkbox
                      checked={!isDisabled && (downloadSelect as any)[k]}
                      onChange={(e) => setDownloadSelect({ ...downloadSelect, [k]: e.target.checked })}
                      disabled={isDisabled}
                      sx={{ color: theme.textMuted, '&.Mui-checked': { color: theme.primary } }}
                    />
                  }
                  label={
                    <Typography variant="body2" fontWeight={700} sx={{ color: isDisabled ? theme.textMuted : theme.textMain, opacity: isDisabled ? 0.5 : 1 }}>
                      {k.toUpperCase()} {isDisabled && "(Not Available)"}
                    </Typography>
                  }
                />
              );
            })}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setDownloadOpen(false)} sx={{ fontWeight: 700, color: theme.textMuted, textTransform: 'none' }}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleDownload}
            disabled={downloadLoading}
            sx={{
              bgcolor: theme.primary,
              borderRadius: '12px',
              fontWeight: 700,
              px: 3,
              textTransform: 'none',
              "&.Mui-disabled": {
                bgcolor: alpha(theme.primary, 0.7),
                color: alpha("#fff", 0.8)
              }
            }}
          >
            {downloadLoading ? <CircularProgress size={20} color="inherit" sx={{ mr: 1 }} /> : null}
            {downloadLoading ? "Starting..." : "Generate ZIP"}
          </Button>
        </DialogActions>
      </Dialog >

      {/* ================= NETRON FALLBACK DIALOG ================= */}
      <Dialog
        open={netronOpen}
        onClose={() => setNetronOpen(false)}
        PaperProps={{
          sx: {
            borderRadius: '24px',
            p: 1,
            bgcolor: theme.background,
            maxWidth: '500px'
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: 800, fontSize: '1.25rem', color: theme.textMain, pb: 1 }}>
          Model Viewer Assistant
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: theme.textMuted, mb: 3, lineHeight: 1.6 }}>
            Netron.app is now open in a new tab. Since your server is using HTTP, you'll need to manually load the weights:
          </Typography>

          <Box sx={{
            bgcolor: alpha(theme.primary, 0.05),
            p: 2.5,
            borderRadius: '16px',
            border: `1px dashed ${alpha(theme.primary, 0.3)}`,
            mb: 3
          }}>
            <Stack spacing={2}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Box sx={{
                  width: 24, height: 24, borderRadius: '50%',
                  bgcolor: theme.primary, color: 'white',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.75rem', fontWeight: 800
                }}>1</Box>
                <Typography variant="body2" fontWeight={700} sx={{ color: theme.textMain }}>
                  Download the model weights below.
                </Typography>
              </Stack>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Box sx={{
                  width: 24, height: 24, borderRadius: '50%',
                  bgcolor: theme.primary, color: 'white',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.75rem', fontWeight: 800
                }}>2</Box>
                <Typography variant="body2" fontWeight={700} sx={{ color: theme.textMain }}>
                  Drag the file into the Netron window.
                </Typography>
              </Stack>
            </Stack>
          </Box>

          <Button
            fullWidth
            variant="contained"
            startIcon={<DownloadIcon />}
            href={`${API_BASE_URL}/artifacts/${activeModel?.id}/download`}
            onClick={() => {
              // Optional: small delay or auto-close? 
              // Keep open so they can see the drag-drop hint.
            }}
            sx={{
              bgcolor: theme.primary,
              borderRadius: '14px',
              py: 1.5,
              fontWeight: 800,
              boxShadow: `0 8px 16px ${alpha(theme.primary, 0.2)}`,
              textTransform: 'none',
              '&:hover': { bgcolor: theme.primaryDark }
            }}
          >
            Download {activeModel?.name || 'Weights'}
          </Button>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 1 }}>
          <Button
            onClick={() => setNetronOpen(false)}
            sx={{ fontWeight: 700, color: theme.textMuted, textTransform: 'none' }}
          >
            Got it, close
          </Button>
        </DialogActions>
      </Dialog>
    </Box >
  );
}