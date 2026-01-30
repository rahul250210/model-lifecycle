"use client";

import { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  CircularProgress,
  Chip,
  Grid,
  IconButton,
  alpha,
  Container,
  Stack,
  Tooltip as MuiTooltip,
  Paper,
} from "@mui/material";

import HubIcon from "@mui/icons-material/Hub";
import LayersIcon from "@mui/icons-material/Layers";
import AddIcon from "@mui/icons-material/Add";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import SpeedIcon from "@mui/icons-material/Speed";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
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

export default function ModelOverview() {
  const { factoryId, algorithmId, modelId } = useParams();
  const navigate = useNavigate();

  const [model, setModel] = useState<any>(null);
  const [versions, setVersions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [modelRes, versionsRes] = await Promise.all([
          axios.get(`/factories/${factoryId}/algorithms/${algorithmId}/models/${modelId}`),
          axios.get(`/factories/${factoryId}/algorithms/${algorithmId}/models/${modelId}/versions`),
        ]);

        const sortedVersions = [...versionsRes.data].sort(
          (a, b) => a.version_number - b.version_number
        );

        setModel(modelRes.data);
        setVersions(sortedVersions);
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
        <CircularProgress size={42} sx={{ color: themePalette.primary }} />
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

  const MetricCard = ({ title, value, icon, color }: any) => (
    <Paper elevation={0} sx={{ 
      p: 3, 
      borderRadius: "24px", 
      border: `1px solid ${themePalette.border}`, 
      display: 'flex', 
      alignItems: 'center', 
      gap: 2, 
      bgcolor: themePalette.white,
      transition: "transform 0.2s",
      "&:hover": { transform: "translateY(-4px)" }
    }}>
      <Box sx={{ p: 1.5, bgcolor: alpha(color, 0.1), color: color, borderRadius: "14px", display: 'flex' }}>
        {icon}
      </Box>
      <Box>
        <Typography variant="caption" fontWeight={800} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 1 }}>
          {title}
        </Typography>
        <Typography variant="h5" fontWeight={900}>{value}</Typography>
      </Box>
    </Paper>
  );

  const MetricChart = ({ title, dataKey, color, activeVersion }: any) => (
    <Card 
      elevation={0} 
      sx={{ 
        borderRadius: "28px", 
        border: `1px solid ${themePalette.border}`,
        bgcolor: themePalette.white,
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        "&:hover": { boxShadow: `0 25px 50px -12px ${alpha("#000", 0.08)}` },
        overflow: 'visible'
      }}
    >
      <CardContent sx={{ p: { xs: 3, md: 5 }, pb: 6  }}>
        {/* IMPROVED HEADER: Spaced out to prevent overlapping */}
        <Stack 
          direction={{ xs: 'column', sm: 'row' }} 
          justifyContent="space-between" 
          alignItems={{ xs: 'flex-start', sm: 'flex-end' }} 
          spacing={2} 
          sx={{ mb: 6 }}
        >
          <Box>
            <Typography 
              variant="overline" 
              fontWeight={800} 
              sx={{ color: themePalette.primary, letterSpacing: 2, display: 'block', mb: 1 }}
            >
              Performance Tracking
            </Typography>
            <Typography 
              variant="h3" 
              fontWeight={900} 
              sx={{ color: themePalette.textMain, letterSpacing: "-0.02em" }}
            >
              {title}
            </Typography>
          </Box>
          <Box sx={{ minWidth: 140, textAlign: { xs: 'left', sm: 'right' } }}>
            <Typography variant="h2" fontWeight={900} sx={{ color: color, lineHeight: 1 }}>
              {activeVersion && activeVersion[dataKey] != null ? `${activeVersion[dataKey]}%` : "N/A"}
            </Typography>
            <Typography variant="caption" fontWeight={800} sx={{ color: themePalette.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Current Milestone
            </Typography>
          </Box>
        </Stack>

        {/* IMPROVED GRAPH: Better texture, visibility and clean aesthetic */}
        <ResponsiveContainer width="100%" height={430}>
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -30, bottom: 20 }}>
            <defs>
              <linearGradient id={`gradient-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.4}/>
                <stop offset="95%" stopColor={color} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid 
              strokeDasharray="4 4" 
              vertical={false} 
              stroke={alpha(themePalette.border, 0.7)} 
            />
            <XAxis 
              dataKey="version" 
              interval={0}
              height={20}
              axisLine={{ stroke: themePalette.border, strokeWidth: 2 }} 
              tickLine={{ stroke: themePalette.border }} 
              tick={{ fill: themePalette.textMuted, fontSize: 14, fontWeight: 700 }}
              dy={1}
            />
            <YAxis 
              domain={[0, 100]} 
              axisLine={{ stroke: themePalette.border, strokeWidth: 2 }} 
              tickLine={{ stroke: themePalette.border }} 
              tick={{ fill: themePalette.textMuted, fontSize: 14, fontWeight: 700 }}
            />
            <Tooltip 
              contentStyle={{ 
                borderRadius: '16px', 
                border: `1px solid ${themePalette.border}`, 
                boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', 
                padding: '16px',
                backgroundColor: alpha(themePalette.white, 0.95),
                backdropFilter: 'blur(4px)'
              }}
              itemStyle={{ fontWeight: 800, color: themePalette.textMain }}
              labelStyle={{ fontWeight: 900, marginBottom: '8px', color: themePalette.primary }}
            />
            <Area 
              type="monotone" 
              dataKey={dataKey} 
              stroke={color} 
              strokeWidth={5} 
              fillOpacity={1} 
              fill={`url(#gradient-${dataKey})`} 
              dot={{ 
                r: 6, 
                fill: themePalette.white, 
                stroke: color, 
                strokeWidth: 3 
              }} 
              activeDot={{ 
                r: 8, 
                strokeWidth: 0,
                fill: color 
              }} 
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: themePalette.background, pb: 10 }}>
      <Container maxWidth="xl">
        {/* Header Hero Section */}
        <Box sx={{ pt: 6, pb: 6 }}>
          <Grid container justifyContent="space-between" alignItems="center">
            <Grid size={{ xs: 12, md: 7 }}>
              <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
                <IconButton 
                  onClick={() => navigate(`/factories/${factoryId}/algorithms/${algorithmId}/models`)}
                  sx={{ bgcolor: themePalette.white, border: `1px solid ${themePalette.border}` }}
                >
                  <ArrowBackIcon fontSize="small" />
                </IconButton>
                <Chip label="Analysis Hub" size="small" sx={{ bgcolor: themePalette.primaryLight, color: themePalette.primary, fontWeight: 900, px: 1 }} />
              </Stack>
              <Typography variant="h2" fontWeight={900} sx={{ color: themePalette.textMain, letterSpacing: "-0.04em" }}>
                {model.name}
              </Typography>
              <Typography variant="h6" sx={{ color: themePalette.textMuted, mt: 1, fontWeight: 400, maxWidth: 600 }}>
                {model.description || "Detailed analysis of model performance metrics and iteration convergence."}
              </Typography>
            </Grid>
              <Grid size={{ xs: 12, md: 5 }}>
              <Stack direction="row" spacing={2} justifyContent={{ md: 'flex-end' }}>
                <Button 
                  variant="outlined" 
                  onClick={() => navigate(`/factories/${factoryId}/algorithms/${algorithmId}/models/${modelId}/versions`)}
                  sx={{ borderRadius: "14px", fontWeight: 800, px: 3, py: 1.2, textTransform: 'none', border: `2px solid ${themePalette.border}` }}
                >
                  Timeline
                </Button>
                <Button 
                  variant="contained" 
                  startIcon={<AddIcon />} 
                  onClick={() => navigate(`/factories/${factoryId}/algorithms/${algorithmId}/models/${modelId}/versions/create`)}
                  sx={{ bgcolor: themePalette.primary, borderRadius: "14px", fontWeight: 800, px: 3, py: 1.2, textTransform: 'none', boxShadow: `0 10px 15px -3px ${alpha(themePalette.primary, 0.4)}` }}
                >
                  Create Version
                </Button>
              </Stack>
            </Grid>
          </Grid>
        </Box>

        {/* KPI SCORECARDS */}
        <Grid container spacing={3} sx={{ mb: 6 }}>
          <Grid size={{xs:12, sm:6, md:3}}>
            <MetricCard title="Versions" value={model.versions_count} icon={<LayersIcon />} color={themePalette.primary} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <MetricCard 
              title="Peak Accuracy" 
              value={versions.length ? `${Math.max(...versions.map(v => v.accuracy || 0))}%` : "0%"} 
              icon={<SpeedIcon />} 
              color={themePalette.success} 
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <MetricCard 
              title="Avg F1-Score" 
              value={versions.length ? `${(versions.reduce((acc, v) => acc + (v.f1_score || 0), 0) / versions.length).toFixed(1)}%` : "0%"} 
              icon={<TrendingUpIcon />} 
              color={themePalette.warning} 
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <MetricCard title="Model ID" value={`MOD-${model.id}`} icon={<HubIcon />} color={themePalette.error} />
          </Grid>
        </Grid>

        {/* ANALYTICS GRID */}
        <Stack spacing={4}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <AssessmentIcon sx={{ color: themePalette.primary, fontSize: 32 }} />
            <Typography variant="h4" fontWeight={900}>Model Performance Convergence</Typography>
            <MuiTooltip title="Analysis across all registered iterations">
              <IconButton size="small"><InfoOutlinedIcon fontSize="small" /></IconButton>
            </MuiTooltip>
          </Stack>
          
          <Grid container spacing={4}>
            <Grid size={{ xs: 12, lg: 6 }}>
              <MetricChart title="Model Accuracy" dataKey="accuracy" color={themePalette.success} activeVersion={activeVersion} />
            </Grid>
            <Grid size={{ xs: 12, lg: 6 }}>
              <MetricChart title="Precision Score" dataKey="precision" color={themePalette.primary} activeVersion={activeVersion} />
            </Grid>
            <Grid size={{ xs: 12, lg: 6 }}>
              <MetricChart title="Recall Sensitivity" dataKey="recall" color={themePalette.warning} activeVersion={activeVersion} />
            </Grid>
            <Grid size={{ xs: 12, lg: 6 }}>
              <MetricChart title="F1-Score Stability" dataKey="f1_score" color={themePalette.error} activeVersion={activeVersion} />
            </Grid>
          </Grid>
        </Stack>
      </Container>
    </Box>
  );
}