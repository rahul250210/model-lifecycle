"use client";

import { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  Grid,
  IconButton,
  alpha,
  Container,
  Stack,
  Paper,
  Breadcrumbs,
  Link,
  Chip,
} from "@mui/material";

import NavigateNextIcon from "@mui/icons-material/NavigateNext";
import HubIcon from "@mui/icons-material/Hub";
import LayersIcon from "@mui/icons-material/Layers";
import AddIcon from "@mui/icons-material/Add";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import SpeedIcon from "@mui/icons-material/Speed";
import DownloadIcon from "@mui/icons-material/Download";
import ShowChartIcon from "@mui/icons-material/ShowChart";
import MemoryIcon from "@mui/icons-material/Memory";
import TuneIcon from "@mui/icons-material/Tune";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";

import { useNavigate, useParams } from "react-router-dom";
import axios from "../../api/axios";
import { useTheme } from "../../theme/ThemeContext";
import { useTranslation } from "react-i18next";

// --- CUSTOM TOOLTIP ---
const CustomTooltip = ({ active, payload, label, theme }: any) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <Box sx={{
      bgcolor: theme.mode === 'dark' ? alpha(theme.paper, 0.95) : alpha('#fff', 0.97),
      border: `1px solid ${alpha(theme.border, 0.4)}`,
      borderRadius: '16px',
      boxShadow: '0 16px 40px rgba(0,0,0,0.18)',
      backdropFilter: 'blur(20px)',
      p: 2,
      minWidth: 160,
    }}>
      <Typography variant="caption" fontWeight={800} sx={{ color: theme.textMuted, letterSpacing: 1, textTransform: 'uppercase', fontSize: '0.65rem', display: 'block', mb: 1.5 }}>
        {label?.replace('v', '') || ''}
      </Typography>
      <Stack spacing={1}>
        {payload.map((entry: any) => (
          <Stack key={entry.dataKey} direction="row" alignItems="center" justifyContent="space-between" spacing={3}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: entry.color, flexShrink: 0, boxShadow: `0 0 6px ${entry.color}` }} />
              <Typography variant="caption" sx={{ color: theme.textSecondary, fontWeight: 600, fontSize: '0.78rem' }}>{entry.name}</Typography>
            </Stack>
            <Typography variant="caption" sx={{ color: theme.textMain, fontWeight: 800, fontSize: '0.85rem', fontVariantNumeric: 'tabular-nums' }}>
              {typeof entry.value === 'number' ? entry.value.toFixed(1) : entry.value ?? '--'}
            </Typography>
          </Stack>
        ))}
      </Stack>
    </Box>
  );
};

