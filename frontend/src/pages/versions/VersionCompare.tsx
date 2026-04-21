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
import axios, { API_BASE_URL } from "../../api/axios";
import { useTheme } from "../../theme/ThemeContext";
import {
  TrendingUp as GainIcon,
  TrendingDown as LossIcon,
  ArrowBack as ArrowBackIcon,
  FlashOn as QuickIcon,
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
  tp?: number;
  tn?: number;
  fp?: number;
  fn?: number;
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

  const leftId = searchParams.get("left");
  const rightId = searchParams.get("right");

  const [left, setLeft] = useState<Version | null>(null);
  const [right, setRight] = useState<Version | null>(null);
  const [modelName, setModelName] = useState<string>("Model");
  const [loading, setLoading] = useState(true);
  const [datasetDelta, setDatasetDelta] = useState<DatasetDelta>({ added: [], removed: [] });
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [addedVisibleCount, setAddedVisibleCount] = useState(10);
  const [removedVisibleCount, setRemovedVisibleCount] = useState(10);

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

  useEffect(() => {
    const fetchVersions = async () => {
      try {
        const [l, r, m] = await Promise.all([
          axios.get(
            `/factories/${factoryId}/algorithms/${algorithmId}/models/${modelId}/versions/${leftId}`
          ),
          axios.get(
            `/factories/${factoryId}/algorithms/${algorithmId}/models/${modelId}/versions/${rightId}`
          ),
          axios.get(
            `/factories/${factoryId}/algorithms/${algorithmId}/models/${modelId}`
          ),
        ]);

        setLeft(l.data);
        setRight(r.data);
        setModelName(m.data.name);
      } catch (err) {
        console.error("Failed to compare versions", err);
      } finally {
        setLoading(false);
      }
    };

    const fetchDatasetComparison = async () => {
      setGalleryLoading(true);
      try {
        const res = await axios.get(
          `/factories/${factoryId}/algorithms/${algorithmId}/models/${modelId}/compare-datasets/${leftId}/${rightId}`
        );
        setDatasetDelta(res.data);
      } catch (err) {
        console.error("Failed to fetch dataset comparison", err);
      } finally {
        setGalleryLoading(false);
      }
    };

    if (leftId && rightId) {
      fetchVersions();
      fetchDatasetComparison();
    }
  }, [factoryId, algorithmId, modelId, leftId, rightId]);

  /* =======================
     Loading
  ======================= */

  if (loading || !left || !right) {
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
    if (key === 'tp') return v.tp;
    if (key === 'tn') return v.tn;
    if (key === 'fp') return v.fp;
    if (key === 'fn') return v.fn;
    return v.metrics?.[key];
  };

  const isPercentage = (key: string) => {
    return ['accuracy', 'precision', 'recall', 'f1_score'].includes(key);
  };

  const allMetricKeys = Array.from(
    new Set([
      'accuracy', 'precision', 'recall', 'f1_score',
      'tp', 'tn', 'fp', 'fn',
      ...Object.keys(left.metrics || {}),
      ...Object.keys(right.metrics || {}),
    ])
  );

  const allParamKeys = Array.from(
    new Set([
      ...Object.keys(left.parameters || {}),
      ...Object.keys(right.parameters || {}),
    ])
  );

  const DiffBadge = ({ l, r, isPct }: { l: any, r: any, isPct: boolean }) => {
    if (typeof l !== 'number' || typeof r !== 'number') return null;
    const diff = r - l;
    if (Math.abs(diff) < 0.0001) return <Chip size="small" label="SAME" sx={{ bgcolor: alpha(theme.textMuted, 0.05), color: theme.textMuted, fontWeight: 700 }} />;

    const isPositive = diff > 0;
    // For FP and FN, positive diff is usually bad, but sticking to standard math color for now to avoid confusion
    const color = isPositive ? theme.success : theme.danger;
    const Icon = isPositive ? GainIcon : LossIcon;

    return (
      <Chip
        size="small"
        icon={<Icon sx={{ fontSize: '14px !important', color: 'inherit !important' }} />}
        label={`${isPositive ? '+' : ''}${isPct ? diff.toFixed(2) + '%' : Number(diff.toFixed(2))}`}
        sx={{
          bgcolor: alpha(color, 0.1),
          color: color,
          fontWeight: 800,
          border: `1px solid ${alpha(color, 0.2)}`
        }}
      />
    );
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
                onClick={() => navigate(`/factories/${factoryId}/algorithms/${algorithmId}/models/${modelId}/versions`)}
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
                  Iterative <Box component="span" sx={{ color: theme.primary, WebkitTextFillColor: "initial" }}>Analysis</Box>
                </Typography>
                <Typography variant="body2" sx={{ color: theme.textMuted, fontWeight: 700, mt: 0.2 }}>
                  Iterating from <Box component="span" sx={{ color: theme.textMain }}>v-{left.version_number}</Box> to <Box component="span" sx={{ color: theme.primary }}>v-{right.version_number}</Box>
                </Typography>
              </Box>
            </Stack>

            <Stack direction="row" spacing={2} sx={{ display: { xs: 'none', md: 'flex' } }}>
              <Box sx={{ textAlign: 'right' }}>
                <Typography variant="overline" fontWeight={900} sx={{ color: theme.textMuted, letterSpacing: 2 }}>MODEL IDENTITY</Typography>
                <Typography variant="body2" fontWeight={700} sx={{ color: theme.textMain }}>{modelName}</Typography>
              </Box>
            </Stack>
          </Box>
        </Container>
      </Box>

      {/* Main Content Area */}
      <Box sx={{ py: 6, zIndex: 1 }}>
        <Container maxWidth="xl" sx={{ width: '100%', maxWidth: '1400px !important' }}>

          {/* Identity Scorecards */}
          <Grid container spacing={4} sx={{ mb: 8 }}>
            {[left, right].map((v, i) => (
              <Grid size={{ xs: 12, md: 6 }} key={v.id}>
                <Box sx={{ position: 'relative' }}>
                  <Card sx={{
                    borderRadius: "32px",
                    background: theme.mode === 'dark'
                      ? `linear-gradient(145deg, ${alpha(theme.paper, 0.9)} 0%, ${alpha(theme.paper, 0.8)} 100%)`
                      : `linear-gradient(145deg, ${alpha(theme.paper, 0.7)} 0%, ${alpha(theme.paper, 0.4)} 100%)`,
                    backdropFilter: "blur(20px)",
                    border: theme.mode === 'dark'
                      ? `1px solid ${alpha(theme.border, 0.3)}`
                      : `1px solid ${i === 0 ? alpha(theme.primary, 0.3) : alpha(theme.secondary || theme.primary, 0.3)}`,
                    boxShadow: i === 0
                      ? `0 20px 60px ${alpha(theme.primary, 0.1)}`
                      : `0 20px 60px ${alpha(theme.secondary || theme.primary, 0.1)}`,
                    overflow: 'hidden',
                    transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
                    "&:hover": {
                      boxShadow: i === 0
                        ? `0 30px 80px ${alpha(theme.primary, 0.2)}`
                        : `0 30px 80px ${alpha(theme.secondary || theme.primary, 0.2)}`,
                    }
                  }}>
                    <Box sx={{
                      position: 'absolute', top: 0, left: 0, width: '100%', height: '6px',
                      background: i === 0
                        ? `linear-gradient(90deg, ${theme.primary}, ${alpha(theme.primary, 0.1)})`
                        : `linear-gradient(90deg, ${theme.secondary || theme.primary}, ${alpha(theme.secondary || theme.primary, 0.1)})`
                    }} />
                    <CardContent sx={{ p: 4 }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                        <Box>
                          <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1.5 }}>
                            <Box sx={{
                              p: 1.5, borderRadius: '16px',
                              bgcolor: i === 0 ? alpha(theme.primary, 0.1) : alpha(theme.secondary || theme.primary, 0.1),
                              color: i === 0 ? theme.primary : (theme.secondary || theme.primary),
                              boxShadow: `0 8px 16px ${alpha(theme.background, 0.2)}`
                            }}>
                              <QuickIcon sx={{ fontSize: 32 }} />
                            </Box>
                            <Box>
                              <Typography variant="overline" fontWeight={900} sx={{ color: theme.textMuted, letterSpacing: 3, display: 'block', fontSize: '11px' }}>
                                {i === 0 ? "BASELINE" : "CANDIDATE"}
                              </Typography>
                              <Typography variant="h4" fontWeight={900} sx={{ color: theme.textMain, letterSpacing: "-0.03em" }}>
                                v{v.version_number}
                              </Typography>
                            </Box>
                          </Stack>
                        </Box>
                        {v.is_active && (
                          <Chip
                            label="PRODUCTION"
                            size="small"
                            sx={{
                              bgcolor: theme.success, color: "#fff", fontWeight: 900,
                              px: 1.5, height: 28, fontSize: '11px', letterSpacing: 1.5,
                              boxShadow: `0 4px 12px ${alpha(theme.success, 0.4)}`
                            }}
                          />
                        )}
                      </Stack>

                      <Grid container spacing={2} sx={{ mt: 4 }}>
                        <Grid size={{ xs: 6 }}>
                          <Box sx={{
                            p: 2.5,
                            borderRadius: '24px',
                            bgcolor: alpha(theme.textMain, 0.03),
                            border: `1px solid ${alpha(theme.border, 0.5)}`,
                            transition: "all 0.2s ease",
                            "&:hover": { bgcolor: alpha(theme.textMain, 0.05), borderColor: alpha(theme.border, 0.8) }
                          }}>
                            <Typography variant="caption" fontWeight={800} sx={{ color: theme.textMuted, display: 'block', mb: 0.5, letterSpacing: 1 }}>ACCURACY</Typography>
                            <Typography variant="h5" fontWeight={900} sx={{ color: theme.textMain, fontFamily: "'JetBrains Mono', monospace" }}>
                              {v.accuracy ? `${v.accuracy}%` : "—"}
                            </Typography>
                          </Box>
                        </Grid>
                        <Grid size={{ xs: 6 }}>
                          <Box sx={{
                            p: 2.5,
                            borderRadius: '24px',
                            bgcolor: alpha(theme.textMain, 0.03),
                            border: `1px solid ${alpha(theme.border, 0.5)}`,
                            transition: "all 0.2s ease",
                            "&:hover": { bgcolor: alpha(theme.textMain, 0.05), borderColor: alpha(theme.border, 0.8) }
                          }}>
                            <Typography variant="caption" fontWeight={800} sx={{ color: theme.textMuted, display: 'block', mb: 0.5, letterSpacing: 1 }}>F1 SCORE</Typography>
                            <Typography variant="h5" fontWeight={900} sx={{ color: theme.textMain, fontFamily: "'JetBrains Mono', monospace" }}>
                              {v.f1_score ? `${v.f1_score}%` : "—"}
                            </Typography>
                          </Box>
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                </Box>
              </Grid>
            ))}
          </Grid>

          {/* Visual Comparison Graphs */}
          <Box sx={{ mb: 10 }}>
            <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 4 }}>
              <Box sx={{ p: 1.5, borderRadius: "16px", bgcolor: alpha(theme.info, 0.1), color: theme.info, display: 'flex' }}>
                <BarChartIcon />
              </Box>
              <Box>
                <Typography variant="h5" fontWeight={900} sx={{ color: theme.textMain, letterSpacing: "-0.02em" }}>
                  Visual Analysis
                </Typography>
                <Typography variant="body2" sx={{ color: theme.textMuted, fontWeight: 600 }}>
                  Graphical representation of performance, resources, and configuration shifts.
                </Typography>
              </Box>
            </Stack>

            <Grid container spacing={4}>
              {/* Performance Parallel Coordinates */}
              <Grid size={{ xs: 12, lg: 6 }}>
                <Card sx={{
                  height: '100%',
                  borderRadius: "24px",
                  background: theme.mode === 'dark'
                    ? `linear-gradient(135deg, ${alpha(theme.paper, 0.9)} 0%, ${alpha(theme.paper, 0.8)} 100%)`
                    : `linear-gradient(135deg, ${alpha(theme.paper, 0.6)} 0%, ${alpha(theme.paper, 0.4)} 100%)`,
                  backdropFilter: "blur(20px)",
                  border: theme.mode === 'dark'
                    ? `1px solid ${alpha(theme.border, 0.3)}`
                    : `1px solid ${alpha(theme.textMain, 0.05)}`,
                  boxShadow: theme.mode === 'dark'
                    ? `0 20px 40px -10px rgba(0,0,0,0.5)`
                    : `0 20px 40px -10px ${alpha(theme.textMain, 0.05)}`,
                  transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                  "&:hover": {
                    boxShadow: theme.mode === 'dark'
                      ? `0 30px 60px -12px rgba(0,0,0,0.6)`
                      : `0 30px 60px -12px ${alpha(theme.textMain, 0.1)}`
                  }
                }}>
                  <CardContent sx={{ p: 4 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 4 }}>
                      <Box>
                        <Typography variant="h6" fontWeight={800} sx={{ color: theme.textMain }}>
                          Performance Profile
                        </Typography>
                        <Typography variant="caption" fontWeight={700} sx={{ color: theme.textMuted }}>
                          PARALLEL COORDINATES
                        </Typography>
                      </Box>
                    </Stack>

                    <Box sx={{ height: 350, width: "100%", mt: 2 }}>
                      <ResponsiveContainer>
                        <LineChart
                          data={[
                            { metric: 'Accuracy', v1: left.accuracy || 0, v2: right.accuracy || 0 },
                            { metric: 'Precision', v1: left.precision || 0, v2: right.precision || 0 },
                            { metric: 'Recall', v1: left.recall || 0, v2: right.recall || 0 },
                            { metric: 'F1 Score', v1: left.f1_score || 0, v2: right.f1_score || 0 },
                          ]}
                          margin={{ top: 10, right: 50, left: 0, bottom: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" vertical={false} horizontal={false} stroke={alpha(theme.textMain, 0.1)} />
                          <XAxis
                            dataKey="metric"
                            tick={{ fill: theme.textSecondary, fontSize: 12, fontWeight: 700 }}
                            axisLine={false}
                            tickLine={false}
                            padding={{ left: 20 }}
                            dy={10}
                          />
                          <YAxis
                            domain={[10, 100]}
                            tick={{ fill: theme.textMuted, fontSize: 11, fontWeight: 600 }}
                            axisLine={false}
                            tickLine={false}
                            width={30}
                          />
                          <Tooltip
                            cursor={{ stroke: alpha(theme.textMain, 0.2), strokeWidth: 2 }}
                            contentStyle={{
                              borderRadius: '16px',
                              border: `1px solid ${alpha(theme.border, 0.5)}`,
                              boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
                              backgroundColor: alpha(theme.paper, 0.95),
                              padding: "12px 16px"
                            }}
                            itemStyle={{ fontSize: '13px', fontWeight: 700, padding: "2px 0" }}
                          />
                          <Legend
                            wrapperStyle={{ fontSize: '12px', fontWeight: 700, paddingTop: '20px' }}
                            iconType="circle"
                          />
                          <Line
                            type="monotone"
                            dataKey="v1"
                            name={`v-${left.version_number}`}
                            stroke={theme.primary}
                            strokeWidth={3}
                            dot={{ r: 4, strokeWidth: 2, fill: theme.paper }}
                            activeDot={{ r: 7, strokeWidth: 0 }}
                          />
                          <Line
                            type="monotone"
                            dataKey="v2"
                            name={`v-${right.version_number}`}
                            stroke={theme.secondary || theme.info}
                            strokeWidth={3}
                            dot={{ r: 4, strokeWidth: 2, fill: theme.paper }}
                            activeDot={{ r: 7, strokeWidth: 0 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              {/* Resource Consumption Horizontal Bar */}
              <Grid size={{ xs: 12, lg: 6 }}>
                <Card sx={{
                  height: '100%',
                  borderRadius: "24px",
                  background: theme.mode === 'dark'
                    ? `linear-gradient(135deg, ${alpha(theme.paper, 0.9)} 0%, ${alpha(theme.paper, 0.8)} 100%)`
                    : `linear-gradient(135deg, ${alpha(theme.paper, 0.6)} 0%, ${alpha(theme.paper, 0.4)} 100%)`,
                  backdropFilter: "blur(20px)",
                  border: theme.mode === 'dark'
                    ? `1px solid ${alpha(theme.border, 0.3)}`
                    : `1px solid ${alpha(theme.textMain, 0.05)}`,
                  boxShadow: theme.mode === 'dark'
                    ? `0 20px 40px -10px rgba(0,0,0,0.5)`
                    : `0 20px 40px -10px ${alpha(theme.textMain, 0.05)}`,
                  transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                  "&:hover": {
                    boxShadow: theme.mode === 'dark'
                      ? `0 30px 60px -12px rgba(0,0,0,0.6)`
                      : `0 30px 60px -12px ${alpha(theme.textMain, 0.1)}`
                  }
                }}>
                  <CardContent sx={{ p: 4 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 4 }}>
                      <Box>
                        <Typography variant="h6" fontWeight={800} sx={{ color: theme.textMain }}>
                          Resource Usage
                        </Typography>
                        <Typography variant="caption" fontWeight={700} sx={{ color: theme.textMuted }}>
                          LATENCY & UTILIZATION
                        </Typography>
                      </Box>
                    </Stack>

                    <Box sx={{ height: 350, width: "100%", mt: 2 }}>
                      <ResponsiveContainer>
                        <BarChart
                          layout="vertical"
                          data={[
                            { name: 'Inference (ms)', v1: left.inference_time || 0, v2: right.inference_time || 0 },
                            { name: 'CPU Usage (%)', v1: left.cpu_utilization || 0, v2: right.cpu_utilization || 0 },
                            { name: 'GPU Usage (%)', v1: left.gpu_utilization || 0, v2: right.gpu_utilization || 0 },
                            { name: 'Cameras', v1: left.cameras_supported || 0, v2: right.cameras_supported || 0 },
                          ]}
                          margin={{ top: 0, right: 10, left: 0, bottom: 0 }}
                          barGap={6}
                        >
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} vertical={false} stroke={alpha(theme.textMain, 0.1)} />
                          <XAxis
                            type="number"
                            tick={{ fill: theme.textSecondary, fontSize: 11, fontWeight: 700 }}
                            axisLine={false}
                            tickLine={false}
                            padding={{ left: 20 }}

                          />
                          <YAxis
                            dataKey="name"
                            type="category"
                            tick={{ fill: theme.textSecondary, fontSize: 11, fontWeight: 700 }}
                            width={100}
                            axisLine={false}
                            tickLine={false}
                          />
                          <Tooltip
                            cursor={{ fill: alpha(theme.textMain, 0.05) }}
                            contentStyle={{
                              borderRadius: '16px',
                              border: `1px solid ${alpha(theme.border, 0.5)}`,
                              boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
                              backgroundColor: alpha(theme.paper, 0.95),
                              padding: "12px 16px"
                            }}
                            itemStyle={{ fontSize: '13px', fontWeight: 700, padding: "2px 0" }}
                          />
                          <Legend
                            wrapperStyle={{ fontSize: '12px', fontWeight: 700, paddingTop: '20px' }}
                            iconType="circle"
                          />
                          <Bar
                            name={`v-${left.version_number}`}
                            dataKey="v1"
                            fill={theme.primary}
                            radius={[0, 6, 6, 0]}
                            barSize={12}
                          />
                          <Bar
                            name={`v-${right.version_number}`}
                            dataKey="v2"
                            fill={theme.secondary || theme.info}
                            radius={[0, 6, 6, 0]}
                            barSize={12}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Box>

          {/* Resource Consumption Convergence */}
          <Box sx={{ mb: 10 }}>
            <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 4 }}>
              <Box sx={{ p: 1.5, borderRadius: "16px", bgcolor: alpha(theme.warning, 0.1), color: theme.warning, display: 'flex' }}>
                <QuickIcon />
              </Box>
              <Box>
                <Typography variant="h5" fontWeight={900} sx={{ color: theme.textMain, letterSpacing: "-0.02em" }}>
                  Resource Demand Analysis
                </Typography>
                <Typography variant="body2" sx={{ color: theme.textMuted, fontWeight: 600 }}>
                  Side-by-side comparison of hardware utilization and latency profiles.
                </Typography>
              </Box>
            </Stack>

            <Card sx={{
              borderRadius: "32px", overflow: 'hidden',
              border: `1px solid ${alpha(theme.border, 0.6)}`,
              background: `linear-gradient(145deg, ${alpha(theme.paper, 0.6)} 0%, ${alpha(theme.paper, 0.4)} 100%)`,
              backdropFilter: "blur(20px)",
              boxShadow: "0 10px 40px -10px rgba(0,0,0,0.05)"
            }}>
              <Box sx={{
                display: 'grid',
                gridTemplateColumns: '1.5fr 1fr 1fr 1fr',
                bgcolor: alpha(theme.textMain, 0.03),
                p: "20px 32px",
                borderBottom: `1px solid ${alpha(theme.border, 0.4)}`,
                alignItems: 'center'
              }}>
                <Typography variant="caption" fontWeight={900} sx={{ color: theme.textMuted, letterSpacing: 2 }}>RESOURCE METRIC</Typography>
                <Typography variant="caption" fontWeight={900} sx={{ color: theme.textMain, textAlign: 'center', bgcolor: alpha(theme.textMain, 0.05), py: 0.75, borderRadius: '8px', border: `1px solid ${alpha(theme.border, 0.2)}` }}>VERSION {left.version_number}</Typography>
                <Typography variant="caption" fontWeight={900} sx={{ color: theme.primary, textAlign: 'center', bgcolor: alpha(theme.primary, 0.08), py: 0.75, borderRadius: '8px', border: `1px solid ${alpha(theme.primary, 0.2)}` }}>VERSION {right.version_number}</Typography>
                <Typography variant="caption" fontWeight={900} sx={{ color: theme.textMuted, textAlign: 'center', letterSpacing: 2 }}>CHANGE</Typography>
              </Box>
              {[
                { key: 'inference_time', label: 'Inference Time', unit: 'ms' },
                { key: 'cpu_utilization', label: 'CPU Utilization', unit: '%' },
                { key: 'gpu_utilization', label: 'GPU Utilization', unit: '%' },
                { key: 'cpu_memory_usage', label: 'CPU Memory Usage', unit: 'MB' },
                { key: 'gpu_memory_usage', label: 'GPU Memory Usage', unit: 'MB' },
                { key: 'cameras_supported', label: 'Cameras Supported', unit: '' },
              ].map((m, idx) => {
                const lVal = (left as any)[m.key];
                const rVal = (right as any)[m.key];
                const isPct = m.unit === '%';

                return (
                  <Box key={m.key} sx={{
                    display: 'grid',
                    gridTemplateColumns: '1.5fr 1fr 1fr 1fr',
                    p: "18px 32px",
                    alignItems: 'center',
                    bgcolor: idx % 2 === 0 ? 'transparent' : alpha(theme.textMain, 0.015),
                    borderBottom: idx === 5 ? 'none' : `1px solid ${alpha(theme.border, 0.2)}`,
                    transition: "all 0.2s ease",
                    "&:hover": { bgcolor: alpha(theme.warning, 0.04) }
                  }}>
                    <Stack direction="row" spacing={2.5} alignItems="center">
                      <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: theme.warning, boxShadow: `0 0 10px ${theme.warning}` }} />
                      <Typography variant="body2" fontWeight={800} sx={{ color: theme.textMain, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        {m.label}
                      </Typography>
                    </Stack>
                    <Typography variant="body2" fontWeight={700} sx={{ color: theme.textMain, textAlign: 'center', fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>
                      {lVal !== undefined && lVal !== null ? `${lVal}${m.unit}` : '—'}
                    </Typography>
                    <Typography variant="body2" fontWeight={700} sx={{ color: theme.textMain, textAlign: 'center', fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>
                      {rVal !== undefined && rVal !== null ? `${rVal}${m.unit}` : '—'}
                    </Typography>
                    <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                      <DiffBadge l={lVal} r={rVal} isPct={isPct} />
                    </Box>
                  </Box>
                );
              })}
            </Card>
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
              borderRadius: "32px", overflow: 'hidden',
              border: `1px solid ${alpha(theme.border, 0.6)}`,
              background: `linear-gradient(145deg, ${alpha(theme.paper, 0.6)} 0%, ${alpha(theme.paper, 0.4)} 100%)`,
              backdropFilter: "blur(20px)",
              boxShadow: "0 10px 40px -10px rgba(0,0,0,0.05)"
            }}>
              <Box sx={{
                display: 'grid',
                gridTemplateColumns: '1.5fr 1fr 1fr 1fr',
                bgcolor: alpha(theme.textMain, 0.03),
                p: "20px 32px",
                borderBottom: `1px solid ${alpha(theme.border, 0.4)}`,
                alignItems: 'center'
              }}>
                <Typography variant="caption" fontWeight={900} sx={{ color: theme.textMuted, letterSpacing: 2 }}>METRIC DEFINITION</Typography>
                <Typography variant="caption" fontWeight={900} sx={{ color: theme.textMain, textAlign: 'center', bgcolor: alpha(theme.textMain, 0.05), py: 0.75, borderRadius: '8px', border: `1px solid ${alpha(theme.border, 0.2)}` }}>VERSION {left.version_number}</Typography>
                <Typography variant="caption" fontWeight={900} sx={{ color: theme.primary, textAlign: 'center', bgcolor: alpha(theme.primary, 0.08), py: 0.75, borderRadius: '8px', border: `1px solid ${alpha(theme.primary, 0.2)}` }}>VERSION {right.version_number}</Typography>
                <Typography variant="caption" fontWeight={900} sx={{ color: theme.textMuted, textAlign: 'center', letterSpacing: 2 }}>DELTA</Typography>
              </Box>
              {allMetricKeys.map((key, idx) => {
                const lVal = getMetricValue(left, key);
                const rVal = getMetricValue(right, key);
                const isPct = isPercentage(key);

                return (
                  <Box key={key} sx={{
                    display: 'grid',
                    gridTemplateColumns: '1.5fr 1fr 1fr 1fr',
                    p: "18px 32px",
                    alignItems: 'center',
                    bgcolor: idx % 2 === 0 ? 'transparent' : alpha(theme.textMain, 0.015),
                    borderBottom: idx === allMetricKeys.length - 1 ? 'none' : `1px solid ${alpha(theme.border, 0.2)}`,
                    transition: "all 0.2s ease",
                    "&:hover": { bgcolor: alpha(theme.primary, 0.04) }
                  }}>
                    <Stack direction="row" spacing={2.5} alignItems="center">
                      <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: idx % 3 === 0 ? theme.primary : idx % 3 === 1 ? theme.success : theme.warning, boxShadow: `0 0 10px ${idx % 3 === 0 ? theme.primary : idx % 3 === 1 ? theme.success : theme.warning}` }} />
                      <Typography variant="body2" fontWeight={800} sx={{ color: theme.textMain, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        {key.replace(/_/g, ' ')}
                      </Typography>
                    </Stack>
                    <Typography variant="body2" fontWeight={700} sx={{ color: theme.textMain, textAlign: 'center', fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>
                      {lVal !== undefined && lVal !== null ? (isPct ? `${lVal}%` : lVal) : '—'}
                    </Typography>
                    <Typography variant="body2" fontWeight={700} sx={{ color: theme.textMain, textAlign: 'center', fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>
                      {rVal !== undefined && rVal !== null ? (isPct ? `${rVal}%` : rVal) : '—'}
                    </Typography>
                    <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                      <DiffBadge l={lVal} r={rVal} isPct={isPct} />
                    </Box>
                  </Box>
                );
              })}
            </Card>
          </Box>

          {/* Parameters Comparison */}
          {allParamKeys.length > 0 && (
            <Box sx={{ mb: 6 }}>
              <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 4 }}>
                <Box sx={{ p: 1.5, borderRadius: "16px", bgcolor: alpha(theme.primary, 0.1), color: theme.primary, display: 'flex' }}>
                  <ParamsIcon />
                </Box>
                <Box>
                  <Typography variant="h5" fontWeight={900} sx={{ color: theme.textMain, letterSpacing: "-0.02em" }}>
                    Configuration & Schema Shift
                  </Typography>
                  <Typography variant="body2" sx={{ color: theme.textMuted, fontWeight: 600 }}>
                    Identifying hyperparameter adjustments and operational changes.
                  </Typography>
                </Box>
              </Stack>

              <Card sx={{
                borderRadius: "32px", overflow: 'hidden',
                border: `1px solid ${alpha(theme.border, 0.6)}`,
                background: `linear-gradient(145deg, ${alpha(theme.paper, 0.6)} 0%, ${alpha(theme.paper, 0.4)} 100%)`,
                backdropFilter: "blur(20px)",
                boxShadow: "0 10px 40px -10px rgba(0,0,0,0.05)"
              }}>
                <Box sx={{
                  display: 'grid',
                  gridTemplateColumns: '1.5fr 1fr 1fr 1fr',
                  bgcolor: alpha(theme.textMain, 0.03),
                  p: "20px 32px",
                  borderBottom: `1px solid ${alpha(theme.border, 0.4)}`,
                  alignItems: 'center'
                }}>
                  <Typography variant="caption" fontWeight={900} sx={{ color: theme.textMuted, letterSpacing: 2 }}>PARAMETER</Typography>
                  <Typography variant="caption" fontWeight={900} sx={{ color: theme.textMain, textAlign: 'center', bgcolor: alpha(theme.textMain, 0.05), py: 0.75, borderRadius: '8px', border: `1px solid ${alpha(theme.border, 0.2)}` }}>VERSION {left.version_number}</Typography>
                  <Typography variant="caption" fontWeight={900} sx={{ color: theme.primary, textAlign: 'center', bgcolor: alpha(theme.primary, 0.08), py: 0.75, borderRadius: '8px', border: `1px solid ${alpha(theme.primary, 0.2)}` }}>VERSION {right.version_number}</Typography>
                  <Typography variant="caption" fontWeight={900} sx={{ color: theme.textMuted, textAlign: 'center', letterSpacing: 2 }}>DELTA</Typography>
                </Box>
                {allParamKeys.map((key, idx) => {
                  const lVal = left.parameters?.[key];
                  const rVal = right.parameters?.[key];
                  const hasChanged = JSON.stringify(lVal) !== JSON.stringify(rVal);

                  return (
                    <Box key={key} sx={{
                      display: 'grid',
                      gridTemplateColumns: '1.5fr 1fr 1fr 1fr',
                      p: "18px 32px",
                      alignItems: 'center',
                      bgcolor: idx % 2 === 0 ? 'transparent' : alpha(theme.textMain, 0.015),
                      borderBottom: idx === allParamKeys.length - 1 ? 'none' : `1px solid ${alpha(theme.border, 0.2)}`,
                      transition: "all 0.2s ease",
                      "&:hover": { bgcolor: alpha(theme.primary, 0.04) }
                    }}>
                      <Typography variant="body2" fontWeight={800} sx={{ color: theme.textMain, textTransform: 'capitalize', letterSpacing: 0.5 }}>
                        {key.replace(/_/g, ' ')}
                      </Typography>
                      <Typography variant="body2" fontWeight={700} sx={{ color: theme.textMuted, textAlign: 'center', fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>
                        {lVal !== undefined ? String(lVal) : '—'}
                      </Typography>
                      <Typography variant="body2" fontWeight={700} sx={{ color: theme.textMain, textAlign: 'center', fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>
                        {rVal !== undefined ? String(rVal) : '—'}
                      </Typography>
                      <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                        {hasChanged ? (() => {
                          const lStr = String(lVal || "");
                          const rStr = String(rVal || "");
                          const lNum = parseFloat(lStr);
                          const rNum = parseFloat(rStr);
                          const isNumeric = !isNaN(lNum) && !isNaN(rNum) && lStr.trim() !== "" && rStr.trim() !== "";

                          if (isNumeric) {
                            return <DiffBadge l={lNum} r={rNum} isPct={false} />;
                          }

                          return (
                            <Box sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 1,
                              bgcolor: alpha(theme.warning, 0.1),
                              px: 1.5,
                              py: 0.5,
                              borderRadius: '8px',
                              border: `1px solid ${alpha(theme.warning, 0.2)}`
                            }}>
                              <Typography variant="caption" fontWeight={700} sx={{ color: theme.textMuted, textDecoration: 'line-through' }}>
                                {lVal !== undefined ? String(lVal) : '—'}
                              </Typography>
                              <GainIcon sx={{ fontSize: '12px', color: theme.warning }} />
                              <Typography variant="caption" fontWeight={900} sx={{ color: theme.warning }}>
                                {rVal !== undefined ? String(rVal) : '—'}
                              </Typography>
                            </Box>
                          );
                        })() : (
                          <Typography variant="caption" fontWeight={800} sx={{ color: alpha(theme.textMuted, 10), letterSpacing: 1 }}>SAME</Typography>
                        )}
                      </Box>
                    </Box>
                  );
                })}
              </Card>
            </Box>
          )}

          {/* Dataset Evolution Gallery */}
          {galleryLoading ? (
            <Box sx={{ mt: 8, mb: 10, textAlign: 'center' }}>
              <CircularProgress size={32} />
              <Typography variant="body2" sx={{ color: theme.textMuted, mt: 2 }}>Analyzing dataset evolution...</Typography>
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
                  <Typography variant="h5" fontWeight={900} sx={{ color: theme.textMain }}>Dataset Evolution Gallery</Typography>
                  <Typography variant="body2" sx={{ color: theme.textMuted }}>Visualizing artifact changes between selected versions</Typography>
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
                          <Typography variant="subtitle1" fontWeight={800} sx={{ color: theme.textMain }}>Added to v{right.version_number}</Typography>
                        </Stack>
                        <Chip label={`${datasetDelta.added.length} images`} size="small" sx={{ bgcolor: alpha(theme.success, 0.1), color: theme.success, fontWeight: 700 }} />
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
                            <Typography variant="caption" fontWeight={700} sx={{ color: theme.textSecondary, mb: 0.5 }}>Viewing</Typography>
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
                                Load More
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
                                Show Less
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
                          <Typography variant="subtitle1" fontWeight={800} sx={{ color: theme.textMain }}>Removed from v{left.version_number}</Typography>
                        </Stack>
                        <Chip label={`${datasetDelta.removed.length} images`} size="small" sx={{ bgcolor: alpha(theme.danger, 0.1), color: theme.danger, fontWeight: 700 }} />
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
                            <Typography variant="caption" fontWeight={700} sx={{ color: theme.textSecondary, mb: 0.5 }}>Viewing</Typography>
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
                                Load More
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
                                Show Less
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
