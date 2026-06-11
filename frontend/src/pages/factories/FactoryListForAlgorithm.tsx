"use client";

import { useEffect, useRef, useState } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  CircularProgress,
  Chip,
  IconButton,
  Container,
  alpha,
  Paper,
  Stack,
  Divider,
  Grid,
  Breadcrumbs,
  Link,
  ToggleButton,
  ToggleButtonGroup,
  Dialog,
  DialogActions,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import FactoryIcon from "@mui/icons-material/Factory";
import HubIcon from "@mui/icons-material/Hub";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import NavigateNextIcon from "@mui/icons-material/NavigateNext";
import DeleteIcon from "@mui/icons-material/Delete";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";

import { useNavigate, useParams } from "react-router-dom";
import axios from "../../api/axios";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../theme/ThemeContext";
import toast from "react-hot-toast";
import DownloadIcon from "@mui/icons-material/Download";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as ReTooltip, Legend
} from "recharts";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import WorkspacePremiumIcon from "@mui/icons-material/WorkspacePremium";
import ScienceIcon from "@mui/icons-material/ScienceOutlined";

interface Factory {
  id: number;
  name: string;
  description?: string;
  models_count: number;
  created_at: string;
}

export default function FactoryListForAlgorithm() {
  const { algorithmId } = useParams();
  const navigate = useNavigate();
  const { theme, mode } = useTheme();
  const { t } = useTranslation();

  const [factories, setFactories] = useState<Factory[]>([]);
  const [versions, setVersions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [algorithmName, setAlgorithmName] = useState("Algorithm");
  const [reportLoading, setReportLoading] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState<"accuracy" | "precision" | "recall" | "f1_score">("accuracy");

  // Remove Factory Dialog States
  const [removeOpen, setRemoveOpen] = useState(false);
  const [factoryToRemove, setFactoryToRemove] = useState<Factory | null>(null);
  const [removeLoading, setRemoveLoading] = useState(false);

  const handleRemoveFactory = (e: React.MouseEvent, factory: Factory) => {
    e.preventDefault();
    e.stopPropagation();
    setFactoryToRemove(factory);
    setRemoveOpen(true);
  };

  const confirmRemoveFactory = async () => {
    if (!factoryToRemove) return;
    try {
      setRemoveLoading(true);
      await axios.delete(`/algorithms/${algorithmId}/factories/${factoryToRemove.id}`);
      setFactories((prev) => prev.filter((f) => f.id !== factoryToRemove.id));
      setRemoveOpen(false);
      setFactoryToRemove(null);
      toast.success(t('factoryList.removeSuccess', 'Factory removed from algorithm successfully'));
      fetchData();
    } catch (err) {
      console.error("Failed to remove factory", err);
      toast.error(t('factoryList.removeFail', 'Failed to remove factory. Please try again.'));
    } finally {
      setRemoveLoading(false);
    }
  };

  const factoriesSectionRef = useRef<HTMLDivElement>(null);

  const scrollToFactories = () => {
    factoriesSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleDownloadReport = async () => {
    setReportLoading(true);
    try {
      const response = await axios.get(`/algorithms/${algorithmId}/report`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const contentDisposition = response.headers['content-disposition'];
      let filename = `${algorithmName.replace(/ /g, '_').toLowerCase()}_report.csv`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match && match[1]) filename = match[1];
      }
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);
      toast.success(t('modelList.algorithmReportSuccess', 'Algorithm report downloaded successfully'));
    } catch (err) {
      console.error('Failed to generate algorithm report', err);
      toast.error(t('algorithmList.reportDownloadFail', 'Failed to generate report. Please try again.'));
    } finally {
      setReportLoading(false);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [factoriesRes, algoRes, versionsRes] = await Promise.all([
        axios.get(`/algorithms/${algorithmId}/factories`),
        axios.get(`/algorithms/${algorithmId}`),
        axios.get(`/algorithms/${algorithmId}/versions`)
      ]);
      setFactories(factoriesRes.data);
      setVersions(versionsRes.data);
      if (algoRes.data && algoRes.data.name) {
        setAlgorithmName(algoRes.data.name);
      }
    } catch (err) {
      console.error("Failed to load factories for algorithm", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [algorithmId]);

  const filteredFactories = factories;

  // KPI Metrics Calculation
  const activeFactoriesCount = factories.filter((f) => f.models_count > 0).length;
  const totalFactoriesCount = factories.length;
  const totalModelsCount = factories.reduce((sum, f) => sum + (f.models_count || 0), 0);
  const totalVersionsCount = versions.length;



  const metricValues = versions
    .map((v) => v[selectedMetric])
    .filter((val) => val !== null && val !== undefined) as number[];
  const peakMetricValue = metricValues.length > 0 ? Math.max(...metricValues) : 0;

  // Transform data for line chart (Metric Progression over Versions)
  const modelKeys = Array.from(new Set(versions.map((v) => `${v.factory_name} - ${v.model_name}`)));

  const versionGroups: { [key: number]: any } = {};
  versions.forEach((v) => {
    const verNum = v.version_number;
    if (!versionGroups[verNum]) {
      versionGroups[verNum] = { version: `v${verNum}` };
    }
    const key = `${v.factory_name} - ${v.model_name}`;
    const val = v[selectedMetric];
    if (val !== null && val !== undefined) {
      versionGroups[verNum][key] = val;
    }
  });

  const lineChartData = Object.keys(versionGroups)
    .map((k) => versionGroups[Number(k)])
    .sort((a, b) => {
      const aNum = Number(a.version.replace('v', ''));
      const bNum = Number(b.version.replace('v', ''));
      return aNum - bNum;
    });



  const PALETTE = [
    theme.primary,
    theme.secondary,
    theme.success,
    theme.warning,
    theme.error,
    theme.info,
    '#f97316',
    '#ec4899',
    '#8b5cf6',
    '#10b981'
  ];

  const hasChartData = versions.length > 0;
  const metricLabel = t(`versionDetails.${selectedMetric === 'f1_score' ? 'f1Score' : selectedMetric}`);

  if (loading) {
    return (
      <Box sx={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", bgcolor: theme.background }}>
        <CircularProgress size={40} sx={{ color: theme.primary }} />
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: theme.background, pb: 10 }}>
      {/* Fixed radial bg */}
      <Box sx={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: -1,
        background: `
          radial-gradient(circle at 85% 5%, ${alpha(theme.primary, 0.05)} 0%, transparent 40%),
          radial-gradient(circle at 5% 40%, ${alpha(theme.secondary, 0.05)} 0%, transparent 40%)
        `,
      }} />

      <Container maxWidth={false}>
        {/* Header Section */}
        <Box sx={{ pt: 6, pb: 6 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} spacing={3}>
            <Box>
              <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
                <IconButton
                  onClick={() => navigate("/algorithms")}
                  sx={{
                    bgcolor: theme.paper,
                    border: `1px solid ${theme.border}`,
                    "&:hover": { bgcolor: theme.primaryLight, color: theme.primary }
                  }}
                >
                  <ArrowBackIcon fontSize="small" sx={{ color: theme.textMain }} />
                </IconButton>

                <Breadcrumbs separator={<NavigateNextIcon fontSize="small" sx={{ color: theme.textSecondary }} />} aria-label="breadcrumb">
                  <Link
                    underline="hover"
                    onClick={() => navigate("/algorithms")}
                    sx={{ cursor: 'pointer', display: 'flex', alignItems: 'center', fontWeight: 500, fontSize: '1.2rem', color: theme.textSecondary }}
                  >
                    {t('factoryList.algorithms', 'Algorithms')}
                  </Link>
                  <Link
                    underline="hover"
                    onClick={() => navigate("/algorithms")}
                    sx={{ cursor: 'pointer', display: 'flex', alignItems: 'center', fontWeight: 500, fontSize: '1.2rem', color: theme.textSecondary }}
                  >
                    {algorithmName}
                  </Link>
                  <Typography fontWeight={700} sx={{ fontSize: '1.2rem', color: theme.textMain }}>{t('factoryList.factories', 'Factories')}</Typography>
                </Breadcrumbs>
              </Stack>
              <Typography variant="h3" fontWeight={900} sx={{
                letterSpacing: '-0.03em', mb: 1,
                background: `linear-gradient(135deg, ${theme.textMain} 0%, ${theme.textSecondary} 100%)`,
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              }}>
                {algorithmName} <Box component="span" sx={{ color: theme.primary }}>Dashboard</Box>
              </Typography>
              <Typography variant="body1" sx={{ color: theme.textMuted, mt: 1, fontWeight: 500 }}>
                {t('factoryList.dashboardDesc', 'Comprehensive algorithm overview, version progression, and comparison across all deployed factories.')}
              </Typography>
            </Box>
            <Stack direction="row" spacing={2} sx={{ width: { xs: '100%', md: 'auto' }, justifyContent: 'flex-end' }}>
              <Button
                variant="outlined"
                onClick={scrollToFactories}
                sx={{
                  borderRadius: "14px",
                  fontWeight: 700,
                  fontSize: "1rem",
                  px: 3,
                  py: 1.5,
                  textTransform: 'none',
                  border: `1px solid ${theme.border}`,
                  color: theme.primary,
                  borderColor: alpha(theme.primary, 0.5),
                  bgcolor: alpha(theme.primary, 0.05),
                  '&:hover': { bgcolor: alpha(theme.primary, 0.1), borderColor: theme.primary },
                }}
              >
                {t('factoryList.manageFactories', 'Manage Factories')}
              </Button>
              <Button
                variant="outlined"
                startIcon={reportLoading ? <CircularProgress size={14} sx={{ color: theme.success }} /> : <DownloadIcon />}
                onClick={handleDownloadReport}
                disabled={reportLoading}
                sx={{
                  borderRadius: "14px",
                  fontWeight: 700,
                  fontSize: "1rem",
                  px: 3,
                  py: 1.5,
                  textTransform: 'none',
                  border: `1px solid ${theme.border}`,
                  color: theme.success,
                  borderColor: alpha(theme.success, 0.5),
                  bgcolor: alpha(theme.success, 0.05),
                  '&:hover': { bgcolor: alpha(theme.success, 0.1), borderColor: theme.success },
                }}
              >
                {reportLoading ? t('factoryOverview.generating', 'Generating…') : t('algorithmList.downloadReport', 'Download Report')}
              </Button>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => navigate("/factories/create", { state: { algorithmId } })}
                sx={{
                  bgcolor: theme.primary,
                  borderRadius: "14px",
                  px: 4,
                  py: 1.5,
                  fontWeight: 800,
                  textTransform: "none",
                  boxShadow: `0 10px 15px -3px ${alpha(theme.primary, 0.3)}`,
                  "&:hover": { bgcolor: "#4338CA", transform: "translateY(-2px)" },
                  transition: "all 0.2s",
                }}
              >
                {t('factoryList.newFactory', 'New Factory')}
              </Button>
            </Stack>
          </Stack>
        </Box>

        {/* KPI Scorecards Row */}
        <Grid container spacing={3} sx={{ mb: 6 }}>
          {[
            {
              title: t('dashboard.kpiFactories', 'Active Factories'),
              value: `${activeFactoriesCount} / ${totalFactoriesCount}`,
              icon: <FactoryIcon sx={{ fontSize: 24 }} />,
              color: theme.primary,
              sub: t('factoryList.activeFactoriesSub', 'Sites running this algorithm')
            },
            {
              title: t('dashboard.kpiModels', 'Deployments'),
              value: totalModelsCount,
              icon: <HubIcon sx={{ fontSize: 24 }} />,
              color: theme.warning,
              sub: t('factoryList.totalModelsSub', 'Total active models')
            },
            {
              title: t('dashboard.kpiActiveVersions', 'Total Versions'),
              value: totalVersionsCount,
              icon: <ScienceIcon sx={{ fontSize: 24 }} />,
              color: theme.success,
              sub: t('factoryList.totalVersionsSub', 'Algorithm iterations')
            },
            {
              title: t('dashboard.peakMetric', 'Peak {{metric}}', { metric: metricLabel }),
              value: peakMetricValue > 0 ? `${peakMetricValue.toFixed(1)}%` : 'N/A',
              icon: <WorkspacePremiumIcon sx={{ fontSize: 24 }} />,
              color: theme.primary,
              sub: t('factoryList.peakMetricSub', 'Top version {{metric}}', { metric: metricLabel.toLowerCase() })
            }
          ].map((card, idx) => (
            <Grid size={{ xs: 12, sm: 6, md: 3 }} key={idx}>
              <Paper
                elevation={0}
                sx={{
                  borderRadius: '24px',
                  border: `1px solid ${alpha(theme.border, 0.4)}`,
                  bgcolor: mode === 'dark' ? alpha(theme.paper, 0.8) : alpha(theme.paper, 0.5),
                  backdropFilter: 'blur(20px)',
                  p: 3,
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3,
                  boxShadow: mode === 'dark'
                    ? '0 8px 32px -8px rgba(0,0,0,0.5)'
                    : `0 8px 32px -8px ${alpha('#000', 0.06)}`,
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    boxShadow: mode === 'dark'
                      ? '0 12px 48px -10px rgba(0,0,0,0.7)'
                      : `0 12px 40px -10px ${alpha('#000', 0.1)}`,
                    borderColor: alpha(card.color, 0.3),
                    transform: 'translateY(-2px)'
                  }
                }}
              >
                <Box
                  sx={{
                    p: 2,
                    borderRadius: '16px',
                    bgcolor: alpha(card.color, 0.1),
                    color: card.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: `inset 0 0 0 1px ${alpha(card.color, 0.15)}`
                  }}
                >
                  {card.icon}
                </Box>
                <Box minWidth={0}>
                  <Typography
                    variant="caption"
                    fontWeight={750}
                    sx={{ color: theme.textMuted, textTransform: 'uppercase', letterSpacing: 1.1, display: 'block', mb: 0.5 }}
                  >
                    {card.title}
                  </Typography>
                  <Typography variant="h4" fontWeight={900} sx={{ color: theme.textMain, lineHeight: 1.1, mb: 0.5 }}>
                    {card.value}
                  </Typography>
                  <Typography variant="caption" sx={{ color: theme.textMuted, display: 'block' }}>
                    {card.sub}
                  </Typography>
                </Box>
              </Paper>
            </Grid>
          ))}
        </Grid>

        {/* Comparative Charts Section */}
        {hasChartData ? (
          <>
            <Box sx={{ mb: 4, display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
              <Typography variant="body2" sx={{ mr: 2, fontWeight: 700, color: theme.textSecondary }}>
                {t('factoryList.selectMetric', 'Metric:')}
              </Typography>
              <ToggleButtonGroup
                value={selectedMetric}
                exclusive
                onChange={(_, newMetric) => {
                  if (newMetric) setSelectedMetric(newMetric);
                }}
                size="small"
                sx={{
                  bgcolor: alpha(theme.border, 0.05),
                  p: 0.5,
                  borderRadius: '12px',
                  border: `1px solid ${theme.border}`,
                  '& .MuiToggleButton-root': {
                    border: 'none',
                    borderRadius: '8px',
                    px: 2.5,
                    py: 0.75,
                    textTransform: 'none',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    color: theme.textSecondary,
                    '&.Mui-selected': {
                      bgcolor: theme.primary,
                      color: '#fff',
                      '&:hover': {
                        bgcolor: alpha(theme.primary, 0.9),
                      },
                    },
                    '&:hover': {
                      bgcolor: alpha(theme.primary, 0.05),
                    },
                  },
                }}
              >
                <ToggleButton value="accuracy">{t('versionDetails.accuracy', 'Accuracy')}</ToggleButton>
                <ToggleButton value="precision">{t('versionDetails.precision', 'Precision')}</ToggleButton>
                <ToggleButton value="recall">{t('versionDetails.recall', 'Recall')}</ToggleButton>
                <ToggleButton value="f1_score">{t('versionDetails.f1Score', 'F1 Score')}</ToggleButton>
              </ToggleButtonGroup>
            </Box>
            <Grid container spacing={4} sx={{ mb: 6 }}>
              {/* Accuracy Progression Line Chart */}
              <Grid size={{ xs: 12 }}>
                <Paper
                  elevation={0}
                  sx={{
                    borderRadius: '24px',
                    border: `1px solid ${alpha(theme.border, 0.4)}`,
                    bgcolor: mode === 'dark' ? alpha(theme.paper, 0.8) : alpha(theme.paper, 0.5),
                    backdropFilter: 'blur(20px)',
                    p: 3,
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column'
                  }}
                >
                  <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
                    <Box sx={{ p: 1, bgcolor: alpha(theme.primary, 0.1), borderRadius: '12px', color: theme.primary, display: 'flex' }}>
                      <TrendingUpIcon />
                    </Box>
                    <Box>
                      <Typography variant="h6" fontWeight={800} sx={{ color: theme.textMain }}>
                        {t('factoryList.metricEvolution', 'Model {{metric}} Evolution', { metric: metricLabel })}
                      </Typography>
                      <Typography variant="caption" sx={{ color: theme.textMuted }}>
                        {t('factoryList.metricEvolutionSub', '{{metric}} progression across sequential versions', { metric: metricLabel })}
                      </Typography>
                    </Box>
                  </Stack>

                  <Box sx={{ height: 320, width: '100%', mt: 'auto' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={lineChartData} margin={{ top: 10, right: 10, bottom: 5, left: -20 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={alpha(theme.border, 0.2)} />
                        <XAxis
                          dataKey="version"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: theme.textMuted, fontSize: 11, fontWeight: 600 }}
                        />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: theme.textMuted, fontSize: 11, fontWeight: 600 }}
                          domain={[0, 100]}
                          allowDecimals={false}
                        />
                        <ReTooltip
                          contentStyle={{
                            borderRadius: 16,
                            border: `1px solid ${alpha(theme.border, 0.5)}`,
                            boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
                            backgroundColor: alpha(theme.paper, 0.9),
                            backdropFilter: 'blur(12px)',
                            padding: '10px 14px'
                          }}
                          itemStyle={{ fontWeight: 700 }}
                          labelStyle={{ color: theme.textMuted, fontWeight: 600, fontSize: 11 }}
                          formatter={(v: any, name: any) => [`${Number(v).toFixed(1)}%`, name]}
                          cursor={{ stroke: theme.textMuted, strokeWidth: 1, strokeDasharray: '4 4' }}
                        />
                        <Legend
                          iconType="circle"
                          iconSize={8}
                          formatter={(value) => <span style={{ color: theme.textSecondary, fontSize: 11, fontWeight: 600 }}>{value}</span>}
                        />
                        {modelKeys.map((key, i) => (
                          <Line
                            key={key}
                            type="monotone"
                            dataKey={key}
                            name={key}
                            stroke={PALETTE[i % PALETTE.length]}
                            strokeWidth={3}
                            dot={{ r: 4, strokeWidth: 2, fill: theme.paper }}
                            activeDot={{ r: 6, strokeWidth: 0 }}
                            connectNulls
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </Box>
                </Paper>
              </Grid>
            </Grid>
          </>
        ) : (
          <Paper
            elevation={0}
            sx={{
              borderRadius: '24px',
              border: `1px solid ${alpha(theme.border, 0.4)}`,
              bgcolor: mode === 'dark' ? alpha(theme.paper, 0.8) : alpha(theme.paper, 0.5),
              backdropFilter: 'blur(20px)',
              p: 4,
              mb: 6,
              textAlign: 'center'
            }}
          >
            <ScienceIcon sx={{ fontSize: 48, color: alpha(theme.textMuted, 0.4), mb: 2 }} />
            <Typography variant="h6" fontWeight={750} sx={{ color: theme.textMain, mb: 1 }}>
              {t('factoryList.noDashboardData', 'No version data for analytics')}
            </Typography>
            <Typography variant="body2" sx={{ color: theme.textMuted, maxWidth: 500, mx: 'auto' }}>
              {t('factoryList.noDashboardDataSub', 'Once model versions are uploaded and metrics are populated inside factories, this algorithm dashboard will display comparative line and bar charts.')}
            </Typography>
          </Paper>
        )}



        {/* Section Header for Factories */}
        <Typography ref={factoriesSectionRef} variant="h6" fontWeight={800} sx={{ color: theme.textMain, mb: 3, scrollMarginTop: "32px" }}>
          {t('factoryList.productionSites', 'Production Sites')}
        </Typography>


        {/* Main Grid */}
        {filteredFactories.length === 0 ? (
          <Box sx={{ py: 10, textAlign: 'center', bgcolor: alpha(theme.paper, 0.5), borderRadius: '32px', border: `2px dashed ${theme.border}` }}>
            <FactoryIcon sx={{ fontSize: 64, color: alpha(theme.textMuted, 0.2), mb: 2 }} />
            <Typography variant="h6" fontWeight={700} color={theme.textMain}>{t('factoryList.noFactories', 'No factories match your search')}</Typography>
            <Typography variant="body2" color={theme.textMuted}>{t('factoryList.noFactoriesSub', 'Try adjusting your filters or create a new cluster.')}</Typography>
          </Box>
        ) : (
          <Grid container spacing={4}>
            {filteredFactories.map((factory) => (
              <Grid size={{ xs: 12, md: 6, lg: 4 }} key={factory.id}>
                <Card
                  elevation={0}
                  sx={{
                    borderRadius: "24px",
                    border: `1px solid ${theme.border}`,
                    height: "100%",
                    bgcolor: theme.paper,
                    cursor: "pointer",
                    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                    "&:hover": {
                      borderColor: theme.primary,
                      boxShadow: `0 20px 25px -5px ${alpha("#000", 0.05)}`,
                      "& .arrow-icon": { opacity: 1, transform: "translateX(0)" }
                    }
                  }}
                  onClick={() => navigate(`/algorithms/${algorithmId}/factories/${factory.id}/models`)}
                >
                  <Box sx={{ px: 3, pt: 3, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Box sx={{ p: 1, bgcolor: alpha(theme.primary, 0.1), borderRadius: "10px", display: 'flex' }}>
                      <FactoryIcon sx={{ color: theme.primary, fontSize: 20 }} />
                    </Box>
                    <IconButton
                      size="small"
                      onClick={(e) => handleRemoveFactory(e, factory)}
                      sx={{ 
                        color: alpha(theme.danger, 0.7),
                        "&:hover": { bgcolor: alpha(theme.danger, 0.1) }
                      }}
                      title="Remove Factory from Algorithm"
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>

                  <CardContent sx={{ p: 3 }}>
                    <Typography variant="h5" fontWeight={600} sx={{ color: theme.textMain, mb: 1 }}>
                      {factory.name}
                    </Typography>

                    <Typography variant="body2" sx={{ color: theme.textMuted, mb: 3, minHeight: 40, lineHeight: 1.6 }}>
                      {factory.description || t('factoryList.noSummary', 'No summary provided for this factory.')}
                    </Typography>

                    <Stack direction="row" spacing={1.5} sx={{ mb: 3 }}>
                      <Chip
                        icon={<HubIcon sx={{ fontSize: '14px !important' }} />}
                        label={t('factoryList.models', '{{count}} Models', { count: factory.models_count })}
                        size="small"
                        sx={{ bgcolor: alpha(theme.warning, 0.08), color: theme.warning, fontWeight: 700, borderRadius: '8px' }}
                      />
                    </Stack>

                    <Divider sx={{ mb: 2, borderColor: alpha(theme.border, 0.5) }} />

                    <Box sx={{ display: "flex", justifyContent: "flex-end", alignItems: "center" }}>
                      <Box
                        className="arrow-icon"
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          color: theme.primary,
                          gap: 0.5,
                          p: 0.5,
                          borderRadius: '4px',
                          opacity: 0,
                          transform: "translateX(-10px)",
                          transition: "all 0.3s",
                          '&:hover': {
                            bgcolor: alpha(theme.primary, 0.1)
                          }
                        }}
                      >
                        <Typography variant="button" fontWeight={800} sx={{ fontSize: '0.7rem' }}>ENTER</Typography>
                        <ArrowForwardIcon sx={{ fontSize: 16 }} />
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </Container>

      {/* Remove Confirmation Dialog */}
      <Dialog
        open={removeOpen}
        onClose={() => !removeLoading && setRemoveOpen(false)}
        PaperProps={{ sx: { borderRadius: "28px", p: 1, maxWidth: 400, bgcolor: theme.paper } }}
      >
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <Box sx={{
            width: 64,
            height: 64,
            borderRadius: '20px',
            bgcolor: alpha(theme.danger, 0.1),
            color: theme.danger,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mx: 'auto',
            mb: 2
          }}>
            <WarningAmberIcon sx={{ fontSize: 32 }} />
          </Box>
          <Typography variant="h5" fontWeight={900} sx={{ color: theme.textMain, mb: 1 }}>
            {t('factoryList.removeConfirmTitle', 'Remove Factory?')}
          </Typography>
          <Typography variant="body2" sx={{ color: theme.textMuted, lineHeight: 1.6 }}>
            {t('factoryList.removeConfirmDesc', 'Are you sure you want to remove')} <strong>{factoryToRemove?.name}</strong> {t('factoryList.removeConfirmFromAlgo', 'from this algorithm?')} {t('factoryList.removeConfirmWarning', 'This will delete all models and versions for this algorithm at this factory. Other algorithms will not be affected.')}
          </Typography>
        </Box>
        <DialogActions sx={{ p: 3, justifyContent: 'center', gap: 2 }}>
          <Button
            fullWidth
            onClick={() => setRemoveOpen(false)}
            disabled={removeLoading}
            sx={{ color: theme.textMuted, fontWeight: 800, textTransform: 'none', py: 1.2, borderRadius: '12px', border: `1px solid ${theme.border}` }}
          >
            {t('factoryList.keepFactory', 'Keep Factory')}
          </Button>
          <Button
            fullWidth
            onClick={confirmRemoveFactory}
            variant="contained"
            disabled={removeLoading}
            sx={{
              bgcolor: theme.danger,
              borderRadius: '12px',
              fontWeight: 800,
              textTransform: 'none',
              py: 1.2,
              "&:hover": { bgcolor: "#DC2626" },
              boxShadow: `0 8px 16px -4px ${alpha(theme.danger, 0.4)}`
            }}
          >
            {removeLoading ? <CircularProgress size={24} color="inherit" /> : t('factoryList.yesRemove', 'Yes, Remove')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
