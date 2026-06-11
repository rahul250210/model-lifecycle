"use client";

import { useEffect, useState } from "react";
import {
    Box, Typography, Grid, Button, CircularProgress, Stack, alpha, Paper,
    Divider, List, ListItem, ListItemText, ListItemIcon, Chip, Tooltip, IconButton,
    FormControl, Select, MenuItem
} from "@mui/material";
import {
    Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, ResponsiveContainer,
    Cell, ComposedChart, Area, Line
} from 'recharts';
import { motion } from 'framer-motion';

import {
    ArrowBack, Layers, History, GridView, ArrowForward, Circle,
    FactoryOutlined, AddCircleOutlined, InfoOutlined, Storage, Download
} from '@mui/icons-material';

import { useNavigate, useParams } from "react-router-dom";
import { useTheme } from "../../theme/ThemeContext";
import axios from "../../api/axios";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";

// ─── Types ───────────────────────────────────────────────────────────────────
interface DashboardData {
    stats: {
        algorithms: number;
        models: number;
        versions: number;
        total_storage_bytes: number;
    };
    distribution: { name: string; value: number }[];
    recent_activity: {
        id: number;
        version: string;
        model_name: string;
        algo_name: string;
        created_at: string;
        link_ids: {
            factory_id: number;
            algo_id: number;
            model_id: number;
            version_id: number;
        }
    }[];
    resource_trends: {
        algorithm: string;
        avg_cpu: number;
        avg_gpu: number;
    }[];
    quadrant_data: {
        version_id: number;
        version_number: number;
        accuracy: number;
        is_active: boolean;
        model_name: string;
        algorithm_name: string;
        size_bytes: number;
        cpu_utilization?: number | null;
        gpu_utilization?: number | null;
    }[];
}

interface Factory {
    id: number;
    name: string;
    description?: string;
}

interface Algorithm {
    id: number;
    name: string;
    description?: string;
    models_count?: number;
    created_at?: string;
    accuracy?: number | null;
}

function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024, sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// ─── Shared paper style matching main dashboard ─────────────────────────────
const paperSx = (theme: any) => ({
    borderRadius: '24px',
    border: `1px solid ${alpha(theme.border, 0.4)}`,
    bgcolor: theme.mode === 'dark' ? alpha(theme.paper, 0.8) : alpha(theme.paper, 0.5),
    backdropFilter: 'blur(20px)',
    boxShadow: theme.mode === 'dark'
        ? '0 8px 32px -8px rgba(0,0,0,0.5)'
        : `0 8px 32px -8px ${alpha('#000', 0.06)}`,
    transition: 'box-shadow 0.3s ease, border-color 0.3s ease, transform 0.3s ease',
    '&:hover': {
        boxShadow: theme.mode === 'dark'
            ? '0 12px 48px -10px rgba(0,0,0,0.7)'
            : `0 12px 40px -10px ${alpha('#000', 0.1)}`,
        borderColor: alpha(theme.primary, 0.3),
    },
});

