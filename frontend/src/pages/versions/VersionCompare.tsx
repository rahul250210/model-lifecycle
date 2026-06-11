"use client";

import { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Stack,
  IconButton,
  CircularProgress,
  Container,
  Chip,
  alpha,
  Button
} from "@mui/material";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import axios, { API_BASE_URL } from "../../api/axios";
import { useTheme } from "../../theme/ThemeContext";
import {
  ArrowBack as ArrowBackIcon,
  Assessment as MetricsIcon,
  Timeline as ParamsIcon,
  BarChart as BarChartIcon,
  Collections as DatasetIcon,
  AddCircle as AddIcon,
  RemoveCircle as RemoveIcon,
  ZoomIn as ZoomIcon,
  Category as CategoryIcon
} from "@mui/icons-material";
import ImageModal from "../../components/ImageModal";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line
} from 'recharts';

interface Artifact {
  id: number;
  version_id: number;
  name: string;
  type: string;
  size: number;
  checksum: string;
  path: string;
}

interface DatasetDelta {
  added: Artifact[];
  removed: Artifact[];
}

/* =======================
   Types
======================= */

interface Version {
  id: number;
  version_number: number;
  parent_version_id?: number;
  metrics?: Record<string, number>;
  parameters?: Record<string, any>;
  created_at: string;
  is_active: boolean;
  note?: string;
  accuracy?: number;
  precision?: number;
  recall?: number;
  f1_score?: number;
  frame_tp?: number;
  frame_tn?: number;
  frame_fp?: number;
  frame_fn?: number;
  alert_tp?: number;
  alert_tn?: number;
  alert_fp?: number;
  alert_fn?: number;
  // Resource Metrics
  cpu_utilization?: number;
  gpu_utilization?: number;
  inference_time?: number;
  cpu_memory_usage?: number;
  gpu_memory_usage?: number;
  cameras_supported?: number;

  // Delta / Dataset Stats
  delta?: {
    dataset_count?: number;
    dataset_new?: number;
    dataset_reused?: number;
    dataset_removed?: number;
  };
}

/* =======================
   Component
======================= */

