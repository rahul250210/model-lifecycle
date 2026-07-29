"use client";

import React, { useEffect, useRef, useState } from "react";
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
  DialogContent,
  DialogTitle,
  MenuItem,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import FactoryIcon from "@mui/icons-material/Factory";
import HubIcon from "@mui/icons-material/Hub";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import NavigateNextIcon from "@mui/icons-material/NavigateNext";
import SortIcon from "@mui/icons-material/Sort";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import FileUploadIcon from "@mui/icons-material/FileUpload";
import InteractiveBreadcrumbs from "../../components/InteractiveBreadcrumbs";
import DeleteIcon from "@mui/icons-material/Delete";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import EditIcon from "@mui/icons-material/Edit";
import CloseIcon from "@mui/icons-material/Close";

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

import type { Factory } from '../../types';

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
  const [iniConfig, setIniConfig] = useState<string | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<"accuracy" | "precision" | "recall" | "f1_score">("accuracy");

  // Link Factory Dialog States
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkLoading, setLinkLoading] = useState(false);
  const [allFactories, setAllFactories] = useState<Factory[]>([]);
  const [selectedLinkFactoryId, setSelectedLinkFactoryId] = useState<number | "">("");
  const [linkDescription, setLinkDescription] = useState("");

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

  const handleOpenLinkDialog = async () => {
    try {
      setLinkOpen(true);
      const res = await axios.get("/factories/");
      const existingIds = new Set(factories.map((f) => f.id));
      setAllFactories(res.data.filter((f: Factory) => !existingIds.has(f.id)));
    } catch (err) {
      console.error("Failed to load all factories", err);
    }
  };

  const handleLinkFactory = async () => {
    if (!selectedLinkFactoryId) return;
    try {
      setLinkLoading(true);
      await axios.post(`/algorithms/${algorithmId}/factories/${selectedLinkFactoryId}/link`, {
        description: linkDescription || null
      });
      toast.success(t('factoryList.linkSuccess', 'Factory linked successfully'));
      setLinkOpen(false);
      setSelectedLinkFactoryId("");
      setLinkDescription("");
      fetchData();
    } catch (err) {
      console.error("Failed to link factory", err);
      toast.error(t('factoryList.linkFail', 'Failed to link factory. Please try again.'));
    } finally {
      setLinkLoading(false);
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
        if (algoRes.data.ini_config) setIniConfig(algoRes.data.ini_config);
      }
    } catch (err) {
      console.error("Failed to load factories for algorithm", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    
    const handleEntityCreated = () => {
      fetchData();
    };
    window.addEventListener("entityCreated", handleEntityCreated);
    return () => window.removeEventListener("entityCreated", handleEntityCreated);
  }, [algorithmId]);

  const filteredFactories = factories;

  // KPI Metrics Calculation
  const activeFactoriesCount = factories.filter((f) => (f.models_count || 0) > 0).length;
  const totalFactoriesCount = factories.length;
  const totalModelsCount = factories.reduce((sum, f) => sum + (f.models_count || 0), 0);
  const totalVersionsCount = versions.length;

  const [parsedIni, setParsedIni] = useState<{ section: string; pairs: { key: string, value: string, meaning: string }[] }[]>([]);
  const [savingIni, setSavingIni] = useState(false);
  const [isEditingIni, setIsEditingIni] = useState(false);

  useEffect(() => {
    if (iniConfig) {
      const lines = iniConfig.split('\n');
      const result: { section: string; pairs: { key: string, value: string, meaning: string }[] }[] = [];
      let currentSection = { section: 'Global', pairs: [] as { key: string, value: string, meaning: string }[] };
      let lastComment = "";
      
      lines.forEach(line => {
        const trimmed = line.trim();
        if (!trimmed) {
          lastComment = "";
          return;
        }
        if (trimmed.startsWith(';') || trimmed.startsWith('#')) {
          lastComment = trimmed.substring(1).trim();
          return;
        }
        
        if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
          if (currentSection.pairs.length > 0) result.push(currentSection);
          currentSection = { section: trimmed.slice(1, -1), pairs: [] };
          lastComment = "";
        } else {
          const idx = trimmed.indexOf('=');
          if (idx > 0) {
            currentSection.pairs.push({
              key: trimmed.substring(0, idx).trim(),
              value: trimmed.substring(idx + 1).trim(),
              meaning: lastComment
            });
            lastComment = "";
          }
        }
      });
      if (currentSection.pairs.length > 0) result.push(currentSection);
      setParsedIni(result);
    }
  }, [iniConfig]);

  const handleSaveIni = async () => {
    try {
      setSavingIni(true);
      let newIni = "";
      parsedIni.forEach(sec => {
        newIni += `[${sec.section}]\n`;
        sec.pairs.forEach(p => {
          if (p.meaning) newIni += `# ${p.meaning}\n`;
          newIni += `${p.key}=${p.value}\n`;
        });
        newIni += "\n";
      });
      
      await axios.put(`/algorithms/${algorithmId}`, {
        name: algorithmName,
        ini_config: newIni.trim()
      });
      
      setIniConfig(newIni.trim());
      setIniConfig(newIni.trim());
      setIsEditingIni(false);
      toast.success(t('factoryList.iniSaveSuccess', 'INI Configuration updated successfully'));
    } catch (err) {
      console.error(err);
      toast.error(t('factoryList.iniSaveFail', 'Failed to save INI configuration'));
    } finally {
      setSavingIni(false);
    }
  };

  const cancelIniEdit = () => {
    setIsEditingIni(false);
    if (iniConfig) {
      const lines = iniConfig.split('\n');
      const result: { section: string; pairs: { key: string, value: string, meaning: string }[] }[] = [];
      let currentSection = { section: 'Global', pairs: [] as { key: string, value: string, meaning: string }[] };
      let lastComment = "";
      
      lines.forEach(line => {
        const trimmed = line.trim();
        if (!trimmed) { lastComment = ""; return; }
        if (trimmed.startsWith(';') || trimmed.startsWith('#')) { lastComment = trimmed.substring(1).trim(); return; }
        if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
          if (currentSection.pairs.length > 0) result.push(currentSection);
          currentSection = { section: trimmed.slice(1, -1), pairs: [] };
          lastComment = "";
        } else {
          const idx = trimmed.indexOf('=');
          if (idx > 0) {
            currentSection.pairs.push({ key: trimmed.substring(0, idx).trim(), value: trimmed.substring(idx + 1).trim(), meaning: lastComment });
            lastComment = "";
          }
        }
      });
      if (currentSection.pairs.length > 0) result.push(currentSection);
      setParsedIni(result);
    }
  };




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

  const updateMeaning = (sIdx: number, pIdx: number, newMeaning: string) => {
    const newParsedIni = [...parsedIni];
    newParsedIni[sIdx].pairs[pIdx].meaning = newMeaning;
    setParsedIni(newParsedIni);
  };

  const updateKey = (sIdx: number, pIdx: number, newKey: string) => {
    const newParsedIni = [...parsedIni];
    newParsedIni[sIdx].pairs[pIdx].key = newKey;
    setParsedIni(newParsedIni);
  };

  const updateValue = (sIdx: number, pIdx: number, newValue: string) => {
    const newParsedIni = [...parsedIni];
    newParsedIni[sIdx].pairs[pIdx].value = newValue;
    setParsedIni(newParsedIni);
  };

  const addParameter = (sIdx: number) => {
    const newParsedIni = [...parsedIni];
    newParsedIni[sIdx].pairs.push({ key: "NewParam", value: "", meaning: "" });
    setParsedIni(newParsedIni);
  };

  const removeParameter = (sIdx: number, pIdx: number) => {
    const newParsedIni = [...parsedIni];
    newParsedIni[sIdx].pairs.splice(pIdx, 1);
    setParsedIni(newParsedIni);
  };

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

                <InteractiveBreadcrumbs 
                  path={[
                    { label: t('factoryList.algorithms', 'Algorithms'), link: '/algorithms', type: 'root' },
                    { label: algorithmName, link: `/algorithms/${algorithmId}/factories`, type: 'algorithm', id: algorithmId }
                  ]}
                />
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
                variant="outlined"
                startIcon={<FactoryIcon />}
                onClick={handleOpenLinkDialog}
                sx={{
                  borderRadius: "14px",
                  px: 4,
                  py: 1.5,
                  fontWeight: 800,
                  textTransform: "none",
                  border: `1px solid ${theme.border}`,
                  color: theme.primary,
                  "&:hover": { bgcolor: alpha(theme.primary, 0.1), borderColor: theme.primary },
                  transition: "all 0.2s",
                }}
              >
                Use Existing Factory
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

        {/* Section Header for Factories */}
        <Typography ref={factoriesSectionRef} variant="h6" fontWeight={800} sx={{ color: theme.textMain, mb: 3, scrollMarginTop: "32px" }}>
          {t('factoryList.productionSites', 'Production Sites')}
        </Typography>

        {/* Main Grid */}
        {filteredFactories.length === 0 ? (
          <Box sx={{ py: 10, textAlign: 'center', bgcolor: alpha(theme.paper, 0.5), borderRadius: '32px', border: `2px dashed ${theme.border}`, mb: 6 }}>
            <FactoryIcon sx={{ fontSize: 64, color: alpha(theme.textMuted, 0.2), mb: 2 }} />
            <Typography variant="h6" fontWeight={700} color={theme.textMain}>{t('factoryList.noFactories', 'No factories match your search')}</Typography>
            <Typography variant="body2" color={theme.textMuted}>{t('factoryList.noFactoriesSub', 'Try adjusting your filters or create a new cluster.')}</Typography>
          </Box>
        ) : (
          <Grid container spacing={4} sx={{ mb: 6 }}>
            {filteredFactories.map((factory) => (
              <Grid size={{ xs: 12, md: 6, lg: 4 }} key={factory.id}>
                <Card
                  onClick={() => navigate(`/algorithms/${algorithmId}/factories/${factory.id}/models`)}
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
                      transform: "translateY(-4px)"
                    }
                  }}
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
                          opacity: 1,
                          transform: "translateX(0)",
                          transition: "all 0.3s",
                          cursor: 'pointer',
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




        {/* INI Configuration Section */}
        {parsedIni && parsedIni.length > 0 && (
          <Paper
            elevation={0}
            sx={{
              mb: 6,
              p: 4,
              borderRadius: '24px',
              border: `1px solid ${theme.border}`,
              bgcolor: mode === 'dark' ? alpha(theme.paper, 0.4) : alpha(theme.paper, 0.7),
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h6" fontWeight={800} sx={{ color: theme.textMain }}>
                {t('factoryList.iniConfig', 'INI Configuration')}
              </Typography>
              <Box sx={{ display: 'flex', gap: 2 }}>
                {isEditingIni ? (
                  <>
                    <Button 
                      variant="outlined" 
                      onClick={cancelIniEdit} 
                      disabled={savingIni}
                      sx={{ 
                        color: theme.textMuted,
                        borderColor: alpha(theme.border, 0.5),
                        borderRadius: '8px', 
                        textTransform: 'none', 
                        fontWeight: 600,
                        px: 3 
                      }}
                    >
                      {t('factoryList.cancel', 'Cancel')}
                    </Button>
                    <Button 
                      variant="contained" 
                      onClick={handleSaveIni} 
                      disabled={savingIni}
                      sx={{ 
                        bgcolor: theme.primary, 
                        color: '#fff', 
                        borderRadius: '8px', 
                        textTransform: 'none', 
                        fontWeight: 600,
                        px: 3 
                      }}
                    >
                      {savingIni ? t('factoryList.saving', 'Saving...') : t('factoryList.saveChanges', 'Save Changes')}
                    </Button>
                  </>
                ) : (
                  <Button 
                    variant="contained" 
                    startIcon={<EditIcon />}
                    onClick={() => setIsEditingIni(true)} 
                    sx={{ 
                      bgcolor: theme.paper, 
                      color: theme.primary,
                      border: `1px solid ${theme.border}`,
                      borderRadius: '8px', 
                      textTransform: 'none', 
                      fontWeight: 600,
                      px: 3,
                      boxShadow: 'none',
                      '&:hover': {
                        bgcolor: alpha(theme.primary, 0.05),
                        boxShadow: 'none',
                      }
                    }}
                  >
                    {t('factoryList.editConfig', 'Edit Configuration')}
                  </Button>
                )}
              </Box>
            </Box>
            
            <TableContainer component={Paper} elevation={0} sx={{ 
              borderRadius: '20px', 
              border: `1px solid ${alpha(theme.primary, 0.15)}`, 
              bgcolor: mode === 'dark' ? alpha(theme.primary, 0.02) : '#fff',
              boxShadow: mode === 'dark' ? '0 10px 40px -10px rgba(0,0,0,0.5)' : `0 10px 40px -10px ${alpha(theme.primary, 0.1)}`,
              overflow: 'hidden'
            }}>
              <Table sx={{ minWidth: 650 }}>
                <TableHead sx={{ bgcolor: alpha(theme.primary, 0.06), borderBottom: `2px solid ${alpha(theme.primary, 0.1)}` }}>
                  <TableRow>
                    <TableCell sx={{ color: theme.primary, fontWeight: 900, width: isEditingIni ? '25%' : '30%', py: 2.5, letterSpacing: 1 }}>PARAMETER</TableCell>
                    <TableCell sx={{ color: theme.primary, fontWeight: 900, width: isEditingIni ? '40%' : '50%', py: 2.5, letterSpacing: 1 }}>MEANING</TableCell>
                    <TableCell align="right" sx={{ color: theme.primary, fontWeight: 900, width: isEditingIni ? '25%' : '20%', py: 2.5, letterSpacing: 1 }}>VALUE</TableCell>
                    {isEditingIni && <TableCell sx={{ width: '10%', py: 2.5 }}></TableCell>}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {parsedIni.map((section, sIdx) => (
                    <React.Fragment key={sIdx}>

                      
                      {/* Parameters Rows */}
                      {section.pairs.map((pair, pIdx) => (
                        <TableRow key={pIdx} hover sx={{ transition: 'all 0.2s', '&:last-child td, &:last-child th': { border: 0 } }}>
                          <TableCell sx={{ verticalAlign: 'middle', borderBottom: `1px solid ${alpha(theme.border, 0.3)}` }}>
                            {isEditingIni ? (
                              <TextField
                                size="small"
                                fullWidth
                                placeholder="Key"
                                value={pair.key}
                                onChange={(e) => updateKey(sIdx, pIdx, e.target.value)}
                                sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px', bgcolor: theme.background, color: theme.textMain, '& input': { p: 1.5, fontSize: '0.85rem', fontWeight: 600, fontFamily: 'monospace', color: theme.textMain } } }}
                              />
                            ) : (
                              <Typography variant="body2" sx={{ color: theme.textSecondary, fontWeight: 700, wordBreak: 'break-all' }}>{pair.key}</Typography>
                            )}
                          </TableCell>
                          
                          <TableCell sx={{ verticalAlign: 'middle', borderBottom: `1px solid ${alpha(theme.border, 0.3)}` }}>
                            {isEditingIni ? (
                              <TextField
                                size="small"
                                fullWidth
                                placeholder="Add parameter description..."
                                value={pair.meaning}
                                onChange={(e) => updateMeaning(sIdx, pIdx, e.target.value)}
                                sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px', bgcolor: theme.background, color: theme.textMain, '& input': { p: 1.5, fontSize: '0.85rem', color: theme.textMain } } }}
                              />
                            ) : (
                              <Typography variant="body2" sx={{ color: pair.meaning ? theme.textMain : theme.textMuted, fontStyle: pair.meaning ? 'normal' : 'italic' }}>
                                {pair.meaning || "No description"}
                              </Typography>
                            )}
                          </TableCell>
                          
                          <TableCell align="right" sx={{ verticalAlign: 'middle', borderBottom: `1px solid ${alpha(theme.border, 0.3)}` }}>
                            {isEditingIni ? (
                              <TextField
                                size="small"
                                fullWidth
                                placeholder="Value"
                                value={pair.value}
                                onChange={(e) => updateValue(sIdx, pIdx, e.target.value)}
                                sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px', bgcolor: theme.background, color: theme.textMain, '& input': { p: 1.5, fontSize: '0.85rem', fontWeight: 600, fontFamily: 'monospace', textAlign: 'right', color: theme.textMain } } }}
                              />
                            ) : (
                              <Typography variant="body2" sx={{ display: 'inline-block', color: theme.textMain, fontFamily: 'monospace', fontWeight: 800, bgcolor: alpha(theme.textMain, 0.05), px: 1.5, py: 1, borderRadius: '6px', wordBreak: 'break-all' }}>
                                {pair.value}
                              </Typography>
                            )}
                          </TableCell>
                          
                          {isEditingIni && (
                            <TableCell align="center" sx={{ verticalAlign: 'middle', borderBottom: `1px solid ${alpha(theme.border, 0.3)}` }}>
                              <IconButton size="small" onClick={() => removeParameter(sIdx, pIdx)} sx={{ color: theme.danger }}>
                                <CloseIcon fontSize="small" />
                              </IconButton>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                      
                      {/* Add Parameter Button Row */}
                      {isEditingIni && (
                        <TableRow>
                          <TableCell colSpan={4} align="center" sx={{ py: 3, borderBottom: `1px solid ${alpha(theme.border, 0.3)}` }}>
                            <Button 
                              variant="outlined"
                              startIcon={<AddIcon />} 
                              onClick={() => addParameter(sIdx)}
                              sx={{ 
                                width: '100%',
                                maxWidth: '300px',
                                color: theme.primary, 
                                borderColor: alpha(theme.primary, 0.4),
                                borderStyle: 'dashed',
                                borderWidth: '2px',
                                fontWeight: 800, 
                                textTransform: 'none', 
                                borderRadius: '12px', 
                                py: 1,
                                '&:hover': { bgcolor: alpha(theme.primary, 0.05), borderColor: theme.primary } 
                              }}
                            >
                              Add Parameter
                            </Button>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  ))}
                  
                  {/* Remove Add New Section */}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        )}
      </Container>

      {/* Link Existing Factory Dialog */}
      <Dialog
        open={linkOpen}
        onClose={() => !linkLoading && setLinkOpen(false)}
        PaperProps={{ sx: { borderRadius: "28px", p: 2, maxWidth: 500, bgcolor: theme.paper, width: "100%" } }}
      >
        <DialogTitle sx={{ fontWeight: 900, color: theme.textMain, display: "flex", alignItems: "center", gap: 1.5 }}>
          <Box sx={{
            width: 48,
            height: 48,
            borderRadius: "16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            bgcolor: alpha(theme.primary, 0.1),
            color: theme.primary,
          }}>
            <FactoryIcon />
          </Box>
          Use Existing Factory
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 3 }}>
          {allFactories.length === 0 ? (
            <Typography variant="body1" sx={{ color: theme.textMuted, p: 2, textAlign: "center", bgcolor: alpha(theme.primary, 0.03), borderRadius: "16px" }}>
              There are no available factories to link. All existing factories are already associated with this algorithm.
            </Typography>
          ) : (
            <>
              <TextField
                select
                fullWidth
                label="Select a Factory"
                value={selectedLinkFactoryId}
                onChange={(e) => {
                  setSelectedLinkFactoryId(Number(e.target.value));
                  const f = allFactories.find(fac => fac.id === Number(e.target.value));
                  if (f) setLinkDescription(f.description || "");
                }}
                SelectProps={{
                  MenuProps: { PaperProps: { sx: { bgcolor: theme.paper, borderRadius: "12px", mt: 1, boxShadow: `0 4px 20px ${alpha("#000", 0.1)}` } } }
                }}
                InputLabelProps={{ sx: { color: theme.textSecondary } }}
                sx={{
                  "& .MuiOutlinedInput-root": { borderRadius: "16px", bgcolor: theme.background },
                  "& .MuiSelect-select": { py: 2 }
                }}
              >
                {allFactories.map((f) => (
                  <MenuItem key={f.id} value={f.id} sx={{ color: theme.textMain, py: 1.5, px: 2 }}>
                    <Typography fontWeight={600}>{f.name}</Typography>
                  </MenuItem>
                ))}
              </TextField>

              {selectedLinkFactoryId !== "" && (
                <TextField
                  fullWidth
                  label="Description (Optional)"
                  value={linkDescription}
                  onChange={(e) => setLinkDescription(e.target.value)}
                  multiline
                  rows={3}
                  placeholder="How is this factory utilized for this algorithm?"
                  InputProps={{ sx: { color: theme.textMain } }}
                  InputLabelProps={{ sx: { color: theme.textSecondary } }}
                  sx={{
                    "& .MuiOutlinedInput-root": { borderRadius: "16px", bgcolor: theme.background }
                  }}
                  helperText={
                    <Typography variant="caption" sx={{ color: theme.textSecondary }}>
                      You can customize the description specifically for this algorithm, keeping the global description intact for others.
                    </Typography>
                  }
                />
              )}
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 1, justifyContent: "flex-end" }}>
          <Button
            onClick={() => setLinkOpen(false)}
            sx={{ color: theme.textMuted, fontWeight: 700, borderRadius: "12px", px: 3, py: 1.2 }}
            disabled={linkLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleLinkFactory}
            variant="contained"
            disabled={!selectedLinkFactoryId || linkLoading}
            sx={{
              bgcolor: theme.primary,
              borderRadius: '12px',
              fontWeight: 800,
              textTransform: 'none',
              px: 4,
              py: 1.2,
              boxShadow: `0 8px 16px -4px ${alpha(theme.primary, 0.4)}`,
              "&:hover": { bgcolor: "#4338CA", transform: "translateY(-1px)" },
              "&:disabled": { bgcolor: alpha(theme.textMuted, 0.2), color: theme.textMuted },
              transition: "all 0.2s"
            }}
          >
            {linkLoading ? <CircularProgress size={24} color="inherit" /> : "Link Factory"}
          </Button>
        </DialogActions>
      </Dialog>

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
