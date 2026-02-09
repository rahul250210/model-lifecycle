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
import AssessmentIcon from "@mui/icons-material/Assessment";
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

  const chartData = versions.map((v) => ({
    version: `v${v.version_number}`,
    accuracy: v.accuracy ?? null,
    precision: v.precision ?? null,
    recall: v.recall ?? null,
    f1_score: v.f1_score ?? null,
  }));

  // --- MODERN METRIC CARD COMPONENT ---
  const MetricCard = ({ title, value, icon, color }: any) => (
    <Paper elevation={0} sx={{
      p: 3,
      borderRadius: "24px",
      border: `1px solid ${alpha(theme.border, 0.6)}`,
      display: 'flex',
      alignItems: 'center',
      gap: 3,
      bgcolor: alpha(theme.paper, 0.6), // Semi-transparent
      backdropFilter: "blur(12px)", // Glass blur
      boxShadow: `0 4px 20px -2px ${alpha(theme.textMain, 0.02)}`,
      transition: "all 0.2s ease-in-out",
      "&:hover": {
        borderColor: alpha(color, 0.4),
        boxShadow: `0 10px 30px -5px ${alpha(color, 0.15)}`,
      }
    }}>
      <Box sx={{
        p: 2,
        borderRadius: "18px",
        bgcolor: alpha(color, 0.1),
        color: color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: `inset 0 0 0 1px ${alpha(color, 0.1)}`
      }}>
        {icon}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="overline" fontWeight={800} sx={{ color: theme.textMuted, letterSpacing: 1.5, display: 'block', lineHeight: 1.2 }}>
          {title}
        </Typography>
        <Typography variant="h6" fontWeight={400} noWrap sx={{ color: theme.textMain, lineHeight: 1.2 }}>
          {value}
        </Typography>
      </Box>
    </Paper>
  );

  // --- MODERN CHART COMPONENT ---
  const MetricChart = ({ title, dataKey, color, activeVersion }: any) => {
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    return (
      <Paper
        elevation={0}
        sx={{
          borderRadius: "32px",
          minWidth: 0,
          border: `1px solid ${alpha(theme.border, 0.6)}`,
          bgcolor: alpha(theme.paper, 0.5),
          backdropFilter: "blur(12px)",
          overflow: 'hidden',
          transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          "&:hover": {
            borderColor: alpha(color, 0.3),
            boxShadow: `0 20px 40px -12px ${alpha(color, 0.1)}`
          }
        }}
      >
        <Box sx={{ p: 4, pb: 2 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }}>
            <Stack spacing={1}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: color }} />
                <Typography variant="overline" fontWeight={800} sx={{ color: theme.textMuted, letterSpacing: 1 }}>
                  Metric Analysis
                </Typography>
              </Stack>
              <Typography variant="h6" fontWeight={400} sx={{ color: theme.textMain }}>
                {title}
              </Typography>
            </Stack>

            <Box sx={{ textAlign: "right" }}>
              <Typography variant="h5" fontWeight={400} sx={{ color: color }}>
                {activeVersion && activeVersion[dataKey] != null ? `${activeVersion[dataKey]}%` : "N/A"}
              </Typography>
              <Chip
                label="Latest"
                size="small"
                sx={{
                  bgcolor: alpha(color, 0.1),
                  color: color,
                  fontWeight: 800,
                  fontSize: "0.7rem",
                  height: 24
                }}
              />
            </Box>
          </Stack>
        </Box>

        <Box sx={{ height: 380, width: "100%", minWidth: 0, mt: 2, position: 'relative' }}>
          {mounted ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 10 }}>
                <defs>
                  <linearGradient id={`gradient-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={alpha(theme.border, 0.4)} />
                <XAxis
                  dataKey="version"
                  height={50}
                  axisLine={{ stroke: theme.border, strokeWidth: 2 }}
                  tickLine={false}
                  tick={{ fill: theme.textMuted, fontSize: 11, fontWeight: 700 }}
                  tickFormatter={(v) => v.replace('v', '')}
                  label={{ value: "Version", position: "centerBottom", offset: -1, fill: theme.textMuted, fontSize: 11, fontWeight: 800 }}
                />
                <YAxis
                  domain={[0, 100]}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                  tick={{ fill: theme.textMuted, fontSize: 11, fontWeight: 700 }}
                  tickFormatter={(value) => `${value}%`}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: '16px',
                    border: `1px solid ${alpha(theme.paper, 0.5)}`,
                    boxShadow: '0 10px 30px -10px rgba(0,0,0,0.1)',
                    padding: '12px 20px',
                    backgroundColor: alpha(theme.paper, 0.8),
                    backdropFilter: 'blur(12px)'
                  }}
                  itemStyle={{ fontWeight: 700, color: theme.textMain }}
                  labelStyle={{ display: 'none' }}
                  cursor={{ stroke: color, strokeWidth: 2, strokeDasharray: '4 4' }}
                />
                <Area
                  type="monotone"
                  dataKey={dataKey}
                  stroke={color}
                  strokeWidth={4}
                  fillOpacity={1}
                  fill={`url(#gradient-${dataKey})`}
                  dot={{ r: 4, strokeWidth: 2, stroke: theme.paper, fill: color }}
                  activeDot={{ r: 6, strokeWidth: 1, stroke: theme.paper, fill: color }}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <Box sx={{ height: '100%', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CircularProgress size={20} sx={{ color: theme.textMuted }} />
            </Box>
          )}
        </Box>
      </Paper>
    );
  };

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

      <Container maxWidth={false} sx={{ px: { xs: 2, md: 6 } }}>

        {/* HERO HEADER */}
        <Box sx={{
          pt: 6, pb: 6,
          borderBottom: `1px solid ${alpha(theme.border, 0.4)}`,
          mb: 6
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
                  color="inherit"
                  onClick={() => navigate("/factories")}
                  sx={{ cursor: 'pointer', display: 'flex', alignItems: 'center', fontWeight: 600, fontSize: '1.2rem', color: theme.textMuted }}
                >
                  Factories
                </Link>
                <Link
                  underline="hover"
                  color="inherit"
                  onClick={() => navigate(`/factories/${factoryId}/algorithms`)}
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
                  variant="h4"
                  fontWeight={400}
                  sx={{
                    mb: 2,
                    letterSpacing: "-0.03em",
                    background: `linear-gradient(135deg, ${theme.textMain} 0%, ${theme.textSecondary} 100%)`,
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent"
                  }}
                >
                  {model.name}
                </Typography>
                <Typography variant="h6" sx={{ color: theme.textMuted, fontWeight: 400, lineHeight: 1.6 }}>
                  {model.description || "Detailed analysis of model performance metrics and iteration convergence."}
                </Typography>
              </Box>

              <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap', gap: 1 }}>
                <Button
                  variant="outlined"
                  onClick={() => navigate(`/factories/${factoryId}/algorithms/${algorithmId}/models/${modelId}/versions`)}
                  sx={{
                    borderRadius: "16px",
                    fontWeight: 700,
                    px: 4,
                    py: 1.5,
                    textTransform: 'none',
                    border: `2px solid ${theme.border}`,
                    color: theme.textSecondary,
                    bgcolor: alpha(theme.paper, 0.5),
                    "&:hover": { bgcolor: theme.paper, borderColor: theme.textSecondary },
                    flexGrow: 1, whiteSpace: 'nowrap'
                  }}
                >
                  View Timeline
                </Button>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => navigate(`/factories/${factoryId}/algorithms/${algorithmId}/models/${modelId}/versions/create`)}
                  sx={{
                    bgcolor: theme.primary,
                    borderRadius: "16px",
                    fontWeight: 700,
                    px: 4,
                    py: 1.5,
                    textTransform: 'none',
                    boxShadow: `0 8px 16px -4px ${alpha(theme.primary, 0.4)}`,
                    "&:hover": { transform: "translateY(-2px)", boxShadow: `0 12px 20px -4px ${alpha(theme.primary, 0.6)}` },
                    flexGrow: 1, whiteSpace: 'nowrap'
                  }}
                >
                  New Version
                </Button>
              </Stack>
            </Stack>
          </Stack>
        </Box>

        {/* METRIC SCORECARDS */}
        <Grid container spacing={3} sx={{ mb: 8 }}>
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
              title="Avg F1-Score"
              value={versions.length ? `${(versions.reduce((acc, v) => acc + (v.f1_score || 0), 0) / versions.length).toFixed(1)}%` : "0%"}
              icon={<TrendingUpIcon />}
              color={theme.warning}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <MetricCard title="Model ID" value={`MOD-${model.id}`} icon={<HubIcon />} color={theme.error} />
          </Grid>
        </Grid>

        {/* ANALYTICS SECTION */}
        <Box>
          <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 4 }}>
            <Box sx={{ p: 1.5, borderRadius: "12px", bgcolor: alpha(theme.primary, 0.1), color: theme.primary }}>
              <AssessmentIcon />
            </Box>
            <Typography variant="h5" fontWeight={400} sx={{ color: theme.textMain }}>
              Performance Convergence
            </Typography>
          </Stack>

          <Grid container spacing={4}>
            <Grid size={{ xs: 12, xl: 6 }} sx={{ minWidth: 0 }}>
              <MetricChart title="Model Accuracy" dataKey="accuracy" color={theme.success} activeVersion={activeVersion} />
            </Grid>
            <Grid size={{ xs: 12, xl: 6 }} sx={{ minWidth: 0 }}>
              <MetricChart title="Precision Score" dataKey="precision" color={theme.primary} activeVersion={activeVersion} />
            </Grid>
            <Grid size={{ xs: 12, xl: 6 }} sx={{ minWidth: 0 }}>
              <MetricChart title="Recall Sensitivity" dataKey="recall" color={theme.warning} activeVersion={activeVersion} />
            </Grid>
            <Grid size={{ xs: 12, xl: 6 }} sx={{ minWidth: 0 }}>
              <MetricChart title="F1-Score Stability" dataKey="f1_score" color={theme.error} activeVersion={activeVersion} />
            </Grid>
          </Grid>
        </Box>

      </Container>
    </Box>
  );
}