export default function VersionCompare() {
  const { factoryId, algorithmId, modelId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { t } = useTranslation();

  const leftId = searchParams.get("left");
  const rightId = searchParams.get("right");
  const idsParam = searchParams.get("ids");

  const [versions, setVersions] = useState<Version[]>([]);
  const [modelName, setModelName] = useState<string>("Model");
  const [loading, setLoading] = useState(true);
  const [datasetDelta, setDatasetDelta] = useState<DatasetDelta>({ added: [], removed: [] });
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [addedVisibleCount, setAddedVisibleCount] = useState(10);
  const [removedVisibleCount, setRemovedVisibleCount] = useState(10);
  const [hideUnchangedParams, setHideUnchangedParams] = useState(false);

  // Derived left (baseline) and right (latest candidate) versions
  const left = versions[0] || null;
  const right = versions[versions.length - 1] || null;

  // Colors palette for multiple versions
  const colors = [
    theme.primary,
    theme.secondary || theme.info,
    theme.success,
    theme.warning,
    theme.error,
    theme.info,
    '#f97316',
    '#ec4899'
  ];

  // Image Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedImages, setSelectedImages] = useState<Artifact[]>([]);
  const [initialIndex, setInitialIndex] = useState(0);

  const openImage = (images: Artifact[], index: number) => {
    setSelectedImages(images);
    setInitialIndex(index);
    setModalOpen(true);
  };

  /* =======================
     Fetch versions
  ======================= */

  const versionIds = idsParam 
    ? idsParam.split(",").map(id => id.trim()).filter(Boolean)
    : [leftId, rightId].filter(Boolean) as string[];

  useEffect(() => {
    const fetchVersions = async () => {
      try {
        const [modelRes, ...versionResList] = await Promise.all([
          axios.get(
            `/algorithms/${algorithmId}/factories/${factoryId}/models/${modelId}`
          ),
          ...versionIds.map(id => 
            axios.get(
              `/algorithms/${algorithmId}/factories/${factoryId}/models/${modelId}/versions/${id}`
            )
          )
        ]);

        const fetchedVersions = versionResList.map(res => res.data as Version);
        // Sort chronologically by version number
        fetchedVersions.sort((a, b) => a.version_number - b.version_number);

        setVersions(fetchedVersions);
        setModelName(modelRes.data.name);
      } catch (err) {
        console.error("Failed to compare versions", err);
      } finally {
        setLoading(false);
      }
    };

    const fetchDatasetComparison = async () => {
      if (!leftId || !rightId) return;
      setGalleryLoading(true);
      try {
        const res = await axios.get(
          `/algorithms/${algorithmId}/factories/${factoryId}/models/${modelId}/compare-datasets/${leftId}/${rightId}`
        );
        setDatasetDelta(res.data);
      } catch (err) {
        console.error("Failed to fetch dataset comparison", err);
      } finally {
        setGalleryLoading(false);
      }
    };

    if (versionIds.length > 0) {
      fetchVersions();
      fetchDatasetComparison();
    } else {
      setLoading(false);
    }
  }, [factoryId, algorithmId, modelId, idsParam, leftId, rightId]);

  /* =======================
     Loading
  ======================= */

  if (loading || versions.length === 0 || !left || !right) {
    return (
      <Box
        sx={{
          height: "70vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: theme.background
        }}
      >
        <CircularProgress size={42} sx={{ color: theme.primary }} />
      </Box>
    );
  }

  /* =======================
     Helpers
  ======================= */

  const getMetricValue = (v: Version, key: string) => {
    if (key === 'accuracy') return v.accuracy;
    if (key === 'precision') return v.precision;
    if (key === 'recall') return v.recall;
    if (key === 'f1_score') return v.f1_score;
    if (key === 'frame_tp') return v.frame_tp;
    if (key === 'frame_tn') return v.frame_tn;
    if (key === 'frame_fp') return v.frame_fp;
    if (key === 'frame_fn') return v.frame_fn;
    if (key === 'alert_tp') return v.alert_tp;
    if (key === 'alert_tn') return v.alert_tn;
    if (key === 'alert_fp') return v.alert_fp;
    if (key === 'alert_fn') return v.alert_fn;
    return v.metrics?.[key];
  };

  const isPercentage = (key: string) => {
    return ['accuracy', 'precision', 'recall', 'f1_score'].includes(key);
  };

  const allMetricKeys = Array.from(
    new Set([
      'frame_tp', 'frame_tn', 'frame_fp', 'frame_fn',
      'alert_tp', 'alert_tn', 'alert_fp', 'alert_fn',
      ...versions.flatMap(v => Object.keys(v.metrics || {})),
    ])
  ).filter(key => !['accuracy', 'precision', 'recall', 'f1_score'].includes(key));

  const allParamKeys = Array.from(
    new Set(versions.flatMap(v => Object.keys(v.parameters || {})))
  );

  const visibleParamKeys = allParamKeys.filter(key => {
    if (!hideUnchangedParams) return true;
    if (versions.length <= 1) return false;
    const firstVal = versions[0].parameters?.[key];
    return versions.some(v => JSON.stringify(v.parameters?.[key]) !== JSON.stringify(firstVal));
  });

  // Dynamic Comparison Insights
  const getBestPerformer = () => {
    if (!versions.length) return null;
    let best = versions[0];
    let maxScore = (best.accuracy || 0) + (best.f1_score || 0);
    for (let i = 1; i < versions.length; i++) {
      const score = (versions[i].accuracy || 0) + (versions[i].f1_score || 0);
      if (score > maxScore) {
        maxScore = score;
        best = versions[i];
      }
    }
    return best;
  };

  const getFastestVersion = () => {
    if (!versions.length) return null;
    const valid = versions.filter(v => v.inference_time !== undefined && v.inference_time !== null);
    if (!valid.length) return null;
    return valid.reduce((prev, curr) => (curr.inference_time || 0) < (prev.inference_time || 0) ? curr : prev, valid[0]);
  };

  const getMostEfficientVersion = () => {
    if (!versions.length) return null;
    const valid = versions.filter(v => v.cpu_memory_usage !== undefined || v.gpu_memory_usage !== undefined);
    if (!valid.length) return null;
    return valid.reduce((prev, curr) => {
      const prevUsage = (prev.cpu_memory_usage || 0) + (prev.gpu_memory_usage || 0);
      const currUsage = (curr.cpu_memory_usage || 0) + (curr.gpu_memory_usage || 0);
      return currUsage < prevUsage ? curr : prev;
    }, valid[0]);
  };

  const bestPerformer = getBestPerformer();
  const fastestVersion = getFastestVersion();
  const efficientVersion = getMostEfficientVersion();


  // Custom Tooltip for Recharts
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <Box sx={{
          bgcolor: theme.mode === 'dark' ? "rgba(15, 23, 42, 0.95)" : "rgba(255, 255, 255, 0.95)",
          backdropFilter: "blur(12px)",
          border: `1px solid ${alpha(theme.border, 0.6)}`,
          p: 2,
          borderRadius: "16px",
          boxShadow: `0 12px 32px ${alpha('#000', 0.15)}`,
          zIndex: 1000
        }}>
          <Typography variant="body2" fontWeight={850} sx={{ color: theme.textMain, mb: 1, borderBottom: `1px solid ${alpha(theme.border, 0.3)}`, pb: 0.5 }}>
            {label}
          </Typography>
          <Stack spacing={1}>
            {payload.map((entry: any, index: number) => (
              <Stack key={index} direction="row" spacing={3} alignItems="center" justifyContent="space-between">
                <Stack direction="row" spacing={1} alignItems="center">
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: entry.stroke || entry.fill }} />
                  <Typography variant="caption" fontWeight={700} sx={{ color: theme.textSecondary }}>
                    {entry.name}
                  </Typography>
                </Stack>
                <Typography variant="body2" fontWeight={950} sx={{ color: theme.textMain, fontFamily: "'JetBrains Mono', monospace" }}>
                  {typeof entry.value === 'number' ? (entry.value % 1 === 0 ? entry.value : entry.value.toFixed(2)) : entry.value}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </Box>
      );
    }
    return null;
  };

  const getMetricLabel = (key: string) => {
    const mapping: Record<string, string> = {
      frame_tp: 'Frame TP',
      frame_tn: 'Frame TN',
      frame_fp: 'Frame FP',
      frame_fn: 'Frame FN',
      alert_tp: 'Alert TP',
      alert_tn: 'Alert TN',
      alert_fp: 'Alert FP',
      alert_fn: 'Alert FN',
    };
    return mapping[key] || key.replace(/_/g, ' ');
  };

  return (
    <Box sx={{
      minHeight: "100vh",
      bgcolor: theme.background,
      position: "relative"
    }}>
      {/* BACKGROUND DECORATION */}
      <Box sx={{
        position: "fixed",
        top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 0,
        background: `
          radial-gradient(circle at 80% 10%, ${alpha(theme.primary, 0.08)} 0%, transparent 40%),
          radial-gradient(circle at 10% 40%, ${alpha(theme.secondary || theme.primary, 0.08)} 0%, transparent 40%)
        `,
        pointerEvents: "none"
      }} />

      {/* Fixed Sticky Header */}
      <Box sx={{
        position: "sticky",
        top: 0,
        bgcolor: alpha(theme.background, 0.7),
        backdropFilter: "blur(24px)",
        zIndex: 100,
        borderBottom: `1px solid ${alpha(theme.border, 0.5)}`,
      }}>
        <Container maxWidth="xl" sx={{ width: '100%', maxWidth: '1400px !important' }}>
          <Box sx={{ py: 2, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Stack direction="row" spacing={3} alignItems="center">
              <IconButton
                onClick={() => navigate(`/algorithms/${algorithmId}/factories/${factoryId}/models/${modelId}/versions`)}
                sx={{
                  bgcolor: theme.paper,
                  border: `1px solid ${theme.border}`,
                  boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
                  '&:hover': { bgcolor: theme.primaryLight, borderColor: theme.primary, transform: "translateX(-4px)" },
                  transition: "all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)"
                }}
              >
                <ArrowBackIcon fontSize="small" sx={{ color: theme.textMain }} />
              </IconButton>
              <Box>
                <Typography variant="h4" fontWeight={900} sx={{
                  color: theme.textMain,
                  letterSpacing: "-0.05em",
                  background: `linear-gradient(135deg, ${theme.textMain} 0%, ${alpha(theme.textMain, 0.6)} 100%)`,
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent"
                }}>
                  {t("versionCompare.titlePrefix")}{" "}
                  <Box component="span" sx={{ color: theme.primary, WebkitTextFillColor: "initial" }}>
                    {t("versionCompare.titleSuffix")}
                  </Box>
                </Typography>
                <Typography variant="body2" sx={{ color: theme.textMuted, fontWeight: 700, mt: 0.2 }}>
                  {t("versionCompare.comparingVersions")}{" "}
                  {versions.map((v, i) => (
                    <Box component="span" key={v.id} sx={{ color: i === 0 ? theme.textMain : i === versions.length - 1 ? theme.primary : theme.textSecondary, fontWeight: 800 }}>
                      v-{v.version_number}{i < versions.length - 1 ? ', ' : ''}
                    </Box>
                  ))}
                </Typography>
              </Box>
            </Stack>

            <Stack direction="row" spacing={2} sx={{ display: { xs: 'none', md: 'flex' } }}>
              <Box sx={{ textAlign: 'right' }}>
                <Typography variant="overline" fontWeight={900} sx={{ color: theme.textMuted, letterSpacing: 2 }}>{t("versionCompare.modelIdentity")}</Typography>
                <Typography variant="body2" fontWeight={700} sx={{ color: theme.textMain }}>{modelName}</Typography>
              </Box>
            </Stack>
          </Box>
        </Container>
      </Box>

      {/* Main Content Area */}
      <Box sx={{ py: 6, zIndex: 1 }}>
        <Container maxWidth="xl" sx={{ width: '100%', maxWidth: '1400px !important' }}>

          {/* Key Comparison Insights Dashboard */}
          {versions.length > 1 && (
            <Box sx={{ mb: 6 }}>
              <Typography variant="overline" fontWeight={900} sx={{ color: theme.textMuted, letterSpacing: 2, mb: 2, display: 'block' }}>
                {t("versionCompare.comparisonHighlights")}
              </Typography>
              <Grid container spacing={3}>
                {bestPerformer && (
                  <Grid size={{ xs: 12, md: 4 }}>
                    <Card sx={{
                      borderRadius: "24px",
                      border: `1px solid ${alpha(theme.success, 0.2)}`,
                      background: theme.mode === 'dark' 
                        ? `linear-gradient(135deg, ${alpha(theme.success, 0.05)} 0%, ${alpha(theme.paper, 0.85)} 100%)`
                        : `linear-gradient(135deg, ${alpha(theme.success, 0.03)} 0%, ${alpha(theme.paper, 0.75)} 100%)`,
                      backdropFilter: "blur(20px)",
                      boxShadow: `0 12px 30px -10px ${alpha(theme.success, 0.15)}`,
                      height: '100%',
                      transition: 'all 0.3s ease',
                      '&:hover': { 
                        transform: 'translateY(-3px)',
                        boxShadow: `0 18px 40px -8px ${alpha(theme.success, 0.25)}`,
                        borderColor: alpha(theme.success, 0.4)
                      }
                    }}>
                      <CardContent sx={{ p: 3 }}>
                        <Stack direction="row" spacing={2} alignItems="center">
                          <Box sx={{ 
                            p: 1.5, 
                            borderRadius: "14px", 
                            bgcolor: alpha(theme.success, 0.1), 
                            color: theme.success, 
                            display: 'flex',
                            fontSize: '20px'
                          }}>
                            🏆
                          </Box>
                          <Box>
                            <Typography variant="caption" fontWeight={900} sx={{ color: theme.textMuted, letterSpacing: 1.2, display: 'block', fontSize: '10px' }}>
                              {t("versionCompare.accuracyLeader")}
                            </Typography>
                            <Typography variant="subtitle1" fontWeight={900} sx={{ color: theme.textMain }}>
                              {t("versionCompare.versionNumber", { number: bestPerformer.version_number })}
                            </Typography>
                            <Typography variant="caption" sx={{ color: theme.textSecondary, display: 'block', mt: 0.5, lineHeight: 1.3 }}>
                              {t("versionCompare.highestAccuracy", { accuracy: bestPerformer.accuracy || 0, f1: bestPerformer.f1_score || 0 })}
                            </Typography>
                          </Box>
                        </Stack>
                      </CardContent>
                    </Card>
                  </Grid>
                )}

                {fastestVersion && (
                  <Grid size={{ xs: 12, md: 4 }}>
                    <Card sx={{
                      borderRadius: "24px",
                      border: `1px solid ${alpha(theme.primary, 0.2)}`,
                      background: theme.mode === 'dark' 
                        ? `linear-gradient(135deg, ${alpha(theme.primary, 0.05)} 0%, ${alpha(theme.paper, 0.85)} 100%)`
                        : `linear-gradient(135deg, ${alpha(theme.primary, 0.03)} 0%, ${alpha(theme.paper, 0.75)} 100%)`,
                      backdropFilter: "blur(20px)",
                      boxShadow: `0 12px 30px -10px ${alpha(theme.primary, 0.15)}`,
                      height: '100%',
                      transition: 'all 0.3s ease',
                      '&:hover': { 
                        transform: 'translateY(-3px)',
                        boxShadow: `0 18px 40px -8px ${alpha(theme.primary, 0.25)}`,
                        borderColor: alpha(theme.primary, 0.4)
                      }
                    }}>
                      <CardContent sx={{ p: 3 }}>
                        <Stack direction="row" spacing={2} alignItems="center">
                          <Box sx={{ 
                            p: 1.5, 
                            borderRadius: "14px", 
                            bgcolor: alpha(theme.primary, 0.1), 
                            color: theme.primary, 
                            display: 'flex',
                            fontSize: '20px'
                          }}>
                            ⚡
                          </Box>
                          <Box>
                            <Typography variant="caption" fontWeight={900} sx={{ color: theme.textMuted, letterSpacing: 1.2, display: 'block', fontSize: '10px' }}>
                              {t("versionCompare.speedLeader")}
                            </Typography>
                            <Typography variant="subtitle1" fontWeight={900} sx={{ color: theme.textMain }}>
                              {t("versionCompare.versionNumber", { number: fastestVersion.version_number })}
                            </Typography>
                            <Typography variant="caption" sx={{ color: theme.textSecondary, display: 'block', mt: 0.5, lineHeight: 1.3 }}>
                              {t("versionCompare.lowestLatency", { time: fastestVersion.inference_time || 0 })}
                            </Typography>
                          </Box>
                        </Stack>
                      </CardContent>
                    </Card>
                  </Grid>
                )}

                {efficientVersion && (
                  <Grid size={{ xs: 12, md: 4 }}>
                    <Card sx={{
                      borderRadius: "24px",
                      border: `1px solid ${alpha(theme.secondary || theme.primary, 0.2)}`,
                      background: theme.mode === 'dark' 
                        ? `linear-gradient(135deg, ${alpha(theme.secondary || theme.primary, 0.05)} 0%, ${alpha(theme.paper, 0.85)} 100%)`
                        : `linear-gradient(135deg, ${alpha(theme.secondary || theme.primary, 0.03)} 0%, ${alpha(theme.paper, 0.75)} 100%)`,
                      backdropFilter: "blur(20px)",
                      boxShadow: `0 12px 30px -10px ${alpha(theme.secondary || theme.primary, 0.15)}`,
                      height: '100%',
                      transition: 'all 0.3s ease',
                      '&:hover': { 
                        transform: 'translateY(-3px)',
                        boxShadow: `0 18px 40px -8px ${alpha(theme.secondary || theme.primary, 0.25)}`,
                        borderColor: alpha(theme.secondary || theme.primary, 0.4)
                      }
                    }}>
                      <CardContent sx={{ p: 3 }}>
                        <Stack direction="row" spacing={2} alignItems="center">
                          <Box sx={{ 
                            p: 1.5, 
                            borderRadius: "14px", 
                            bgcolor: alpha(theme.secondary || theme.primary, 0.1), 
                            color: theme.secondary || theme.primary, 
                            display: 'flex',
                            fontSize: '20px'
                          }}>
                            🍃
                          </Box>
                          <Box>
                            <Typography variant="caption" fontWeight={900} sx={{ color: theme.textMuted, letterSpacing: 1.2, display: 'block', fontSize: '10px' }}>
                              {t("versionCompare.hardwareChampion")}
                            </Typography>
                            <Typography variant="subtitle1" fontWeight={900} sx={{ color: theme.textMain }}>
                              {t("versionCompare.versionNumber", { number: efficientVersion.version_number })}
                            </Typography>
                            <Typography variant="caption" sx={{ color: theme.textSecondary, display: 'block', mt: 0.5, lineHeight: 1.3 }}>
                              {t("versionCompare.memoryFootprint", { cpu: efficientVersion.cpu_memory_usage || 0, gpu: efficientVersion.gpu_memory_usage || 0 })}
                            </Typography>
                          </Box>
                        </Stack>
                      </CardContent>
                    </Card>
                  </Grid>
                )}
              </Grid>
            </Box>
          )}


          {/* Visual Comparison Graphs */}
          <Box sx={{ mb: 10 }}>
            <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 4 }}>
              <Box sx={{ p: 1.5, borderRadius: "16px", bgcolor: alpha(theme.info, 0.1), color: theme.info, display: 'flex' }}>
                <BarChartIcon />
              </Box>
              <Box>
                <Typography variant="h5" fontWeight={900} sx={{ color: theme.textMain, letterSpacing: "-0.02em" }}>
                  {t("versionCompare.visualAnalysis")}
                </Typography>
                <Typography variant="body2" sx={{ color: theme.textMuted, fontWeight: 600 }}>
                  {t("versionCompare.visualAnalysisSub")}
                </Typography>
              </Box>
            </Stack>

            <Grid container spacing={4}>
              {/* Performance Parallel Coordinates */}
              <Grid size={{ xs: 12 }}>
                <Card sx={{
                  borderRadius: "24px",
                  background: theme.mode === 'dark'
                    ? `linear-gradient(135deg, ${alpha(theme.paper, 0.9)} 0%, ${alpha(theme.paper, 0.8)} 100%)`
                    : `linear-gradient(135deg, ${alpha(theme.paper, 0.65)} 0%, ${alpha(theme.paper, 0.45)} 100%)`,
                  backdropFilter: "blur(20px)",
                  border: `1px solid ${alpha(theme.border, 0.4)}`,
                  boxShadow: `0 16px 40px -10px ${alpha(theme.textMain, 0.05)}`,
                  transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                  "&:hover": {
                    boxShadow: `0 24px 60px -8px ${alpha(theme.textMain, 0.1)}`
                  }
                }}>
                  <CardContent sx={{ p: 4 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 4 }}>
                      <Box>
                        <Typography variant="h6" fontWeight={850} sx={{ color: theme.textMain }}>
                          {t("versionCompare.performanceProfile")}
                        </Typography>
                        <Typography variant="caption" fontWeight={900} sx={{ color: theme.textMuted, letterSpacing: 1 }}>
                          {t("versionCompare.parallelCoordinates")}
                        </Typography>
                      </Box>
                    </Stack>

                    <Box sx={{ height: 380, width: "100%", mt: 2 }}>
                      <ResponsiveContainer>
                        <LineChart
                          data={[
                            { metric: t("versionDetails.accuracy") || 'Accuracy', ...versions.reduce((acc, v) => ({ ...acc, [`v_${v.version_number}`]: v.accuracy || 0 }), {}) },
                            { metric: t("versionDetails.precision") || 'Precision', ...versions.reduce((acc, v) => ({ ...acc, [`v_${v.version_number}`]: v.precision || 0 }), {}) },
                            { metric: t("versionDetails.recall") || 'Recall', ...versions.reduce((acc, v) => ({ ...acc, [`v_${v.version_number}`]: v.recall || 0 }), {}) },
                            { metric: t("versionDetails.f1Score") || 'F1 Score', ...versions.reduce((acc, v) => ({ ...acc, [`v_${v.version_number}`]: v.f1_score || 0 }), {}) },
                          ]}
                          margin={{ top: 10, right: 30, left: -20, bottom: 0 }}
                        >
                          <CartesianGrid strokeDasharray="4 4" vertical={false} stroke={alpha(theme.textMuted, 0.15)} />
                          <XAxis
                            dataKey="metric"
                            tick={{ fill: theme.textSecondary, fontSize: 12, fontWeight: 700 }}
                            axisLine={false}
                            tickLine={false}
                            dy={10}
                          />
                          <YAxis
                            domain={[10, 100]}
                            tick={{ fill: theme.textMuted, fontSize: 11, fontWeight: 600 }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <Tooltip content={<CustomTooltip />} />
                          <Legend
                            wrapperStyle={{ fontSize: '12px', fontWeight: 800, paddingTop: '20px' }}
                            iconType="circle"
                          />
                          {versions.map((v, idx) => (
                            <Line
                              key={v.id}
                              type="monotone"
                              dataKey={`v_${v.version_number}`}
                              name={t("versionCompare.versionNumber", { number: v.version_number })}
                              stroke={colors[idx % colors.length]}
                              strokeWidth={3.5}
                              dot={{ r: 5, strokeWidth: 3, stroke: colors[idx % colors.length], fill: theme.paper }}
                              activeDot={{ r: 8, strokeWidth: 4, stroke: colors[idx % colors.length], fill: theme.paper }}
                            />
                          ))}
                        </LineChart>
                      </ResponsiveContainer>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              {/* Resource Consumption Horizontal Bar */}
              <Grid size={{ xs: 12 }}>
                <Card sx={{
                  borderRadius: "24px",
                  background: theme.mode === 'dark'
                    ? `linear-gradient(135deg, ${alpha(theme.paper, 0.9)} 0%, ${alpha(theme.paper, 0.8)} 100%)`
                    : `linear-gradient(135deg, ${alpha(theme.paper, 0.65)} 0%, ${alpha(theme.paper, 0.45)} 100%)`,
                  backdropFilter: "blur(20px)",
                  border: `1px solid ${alpha(theme.border, 0.4)}`,
                  boxShadow: `0 16px 40px -10px ${alpha(theme.textMain, 0.05)}`,
                  transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                  "&:hover": {
                    boxShadow: `0 24px 60px -8px ${alpha(theme.textMain, 0.1)}`
                  }
                }}>
                  <CardContent sx={{ p: 4 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 4 }}>
                      <Box>
                        <Typography variant="h6" fontWeight={850} sx={{ color: theme.textMain }}>
                          {t("versionCompare.resourceUsage")}
                        </Typography>
                        <Typography variant="caption" fontWeight={900} sx={{ color: theme.textMuted, letterSpacing: 1 }}>
                          {t("versionCompare.latencyUtilization")}
                        </Typography>
                      </Box>
                    </Stack>

                    <Box sx={{ height: 380, width: "100%", mt: 2 }}>
                      <ResponsiveContainer>
                        <BarChart
                          layout="vertical"
                          data={[
                            { name: `${t("versionDetails.inference") || "Inference"} (ms)`, ...versions.reduce((acc, v) => ({ ...acc, [`v_${v.version_number}`]: v.inference_time || 0 }), {}) },
                            { name: `${t("versionDetails.cpuUsage") || "CPU Usage"} (%)`, ...versions.reduce((acc, v) => ({ ...acc, [`v_${v.version_number}`]: v.cpu_utilization || 0 }), {}) },
                            { name: `${t("versionDetails.gpuUsage") || "GPU Usage"} (%)`, ...versions.reduce((acc, v) => ({ ...acc, [`v_${v.version_number}`]: v.gpu_utilization || 0 }), {}) },
                            { name: t("versionDetails.cameras") || "Cameras", ...versions.reduce((acc, v) => ({ ...acc, [`v_${v.version_number}`]: v.cameras_supported || 0 }), {}) },
                          ]}
                          margin={{ top: 0, right: 20, left: 10, bottom: 0 }}
                          barGap={6}
                        >
                          <CartesianGrid strokeDasharray="4 4" horizontal={false} stroke={alpha(theme.textMuted, 0.15)} />
                          <XAxis
                            type="number"
                            tick={{ fill: theme.textSecondary, fontSize: 11, fontWeight: 700 }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis
                            dataKey="name"
                            type="category"
                            tick={{ fill: theme.textSecondary, fontSize: 11, fontWeight: 700 }}
                            width={100}
                            axisLine={false}
                            tickLine={false}
                          />
                          <Tooltip content={<CustomTooltip />} cursor={{ fill: alpha(theme.textMain, 0.03) }} />
                          <Legend
                            wrapperStyle={{ fontSize: '12px', fontWeight: 800, paddingTop: '20px' }}
                            iconType="circle"
                          />
                          {versions.map((v, idx) => (
                            <Bar
                              key={v.id}
                              name={t("versionCompare.versionNumber", { number: v.version_number })}
                              dataKey={`v_${v.version_number}`}
                              fill={colors[idx % colors.length]}
                              radius={[0, 10, 10, 0]}
                              barSize={Math.max(4, 16 - versions.length * 2)}
                            />
                          ))}
                        </BarChart>
                      </ResponsiveContainer>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Box>

          {/* Metrics Comparison */}
          <Box sx={{ mb: 10 }}>
            <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 4 }}>
              <Box sx={{ p: 1.5, borderRadius: "16px", bgcolor: alpha(theme.success, 0.1), color: theme.success, display: 'flex' }}>
                <MetricsIcon />
              </Box>
              <Box>
                <Typography variant="h5" fontWeight={900} sx={{ color: theme.textMain, letterSpacing: "-0.02em" }}>
                  Metric Convergence Overview
                </Typography>
                <Typography variant="body2" sx={{ color: theme.textMuted, fontWeight: 600 }}>
                  Detailed analysis of performance gain/loss across standard evaluation criteria.
                </Typography>
              </Box>
            </Stack>

            <Card sx={{
              borderRadius: "24px", overflow: 'hidden',
              border: `1px solid ${alpha(theme.border, 0.5)}`,
              background: `linear-gradient(145deg, ${alpha(theme.paper, 0.6)} 0%, ${alpha(theme.paper, 0.4)} 100%)`,
              backdropFilter: "blur(20px)",
              boxShadow: "0 10px 40px -10px rgba(0,0,0,0.05)"
            }}>
              <Box sx={{
                display: 'grid',
                gridTemplateColumns: `1.6fr repeat(${versions.length}, 1fr)`,
                bgcolor: theme.mode === 'dark' ? alpha(theme.white, 0.03) : alpha(theme.textMain, 0.03),
                p: "20px 32px",
                borderBottom: `1px solid ${alpha(theme.border, 0.4)}`,
                alignItems: 'center'
              }}>
                <Typography variant="caption" fontWeight={900} sx={{ color: theme.textMuted, letterSpacing: 2 }}>{t("versionCompare.metricDefinition")}</Typography>
                {versions.map((v, idx) => (
                  <Typography
                    key={v.id}
                    variant="caption"
                    fontWeight={950}
                    sx={{
                      color: colors[idx % colors.length],
                      textAlign: 'center',
                      bgcolor: alpha(colors[idx % colors.length], 0.08),
                      py: 1,
                      borderRadius: '10px',
                      mx: 1,
                      border: `1px solid ${alpha(colors[idx % colors.length], 0.25)}`,
                      letterSpacing: 1,
                      boxShadow: `0 4px 12px ${alpha(colors[idx % colors.length], 0.05)}`
                    }}
                  >
                    {t("versionCompare.versionNumber", { number: v.version_number }).toUpperCase()}
                  </Typography>
                ))}
              </Box>
              {allMetricKeys.map((key, idx) => {
                const isPct = isPercentage(key);

                return (
                  <Box key={key} sx={{
                    display: 'grid',
                    gridTemplateColumns: `1.6fr repeat(${versions.length}, 1fr)`,
                    p: "18px 32px",
                    alignItems: 'center',
                    bgcolor: idx % 2 === 0 ? 'transparent' : alpha(theme.textMain, 0.015),
                    borderBottom: idx === allMetricKeys.length - 1 ? 'none' : `1px solid ${alpha(theme.border, 0.25)}`,
                    transition: "all 0.2s ease",
                    "&:hover": { bgcolor: alpha(theme.primary, 0.03) }
                  }}>
                    <Stack direction="row" spacing={2.5} alignItems="center">
                      <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: idx % 3 === 0 ? theme.primary : idx % 3 === 1 ? theme.success : theme.warning, boxShadow: `0 0 10px ${idx % 3 === 0 ? theme.primary : idx % 3 === 1 ? theme.success : theme.warning}` }} />
                      <Typography variant="body2" fontWeight={800} sx={{ color: theme.textMain, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        {getMetricLabel(key)}
                      </Typography>
                    </Stack>
                    {versions.map((v) => {
                      const val = getMetricValue(v, key);
                      return (
                        <Typography key={v.id} variant="body2" fontWeight={750} sx={{ color: theme.textMain, textAlign: 'center', fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>
                          {val !== undefined && val !== null ? (isPct ? `${val}%` : val) : '—'}
                        </Typography>
                      );
                    })}
                  </Box>
                );
              })}
            </Card>
          </Box>

          {/* Parameters Comparison */}
          {allParamKeys.length > 0 && (
            <Box sx={{ mb: 6 }}>
              <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between" sx={{ mb: 4 }}>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Box sx={{ p: 1.5, borderRadius: "16px", bgcolor: alpha(theme.primary, 0.1), color: theme.primary, display: 'flex' }}>
                    <ParamsIcon />
                  </Box>
                  <Box>
                    <Typography variant="h5" fontWeight={900} sx={{ color: theme.textMain, letterSpacing: "-0.02em" }}>
                      {t("versionCompare.configShift")}
                    </Typography>
                    <Typography variant="body2" sx={{ color: theme.textMuted, fontWeight: 600 }}>
                      {t("versionCompare.configShiftSub")}
                    </Typography>
                  </Box>
                </Stack>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => setHideUnchangedParams(!hideUnchangedParams)}
                  sx={{
                    borderRadius: "12px",
                    textTransform: "none",
                    fontWeight: 700,
                    borderColor: hideUnchangedParams ? theme.primary : alpha(theme.border, 0.8),
                    color: hideUnchangedParams ? theme.primary : theme.textSecondary,
                    bgcolor: hideUnchangedParams ? alpha(theme.primary, 0.05) : "transparent",
                    px: 2.5,
                    py: 1,
                    '&:hover': {
                      borderColor: theme.primary,
                      bgcolor: alpha(theme.primary, 0.08)
                    }
                  }}
                >
                  {hideUnchangedParams ? t("versionCompare.showingChangesOnly") : t("versionCompare.showChangesOnly")}
                </Button>
              </Stack>

              <Card sx={{
                borderRadius: "24px", overflow: 'hidden',
                border: `1px solid ${alpha(theme.border, 0.5)}`,
                background: `linear-gradient(145deg, ${alpha(theme.paper, 0.6)} 0%, ${alpha(theme.paper, 0.4)} 100%)`,
                backdropFilter: "blur(20px)",
                boxShadow: "0 10px 40px -10px rgba(0,0,0,0.05)"
              }}>
                <Box sx={{
                  display: 'grid',
                  gridTemplateColumns: `1.6fr repeat(${versions.length}, 1fr)`,
                  bgcolor: theme.mode === 'dark' ? alpha(theme.white, 0.03) : alpha(theme.textMain, 0.03),
                  p: "20px 32px",
                  borderBottom: `1px solid ${alpha(theme.border, 0.4)}`,
                  alignItems: 'center'
                }}>
                  <Typography variant="caption" fontWeight={900} sx={{ color: theme.textMuted, letterSpacing: 2 }}>{t("versionCompare.parameter")}</Typography>
                  {versions.map((v, idx) => (
                    <Typography
                      key={v.id}
                      variant="caption"
                      fontWeight={950}
                      sx={{
                        color: colors[idx % colors.length],
                        textAlign: 'center',
                        bgcolor: alpha(colors[idx % colors.length], 0.08),
                        py: 1,
                        borderRadius: '10px',
                        mx: 1,
                        border: `1px solid ${alpha(colors[idx % colors.length], 0.25)}`,
                        letterSpacing: 1,
                        boxShadow: `0 4px 12px ${alpha(colors[idx % colors.length], 0.05)}`
                      }}
                    >
                      {t("versionCompare.versionNumber", { number: v.version_number }).toUpperCase()}
                    </Typography>
                  ))}
                </Box>
                {visibleParamKeys.length === 0 ? (
                  <Box sx={{ p: 6, textAlign: 'center' }}>
                    <Typography variant="body2" sx={{ color: theme.textMuted, fontStyle: 'italic', fontWeight: 600 }}>
                      {t("versionCompare.noParamChanges")}
                    </Typography>
                  </Box>
                ) : (
                  visibleParamKeys.map((key, idx) => {
                    return (
                      <Box key={key} sx={{
                        display: 'grid',
                        gridTemplateColumns: `1.6fr repeat(${versions.length}, 1fr)`,
                        p: "18px 32px",
                        alignItems: 'center',
                        bgcolor: idx % 2 === 0 ? 'transparent' : alpha(theme.textMain, 0.015),
                        borderBottom: idx === visibleParamKeys.length - 1 ? 'none' : `1px solid ${alpha(theme.border, 0.25)}`,
                        transition: "all 0.2s ease",
                        "&:hover": { bgcolor: alpha(theme.primary, 0.03) }
                      }}>
                        <Typography variant="body2" fontWeight={800} sx={{ color: theme.textMain, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                          {key.replace(/_/g, ' ')}
                        </Typography>
                        {versions.map((v) => {
                          const val = v.parameters?.[key];
                          return (
                            <Typography key={v.id} variant="body2" fontWeight={750} sx={{ color: theme.textSecondary, textAlign: 'center', fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>
                              {val !== undefined ? String(val) : '—'}
                            </Typography>
                          );
                        })}
                      </Box>
                    );
                  })
                )}
              </Card>
            </Box>
          )}

          {/* Dataset Evolution Gallery */}
          {galleryLoading ? (
            <Box sx={{ mt: 8, mb: 10, textAlign: 'center' }}>
              <CircularProgress size={32} />
              <Typography variant="body2" sx={{ color: theme.textMuted, mt: 2 }}>{t("versionCompare.analyzingDataset")}</Typography>
            </Box>
          ) : (datasetDelta.added.length > 0 || datasetDelta.removed.length > 0) && (
            <Box sx={{ mt: 8, mb: 4 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 4 }}>
                <Box sx={{
                  p: 1.2,
                  borderRadius: '12px',
                  bgcolor: alpha(theme.primary, 0.1),
                  color: theme.primary,
                  display: 'flex'
                }}>
                  <DatasetIcon />
                </Box>
                <Box>
                  <Typography variant="h5" fontWeight={900} sx={{ color: theme.textMain }}>{t("versionCompare.datasetGallery")}</Typography>
                  <Typography variant="body2" sx={{ color: theme.textMuted }}>{t("versionCompare.datasetGallerySub")}</Typography>
                </Box>
              </Box>

              <Grid container spacing={4}>
                {/* Added Images */}
                {datasetDelta.added.length > 0 && (
                  <Grid size={{ xs: 12 }}>
                    <Card sx={{
                      borderRadius: '24px',
                      bgcolor: alpha(theme.paper, 0.6),
                      backdropFilter: 'blur(20px)',
                      border: `1px solid ${alpha(theme.success, 0.2)}`,
                      overflow: 'hidden'
                    }}>
                      <Box sx={{ p: 3, borderBottom: `1px solid ${alpha(theme.border, 0.1)}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Stack direction="row" spacing={1.5} alignItems="center">
                          <AddIcon sx={{ color: theme.success }} />
                          <Typography variant="subtitle1" fontWeight={800} sx={{ color: theme.textMain }}>{t("versionCompare.addedTo", { version: right.version_number })}</Typography>
                        </Stack>
                        <Chip label={t("versionCompare.imagesCount", { count: datasetDelta.added.length })} size="small" sx={{ bgcolor: alpha(theme.success, 0.1), color: theme.success, fontWeight: 700 }} />
                      </Box>
                      <Box sx={{
                        p: 3,
                        display: "flex",
                        gap: 2.5,
                        overflowX: "auto",
                        pb: 2,
                        cursor: 'grab',
                        '&::-webkit-scrollbar': { height: '8px' },
                        '&::-webkit-scrollbar-thumb': { bgcolor: alpha(theme.primary, 0.3), borderRadius: '10px', '&:hover': { bgcolor: alpha(theme.primary, 0.5) } }
                      }}>
                        {datasetDelta.added.slice(0, addedVisibleCount).map((img, i) => (
                          <Box
                            key={img.id}
                            sx={{ minWidth: 180, maxWidth: 180, flexShrink: 0 }}
                          >
                            <Box
                              onClick={() => openImage(datasetDelta.added, i)}
                              sx={{
                                aspectRatio: '1',
                                borderRadius: '12px',
                                overflow: 'hidden',
                                position: 'relative',
                                cursor: 'pointer',
                                border: `1px solid ${alpha(theme.border, 0.1)}`,
                                transition: 'all 0.2s ease',
                                '&:hover': { transform: 'scale(1.05)', boxShadow: `0 8px 16px ${alpha('#000', 0.2)}` },
                                '&:hover .zoom-overlay': { opacity: 1 }
                              }}
                            >
                              <img
                                src={`${API_BASE_URL}/artifacts/${img.id}/image`}
                                alt={img.name}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              />
                              <Box className="zoom-overlay" sx={{
                                position: 'absolute', inset: 0, bgcolor: alpha('#000', 0.4),
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                opacity: 0, transition: 'opacity 0.2s ease'
                              }}>
                                <ZoomIcon sx={{ color: '#fff' }} />
                              </Box>
                            </Box>
                            <Typography variant="caption" sx={{ p: 1, display: 'block', textAlign: 'center', fontWeight: 700, color: theme.textMain, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {img.name.split('/').pop()}
                            </Typography>
                          </Box>
                        ))}

                        {/* Pagination Controls inside Scroll Container */}
                        {datasetDelta.added.length > 10 && (
                          <Card
                            elevation={0}
                            sx={{
                              minWidth: 220,
                              maxWidth: 220,
                              borderRadius: "16px",
                              border: `1px solid ${alpha(theme.border, 0.4)}`,
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
                                boxShadow: `0 8px 16px ${alpha('#000', 0.1)}`,
                                borderColor: alpha(theme.primary, 0.3)
                              }
                            }}
                          >
                            <Box sx={{ mb: 2, p: 1.5, borderRadius: "50%", bgcolor: alpha(theme.primary, 0.08), color: theme.primary }}>
                              <CategoryIcon fontSize="small" />
                            </Box>
                            <Typography variant="caption" fontWeight={700} sx={{ color: theme.textSecondary, mb: 0.5 }}>{t("versionCompare.viewing")}</Typography>
                            <Typography variant="h6" fontWeight={900} sx={{ color: theme.textMain, mb: 2 }}>
                              {Math.min(addedVisibleCount, datasetDelta.added.length)} <Box component="span" sx={{ color: theme.textMuted, fontSize: '0.75em' }}>/ {datasetDelta.added.length}</Box>
                            </Typography>
                            <Stack spacing={1.5} width="100%">
                              <Button
                                fullWidth
                                disabled={addedVisibleCount >= datasetDelta.added.length}
                                variant="contained"
                                size="small"
                                startIcon={<AddIcon />}
                                onClick={() => setAddedVisibleCount(prev => prev + 10)}
                                sx={{ borderRadius: "10px", textTransform: 'none', fontWeight: 700, boxShadow: 'none', bgcolor: theme.primary, '&:hover': { bgcolor: theme.primary, boxShadow: 'none' } }}
                              >
                                {t("versionCompare.loadMore")}
                              </Button>
                              <Button
                                fullWidth
                                disabled={addedVisibleCount <= 10}
                                variant="outlined"
                                size="small"
                                startIcon={<RemoveIcon />}
                                onClick={() => setAddedVisibleCount(prev => Math.max(10, prev - 10))}
                                sx={{ borderRadius: "10px", textTransform: 'none', fontWeight: 700, borderWidth: "2px", borderColor: alpha(theme.textMain, 0.1), color: theme.textSecondary }}
                              >
                                {t("versionCompare.showLess")}
                              </Button>
                            </Stack>
                          </Card>
                        )}
                      </Box>
                    </Card>
                  </Grid>
                )}

                {/* Removed Images */}
                {datasetDelta.removed.length > 0 && (
                  <Grid size={{ xs: 12 }}>
                    <Card sx={{
                      borderRadius: '24px',
                      bgcolor: alpha(theme.paper, 0.6),
                      backdropFilter: 'blur(20px)',
                      border: `1px solid ${alpha(theme.danger, 0.2)}`,
                      overflow: 'hidden'
                    }}>
                      <Box sx={{ p: 3, borderBottom: `1px solid ${alpha(theme.border, 0.1)}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Stack direction="row" spacing={1.5} alignItems="center">
                          <RemoveIcon sx={{ color: theme.danger }} />
                          <Typography variant="subtitle1" fontWeight={800} sx={{ color: theme.textMain }}>{t("versionCompare.removedFrom", { version: left.version_number })}</Typography>
                        </Stack>
                        <Chip label={t("versionCompare.imagesCount", { count: datasetDelta.removed.length })} size="small" sx={{ bgcolor: alpha(theme.danger, 0.1), color: theme.danger, fontWeight: 700 }} />
                      </Box>
                      <Box sx={{
                        p: 3,
                        display: "flex",
                        gap: 2.5,
                        overflowX: "auto",
                        pb: 2,
                        cursor: 'grab',
                        '&::-webkit-scrollbar': { height: '8px' },
                        '&::-webkit-scrollbar-thumb': { bgcolor: alpha(theme.danger, 0.3), borderRadius: '10px', '&:hover': { bgcolor: alpha(theme.danger, 0.5) } }
                      }}>
                        {datasetDelta.removed.slice(0, removedVisibleCount).map((img, i) => (
                          <Box
                            key={img.id}
                            sx={{ minWidth: 180, maxWidth: 180, flexShrink: 0 }}
                          >
                            <Box
                              onClick={() => openImage(datasetDelta.removed, i)}
                              sx={{
                                aspectRatio: '1',
                                borderRadius: '12px',
                                overflow: 'hidden',
                                position: 'relative',
                                cursor: 'pointer',
                                border: `1px solid ${alpha(theme.border, 0.1)}`,
                                filter: 'grayscale(0.6)',
                                transition: 'all 0.2s ease',
                                '&:hover': { transform: 'scale(1.05)', filter: 'none', boxShadow: `0 8px 16px ${alpha('#000', 0.2)}` },
                                '&:hover .zoom-overlay': { opacity: 1 }
                              }}
                            >
                              <img
                                src={`${API_BASE_URL}/artifacts/${img.id}/image`}
                                alt={img.name}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              />
                              <Box className="zoom-overlay" sx={{
                                position: 'absolute', inset: 0, bgcolor: alpha('#000', 0.4),
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                opacity: 0, transition: 'opacity 0.2s ease'
                              }}>
                                <ZoomIcon sx={{ color: '#fff' }} />
                              </Box>
                            </Box>
                            <Typography variant="caption" sx={{ p: 1, display: 'block', textAlign: 'center', fontWeight: 700, color: theme.textMain, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {img.name.split('/').pop()}
                            </Typography>
                          </Box>
                        ))}

                        {/* Pagination Controls inside Scroll Container */}
                        {datasetDelta.removed.length > 10 && (
                          <Card
                            elevation={0}
                            sx={{
                              minWidth: 220,
                              maxWidth: 220,
                              borderRadius: "16px",
                              border: `1px solid ${alpha(theme.border, 0.4)}`,
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
                                boxShadow: `0 8px 16px ${alpha('#000', 0.1)}`,
                                borderColor: alpha(theme.danger, 0.3)
                              }
                            }}
                          >
                            <Box sx={{ mb: 2, p: 1.5, borderRadius: "50%", bgcolor: alpha(theme.danger, 0.08), color: theme.danger }}>
                              <CategoryIcon fontSize="small" />
                            </Box>
                            <Typography variant="caption" fontWeight={700} sx={{ color: theme.textSecondary, mb: 0.5 }}>{t("versionCompare.viewing")}</Typography>
                            <Typography variant="h6" fontWeight={900} sx={{ color: theme.textMain, mb: 2 }}>
                              {Math.min(removedVisibleCount, datasetDelta.removed.length)} <Box component="span" sx={{ color: theme.textMuted, fontSize: '0.75em' }}>/ {datasetDelta.removed.length}</Box>
                            </Typography>
                            <Stack spacing={1.5} width="100%">
                              <Button
                                fullWidth
                                disabled={removedVisibleCount >= datasetDelta.removed.length}
                                variant="contained"
                                size="small"
                                startIcon={<AddIcon />}
                                onClick={() => setRemovedVisibleCount(prev => prev + 10)}
                                sx={{ borderRadius: "10px", textTransform: 'none', fontWeight: 700, boxShadow: 'none', bgcolor: theme.danger, '&:hover': { bgcolor: theme.danger, boxShadow: 'none' } }}
                              >
                                {t("versionCompare.loadMore")}
                              </Button>
                              <Button
                                fullWidth
                                disabled={removedVisibleCount <= 10}
                                variant="outlined"
                                size="small"
                                startIcon={<RemoveIcon />}
                                onClick={() => setRemovedVisibleCount(prev => Math.max(10, prev - 10))}
                                sx={{ borderRadius: "10px", textTransform: 'none', fontWeight: 700, borderWidth: "2px", borderColor: alpha(theme.textMain, 0.1), color: theme.textSecondary }}
                              >
                                {t("versionCompare.showLess")}
                              </Button>
                            </Stack>
                          </Card>
                        )}
                      </Box>
                    </Card>
                  </Grid>
                )}
              </Grid>
            </Box>
          )}

          {/* Gallery Modal */}
          <ImageModal
            open={modalOpen}
            onClose={() => setModalOpen(false)}
            images={selectedImages.map(a => `${API_BASE_URL}/artifacts/${a.id}/image`)}
            initialIndex={initialIndex}
          />
        </Container>
      </Box>
    </Box>
  );
}