// --- PREMIUM CHART COMPONENT ---
const PremiumChart = ({ title, subtitle, icon, data, metrics, accentColor }: any) => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const hasData = data && data.length > 0 && metrics.some((m: any) => data.some((d: any) => d[m.key] !== undefined && d[m.key] !== null && d[m.key] !== ''));

  return (
    <Paper elevation={0} sx={{
      p: 0,
      borderRadius: '28px',
      border: `1px solid ${alpha(theme.border, 0.35)}`,
      bgcolor: theme.mode === 'dark' ? alpha(theme.paper, 0.7) : alpha(theme.paper, 0.6),
      backdropFilter: 'blur(24px)',
      overflow: 'hidden',
      height: '100%',
      boxShadow: theme.mode === 'dark'
        ? `0 8px 32px -8px rgba(0,0,0,0.6), inset 0 1px 0 ${alpha('#fff', 0.04)}`
        : `0 8px 32px -8px ${alpha(accentColor || theme.primary, 0.08)}, inset 0 1px 0 rgba(255,255,255,0.8)`,
      transition: 'box-shadow 0.35s ease, border-color 0.35s ease',
      '&:hover': {
        borderColor: alpha(accentColor || theme.primary, 0.3),
        boxShadow: theme.mode === 'dark'
          ? `0 16px 48px -12px rgba(0,0,0,0.8), inset 0 1px 0 ${alpha('#fff', 0.06)}`
          : `0 16px 48px -12px ${alpha(accentColor || theme.primary, 0.14)}`,
      }
    }}>
      {/* Header */}
      <Box sx={{
        px: 3.5, pt: 3, pb: 2.5,
        borderBottom: `1px solid ${alpha(theme.border, 0.2)}`,
        background: theme.mode === 'dark'
          ? `linear-gradient(135deg, ${alpha(accentColor || theme.primary, 0.05)} 0%, transparent 60%)`
          : `linear-gradient(135deg, ${alpha(accentColor || theme.primary, 0.04)} 0%, transparent 60%)`,
      }}>
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between">
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Box sx={{
              p: 1.25,
              borderRadius: '12px',
              bgcolor: alpha(accentColor || theme.primary, 0.12),
              color: accentColor || theme.primary,
              display: 'flex',
              alignItems: 'center',
              boxShadow: `0 0 0 1px ${alpha(accentColor || theme.primary, 0.15)}`,
            }}>
              {icon}
            </Box>
            <Box>
              <Typography variant="subtitle1" fontWeight={800} sx={{ color: theme.textMain, lineHeight: 1.2, letterSpacing: '-0.02em' }}>
                {title}
              </Typography>
              {subtitle && (
                <Typography variant="caption" sx={{ color: theme.textMuted, fontWeight: 500, display: 'block', mt: 0.2 }}>
                  {subtitle}
                </Typography>
              )}
            </Box>
          </Stack>
          {/* Metric Pills */}
          <Stack direction="row" spacing={0.75} flexWrap="wrap" justifyContent="flex-end" sx={{ maxWidth: '55%' }}>
            {metrics.map((m: any) => (
              <Box key={m.key} sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.6,
                px: 1.25,
                py: 0.4,
                borderRadius: '20px',
                bgcolor: alpha(m.color, 0.1),
                border: `1px solid ${alpha(m.color, 0.2)}`,
              }}>
                <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: m.color, boxShadow: `0 0 4px ${m.color}` }} />
                <Typography variant="caption" sx={{ color: m.color, fontWeight: 700, fontSize: '0.68rem', lineHeight: 1, whiteSpace: 'nowrap' }}>
                  {m.label}
                </Typography>
              </Box>
            ))}
          </Stack>
        </Stack>
      </Box>

      {/* Chart Body */}
      <Box sx={{ px: 1, pt: 2, pb: 1 }}>
        {!hasData ? (
          <Box sx={{ height: 280, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1.5 }}>
            <Box sx={{ p: 2, borderRadius: '50%', bgcolor: alpha(accentColor || theme.primary, 0.08), color: alpha(accentColor || theme.primary, 0.4), display: 'flex' }}>
              {icon}
            </Box>
            <Typography variant="body2" sx={{ color: theme.textMuted, fontWeight: 600 }}>{t('modelOverview.noData', 'No data recorded yet')}</Typography>
            <Typography variant="caption" sx={{ color: alpha(theme.textMuted, 0.6) }}>{t('modelOverview.registerVersion', 'Register a version with metrics to see trends')}</Typography>
          </Box>
        ) : (
          <Box sx={{ height: 310, width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 8, right: 16, left: -12, bottom: 0 }}>
                <defs>
                  {metrics.map((m: any) => (
                    <linearGradient key={m.key} id={`pgrad-${m.key}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={m.color} stopOpacity={0.35} />
                      <stop offset="55%" stopColor={m.color} stopOpacity={0.08} />
                      <stop offset="100%" stopColor={m.color} stopOpacity={0} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="2 4" vertical={false} stroke={alpha(theme.border, 0.18)} />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: theme.textMuted, fontSize: 12, fontWeight: 700 }}
                  tickFormatter={(v) => v}
                  padding={{ left: 10, right: 10 }}
                />
                <YAxis
                  yAxisId="left"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: theme.textMuted, fontSize: 11, fontWeight: 600 }}
                  width={36}
                  domain={[0, 'auto']}
                  allowDataOverflow={false}
                />
                <Tooltip
                  content={(props: any) => <CustomTooltip {...props} theme={theme} />}
                  cursor={{ stroke: alpha(theme.textMuted, 0.2), strokeWidth: 1.5, strokeDasharray: '5 5' }}
                />
                {metrics.map((m: any, idx: number) => (
                  <Area
                    key={m.key}
                    yAxisId="left"
                    type="monotone"
                    dataKey={m.key}
                    name={m.label}
                    stroke={m.color}
                    strokeWidth={2.5}
                    fill={`url(#pgrad-${m.key})`}
                    strokeOpacity={0.95}
                    connectNulls={false}
                    dot={(props: any) => {
                      const { cx, cy, stroke, value } = props;
                      if (value === undefined || value === null || cy === undefined || cy === null || isNaN(cy)) return <g key={`dot-${idx}-${cx}`} />;
                      return (
                        <g key={`dot-${idx}-${cx}`}>
                          <circle cx={cx} cy={cy} r={5} fill={theme.mode === 'dark' ? theme.paper : '#fff'} stroke={stroke} strokeWidth={2.5} />
                        </g>
                      );
                    }}
                    activeDot={(props: any) => {
                      const { cx, cy, stroke, value } = props;
                      if (value === undefined || value === null || cy === undefined || cy === null || isNaN(cy)) return <g key={`adot-${idx}-${cx}`} />;
                      return (
                        <g key={`adot-${idx}-${cx}`}>
                          <circle cx={cx} cy={cy} r={7} fill={stroke} strokeWidth={0} opacity={0.2} />
                          <circle cx={cx} cy={cy} r={4.5} fill={stroke} strokeWidth={0} />
                        </g>
                      );
                    }}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </Box>
        )}
      </Box>
    </Paper>
  );
};

// --- RECENT ACTIVITY FEED ---
const ActivityFeed = ({ versions, factoryId, algorithmId, modelId }: { versions: any[], factoryId: string, algorithmId: string, modelId: string }) => {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const { t } = useTranslation();

  // Sort versions by most recent activity (updated_at)
  const sortedByActivity = [...versions].sort((a, b) =>
    new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime()
  );

  return (
    <Paper elevation={0} sx={{
      p: 0,
      borderRadius: "24px",
      border: `1px solid ${alpha(theme.border, 0.5)}`,
      bgcolor: theme.mode === 'dark' ? alpha(theme.paper, 0.7) : alpha(theme.paper, 0.3), // Higher opacity in dark mode
      backdropFilter: "blur(12px)",
      overflow: "hidden"
    }}>
      <Box sx={{
        p: 3,
        borderBottom: `1px solid ${alpha(theme.border, 0.4)}`,
        bgcolor: theme.mode === 'dark' ? alpha(theme.paper, 0.9) : alpha(theme.paper, 0.6)
      }}>
        <Typography variant="h6" fontWeight={800} sx={{ color: theme.textMain }}>
          {t('modelOverview.recentActivity', 'Recent Activity')}
        </Typography>
      </Box>
      <Stack spacing={0}>
        {sortedByActivity.slice(0, 5).map((v, i) => {
          const isEdited = v.updated_at && v.created_at && (new Date(v.updated_at).getTime() - new Date(v.created_at).getTime() > 2000);

          return (
            <Box key={v.id} sx={{
              p: 2.5,
              borderBottom: i < 4 ? `1px solid ${alpha(theme.border, 0.3)}` : "none",
              "&:hover": { bgcolor: alpha(theme.primary, 0.05) },
              transition: "bgcolor 0.2s",
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
              overflow: 'hidden'
            }}>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1, zIndex: 1 }}>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Box sx={{
                    width: 40, height: 40, borderRadius: "12px", // Squircle shape
                    bgcolor: v.is_active ? alpha(theme.success, 0.15) : alpha(theme.primary, 0.15),
                    color: v.is_active ? theme.success : theme.primary,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "0.9rem", fontWeight: 800,
                    boxShadow: `0 4px 12px ${v.is_active ? alpha(theme.success, 0.2) : alpha(theme.primary, 0.2)}`
                  }}>
                    v{v.version_number}
                  </Box>
                  <Box>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="body1" fontWeight={700} sx={{ color: theme.textMain }}>
                        {isEdited ? t('modelOverview.versionEdited', "Version Edited") : t('modelOverview.newVersionCreated', "New Version Created")}
                      </Typography>
                      {v.is_active && <Chip label={t('modelOverview.active', 'Active')} size="small" sx={{ height: 20, bgcolor: theme.success, color: '#fff', fontWeight: 700, fontSize: '0.65rem' }} />}
                    </Stack>
                    <Typography variant="caption" sx={{ color: theme.textMuted, fontWeight: 500 }}>
                      {v.updated_at ? new Date(v.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : t('modelOverview.justNow', "Just now")}
                    </Typography>
                  </Box>
                </Stack>

                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => navigate(`/algorithms/${algorithmId}/factories/${factoryId}/models/${modelId}/versions/${v.id}`)}
                  sx={{
                    borderRadius: "8px",
                    textTransform: 'none',
                    fontWeight: 700,
                    borderColor: alpha(theme.border, 0.5),
                    color: theme.textSecondary,
                    "&:hover": { borderColor: theme.primary, color: theme.primary, bgcolor: alpha(theme.primary, 0.05) }
                  }}
                >
                  {t('modelOverview.viewDetails', 'View Details')}
                </Button>
              </Stack>

              {/* Metrics Grid for Context */}
              <Stack direction="row" spacing={1} sx={{ mt: 1, ml: 5.5, flexWrap: 'wrap', gap: 1 }}>
                {v.accuracy !== undefined && (
                  <Chip size="small" label={`Acc: ${v.accuracy}%`} sx={{ height: 24, fontSize: "0.75rem", fontWeight: 700, bgcolor: alpha(theme.success, 0.1), color: theme.success, border: `1px solid ${alpha(theme.success, 0.2)}` }} />
                )}
                {v.f1_score !== undefined && (
                  <Chip size="small" label={`F1: ${v.f1_score}%`} sx={{ height: 24, fontSize: "0.75rem", fontWeight: 700, bgcolor: alpha(theme.primary, 0.1), color: theme.primary, border: `1px solid ${alpha(theme.primary, 0.2)}` }} />
                )}
                {v.inference_time !== undefined && (
                  <Chip size="small" label={`${v.inference_time}ms`} sx={{ height: 24, fontSize: "0.75rem", fontWeight: 700, bgcolor: alpha(theme.info, 0.1), color: theme.info, border: `1px solid ${alpha(theme.info, 0.2)}` }} />
                )}
                {v.parameters?.epochs && (
                  <Chip size="small" label={`Epochs: ${v.parameters.epochs}`} sx={{ height: 24, fontSize: "0.75rem", fontWeight: 600, bgcolor: alpha(theme.textMuted, 0.1), color: theme.textSecondary, border: `1px solid ${alpha(theme.border, 0.3)}` }} />
                )}
              </Stack>

              {v.note && (
                <Paper elevation={0} sx={{
                  mt: 1.5,
                  ml: 7,
                  p: 1.5,
                  bgcolor: alpha(theme.background, 0.5),
                  borderRadius: "12px",
                  border: `1px solid ${alpha(theme.border, 0.3)}`
                }}>
                  <Typography variant="body2" sx={{ color: theme.textSecondary, fontStyle: "italic", fontSize: "0.9rem" }}>
                    "{v.note}"
                  </Typography>
                </Paper>
              )}
            </Box>
          );
        })}
        {versions.length === 0 && (
          <Box sx={{ p: 6, textAlign: "center" }}>
            <Typography variant="body1" sx={{ color: theme.textMuted, fontWeight: 500 }}>{t('modelOverview.noActivity', 'No activity recorded yet.')}</Typography>
            <Button variant="text" size="small" sx={{ mt: 1, textTransform: 'none' }}>{t('modelOverview.createFirstVersion', 'Create your first version')}</Button>
          </Box>
        )}
      </Stack>
    </Paper>
  );
};

export default function ModelOverview() {
  const { factoryId, algorithmId, modelId } = useParams();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { t } = useTranslation();

  const [model, setModel] = useState<any>(null);
  const [versions, setVersions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [factoryName, setFactoryName] = useState("Factory");
  const [algorithmName, setAlgorithmName] = useState("Algorithm");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [modelRes, versionsRes, factoryRes, allAlgosRes] = await Promise.all([
          axios.get(`/algorithms/${algorithmId}/factories/${factoryId}/models/${modelId}`),
          axios.get(`/algorithms/${algorithmId}/factories/${factoryId}/models/${modelId}/versions`),
          axios.get(`/factories/${factoryId}`),
          axios.get(`/algorithms`)
        ]);

        const sortedVersions = [...versionsRes.data].sort(
          (a, b) => a.version_number - b.version_number
        );

        setModel(modelRes.data);
        setVersions(sortedVersions);

        if (factoryRes.data && factoryRes.data.name) setFactoryName(factoryRes.data.name);

        const currentAlgo = (allAlgosRes.data as any[]).find((a: any) => a.id == algorithmId);
        if (currentAlgo) setAlgorithmName(currentAlgo.name);

      } catch (err) {
        console.error("Failed to load model overview", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [factoryId, algorithmId, modelId]);

  const handleGenerateReport = async () => {
    try {
      const response = await axios.get(
        `/algorithms/${algorithmId}/factories/${factoryId}/models/${modelId}/report`,
        { responseType: 'blob' }
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;

      // Get the filename from the content-disposition header if available
      const contentDisposition = response.headers['content-disposition'];
      let filename = `${model?.name?.replace(/ /g, '_').toLowerCase() || 'report'}.csv`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match && match.length === 2) {
          filename = match[1];
        }
      }

      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();

      // Clean up
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);
    } catch (error) {
      console.error("Error downloading report:", error);
      alert(t('modelOverview.reportDownloadFail', "Failed to generate model report"));
    }
  };

  if (loading || !model) {
    return (
      <Box sx={{ height: "80vh", display: "flex", justifyContent: "center", alignItems: "center" }}>
        <CircularProgress size={42} sx={{ color: theme.primary }} />
      </Box>
    );
  }

  const activeVersion =
    versions.find((v) => v.is_active) ||
    versions[versions.length - 1];



  // --- MODERN METRIC CARD COMPONENT ---
  const MetricCard = ({ title, value, icon, color }: any) => (
    <Paper elevation={0} sx={{
      p: 3,
      borderRadius: "24px",
      border: `1px solid ${alpha(theme.border, 0.4)}`,
      display: 'flex',
      alignItems: 'center',
      gap: 3,
      bgcolor: theme.mode === 'dark' ? alpha(theme.paper, 0.9) : alpha(theme.paper, 0.4), // Higher opacity in dark mode
      backdropFilter: "blur(20px)",
      boxShadow: theme.mode === 'dark'
        ? `0 4px 20px -2px rgba(0,0,0,0.5)`
        : `0 4px 20px -2px ${alpha(theme.textMain, 0.05)}`,
      transition: "box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
      cursor: 'default',
      "&:hover": {
        borderColor: alpha(color, 0.5),
        boxShadow: theme.mode === 'dark'
          ? `0 12px 30px -5px rgba(0,0,0,0.7)`
          : `0 12px 30px -5px ${alpha(color, 0.25)}`,
      }
    }}>
      <Box sx={{
        p: 2,
        borderRadius: "18px",
        bgcolor: alpha(color, 0.15),
        color: color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: `inset 0 0 0 1px ${alpha(color, 0.2)}`
      }}>
        {icon}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="overline" fontWeight={700} sx={{ color: theme.textMuted, letterSpacing: 1.2, display: 'block', lineHeight: 1.2, fontSize: '0.75rem' }}>
          {title}
        </Typography>
        <Typography variant="h5" fontWeight={700} noWrap sx={{ color: theme.textMain, lineHeight: 1.2, mt: 0.5 }}>
          {value}
        </Typography>
      </Box>
    </Paper>
  );

  // --- PREPARE DATA FOR CHARTS ---
  const toNum = (v: any) => (v !== undefined && v !== null && v !== '' && !isNaN(Number(v))) ? Number(v) : null;

  const chartData = [...versions].sort((a, b) => a.version_number - b.version_number).map(v => ({
    name: `v${v.version_number}`,
    // Performance metrics
    accuracy:        toNum(v.accuracy),
    precision:       toNum(v.precision),
    recall:          toNum(v.recall),
    f1_score:        toNum(v.f1_score),
    // Resource metrics (columns)
    cpu_utilization: toNum(v.cpu_utilization),
    gpu_utilization: toNum(v.gpu_utilization),
    inference_time:  toNum(v.inference_time),
    // Training parameters (from parameters JSON)
    learning_rate:   toNum(v.parameters?.learning_rate),
    batch_size:      toNum(v.parameters?.batch_size),
    epochs:          toNum(v.parameters?.epochs),
  }));

  return (
    <Box sx={{ minHeight: "100vh", paddingBottom: 10 }}>

      {/* BACKGROUND DECORATION */}
      <Box sx={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: -1,
        background: `
            radial-gradient(circle at 80% 10%, ${alpha(theme.primary, 0.08)} 0%, transparent 40%),
            radial-gradient(circle at 10% 40%, ${alpha(theme.secondary, 0.08)} 0%, transparent 40%)
          `
      }} />

      <Container maxWidth="xl" sx={{ px: { xs: 2, md: 6 } }}>

        {/* HERO HEADER */}
        <Box sx={{
          pt: 4, pb: 4,
          borderBottom: `1px solid ${alpha(theme.border, 0.4)}`,
          mb: 4
        }}>
          <Stack spacing={3}>
            {/* Breadcrumbs */}
            <Stack direction="row" spacing={2} alignItems="center">
              <IconButton
                onClick={() => navigate(`/algorithms/${algorithmId}/factories/${factoryId}/models`)}
                sx={{
                  bgcolor: alpha(theme.paper, 0.8),
                  border: `1px solid ${theme.border}`,
                  backdropFilter: "blur(4px)",
                  "&:hover": { bgcolor: theme.paper, transform: "translateX(-2px)" },
                  transition: "all 0.2s"
                }}
              >
                <ArrowBackIcon fontSize="small" sx={{ color: theme.textMain }} />
              </IconButton>

              <Breadcrumbs separator={<NavigateNextIcon fontSize="small" sx={{ color: theme.textMuted }} />} aria-label="breadcrumb">
                <Link
                  underline="hover"
                  onClick={() => navigate(`/algorithms`)}
                  sx={{ cursor: 'pointer', display: 'flex', alignItems: 'center', fontWeight: 600, fontSize: '1.2rem', color: theme.textMuted }}
                >
                  {t('modelList.algorithms', 'Algorithms')}
                </Link>
                <Link
                  underline="hover"
                  color="inherit"
                  onClick={() => navigate(`/algorithms/${algorithmId}/factories`)}
                  sx={{ cursor: 'pointer', display: 'flex', alignItems: 'center', fontWeight: 600, fontSize: '1.2rem', color: theme.textMuted }}
                >
                  {algorithmName}
                </Link>
                <Link
                  underline="hover"
                  color="inherit"
                  onClick={() => navigate(`/algorithms/${algorithmId}/factories/${factoryId}/models`)}
                  sx={{ cursor: 'pointer', display: 'flex', alignItems: 'center', fontWeight: 600, fontSize: '1.2rem', color: theme.textMuted }}
                >
                  {factoryName}
                </Link>
                <Typography color="text.primary" fontWeight={800} sx={{ fontSize: '1.2rem' }}>
                  {model?.name}
                </Typography>
              </Breadcrumbs>
            </Stack>

            <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'flex-end' }} spacing={4}>
              <Box sx={{ maxWidth: 800 }}>
                <Typography
                  variant="h3"
                  fontWeight={900}
                  sx={{
                    mb: 1,
                    letterSpacing: "-0.03em",
                    background: `linear-gradient(135deg, ${theme.textMain} 0%, ${theme.textSecondary} 100%)`,
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent"
                  }}
                >
                  {model.name}
                </Typography>
                <Typography variant="h6" sx={{ color: theme.textMuted, fontWeight: 500, lineHeight: 1.6 }}>
                  {model.description || t('modelOverview.defaultDesc', "Detailed analysis of model performance metrics and iteration convergence.")}
                </Typography>
              </Box>

              <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap', gap: 1 }}>
                <Button
                  variant="outlined"
                  onClick={() => navigate(`/algorithms/${algorithmId}/factories/${factoryId}/models/${modelId}/versions`)}
                  startIcon={<LayersIcon />}
                  sx={{
                    borderRadius: "12px",
                    fontWeight: 700,
                    px: 3,
                    py: 1,
                    textTransform: 'none',
                    border: `1px solid ${theme.border}`,
                    color: theme.textSecondary,
                    bgcolor: theme.paper,
                    "&:hover": { bgcolor: theme.background, borderColor: theme.textSecondary },
                  }}
                >
                  {t('modelOverview.manageVersions', 'Manage Versions')}
                </Button>
                <Button
                  variant="outlined"
                  onClick={handleGenerateReport}
                  startIcon={<DownloadIcon />}
                  sx={{
                    borderRadius: "12px",
                    fontWeight: 700,
                    px: 3,
                    py: 1,
                    textTransform: 'none',
                    border: `1px solid ${theme.border}`,
                    color: theme.success,
                    borderColor: alpha(theme.success, 0.5),
                    bgcolor: alpha(theme.success, 0.05),
                    "&:hover": { bgcolor: alpha(theme.success, 0.1), borderColor: theme.success },
                  }}
                >
                  {t('modelOverview.generateReport', 'Generate Report')}
                </Button>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => navigate(`/algorithms/${algorithmId}/factories/${factoryId}/models/${modelId}/versions/create`)}
                  sx={{
                    bgcolor: theme.primary,
                    borderRadius: "12px",
                    fontWeight: 700,
                    px: 3,
                    py: 1,
                    textTransform: 'none',
                    boxShadow: `0 8px 16px -4px ${alpha(theme.primary, 0.4)}`,
                    "&:hover": { transform: "translateY(-1px)", boxShadow: `0 12px 20px -4px ${alpha(theme.primary, 0.6)}` },
                  }}
                >
                  {t('modelOverview.newVersion', 'New Version')}
                </Button>
              </Stack>
            </Stack>
          </Stack>
        </Box>

        {/* METRIC SCORECARDS */}
        <Grid container spacing={3} sx={{ mb: 6 }}>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <MetricCard title={t('modelOverview.totalVersions', 'Total Versions')} value={model.versions_count} icon={<LayersIcon />} color={theme.primary} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <MetricCard
              title={t('modelOverview.peakAccuracy', 'Peak Accuracy')}
              value={versions.length ? `${Math.max(...versions.map(v => v.accuracy || 0))}%` : "0%"}
              icon={<SpeedIcon />}
              color={theme.success}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <MetricCard
              title={t('modelOverview.activeVersion', 'Active Version')}
              value={activeVersion ? `v${activeVersion.version_number}` : t('modelOverview.none', "None")}
              icon={<TrendingUpIcon />}
              color={theme.secondary}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <MetricCard
              title={t('modelOverview.lastUpdated', 'Last Updated')}
              value={versions.length ? new Date(versions[versions.length - 1].created_at).toLocaleDateString() : t('modelOverview.never', "Never")}
              icon={<HubIcon />}
              color={theme.info}
            />
          </Grid>
        </Grid>

        {/* PREMIUM GRAPHS SECTION */}
        <Box sx={{ mb: 6 }}>
          {/* Section Header */}
          <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
            <Box sx={{ width: 4, height: 28, bgcolor: theme.primary, borderRadius: '4px', boxShadow: `0 0 12px ${alpha(theme.primary, 0.5)}` }} />
            <Box>
              <Typography variant="h6" fontWeight={800} sx={{ color: theme.textMain, letterSpacing: '-0.02em' }}>{t('modelOverview.versionAnalytics', 'Version Analytics')}</Typography>
              <Typography variant="caption" sx={{ color: theme.textMuted }}>{t('modelOverview.versionAnalyticsSub', 'Track how metrics evolve across registered versions')}</Typography>
            </Box>
          </Stack>

          {/* Full-width Performance Chart */}
          <Box sx={{ mb: 4 }}>
            <PremiumChart
              title={t('modelOverview.evaluationPerformance', 'Evaluation Performance')}
              subtitle={t('modelOverview.evaluationPerformanceSub', 'Accuracy, precision, recall & F1 score over versions')}
              icon={<ShowChartIcon sx={{ fontSize: 18 }} />}
              accentColor={theme.success}
              data={chartData}
              metrics={[
                { key: "accuracy", label: t('modelOverview.accuracy', "Accuracy"), color: theme.success },
                { key: "precision", label: t('modelOverview.precision', "Precision"), color: theme.primary },
                { key: "recall", label: t('modelOverview.recall', "Recall"), color: theme.warning },
                { key: "f1_score", label: t('modelOverview.f1Score', "F1 Score"), color: theme.error }
              ]}
            />
          </Box>

          {/* Side-by-side Resource & Training */}
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 6 }}>
              <PremiumChart
                title={t('modelOverview.resourceConsumption', 'Resource Consumption')}
                subtitle={t('modelOverview.resourceConsumptionSub', 'CPU & GPU utilization and inference latency')}
                icon={<MemoryIcon sx={{ fontSize: 18 }} />}
                accentColor={theme.warning}
                data={chartData}
                metrics={[
                  { key: "cpu_utilization", label: t('modelOverview.cpu', "CPU (%)"), color: theme.warning },
                  { key: "gpu_utilization", label: t('modelOverview.gpu', "GPU (%)"), color: theme.secondary },
                  { key: "inference_time", label: t('modelOverview.latency', "Latency (ms)"), color: theme.info }
                ]}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <PremiumChart
                title={t('modelOverview.trainingParameters', 'Training Parameters')}
                subtitle={t('modelOverview.trainingParametersSub', 'Batch size and epoch configuration per version')}
                icon={<TuneIcon sx={{ fontSize: 18 }} />}
                accentColor={theme.secondary}
                data={chartData}
                metrics={[
                  { key: "batch_size", label: t('modelOverview.batchSize', "Batch Size"), color: '#8b5cf6' },
                  { key: "epochs", label: t('modelOverview.epochs', "Epochs"), color: '#ec4899' },
                  { key: "learning_rate", label: t('modelOverview.lr', "LR"), color: '#06b6d4' },
                ]}
              />
            </Grid>
          </Grid>
        </Box>

        {/* RECENT ACTIVITY (MOVED TO BOTTOM) */}
        <Box sx={{ mb: 8 }}>
          <ActivityFeed versions={versions} factoryId={factoryId!} algorithmId={algorithmId!} modelId={modelId!} />
        </Box>

      </Container>
    </Box>
  );
}