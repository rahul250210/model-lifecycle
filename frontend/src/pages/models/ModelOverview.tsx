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
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  Legend,
} from "recharts";

import { useNavigate, useParams } from "react-router-dom";
import axios from "../../api/axios";
import { useTheme } from "../../theme/ThemeContext";

// --- UNIFIED CHART COMPONENT ---
const UnifiedChart = ({ title, data, metrics }: any) => {
  const { theme } = useTheme();
  return (
    <Paper elevation={0} sx={{
      p: 3,
      borderRadius: "24px",
      border: `1px solid ${alpha(theme.border, 0.4)}`, // Subtler border
      bgcolor: theme.mode === 'dark' ? alpha(theme.paper, 0.8) : alpha(theme.paper, 0.4),
      backdropFilter: "blur(20px)",
      height: "100%",
      minHeight: 400,
      boxShadow: theme.mode === 'dark'
        ? `0 8px 32px -8px rgba(0,0,0,0.5)`
        : `0 8px 32px -8px ${alpha(theme.textMain, 0.05)}`,
      transition: "box-shadow 0.3s ease-in-out, border-color 0.3s ease-in-out",
      "&:hover": {
        boxShadow: theme.mode === 'dark'
          ? `0 12px 48px -10px rgba(0,0,0,0.7)`
          : `0 12px 40px -10px ${alpha(theme.textMain, 0.1)}`,
        borderColor: alpha(theme.primary, 0.4)
      }
    }}>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h6" fontWeight={800} sx={{
          background: `linear-gradient(45deg, ${theme.textMain}, ${theme.textSecondary})`,
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent"
        }}>
          {title}
        </Typography>
      </Stack>

      <Box sx={{ height: 380, width: "100%" }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 40 }}>
            <defs>
              {metrics.map((m: any) => (
                <linearGradient key={m.key} id={`gradient-${m.key}`} x1="0" y1="0" x2="0" y2="1">

                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={alpha(theme.border, 0.2)} />
            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{ fill: theme.textMuted, fontSize: 14, fontWeight: 800 }}
              tickFormatter={(v) => v.replace('v', '')}
              padding={{ left: 20 }}
              label={{ value: "Version", position: "insideBottom", offset: -25, fill: theme.textSecondary, fontSize: 11, fontWeight: 800 }}
            />
            <YAxis
              yAxisId="left"
              axisLine={false}
              tickLine={false}
              tick={{ fill: theme.textMuted, fontSize: 14, fontWeight: 800 }}
              width={40}
              padding={{ bottom: 12 }}
            />
            <Tooltip
              contentStyle={{
                borderRadius: '16px',
                border: `1px solid ${alpha(theme.border, 0.5)}`,
                boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
                backgroundColor: alpha(theme.paper, 0.85),
                backdropFilter: "blur(12px)",
                padding: "12px 16px"
              }}
              itemStyle={{ fontWeight: 700, fontSize: '0.85rem' }}
              labelStyle={{ display: 'none' }}
              cursor={{ stroke: theme.textMuted, strokeWidth: 1, strokeDasharray: '4 4' }}
            />
            <Legend
              verticalAlign="top"
              align="right"
              height={20}
              iconType="circle"
              iconSize={8}
              wrapperStyle={{
                fontWeight: 700,
                fontSize: '0.7rem',
                color: theme.textSecondary,
                top: 0,
                right: 10,
                paddingBottom: '10px'
              }}
            />

            {metrics.map((m: any) => (
              <Area
                key={m.key}
                yAxisId="left"
                type="monotone"
                dataKey={m.key}
                name={m.label}
                stroke={m.color}
                strokeWidth={3}
                fill={`url(#gradient-${m.key})`}
                dot={{ r: 4, fill: theme.paper, stroke: m.color, strokeWidth: 2 }}
                activeDot={{ r: 7, strokeWidth: 0, fill: m.color }}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </Box>
    </Paper>
  );
};

// --- RECENT ACTIVITY FEED ---
const ActivityFeed = ({ versions, factoryId, algorithmId, modelId }: { versions: any[], factoryId: string, algorithmId: string, modelId: string }) => {
  const { theme } = useTheme();
  const navigate = useNavigate();

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
          Recent Activity
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
                        {isEdited ? "Version Edited" : "New Version Created"}
                      </Typography>
                      {v.is_active && <Chip label="Active" size="small" sx={{ height: 20, bgcolor: theme.success, color: '#fff', fontWeight: 700, fontSize: '0.65rem' }} />}
                    </Stack>
                    <Typography variant="caption" sx={{ color: theme.textMuted, fontWeight: 500 }}>
                      {v.updated_at ? new Date(v.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : "Just now"}
                    </Typography>
                  </Box>
                </Stack>

                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => navigate(`/factories/${factoryId}/algorithms/${algorithmId}/models/${modelId}/versions/${v.id}`)}
                  sx={{
                    borderRadius: "8px",
                    textTransform: 'none',
                    fontWeight: 700,
                    borderColor: alpha(theme.border, 0.5),
                    color: theme.textSecondary,
                    "&:hover": { borderColor: theme.primary, color: theme.primary, bgcolor: alpha(theme.primary, 0.05) }
                  }}
                >
                  View Details
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
            <Typography variant="body1" sx={{ color: theme.textMuted, fontWeight: 500 }}>No activity recorded yet.</Typography>
            <Button variant="text" size="small" sx={{ mt: 1, textTransform: 'none' }}>Create your first version</Button>
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

  const [model, setModel] = useState<any>(null);
  const [versions, setVersions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [factoryName, setFactoryName] = useState("Factory");
  const [algorithmName, setAlgorithmName] = useState("Algorithm");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [modelRes, versionsRes, factoryRes, allAlgosRes] = await Promise.all([
          axios.get(`/factories/${factoryId}/algorithms/${algorithmId}/models/${modelId}`),
          axios.get(`/factories/${factoryId}/algorithms/${algorithmId}/models/${modelId}/versions`),
          axios.get(`/factories/${factoryId}`),
          axios.get(`/factories/${factoryId}/algorithms`)
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
        `/factories/${factoryId}/algorithms/${algorithmId}/models/${modelId}/report`,
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
      alert("Failed to generate model report");
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

  // --- PREPARE DATA FOR UNIFIED CHARTS ---
  const chartData = [...versions].sort((a, b) => a.version_number - b.version_number).map(v => ({
    name: `v${v.version_number}`,
    ...v,
    parameters: v.parameters || {},
    resource_metrics: v.resource_metrics || {},

    // Flatten for ease of access if needed
    learning_rate: v.parameters?.learning_rate,
    batch_size: v.parameters?.batch_size,
    epochs: v.parameters?.epochs,
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
                onClick={() => navigate(`/factories/${factoryId}/algorithms/${algorithmId}/models`)}
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
                  onClick={() => navigate(`/factories/${factoryId}`)}
                  sx={{ cursor: 'pointer', display: 'flex', alignItems: 'center', fontWeight: 600, fontSize: '1.2rem', color: theme.textMuted }}
                >
                  {factoryName}
                </Link>
                <Link
                  underline="hover"
                  color="inherit"
                  onClick={() => navigate(`/factories/${factoryId}/algorithms/${algorithmId}/models`)}
                  sx={{ cursor: 'pointer', display: 'flex', alignItems: 'center', fontWeight: 600, fontSize: '1.2rem', color: theme.textMuted }}
                >
                  {algorithmName}
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
                  {model.description || "Detailed analysis of model performance metrics and iteration convergence."}
                </Typography>
              </Box>

              <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap', gap: 1 }}>
                <Button
                  variant="outlined"
                  onClick={() => navigate(`/factories/${factoryId}/algorithms/${algorithmId}/models/${modelId}/versions`)}
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
                  Manage Versions
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
                  Generate Report
                </Button>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => navigate(`/factories/${factoryId}/algorithms/${algorithmId}/models/${modelId}/versions/create`)}
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
                  New Version
                </Button>
              </Stack>
            </Stack>
          </Stack>
        </Box>

        {/* METRIC SCORECARDS */}
        <Grid container spacing={3} sx={{ mb: 6 }}>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <MetricCard title="Total Versions" value={model.versions_count} icon={<LayersIcon />} color={theme.primary} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <MetricCard
              title="Peak Accuracy"
              value={versions.length ? `${Math.max(...versions.map(v => v.accuracy || 0))}%` : "0%"}
              icon={<SpeedIcon />}
              color={theme.success}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <MetricCard
              title="Active Version"
              value={activeVersion ? `v${activeVersion.version_number}` : "None"}
              icon={<TrendingUpIcon />}
              color={theme.secondary}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <MetricCard
              title="Last Updated"
              value={versions.length ? new Date(versions[versions.length - 1].created_at).toLocaleDateString() : "Never"}
              icon={<HubIcon />}
              color={theme.info}
            />
          </Grid>
        </Grid>

        {/* UNIFIED GRAPHS SECTION */}
        <Grid container spacing={4} sx={{ mb: 6 }}>
          {/* Performance Graph */}
          <Grid size={{ xs: 12 }}>
            <UnifiedChart
              title="Performance Metrics Overview"
              data={chartData}
              yAxisLabel="Percentage (%)"
              metrics={[
                { key: "accuracy", label: "Accuracy", color: theme.success },
                { key: "precision", label: "Precision", color: theme.primary },
                { key: "recall", label: "Recall", color: theme.warning },
                { key: "f1_score", label: "F1 Score", color: theme.error }
              ]}
            />
          </Grid>

          {/* Resource Graph */}
          <Grid size={{ xs: 12, md: 6 }}>
            <UnifiedChart
              title="Resource Consumption"
              data={chartData}
              yAxisLabel="Utilization (%) / Time (ms)"
              metrics={[
                { key: "cpu_utilization", label: "CPU Usage (%)", color: theme.warning },
                { key: "gpu_utilization", label: "GPU Usage (%)", color: theme.secondary },
                { key: "inference_time", label: "Inference Time (ms)", color: theme.info }
              ]}
            />
          </Grid>

          {/* Training Params Graph */}
          <Grid size={{ xs: 12, md: 6 }}>
            <UnifiedChart
              title="Training Parameters"
              data={chartData}
              yAxisLabel="Value"
              metrics={[
                { key: "batch_size", label: "Batch Size", color: theme.success },
                { key: "epochs", label: "Epochs", color: theme.error },
              ]}
            />
          </Grid>
        </Grid>

        {/* RECENT ACTIVITY (MOVED TO BOTTOM) */}
        <Box sx={{ mb: 8 }}>
          <ActivityFeed versions={versions} factoryId={factoryId!} algorithmId={algorithmId!} modelId={modelId!} />
        </Box>

      </Container>
    </Box>
  );
}