// ─── Telemetry Score Card with sparklines ────────────────────────────────────
function VitalsCard({ title, value, icon, color, sub, trendData }: any) {
    const { theme } = useTheme();
    return (
        <Paper elevation={0} sx={{
            ...paperSx(theme), p: 2.5,
            display: 'flex', flexDirection: 'column',
            justifyContent: 'space-between', height: '100%'
        }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1.5 }}>
                <Box sx={{
                    p: 1.5, borderRadius: '14px', bgcolor: alpha(color, 0.1), color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: `inset 0 0 0 1px ${alpha(color, 0.15)}`, flexShrink: 0,
                }}>
                    {icon}
                </Box>
                <Box minWidth={0}>
                    <Typography variant="overline" fontWeight={700} sx={{ color: theme.textMuted, letterSpacing: 1.2, display: 'block', lineHeight: 1.2, fontSize: '0.65rem' }}>
                        {title}
                    </Typography>
                    <Typography variant="h5" fontWeight={900} noWrap sx={{ color: theme.textMain, lineHeight: 1.2, mt: 0.3 }}>
                        {value}
                    </Typography>
                </Box>
            </Box>

            <Box sx={{ height: 26, mt: 1, width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendData || []} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
                        <defs>
                            <linearGradient id={`grad-${title.replace(/\s+/g, '')}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={color} stopOpacity={0.25} />
                                <stop offset="100%" stopColor={color} stopOpacity={0.0} />
                            </linearGradient>
                        </defs>
                        <Area type="monotone" dataKey="value" stroke={color} strokeWidth={1.5} fill={`url(#grad-${title.replace(/\s+/g, '')})`} dot={false} activeDot={false} />
                    </AreaChart>
                </ResponsiveContainer>
            </Box>
            <Typography variant="caption" sx={{ color: theme.textMuted, mt: 1.2, fontSize: '0.7rem' }}>{sub}</Typography>
        </Paper>
    );
}

// Imports for Recharts components needed
import { AreaChart } from 'recharts';

export default function FactoryOverview() {
    const { factoryId } = useParams();
    const navigate = useNavigate();
    const { theme, mode } = useTheme();
    const { t } = useTranslation();

    const [factory, setFactory] = useState<Factory | null>(null);
    const [data, setData] = useState<DashboardData | null>(null);
    const [algorithms, setAlgorithms] = useState<Algorithm[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedAlgoFilter, setSelectedAlgoFilter] = useState<string>("All");
    const [reportLoading, setReportLoading] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [factoryRes, dashRes, algosRes] = await Promise.all([
                    axios.get(`/factories/${factoryId}`),
                    axios.get(`/factories/${factoryId}/dashboard`),
                    axios.get(`/factories/${factoryId}/algorithms`),
                ]);
                setFactory(factoryRes.data);
                setData(dashRes.data);
                setAlgorithms(algosRes.data);
            } catch (err) {
                console.error("Failed to load factory dashboard", err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [factoryId]);

    const handleGenerateReport = async () => {
        if (!factory) return;
        setReportLoading(true);
        try {
            const response = await axios.get(`/factories/${factoryId}/report`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            const contentDisposition = response.headers['content-disposition'];
            let filename = `factory_${factory.name.replace(/ /g, '_').toLowerCase()}_report.csv`;
            if (contentDisposition) {
                const match = contentDisposition.match(/filename="?([^"]+)"?/);
                if (match && match[1]) filename = match[1];
            }
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(link);
            toast.success(t('factoryOverview.reportSuccess', 'Report downloaded successfully'));
        } catch (err) {
            console.error('Failed to generate factory report', err);
            toast.error(t('factoryOverview.reportFail', 'Failed to generate report. Please try again.'));
        } finally {
            setReportLoading(false);
        }
    };

    if (loading || !factory || !data) {
        return (
            <Box sx={{ height: '80vh', display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 2 }}>
                <CircularProgress size={42} sx={{ color: theme.primary }} />
                <Typography sx={{ color: theme.textMuted, fontWeight: 500 }}>{t('factoryOverview.loading', 'Loading factory analytics…')}</Typography>
            </Box>
        );
    }

    const COLORS = [theme.primary, theme.secondary, theme.success, theme.warning, theme.error, theme.info, '#ec4899', '#f97316'];

    const algoColors: { [key: string]: string } = {};
    algorithms.forEach((a, idx) => {
        algoColors[a.name] = COLORS[idx % COLORS.length];
    });

    const filteredQuadrantData = selectedAlgoFilter === "All"
        ? data.quadrant_data
        : data.quadrant_data.filter(q => q.algorithm_name === selectedAlgoFilter);

    const sortedQuadrantData = [...(filteredQuadrantData || [])].sort((a, b) => {
        if (a.model_name !== b.model_name) {
            return a.model_name.localeCompare(b.model_name);
        }
        return a.version_number - b.version_number;
    });

    const scatterData = sortedQuadrantData.map(q => {
        const sizeMB = parseFloat((q.size_bytes / 1048576).toFixed(1));
        return {
            name: q.model_name,
            version: `v${q.version_number}`,
            displayName: `${q.model_name} v${q.version_number}`,
            accuracy: q.accuracy,
            size_mb: sizeMB,
            algorithm: q.algorithm_name,
            color: algoColors[q.algorithm_name] || theme.primary,
            is_active: q.is_active
        };
    });

    const activeLanes = (data?.quadrant_data || [])
        .filter(q => q.is_active)
        .map(q => {
            const trend = (data?.resource_trends || []).find(r => r.algorithm === q.algorithm_name);
            return {
                ...q,
                avg_cpu: q.cpu_utilization !== null && q.cpu_utilization !== undefined ? q.cpu_utilization : (trend ? trend.avg_cpu : 0),
                avg_gpu: q.gpu_utilization !== null && q.gpu_utilization !== undefined ? q.gpu_utilization : (trend ? trend.avg_gpu : 0)
            };
        });

    return (
        <Box sx={{ minHeight: '100vh', pb: 10 }}>
            {/* Fixed radial backgrounds for glassmorphic visual pop */}
            <Box sx={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: -1,
                background: `
                    radial-gradient(circle at 85% 5%, ${alpha(theme.primary, 0.05)} 0%, transparent 40%),
                    radial-gradient(circle at 5% 45%, ${alpha(theme.secondary, 0.05)} 0%, transparent 40%)
                `,
            }} />

            <Box sx={{ px: { xs: 2, md: 5 }, maxWidth: "1600px", margin: "0 auto" }}>

                {/* ═══ HERO HEADER ═══ */}
                <Box sx={{ pt: 4, pb: 4, borderBottom: `1px solid ${alpha(theme.border, 0.4)}`, mb: 4 }}>
                    <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} spacing={3}>
                        <Stack direction="row" spacing={2.5} alignItems="center">
                            <Button
                                variant="outlined"
                                startIcon={<ArrowBack />}
                                onClick={() => navigate(-1)}
                                sx={{
                                    borderRadius: '12px', textTransform: 'none', fontWeight: 700, px: 2, py: 1,
                                    color: theme.textSecondary, border: `1px solid ${theme.border}`, bgcolor: alpha(theme.paper, 0.8),
                                    '&:hover': { bgcolor: theme.background, borderColor: theme.textSecondary }
                                }}
                            >
                                {t('factoryOverview.back', 'Back')}
                            </Button>
                            <Box>
                                <Stack direction="row" spacing={1.5} alignItems="center">
                                    <Box sx={{ p: 1, bgcolor: alpha(theme.primary, 0.12), borderRadius: '12px', color: theme.primary, display: 'flex' }}>
                                        <FactoryOutlined />
                                    </Box>
                                    <Typography variant="h4" fontWeight={900} sx={{
                                        letterSpacing: '-0.02em',
                                        background: `linear-gradient(135deg, ${theme.textMain} 0%, ${theme.textSecondary} 100%)`,
                                        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                                    }}>
                                        {factory.name}
                                    </Typography>
                                </Stack>
                                <Typography variant="body2" sx={{ color: theme.textMuted, mt: 0.5, fontWeight: 500 }}>
                                    {factory.description || t('factoryOverview.defaultDesc', 'Operational edge node and hardware virtualization factory pipeline.')}
                                </Typography>
                            </Box>
                        </Stack>

                        <Stack direction="row" spacing={2} sx={{ width: { xs: '100%', md: 'auto' }, justifyContent: 'flex-end' }}>
                            <Button
                                variant="outlined"
                                startIcon={reportLoading ? <CircularProgress size={14} sx={{ color: theme.success }} /> : <Download />}
                                onClick={handleGenerateReport}
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
                                {reportLoading ? t('factoryOverview.generating', 'Generating…') : t('factoryOverview.downloadReport', 'Download Report')}
                            </Button>
                        </Stack>
                    </Stack>
                </Box>



                {/* ═══ VITALS SCORECARDS ═══ */}
                <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
                    <Grid container spacing={3} sx={{ mb: 4 }}>
                        {[
                            { title: t('factoryOverview.algosDeployed', "Algorithms Deployed"), value: data.stats.algorithms, icon: <GridView fontSize="small" />, color: theme.primary, sub: t('factoryOverview.algosSub', "Registered structures"), trend: [3, 4, 4, 5, data.stats.algorithms] },
                            { title: t('factoryOverview.modelsDeployed', "Total Models Deployed"), value: data.stats.models, icon: <Layers fontSize="small" />, color: theme.secondary, sub: t('factoryOverview.modelsSub', "Trained instances"), trend: [12, 14, 18, 20, data.stats.models] },
                            { title: t('factoryOverview.registeredVersions', "Registered Versions"), value: data.stats.versions, icon: <History fontSize="small" />, color: theme.success, sub: t('factoryOverview.versionsSub', "Audit modifications"), trend: [34, 40, 48, 52, data.stats.versions] },
                            { title: t('factoryOverview.artifactStorage', "Artifact Storage"), value: formatBytes(data.stats.total_storage_bytes), icon: <Storage fontSize="small" />, color: theme.warning, sub: t('factoryOverview.storageSub', "Local artifact data size"), trend: [data.stats.total_storage_bytes * 0.4, data.stats.total_storage_bytes * 0.6, data.stats.total_storage_bytes * 0.75, data.stats.total_storage_bytes * 0.9, data.stats.total_storage_bytes] },
                        ].map((c) => (
                            <Grid key={c.title} size={{ xs: 12, sm: 6, md: 3 }}>
                                <VitalsCard
                                    title={c.title}
                                    value={c.value}
                                    icon={c.icon}
                                    color={c.color}
                                    sub={c.sub}
                                    trendData={c.trend.map(val => ({ value: val }))}
                                />
                            </Grid>
                        ))}
                    </Grid>
                </motion.div>

                {/* ═══ CHARTS BLOCK (Quadrant Bubble Chart + Telemetry Composed Chart) ═══ */}
                <Grid container spacing={3} sx={{ mb: 4 }}>

                    {/* Model Size vs Performance Matrix (Scatter Chart) */}
                    <Grid size={{ xs: 12, md: 6 }}>
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.15 }}>
                            <Paper elevation={0} sx={{ ...paperSx(theme), p: 3, height: '100%', minHeight: 400, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                <Box>
                                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3, flexWrap: 'wrap', gap: 2 }}>
                                        <Box>
                                            <Typography variant="h6" fontWeight={800} sx={{ color: theme.textMain }}>
                                                {t('factoryOverview.matrixTitle', 'Model Size vs. Performance Matrix')}
                                            </Typography>
                                            <Typography variant="caption" sx={{ color: theme.textMuted }}>
                                                {t('factoryOverview.matrixSub', 'active and candidate model versions evaluated by size (MB) and accuracy (%)')}
                                            </Typography>
                                        </Box>
                                        <Stack direction="row" spacing={1.5} alignItems="center">
                                            <FormControl size="small" sx={{ minWidth: 160 }}>
                                                <Select
                                                    value={selectedAlgoFilter}
                                                    onChange={(e) => setSelectedAlgoFilter(e.target.value)}
                                                    MenuProps={{
                                                        PaperProps: {
                                                            sx: {
                                                                bgcolor: theme.paper,
                                                                border: `1px solid ${theme.border}`,
                                                                backgroundImage: 'none',
                                                                "& .MuiMenuItem-root": {
                                                                    color: theme.textMain,
                                                                    fontWeight: 600,
                                                                    "&:hover": {
                                                                        bgcolor: alpha(theme.primary, 0.08),
                                                                    },
                                                                    "&.Mui-selected": {
                                                                        bgcolor: alpha(theme.primary, 0.15),
                                                                        color: theme.primary,
                                                                        "&:hover": {
                                                                            bgcolor: alpha(theme.primary, 0.2),
                                                                        }
                                                                    }
                                                                }
                                                            }
                                                        }
                                                    }}
                                                    sx={{
                                                        borderRadius: '12px',
                                                        color: theme.textMain,
                                                        bgcolor: theme.mode === 'dark' ? alpha(theme.background, 0.5) : theme.background,
                                                        '.MuiOutlinedInput-notchedOutline': { borderColor: theme.mode === 'dark' ? alpha(theme.border, 0.8) : theme.border },
                                                        '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: theme.primary },
                                                        '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: theme.primary },
                                                        '.MuiSelect-icon': { color: theme.textSecondary }
                                                    }}
                                                >
                                                    <MenuItem value="All">{t('factoryOverview.allAlgorithms', 'All Algorithms')}</MenuItem>
                                                    {algorithms.map(a => (
                                                        <MenuItem key={a.id} value={a.name}>{a.name}</MenuItem>
                                                    ))}
                                                </Select>
                                            </FormControl>
                                            <Tooltip title="Ideally, models should have high accuracy and a small disk footprint (top-left)">
                                                <IconButton size="small"><InfoOutlined sx={{ fontSize: 16, color: theme.textMuted }} /></IconButton>
                                            </Tooltip>
                                        </Stack>
                                    </Stack>

                                    {scatterData.length === 0 ? (
                                        <Box sx={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <Typography sx={{ color: theme.textMuted }}>{t('factoryOverview.noVersionsEvaluated', 'No model versions evaluated yet')}</Typography>
                                        </Box>
                                    ) : (
                                        <Box sx={{ height: 280, width: '100%' }}>
                                            <ResponsiveContainer width="100%" height="100%">
                                                <ComposedChart data={scatterData} margin={{ top: 20, right: -10, bottom: 5, left: -10 }}>
                                                    <CartesianGrid stroke={alpha(theme.border, 0.3)} strokeDasharray="3 3" vertical={false} />
                                                    <XAxis
                                                        dataKey="displayName"
                                                        tick={{ fill: theme.textMuted, fontSize: 10, fontWeight: 600 }}
                                                        axisLine={false}
                                                        tickLine={false}
                                                    />
                                                    <YAxis
                                                        yAxisId="left"
                                                        orientation="left"
                                                        domain={[0, 100]}
                                                        unit="%"
                                                        tick={{ fill: theme.textMuted, fontSize: 10, fontWeight: 600 }}
                                                        axisLine={false}
                                                        tickLine={false}
                                                    />
                                                    <YAxis
                                                        yAxisId="right"
                                                        orientation="right"
                                                        domain={[0, 'auto']}
                                                        unit=" MB"
                                                        tick={{ fill: theme.textMuted, fontSize: 10, fontWeight: 600 }}
                                                        axisLine={false}
                                                        tickLine={false}
                                                    />
                                                    <ReTooltip
                                                        cursor={{ fill: alpha(theme.border, 0.1) }}
                                                        content={({ active, payload }) => {
                                                            if (active && payload && payload.length) {
                                                                const data = payload[0].payload;
                                                                return (
                                                                    <Box sx={{
                                                                        borderRadius: '16px',
                                                                        border: `1px solid ${alpha(theme.border, 0.5)}`,
                                                                        boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
                                                                        backgroundColor: alpha(theme.paper, 0.9),
                                                                        backdropFilter: 'blur(12px)',
                                                                        p: 1.8,
                                                                    }}>
                                                                        <Typography variant="body2" fontWeight={800} sx={{ color: theme.textMain, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                                                                            {data.displayName}
                                                                            {data.is_active && (
                                                                                <Chip label={t('factoryOverview.active', 'Active')} size="small" sx={{ bgcolor: alpha(theme.success, 0.15), color: theme.success, fontWeight: 800, height: 18, fontSize: '0.62rem' }} />
                                                                            )}
                                                                        </Typography>
                                                                        <Typography variant="caption" sx={{ color: theme.textMuted, display: 'block', mb: 0.8, fontWeight: 600 }}>
                                                                            {t('factoryOverview.category', 'Category:')} {data.algorithm}
                                                                        </Typography>
                                                                        <Stack spacing={0.5}>
                                                                            <Box display="flex" justifyContent="space-between" gap={3}>
                                                                                <Typography variant="caption" sx={{ color: theme.textSecondary, fontWeight: 700 }}>{t('factoryOverview.accuracy', 'Accuracy (%)').replace(' (%)', '')}:</Typography>
                                                                                <Typography variant="caption" sx={{ color: theme.success, fontWeight: 900 }}>{data.accuracy}%</Typography>
                                                                            </Box>
                                                                            <Box display="flex" justifyContent="space-between" gap={3}>
                                                                                <Typography variant="caption" sx={{ color: theme.textSecondary, fontWeight: 700 }}>{t('factoryOverview.modelSize', 'Model Size (MB)').replace(' (MB)', '')}:</Typography>
                                                                                <Typography variant="caption" sx={{ color: theme.primary, fontWeight: 900 }}>{data.size_mb} MB</Typography>
                                                                            </Box>
                                                                        </Stack>
                                                                    </Box>
                                                                );
                                                            }
                                                            return null;
                                                        }}
                                                    />
                                                    <Bar
                                                        yAxisId="right"
                                                        dataKey="size_mb"
                                                        name={t('factoryOverview.modelSize', 'Model Size (MB)')}
                                                        radius={[4, 4, 0, 0]}
                                                        barSize={20}
                                                    >
                                                        {scatterData.map((entry, index) => (
                                                            <Cell key={`cell-${index}`} fill={alpha(entry.color, 0.15)} stroke={entry.color} strokeWidth={1.5} />
                                                        ))}
                                                    </Bar>
                                                    <Line
                                                        yAxisId="left"
                                                        type="monotone"
                                                        dataKey="accuracy"
                                                        name={t('factoryOverview.accuracy', 'Accuracy (%)')}
                                                        stroke={theme.primary}
                                                        strokeWidth={3}
                                                        dot={{ r: 4, strokeWidth: 2, fill: theme.paper }}
                                                        activeDot={{ r: 6, strokeWidth: 0 }}
                                                    />
                                                </ComposedChart>
                                            </ResponsiveContainer>
                                        </Box>
                                    )}
                                </Box>

                                {/* Custom Legend */}
                                {scatterData.length > 0 && (
                                    <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 3.5 }}>
                                        {/* Metrics Legend */}
                                        <Stack direction="row" alignItems="center" spacing={2} sx={{ borderRight: `1px solid ${alpha(theme.border, 0.4)}`, pr: 3 }}>
                                            <Stack direction="row" alignItems="center" spacing={1}>
                                                <Box sx={{ width: 14, height: 3, bgcolor: theme.primary, borderRadius: '2px' }} />
                                                <Typography variant="caption" fontWeight={800} sx={{ color: theme.textSecondary }}>
                                                    {t('factoryOverview.accuracy', 'Accuracy (%)')}
                                                </Typography>
                                            </Stack>
                                            <Stack direction="row" alignItems="center" spacing={1}>
                                                <Box sx={{ width: 12, height: 12, borderRadius: '3px', border: `1.5px solid ${theme.textSecondary}`, bgcolor: alpha(theme.textSecondary, 0.1) }} />
                                                <Typography variant="caption" fontWeight={800} sx={{ color: theme.textSecondary }}>
                                                    {t('factoryOverview.modelSize', 'Model Size (MB)')}
                                                </Typography>
                                            </Stack>
                                        </Stack>

                                        {/* Algorithm Color Map */}
                                        <Stack direction="row" spacing={2} flexWrap="wrap" justifyContent="center">
                                            {algorithms.map((a) => (
                                                <Stack key={a.id} direction="row" alignItems="center" spacing={1}>
                                                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: algoColors[a.name] || theme.primary }} />
                                                    <Typography variant="caption" fontWeight={700} sx={{ color: theme.textSecondary }}>
                                                        {a.name}
                                                    </Typography>
                                                </Stack>
                                            ))}
                                        </Stack>
                                    </Box>
                                )}
                            </Paper>
                        </motion.div>
                    </Grid>

                    {/* Live Production Pipelines Monitor */}
                    <Grid size={{ xs: 12, md: 6 }}>
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }} style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column' }}>
                            <Paper elevation={0} sx={{ ...paperSx(theme), p: 3, height: '100%', minHeight: 400, display: 'flex', flexDirection: 'column' }}>
                                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 3 }}>
                                    <Box>
                                        <Typography variant="h6" fontWeight={800} sx={{ color: theme.textMain }}>
                                            {t('factoryOverview.livePipelines', 'Live Production Pipelines')}
                                        </Typography>
                                        <Typography variant="caption" sx={{ color: theme.textMuted }}>
                                            {t('factoryOverview.livePipelinesSub', 'Active edge-inference pipelines and live resource metrics')}
                                        </Typography>
                                    </Box>
                                    {activeLanes.length > 0 && (
                                        <Chip
                                            label={`${activeLanes.length} ${t('factoryOverview.active', 'Active')}`}
                                            size="small"
                                            sx={{
                                                bgcolor: alpha(theme.success, 0.1),
                                                color: theme.success,
                                                fontWeight: 800,
                                                fontSize: '0.75rem',
                                                border: `1px solid ${alpha(theme.success, 0.25)}`,
                                                px: 0.5
                                            }}
                                        />
                                    )}
                                </Stack>

                                {activeLanes.length === 0 ? (
                                    <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 2, px: 3 }}>
                                        <Box sx={{ p: 2, borderRadius: '50%', bgcolor: alpha(theme.warning, 0.1), color: theme.warning, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <InfoOutlined sx={{ fontSize: 32 }} />
                                        </Box>
                                        <Typography variant="body2" sx={{ color: theme.textSecondary, fontWeight: 700 }}>
                                            {t('factoryOverview.noActivePipelines', 'No Active Production Pipelines')}
                                        </Typography>
                                        <Typography variant="caption" sx={{ color: theme.textMuted, maxWidth: 280 }}>
                                            {t('factoryOverview.activateToStart', 'Activate a model version in the roster below to start edge inference and live telemetry tracking.')}
                                        </Typography>
                                    </Box>
                                ) : (
                                    <Stack spacing={2} sx={{ flexGrow: 1, maxHeight: 300, overflowY: 'auto', pr: 1, '&::-webkit-scrollbar': { width: '6px' }, '&::-webkit-scrollbar-thumb': { bgcolor: alpha(theme.border, 0.4), borderRadius: '4px' } }}>
                                        {activeLanes.map((lane) => {
                                            const sizeFormatted = formatBytes(lane.size_bytes);
                                            return (
                                                <Box key={lane.version_id} sx={{
                                                    p: 2,
                                                    borderRadius: '16px',
                                                    border: `1px solid ${alpha(theme.border, 0.4)}`,
                                                    bgcolor: alpha(theme.paper, 0.4),
                                                    transition: 'all 0.2s ease-in-out',
                                                    '&:hover': {
                                                        borderColor: alpha(theme.primary, 0.3),
                                                        bgcolor: alpha(theme.paper, 0.6)
                                                    }
                                                }}>
                                                    {/* Header of pipeline card */}
                                                    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                                                        <Stack direction="row" alignItems="center" spacing={1.5}>
                                                            <Box sx={{
                                                                width: 10,
                                                                height: 10,
                                                                borderRadius: '50%',
                                                                bgcolor: theme.success,
                                                                animation: 'pulse 2s infinite',
                                                                '@keyframes pulse': {
                                                                    '0%': { transform: 'scale(0.9)', boxShadow: `0 0 0 0 ${alpha(theme.success, 0.7)}` },
                                                                    '70%': { transform: 'scale(1)', boxShadow: `0 0 0 6px ${alpha(theme.success, 0)}` },
                                                                    '100%': { transform: 'scale(0.9)', boxShadow: `0 0 0 0 ${alpha(theme.success, 0)}` },
                                                                },
                                                            }} />
                                                            <Box>
                                                                <Typography variant="subtitle2" fontWeight={800} sx={{ color: theme.textMain, lineHeight: 1.2 }}>
                                                                    {lane.algorithm_name}
                                                                </Typography>
                                                                <Typography variant="caption" sx={{ color: theme.textMuted }}>
                                                                    {lane.model_name} (v{lane.version_number})
                                                                </Typography>
                                                            </Box>
                                                        </Stack>
                                                        <Stack direction="row" spacing={1.5} alignItems="center">
                                                            <Chip
                                                                label={t('factoryOverview.acc', 'Acc: {{accuracy}}%', { accuracy: lane.accuracy })}
                                                                size="small"
                                                                sx={{
                                                                    bgcolor: alpha(theme.primary, 0.1),
                                                                    color: theme.primary,
                                                                    fontWeight: 800,
                                                                    fontSize: '0.75rem',
                                                                    border: `1px solid ${alpha(theme.primary, 0.15)}`
                                                                }}
                                                            />
                                                            <Typography variant="caption" sx={{ color: theme.textSecondary, fontWeight: 700 }}>
                                                                {sizeFormatted}
                                                            </Typography>
                                                        </Stack>
                                                    </Stack>

                                                    {/* Progress bars representing load */}
                                                    <Grid container spacing={3}>
                                                        <Grid size={{ xs: 6 }}>
                                                            <Stack spacing={0.75}>
                                                                <Stack direction="row" justifyContent="space-between" alignItems="center">
                                                                    <Typography variant="caption" sx={{ color: theme.textSecondary, fontSize: '0.75rem', fontWeight: 600 }}>{t('factoryOverview.cpuDemand', 'CPU Demand')}</Typography>
                                                                    <Typography variant="caption" sx={{ color: theme.textMain, fontSize: '0.75rem', fontWeight: 800 }}>{lane.avg_cpu}%</Typography>
                                                                </Stack>
                                                                <Box sx={{ width: '100%', height: 6, bgcolor: alpha(theme.border, 0.2), borderRadius: 3, overflow: 'hidden' }}>
                                                                    <Box sx={{
                                                                        width: `${lane.avg_cpu}%`,
                                                                        height: '100%',
                                                                        bgcolor: theme.primary,
                                                                        borderRadius: 3,
                                                                        transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)'
                                                                    }} />
                                                                </Box>
                                                            </Stack>
                                                        </Grid>
                                                        <Grid size={{ xs: 6 }}>
                                                            <Stack spacing={0.75}>
                                                                <Stack direction="row" justifyContent="space-between" alignItems="center">
                                                                    <Typography variant="caption" sx={{ color: theme.textSecondary, fontSize: '0.75rem', fontWeight: 600 }}>{t('factoryOverview.gpuDemand', 'GPU Demand')}</Typography>
                                                                    <Typography variant="caption" sx={{ color: theme.textMain, fontSize: '0.75rem', fontWeight: 800 }}>{lane.avg_gpu}%</Typography>
                                                                </Stack>
                                                                <Box sx={{ width: '100%', height: 6, bgcolor: alpha(theme.border, 0.2), borderRadius: 3, overflow: 'hidden' }}>
                                                                    <Box sx={{
                                                                        width: `${lane.avg_gpu}%`,
                                                                        height: '100%',
                                                                        bgcolor: theme.secondary,
                                                                        borderRadius: 3,
                                                                        transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)'
                                                                    }} />
                                                                </Box>
                                                            </Stack>
                                                        </Grid>
                                                    </Grid>
                                                </Box>
                                            );
                                        })}
                                    </Stack>
                                )}
                            </Paper>
                        </motion.div>
                    </Grid>
                </Grid>

                {/* ═══ ACTIVE DEPLOYMENT ROSTER GRID ═══ */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.25 }}>
                    <Box sx={{ mb: 5 }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
                            <Box>
                                <Typography variant="h6" fontWeight={800} sx={{ color: theme.textMain }}>
                                    {t('factoryOverview.activeAlgorithm', 'Active Algorithm')}
                                </Typography>
                                <Typography variant="caption" sx={{ color: theme.textMuted }}>
                                    {t('factoryOverview.physicalDeployment', 'Physical deployment of algorithm structures running on edge nodes')}
                                </Typography>
                            </Box>
                            <Chip
                                icon={<Circle sx={{ fontSize: '8px !important', color: `${theme.success} !important` }} />}
                                label={t('factoryOverview.deployedAlgosCount', '{{count}} deployed algorithms', { count: algorithms.length })}
                                size="small"
                                sx={{ bgcolor: alpha(theme.success, 0.1), color: theme.success, fontWeight: 700, border: `1px solid ${alpha(theme.success, 0.2)}` }}
                            />
                        </Stack>

                        {algorithms.length === 0 ? (
                            <Paper elevation={0} sx={{ ...paperSx(theme), p: 6, textAlign: 'center' }}>
                                <Typography sx={{ color: theme.textMuted }}>{t('factoryOverview.noAlgosRegistered', 'No algorithms registered in this factory yet.')}</Typography>
                                <Button variant="text" size="small" sx={{ mt: 1, textTransform: 'none' }} onClick={() => navigate('/algorithms/create')}>
                                    {t('factoryOverview.registerFirstAlgo', 'Register your first algorithm')}
                                </Button>
                            </Paper>
                        ) : (
                            <Grid container spacing={3}>
                                {algorithms.map((a) => {
                                    return (
                                        <Grid key={a.id} size={{ xs: 12, sm: 6, md: 4 }}>
                                            <Paper elevation={0} sx={{
                                                ...paperSx(theme), p: 3, height: '100%',
                                                display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                                                background: mode === 'dark'
                                                    ? `linear-gradient(145deg, ${alpha(theme.paper, 0.9)} 0%, ${alpha(theme.primary, 0.02)} 100%)`
                                                    : `linear-gradient(145deg, ${alpha(theme.paper, 0.6)} 0%, ${alpha(theme.primary, 0.01)} 100%)`
                                            }}>
                                                <Box>
                                                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 2 }}>
                                                        <Stack direction="row" spacing={1.5} alignItems="center">
                                                            <Box sx={{
                                                                p: 1.2, bgcolor: alpha(theme.primary, 0.1), borderRadius: '12px',
                                                                color: theme.primary, display: 'flex',
                                                                boxShadow: `inset 0 0 0 1px ${alpha(theme.primary, 0.15)}`
                                                            }}>
                                                                <GridView fontSize="small" />
                                                            </Box>
                                                            <Box minWidth={0}>
                                                                <Typography variant="body1" fontWeight={800} sx={{ color: theme.textMain }} noWrap>
                                                                    {a.name}
                                                                </Typography>
                                                            </Box>
                                                        </Stack>
                                                        <Chip
                                                            label={t('factoryOverview.active', 'Active')}
                                                            size="small"
                                                            sx={{
                                                                height: 22, bgcolor: alpha(theme.success, 0.1), color: theme.success,
                                                                fontWeight: 700, border: `1px solid ${alpha(theme.success, 0.2)}`
                                                            }}
                                                        />
                                                    </Stack>

                                                    <Divider sx={{ my: 1.8, borderColor: alpha(theme.border, 0.4) }} />

                                                    <Stack spacing={1.2} sx={{ mb: 2 }}>
                                                        <Box display="flex" justifyContent="space-between">
                                                            <Typography variant="caption" sx={{ color: theme.textMuted, fontWeight: 600 }}>{t('factoryOverview.trainedModels', 'Trained Models')}</Typography>
                                                            <Typography variant="caption" sx={{ color: theme.textSecondary, fontWeight: 800 }}>{a.models_count ?? 0}</Typography>
                                                        </Box>
                                                    </Stack>
                                                </Box>

                                                <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                                                    <Button
                                                        variant="outlined"
                                                        size="small"
                                                        endIcon={<ArrowForward sx={{ fontSize: '14px !important' }} />}
                                                        onClick={() => navigate(`/algorithms/${a.id}/factories/${factory.id}/models`)}
                                                        sx={{
                                                            borderRadius: '10px', textTransform: 'none', fontWeight: 700, px: 1.8, py: 0.5,
                                                            fontSize: '0.75rem', border: `1px solid ${alpha(theme.primary, 0.25)}`,
                                                            color: theme.primary, bgcolor: alpha(theme.primary, 0.02),
                                                            '&:hover': { bgcolor: theme.primary, color: theme.white, borderColor: theme.primary }
                                                        }}
                                                    >
                                                        {t('factoryOverview.configure', 'Configure')}
                                                    </Button>
                                                </Box>
                                            </Paper>
                                        </Grid>
                                    );
                                })}
                            </Grid>
                        )}
                    </Box>
                </motion.div>

                {/* ═══ RECENT ACTIVITY Chrono-Timeline ═══ */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }}>
                    <Paper elevation={0} sx={{ ...paperSx(theme), p: 3 }}>
                        <Box sx={{ mb: 3 }}>
                            <Typography variant="h6" fontWeight={800} sx={{ color: theme.textMain }}>
                                {t('factoryOverview.recentActivity', 'Recent Version Activities')}
                            </Typography>
                            <Typography variant="caption" sx={{ color: theme.textMuted }}>
                                {t('factoryOverview.recentActivitySub', 'Live audit stream of registered model versions inside this factory')}
                            </Typography>
                        </Box>

                        <List sx={{ p: 0 }}>
                            {data.recent_activity.map((item, index) => (
                                <div key={item.id}>
                                    {index > 0 && <Divider sx={{ my: 1.5, borderColor: alpha(theme.border, 0.3) }} />}
                                    <ListItem
                                        disablePadding
                                        onClick={() => navigate(`/algorithms/${item.link_ids.algo_id}/factories/${item.link_ids.factory_id}/models/${item.link_ids.model_id}/versions/${item.link_ids.version_id}`)}
                                        sx={{
                                            py: 1.5, px: 2, cursor: "pointer", borderRadius: "16px",
                                            transition: "all 0.2s ease",
                                            "&:hover": { bgcolor: alpha(theme.primary, 0.04), transform: 'translateX(4px)' }
                                        }}
                                    >
                                        <ListItemIcon>
                                            <Box sx={{
                                                width: 40, height: 40, borderRadius: "12px",
                                                bgcolor: alpha(theme.success, 0.1), color: theme.success,
                                                display: "flex", alignItems: "center", justifyContent: "center",
                                                boxShadow: `inset 0 0 0 1px ${alpha(theme.success, 0.15)}`
                                            }}>
                                                <AddCircleOutlined fontSize="small" />
                                            </Box>
                                        </ListItemIcon>
                                        <ListItemText
                                            primary={
                                                <Typography fontWeight={800} variant="body2" sx={{ color: theme.textMain }}>
                                                    {t('factoryOverview.newVersion', 'New version')} <span style={{ color: theme.primary, fontWeight: 900 }}>v{item.version}</span> {t('factoryOverview.registeredForModel', 'registered for model')} <span style={{ fontWeight: 900 }}>{item.model_name}</span>
                                                </Typography>
                                            }
                                            secondary={
                                                <Typography variant="caption" sx={{ color: theme.textMuted, fontWeight: 500, mt: 0.3, display: 'block' }}>
                                                    {t('factoryOverview.algoCategory', 'Algorithm Category: {{algoName}} • {{date}}', { algoName: item.algo_name, date: new Date(item.created_at).toLocaleString() })}
                                                </Typography>
                                            }
                                        />
                                        <Button
                                            size="small"
                                            variant="text"
                                            endIcon={<ArrowForward fontSize="small" />}
                                            sx={{ borderRadius: "20px", textTransform: 'none', fontWeight: 700 }}
                                        >
                                            {t('factoryOverview.inspect', 'Inspect')}
                                        </Button>
                                    </ListItem>
                                </div>
                            ))}
                            {data.recent_activity.length === 0 && (
                                <Box sx={{ py: 3, textAlign: 'center' }}>
                                    <Typography sx={{ color: theme.textMuted, fontStyle: "italic" }}>
                                        {t('factoryOverview.noRecentActivity', 'No recent model activity recorded yet.')}
                                    </Typography>
                                </Box>
                            )}
                        </List>
                    </Paper>
                </motion.div>

            </Box>

            <style>{`
                @keyframes dashPulse { 0%, 100% { opacity: 1; box-shadow: 0 0 10px currentColor; } 50% { opacity: 0.5; box-shadow: 0 0 20px currentColor; } }
            `}</style>
        </Box>
    );
}
