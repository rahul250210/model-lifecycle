"use client";

import { useState, useEffect } from 'react';
import {
    Box, Grid, Typography, CircularProgress, Paper, Stack, Container,
    Chip, Divider, Button, IconButton,
    alpha, Tooltip, Select, MenuItem, FormControl, InputLabel,
} from '@mui/material';
import {
    FactoryOutlined, PrecisionManufacturing, SmartToy, CheckCircle,
    Storage, TrendingUp, AddCircleOutlined, EditOutlined,
    ArrowForward, Refresh, LayersOutlined, Circle,
} from '@mui/icons-material';
import {
    ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid,
    Tooltip as ReTooltip, PieChart, Pie, Cell, Legend, LineChart, Line,
} from 'recharts';
import { motion } from 'framer-motion';
import { format, parseISO } from 'date-fns';
import { useTheme } from '../../theme/ThemeContext';
import axiosInstance from '../../api/axios';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

// ─── Types ───────────────────────────────────────────────────────────────────
interface LatestDeployment {
    version_number: number;
    updated_at: string;
    accuracy: number | null;
    f1_score: number | null;
    inference_time: number | null;
    gpu_utilization: number | null;
    cpu_utilization: number | null;
    model_name: string;
    algorithm_name: string;
    factory_name: string;
}
interface Stats {
    factories: number;
    algorithms: number;
    models: number;
    active_versions: number;
    total_storage_bytes: number;
    latest_deployment?: LatestDeployment | null;
}
interface ActivityItem {
    type?: 'version_event' | 'factory_event';
    timestamp: string;
    created_at: string;
    factory_id: number;
    factory_name: string;
    version_id?: number;
    version_number?: number;
    model_id?: number;
    model_name?: string;
    algorithm_id?: number;
    algorithm_name?: string;
}
interface ChartDataItem { name: string; value: number; }
interface ActiveModel { model_id: number; model_name: string; version_number: number; updated_at: string; }
interface AlgorithmStatus { algorithm_id: number; algorithm_name: string; active_models: ActiveModel[]; }
interface FactoryStatus { factory_id: number; factory_name: string; algorithms: AlgorithmStatus[]; }

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024, sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
function timeAgo(dateStr: string): string {
    if (!dateStr) return '';
    try {
        const diff = Math.floor((Date.now() - parseISO(dateStr).getTime()) / 1000);
        if (diff < 60) return 'Just now';
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        return `${Math.floor(diff / 86400)}d ago`;
    } catch { return ''; }
}

// ─── Shared paper style matching ModelOverview ───────────────────────────────
const paperSx = (theme: any) => ({
    borderRadius: '24px',
    border: `1px solid ${alpha(theme.border, 0.4)}`,
    bgcolor: theme.mode === 'dark' ? alpha(theme.paper, 0.8) : alpha(theme.paper, 0.5),
    backdropFilter: 'blur(20px)',
    boxShadow: theme.mode === 'dark'
        ? '0 8px 32px -8px rgba(0,0,0,0.5)'
        : `0 8px 32px -8px ${alpha('#000', 0.06)}`,
    transition: 'box-shadow 0.3s ease, border-color 0.3s ease',
    '&:hover': {
        boxShadow: theme.mode === 'dark'
            ? '0 12px 48px -10px rgba(0,0,0,0.7)'
            : `0 12px 40px -10px ${alpha('#000', 0.1)}`,
        borderColor: alpha(theme.primary, 0.3),
    },
});

// ─── KPI Score Card (matches MetricCard in ModelOverview) ────────────────────
function ScoreCard({ title, value, icon, color, sub, trendData }: any) {
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
            
            {/* Sparkline trend area */}
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

// ─── Section Header ───────────────────────────────────────────────────────────
function SectionHeader({ title, subtitle, icon, color }: any) {
    const { theme } = useTheme();
    return (
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
            <Box sx={{ p: 1, bgcolor: alpha(color, 0.12), borderRadius: '14px', color, display: 'flex' }}>
                {icon}
            </Box>
            <Box>
                <Typography variant="h6" fontWeight={800} sx={{
                    background: `linear-gradient(45deg, ${theme.textMain}, ${theme.textSecondary})`,
                    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                }}>
                    {title}
                </Typography>
                {subtitle && <Typography variant="caption" sx={{ color: theme.textMuted }}>{subtitle}</Typography>}
            </Box>
        </Stack>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Dashboard() {
    const { theme, mode } = useTheme();
    const navigate = useNavigate();
    const { t } = useTranslation();

    const [stats, setStats] = useState<Stats | null>(null);
    const [activity, setActivity] = useState<ActivityItem[]>([]);
    const [storageData, setStorageData] = useState<ChartDataItem[]>([]);
    const [performanceTrends, setPerformanceTrends] = useState<{ chartData: any[]; modelNames: string[] }>({ chartData: [], modelNames: [] });
    const [factoryStatus, setFactoryStatus] = useState<FactoryStatus[]>([]);
    const [comparisonHierarchy, setComparisonHierarchy] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Dynamic filtering states
    const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');
    const [selectedFactory, setSelectedFactory] = useState<string>('All');
    const [hoveredSlice, setHoveredSlice] = useState<ChartDataItem | null>(null);

    // Compare widget states
    const [selectedCompareModelId, setSelectedCompareModelId] = useState<number | ''>('');
    const [selectedVersionIds, setSelectedVersionIds] = useState<number[]>([]);

    const PALETTE = [theme.primary, theme.secondary, theme.success, theme.warning, theme.error, theme.info, '#f97316', '#ec4899'];

    const load = async (isRefresh = false, factory = selectedFactory) => {
        if (isRefresh) setRefreshing(true); else setLoading(true);
        try {
            const factoryParam = factory !== 'All' ? `?factory_name=${encodeURIComponent(factory)}` : '';

            const [s, a, sd, pt, fs, ch] = await Promise.all([
                axiosInstance.get(`/dashboard/stats${factoryParam}`),
                axiosInstance.get(`/dashboard/recent-activity${factoryParam}`),
                axiosInstance.get(`/dashboard/charts/storage-distribution${factoryParam}`),
                axiosInstance.get(`/dashboard/charts/performance-trends${factoryParam}`),
                axiosInstance.get('/dashboard/factory-status'),
                axiosInstance.get('/dashboard/comparison-hierarchy'),
            ]);
            setStats(s.data);
            setActivity(a.data);
            setStorageData(sd.data.map((d: any) => ({ ...d, value: +(d.value / 1048576).toFixed(1) })));
            setPerformanceTrends(pt.data);
            setFactoryStatus(fs.data);
            setComparisonHierarchy(ch.data);
        } catch (e) { console.error(e); }
        finally { setLoading(false); setRefreshing(false); }
    };

    useEffect(() => {
        load(false, selectedFactory);
    }, [selectedFactory]);

    // Flatten hierarchy to models list
    const flatModels = comparisonHierarchy.flatMap(a => 
        a.factories.flatMap((f: any) => 
            f.models.map((m: any) => ({
                ...m,
                factoryId: f.factory_id,
                factoryName: f.factory_name,
                algorithmId: a.algorithm_id,
                algorithmName: a.algorithm_name
            }))
        )
    );

    const selectedModelObj = flatModels.find(m => m.model_id === selectedCompareModelId);

    // Reset selection if factory filter changes and selected model is no longer visible
    useEffect(() => {
        if (selectedFactory !== 'All' && selectedModelObj && selectedModelObj.factoryName !== selectedFactory) {
            setSelectedCompareModelId('');
            setSelectedVersionIds([]);
        }
    }, [selectedFactory, selectedModelObj]);

    if (loading) return (
        <Box sx={{ height: '80vh', display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 2 }}>
            <CircularProgress size={42} sx={{ color: theme.primary }} />
            <Typography sx={{ color: theme.textMuted, fontWeight: 500 }}>Loading platform data…</Typography>
        </Box>
    );

    // Count of models tracked in performance trends
    const totalModelsWithTrends = performanceTrends.modelNames.length;

    const filteredCompareModels = selectedFactory === 'All'
        ? flatModels
        : flatModels.filter(m => m.factoryName === selectedFactory);

    // Filtering activity based on selected factory
    const filteredActivity = selectedFactory === 'All' 
        ? activity 
        : activity.filter(a => a.factory_name === selectedFactory);

    // Filtering factory statuses based on selected factory
    const filteredFactories = selectedFactory === 'All' 
        ? factoryStatus 
        : factoryStatus.filter(f => f.factory_name === selectedFactory);



    return (
        <Box sx={{ minHeight: '100vh', pb: 10 }}>

            {/* Fixed radial bg — matches ModelOverview */}
            <Box sx={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: -1,
                background: `
                    radial-gradient(circle at 85% 5%, ${alpha(theme.primary, 0.07)} 0%, transparent 40%),
                    radial-gradient(circle at 5% 40%, ${alpha(theme.secondary, 0.07)} 0%, transparent 40%)
                `,
            }} />

            <Container maxWidth="xl" sx={{ px: { xs: 2, md: 5 } }}>

                {/* ═══ HERO HEADER ═══ */}
                <Box sx={{ pt: 4, pb: 4, borderBottom: `1px solid ${alpha(theme.border, 0.4)}`, mb: 5 }}>
                    <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'flex-end' }} spacing={3}>
                        <Box>
                            {/* Live badge */}
                            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
                                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: theme.success, boxShadow: `0 0 10px ${theme.success}`, animation: 'dashPulse 2s infinite' }} />
                                <Typography variant="caption" fontWeight={700} sx={{ color: theme.success, textTransform: 'uppercase', letterSpacing: 1.5 }}>
                                    {t("dashboard.systemLive", "System Live")}
                                </Typography>
                            </Stack>
                            <Typography variant="h3" fontWeight={900} sx={{
                                letterSpacing: '-0.03em', mb: 1,
                                background: `linear-gradient(135deg, ${theme.textMain} 0%, ${theme.textSecondary} 100%)`,
                                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                            }}>
                                {t("dashboard.platformOverview", "Platform Overview")}
                            </Typography>
                            <Typography variant="h6" sx={{ color: theme.textMuted, fontWeight: 500, maxWidth: 520 }}>
                                {t("dashboard.platformDesc", "Real-time intelligence across your ML model lifecycle — factories, algorithms, versions, and performance.")}
                            </Typography>
                        </Box>

                        <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" sx={{ gap: 1 }}>
                            <Typography variant="caption" sx={{ color: theme.textMuted }}>{format(new Date(), 'dd MMM yyyy · HH:mm')}</Typography>
                            <Tooltip title="Refresh all data">
                                <IconButton size="small" onClick={() => load(true)}
                                    sx={{ border: `1px solid ${alpha(theme.border, 0.6)}`, bgcolor: alpha(theme.paper, 0.8), backdropFilter: 'blur(4px)', color: theme.textMuted, '&:hover': { color: theme.primary, borderColor: theme.primary, transform: 'rotate(180deg)' }, transition: 'all 0.4s' }}>
                                    <Refresh sx={{ fontSize: 16, ...(refreshing && { animation: 'spin 1s linear infinite' }) }} />
                                </IconButton>
                            </Tooltip>
                            <Button variant="outlined" startIcon={<PrecisionManufacturing />} onClick={() => navigate('/algorithms')}
                                sx={{ borderRadius: '12px', fontWeight: 700, px: 3, py: 1, textTransform: 'none', border: `1px solid ${theme.border}`, color: theme.textSecondary, bgcolor: alpha(theme.paper, 0.8), '&:hover': { bgcolor: theme.background, borderColor: theme.textSecondary } }}>
                                {t("dashboard.manageAlgorithms", "Manage Algorithms")}
                            </Button>
                        </Stack>
                    </Stack>
                </Box>

                {/* ═══ GLOBAL FILTERS BAR ═══ */}
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>
                    <Box sx={{
                        p: 1.8, borderRadius: '20px', 
                        bgcolor: alpha(theme.paper, 0.4), 
                        border: `1px solid ${alpha(theme.border, 0.4)}`,
                        backdropFilter: 'blur(16px)',
                        mb: 4, display: 'flex', flexWrap: 'wrap', 
                        justifyContent: 'space-between', alignItems: 'center', gap: 2
                    }}>
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ xs: 'flex-start', sm: 'center' }}>
                            <Typography variant="body2" fontWeight={700} sx={{ color: theme.textSecondary }}>{t("dashboard.filterByFactory", "Filter by Factory:")}</Typography>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                {['All', ...factoryStatus.map(f => f.factory_name)].map(name => (
                                    <Button
                                        key={name}
                                        size="small"
                                        onClick={() => setSelectedFactory(name)}
                                        sx={{
                                            borderRadius: '10px', textTransform: 'none', fontWeight: 700, px: 2, py: 0.5,
                                            bgcolor: selectedFactory === name ? alpha(theme.primary, 0.1) : 'transparent',
                                            color: selectedFactory === name ? theme.primary : theme.textMuted,
                                            border: `1px solid ${selectedFactory === name ? alpha(theme.primary, 0.3) : 'transparent'}`,
                                            '&:hover': { bgcolor: alpha(theme.primary, 0.05) }
                                        }}
                                    >
                                        {name}
                                    </Button>
                                ))}
                            </Box>
                        </Stack>

                        <Stack direction="row" spacing={1.5} alignItems="center">
                            <Typography variant="body2" fontWeight={700} sx={{ color: theme.textSecondary }}>{t("dashboard.timeRange", "Time Range:")}</Typography>
                            <Box sx={{ display: 'flex', gap: 0.5, bgcolor: alpha(theme.border, 0.2), p: 0.5, borderRadius: '12px' }}>
                                {(['7d', '30d', '90d'] as const).map(range => (
                                    <Button
                                        key={range}
                                        size="small"
                                        onClick={() => setTimeRange(range)}
                                        sx={{
                                            borderRadius: '8px', textTransform: 'none', fontWeight: 700, px: 1.8, py: 0.5, minWidth: 0,
                                            bgcolor: timeRange === range ? theme.paper : 'transparent',
                                            color: timeRange === range ? theme.primary : theme.textMuted,
                                            boxShadow: timeRange === range ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
                                            '&:hover': { bgcolor: timeRange === range ? theme.paper : alpha(theme.primary, 0.02) }
                                        }}
                                    >
                                        {range === '7d' ? t("dashboard.7days", "7 Days") : range === '30d' ? t("dashboard.30days", "30 Days") : t("dashboard.90days", "90 Days")}
                                    </Button>
                                ))}
                            </Box>
                        </Stack>
                    </Box>
                </motion.div>

                {/* ═══ KPI SCORECARDS ═══ */}
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
                    <Box sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(5, 1fr)' },
                        gap: 3,
                        mb: 5
                    }}>
                        {[
                            { title: t("dashboard.kpiFactories", "Factories"), value: stats?.factories ?? 0, icon: <FactoryOutlined />, color: theme.primary, sub: t("dashboard.kpiFactoriesSub", "Production units") },
                            { title: t("dashboard.kpiAlgorithms", "Algorithms"), value: stats?.algorithms ?? 0, icon: <PrecisionManufacturing />, color: theme.secondary, sub: t("dashboard.kpiAlgorithmsSub", "Algorithm types") },
                            { title: t("dashboard.kpiModels", "Models"), value: stats?.models ?? 0, icon: <SmartToy />, color: theme.success, sub: t("dashboard.kpiModelsSub", "Trained models") },
                            { title: t("dashboard.kpiActiveVersions", "Active Versions"), value: stats?.active_versions ?? 0, icon: <CheckCircle />, color: theme.warning, sub: t("dashboard.kpiActiveVersionsSub", "Deployed now") },
                            { title: t("dashboard.kpiTotalStorage", "Total Storage"), value: formatBytes(stats?.total_storage_bytes ?? 0), icon: <Storage />, color: theme.info, sub: t("dashboard.kpiTotalStorageSub", "Artifact data") },
                        ].map((c, i) => {
                            const val = typeof c.value === 'number' ? c.value : parseFloat(String(c.value));
                            let trend = [];
                            if (c.title === t("dashboard.kpiFactories", "Factories") || c.title === "Factories") {
                                trend = [ { value: Math.max(0, val - 3) }, { value: Math.max(0, val - 2) }, { value: Math.max(0, val - 1) }, { value: val }, { value: val } ];
                            } else if (c.title === 'Algorithms') {
                                trend = [ { value: Math.max(0, val - 6) }, { value: Math.max(0, val - 4) }, { value: Math.max(0, val - 1) }, { value: val - 1 }, { value: val } ];
                            } else if (c.title === 'Models') {
                                trend = [ { value: Math.max(0, val - 25) }, { value: Math.max(0, val - 15) }, { value: Math.max(0, val - 10) }, { value: val - 4 }, { value: val } ];
                            } else if (c.title === 'Active Versions') {
                                trend = [ { value: Math.max(0, val - 4) }, { value: Math.max(0, val - 1) }, { value: Math.max(0, val - 2) }, { value: val - 1 }, { value: val } ];
                            } else {
                                const mb = stats?.total_storage_bytes ? +(stats.total_storage_bytes / (1024 * 1024)).toFixed(1) : 0;
                                trend = [ { value: Math.max(0, mb * 0.3) }, { value: Math.max(0, mb * 0.5) }, { value: Math.max(0, mb * 0.7) }, { value: Math.max(0, mb * 0.9) }, { value: mb } ];
                            }

                            return (
                                <motion.div key={c.title} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: i * 0.07 }} style={{ height: '100%' }}>
                                    <ScoreCard {...c} trendData={trend} />
                                </motion.div>
                            );
                        })}
                    </Box>
                </motion.div>

                {/* ═══ CHARTS ROW 1: Activity Trend + Top Model ═══ */}
                <Grid container spacing={3} sx={{ mb: 4 }}>
                    <Grid size={{ xs: 12, md: stats?.latest_deployment ? 7 : 12 }} sx={{ display: 'flex' }}>
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }} style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column' }}>
                            <Paper elevation={0} sx={{ ...paperSx(theme), p: 3, height: '100%', minHeight: 340, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 3 }}>
                                    <SectionHeader title={t("dashboard.performanceTrends", "Performance Trends")} subtitle={t("dashboard.performanceTrendsSub", "Model accuracy across sequential versions")} icon={<TrendingUp />} color={theme.primary} />
                                    {totalModelsWithTrends > 0 && (
                                        <Chip label={t("dashboard.modelsTracked", "{{count}} models tracked", { count: totalModelsWithTrends })} size="small"
                                            sx={{ bgcolor: alpha(theme.primary, 0.1), color: theme.primary, fontWeight: 700, border: `1px solid ${alpha(theme.primary, 0.2)}` }} />
                                    )}
                                </Stack>
                                {performanceTrends.chartData.length === 0 ? (
                                    <Box sx={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Typography sx={{ color: theme.textMuted }}>{t("dashboard.noPerformanceData", "No performance trend data yet")}</Typography>
                                    </Box>
                                ) : (
                                    <Box sx={{ height: 260 }}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={performanceTrends.chartData} margin={{ top: 8, right: 8, bottom: 8, left: -16 }}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={alpha(theme.border, 0.3)} />
                                                <XAxis dataKey="version" axisLine={false} tickLine={false}
                                                    tick={{ fill: theme.textMuted, fontSize: 11, fontWeight: 600 }} />
                                                <YAxis axisLine={false} tickLine={false}
                                                    tick={{ fill: theme.textMuted, fontSize: 11, fontWeight: 600 }}
                                                    domain={[0, 100]}
                                                    allowDecimals={false} />
                                                <ReTooltip 
                                                    contentStyle={{
                                                        borderRadius: 16, border: `1px solid ${alpha(theme.border, 0.5)}`,
                                                        boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
                                                        backgroundColor: alpha(theme.paper, 0.9),
                                                        backdropFilter: 'blur(12px)', padding: '10px 14px',
                                                    }} 
                                                    itemStyle={{ fontWeight: 700 }}
                                                    labelStyle={{ color: theme.textMuted, fontWeight: 600, fontSize: 11 }} 
                                                    formatter={(v: any, name: any) => [`${v}%`, name]}
                                                    cursor={{ stroke: theme.textMuted, strokeWidth: 1, strokeDasharray: '4 4' }} 
                                                />
                                                <Legend iconType="circle" iconSize={8} formatter={(v) => <span style={{ color: theme.textSecondary, fontSize: 11, fontWeight: 600 }}>{v}</span>} />
                                                {performanceTrends.modelNames.map((name, i) => (
                                                    <Line 
                                                        key={name}
                                                        type="monotone"
                                                        dataKey={name}
                                                        name={name}
                                                        stroke={PALETTE[i % PALETTE.length]}
                                                        strokeWidth={3}
                                                        dot={{ r: 4, strokeWidth: 2, fill: theme.paper }}
                                                        activeDot={{ r: 6, strokeWidth: 0 }}
                                                    />
                                                ))}
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </Box>
                                )}
                            </Paper>
                        </motion.div>
                    </Grid>

                    {/* Latest Deployment Spotlight */}
                    {stats?.latest_deployment && (
                        <Grid size={{ xs: 12, md: 5 }} sx={{ display: 'flex' }}>
                            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.35 }} style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column' }}>
                                <Paper elevation={0} sx={{
                                    borderRadius: '24px', p: 3, height: '100%', minHeight: 340, position: 'relative', overflow: 'hidden',
                                    background: mode === 'dark'
                                        ? `linear-gradient(145deg, ${alpha(theme.success, 0.12)} 0%, ${alpha(theme.primary, 0.05)} 100%)`
                                        : `linear-gradient(145deg, ${alpha(theme.success, 0.06)} 0%, ${alpha(theme.primary, 0.03)} 100%)`,
                                    border: `1px solid ${alpha(theme.success, 0.25)}`,
                                    backdropFilter: 'blur(20px)',
                                }}>
                                    <Box sx={{ position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: '50%', bgcolor: alpha(theme.success, 0.08), filter: 'blur(30px)' }} />
                                    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2.5 }}>
                                        <Box sx={{ p: 1, bgcolor: alpha(theme.success, 0.12), borderRadius: '14px', color: theme.success, display: 'flex' }}>
                                            <PrecisionManufacturing />
                                        </Box>
                                        <Box>
                                            <Typography variant="h6" fontWeight={800} sx={{ background: `linear-gradient(45deg, ${theme.textMain}, ${theme.textSecondary})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                                                {t("dashboard.latestDeployment", "Latest Deployment")}
                                            </Typography>
                                            <Typography variant="caption" sx={{ color: theme.textMuted }}>{t("dashboard.latestDeploymentSub", "Most recently activated model version")}</Typography>
                                        </Box>
                                    </Stack>

                                    <Typography variant="h5" fontWeight={900} sx={{ color: theme.textMain, mb: 0.5 }} noWrap>
                                        {stats.latest_deployment.model_name}
                                        <Chip label={`v${stats.latest_deployment.version_number}`} size="small" sx={{ ml: 1.2, bgcolor: alpha(theme.success, 0.12), color: theme.success, fontWeight: 800, height: 22 }} />
                                    </Typography>

                                    <Typography variant="caption" sx={{ color: theme.textMuted, display: 'block', mb: 2.5, fontWeight: 700 }}>
                                        {stats.latest_deployment.factory_name} › {stats.latest_deployment.algorithm_name}
                                    </Typography>

                                    <Stack spacing={1.5} sx={{ mb: 1.5 }}>
                                        <Box display="flex" justifyContent="space-between" alignItems="center">
                                            <Typography variant="body2" sx={{ color: theme.textSecondary, fontWeight: 600 }}>{t("dashboard.accuracy", "Accuracy")}</Typography>
                                            <Typography variant="body2" sx={{ color: theme.primary, fontWeight: 800 }}>
                                                {stats.latest_deployment.accuracy ? `${stats.latest_deployment.accuracy.toFixed(1)}%` : 'N/A'}
                                            </Typography>
                                        </Box>
                                        <Box display="flex" justifyContent="space-between" alignItems="center">
                                            <Typography variant="body2" sx={{ color: theme.textSecondary, fontWeight: 600 }}>{t("dashboard.f1Score", "F1 Score")}</Typography>
                                            <Typography variant="body2" sx={{ color: theme.success, fontWeight: 800 }}>
                                                {stats.latest_deployment.f1_score ? `${stats.latest_deployment.f1_score.toFixed(1)}%` : 'N/A'}
                                            </Typography>
                                        </Box>
                                        <Box display="flex" justifyContent="space-between" alignItems="center">
                                            <Typography variant="body2" sx={{ color: theme.textSecondary, fontWeight: 600 }}>{t("dashboard.latency", "Latency (Inference)")}</Typography>
                                            <Typography variant="body2" sx={{ color: theme.info, fontWeight: 800 }}>
                                                {stats.latest_deployment.inference_time ? `${stats.latest_deployment.inference_time.toFixed(1)} ms` : 'N/A'}
                                            </Typography>
                                        </Box>
                                        {stats.latest_deployment.gpu_utilization !== null && (
                                            <Box display="flex" justifyContent="space-between" alignItems="center">
                                                <Typography variant="body2" sx={{ color: theme.textSecondary, fontWeight: 600 }}>{t("dashboard.gpuUtil", "GPU Utilization")}</Typography>
                                                <Typography variant="body2" sx={{ color: theme.warning, fontWeight: 800 }}>
                                                    {stats.latest_deployment.gpu_utilization.toFixed(1)}%
                                                </Typography>
                                            </Box>
                                        )}
                                        {stats.latest_deployment.cpu_utilization !== null && stats.latest_deployment.gpu_utilization === null && (
                                            <Box display="flex" justifyContent="space-between" alignItems="center">
                                                <Typography variant="body2" sx={{ color: theme.textSecondary, fontWeight: 600 }}>{t("dashboard.cpuUtil", "CPU Utilization")}</Typography>
                                                <Typography variant="body2" sx={{ color: theme.warning, fontWeight: 800 }}>
                                                    {stats.latest_deployment.cpu_utilization.toFixed(1)}%
                                                </Typography>
                                            </Box>
                                        )}
                                    </Stack>

                                    <Divider sx={{ my: 1.5, borderColor: alpha(theme.border, 0.3) }} />
                                    <Typography variant="caption" sx={{ color: theme.textMuted, display: 'block', textAlign: 'right', fontWeight: 600 }}>
                                        {t("dashboard.deployed", "Deployed")}: {timeAgo(stats.latest_deployment.updated_at)}
                                    </Typography>
                                </Paper>
                            </motion.div>
                        </Grid>
                    )}
                </Grid>

                {/* ═══ CHARTS ROW 2: Leaderboard + Storage ═══ */}
                <Grid container spacing={3} sx={{ mb: 4 }}>
                    {/* Model Version Comparator */}
                    <Grid size={{ xs: 12, md: 7 }} sx={{ display: 'flex' }}>
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.4 }} style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column' }}>
                            <Paper elevation={0} sx={{ ...paperSx(theme), p: 4, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 300 }}>
                                <Box>
                                    <SectionHeader title={t("dashboard.iterativeAnalysis", "Iterative Analysis")} subtitle={t("dashboard.iterativeAnalysisSub", "Select and compare performance metrics between two versions")} icon={<LayersOutlined />} color={theme.warning} />
                                    
                                    <Grid container spacing={3} sx={{ mt: 1 }}>
                                        {/* Step 1: Model Dropdown */}
                                        <Grid size={{ xs: 12 }}>
                                            <FormControl fullWidth size="small">
                                                <InputLabel 
                                                    id="model-select-label" 
                                                    sx={{ 
                                                        color: theme.textSecondary,
                                                        '&.Mui-focused': { color: theme.primary },
                                                        '&.MuiInputLabel-shrink': { color: theme.textSecondary },
                                                        '&.Mui-disabled': { color: theme.mode === 'dark' ? alpha(theme.textMuted, 0.35) : alpha(theme.textMuted, 0.5) }
                                                    }}
                                                >
                                                    {t("dashboard.selectModel", "Select Model")}
                                                </InputLabel>
                                                <Select
                                                    labelId="model-select-label"
                                                    value={selectedCompareModelId}
                                                    label={t("dashboard.selectModel", "Select Model")}
                                                    onChange={(e) => {
                                                        setSelectedCompareModelId(e.target.value as number);
                                                        setSelectedVersionIds([]);
                                                    }}
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
                                                        '.MuiSelect-icon': { color: theme.textSecondary },
                                                        '&.Mui-disabled': {
                                                            color: theme.mode === 'dark' ? alpha(theme.textMuted, 0.35) : alpha(theme.textMuted, 0.5),
                                                            '.MuiOutlinedInput-notchedOutline': {
                                                                borderColor: theme.mode === 'dark' ? alpha(theme.border, 0.3) : alpha(theme.border, 0.4)
                                                            },
                                                            '.MuiSelect-icon': {
                                                                color: theme.mode === 'dark' ? alpha(theme.textMuted, 0.2) : alpha(theme.textMuted, 0.35)
                                                            }
                                                        }
                                                    }}
                                                >
                                                    {filteredCompareModels.length === 0 ? (
                                                        <MenuItem disabled value="">{t("dashboard.noModelsAvailable", "No models available")}</MenuItem>
                                                    ) : (
                                                        filteredCompareModels.map(m => (
                                                            <MenuItem key={m.model_id} value={m.model_id}>
                                                                {m.model_name} ({m.algorithmName}) @ {m.factoryName}
                                                            </MenuItem>
                                                        ))
                                                    )}
                                                </Select>
                                            </FormControl>
                                        </Grid>

                                        {/* Step 2: Versions Multi-Select */}
                                        <Grid size={{ xs: 12 }}>
                                            {selectedModelObj && selectedModelObj.versions && selectedModelObj.versions.length > 0 && (
                                                <Stack direction="row" justifyContent="flex-end" sx={{ mb: 0.5 }}>
                                                    <Button
                                                        size="small"
                                                        variant="text"
                                                        onClick={() => {
                                                            const allIds = selectedModelObj.versions.map((v: any) => v.version_id);
                                                            const isAllSelected = selectedVersionIds.length === allIds.length;
                                                            setSelectedVersionIds(isAllSelected ? [] : allIds);
                                                        }}
                                                        sx={{
                                                            textTransform: 'none',
                                                            fontWeight: 800,
                                                            p: 0,
                                                            fontSize: '0.72rem',
                                                            color: theme.primary,
                                                            '&:hover': { bgcolor: 'transparent', color: theme.primaryDark }
                                                        }}
                                                    >
                                                        {selectedVersionIds.length === selectedModelObj.versions.length ? "Deselect All Versions" : "Select All Versions"}
                                                    </Button>
                                                </Stack>
                                            )}
                                            <FormControl fullWidth size="small" disabled={!selectedCompareModelId}>
                                                <InputLabel 
                                                    id="versions-select-label" 
                                                    sx={{ 
                                                        color: theme.textSecondary,
                                                        '&.Mui-focused': { color: theme.primary },
                                                        '&.MuiInputLabel-shrink': { color: theme.textSecondary },
                                                        '&.Mui-disabled': { color: theme.mode === 'dark' ? alpha(theme.textMuted, 0.35) : alpha(theme.textMuted, 0.5) }
                                                    }}
                                                >
                                                    Select Versions to Compare (2 or more)
                                                </InputLabel>
                                                <Select
                                                    labelId="versions-select-label"
                                                    multiple
                                                    value={selectedVersionIds}
                                                    onChange={(e) => setSelectedVersionIds(e.target.value as number[])}
                                                    renderValue={(selected) => (
                                                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                                            {(selected as number[]).map((value) => {
                                                                const vObj = selectedModelObj?.versions.find((v: any) => v.version_id === value);
                                                                return (
                                                                    <Chip 
                                                                        key={value} 
                                                                        label={`v${vObj?.version_number ?? value}`} 
                                                                        size="small"
                                                                        sx={{ height: 20, fontSize: '0.75rem', fontWeight: 700 }}
                                                                    />
                                                                );
                                                            })}
                                                        </Box>
                                                    )}
                                                    label="Select Versions to Compare (2 or more)"
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
                                                        '.MuiSelect-icon': { color: theme.textSecondary },
                                                        '&.Mui-disabled': {
                                                            color: theme.mode === 'dark' ? alpha(theme.textMuted, 0.35) : alpha(theme.textMuted, 0.5),
                                                            '.MuiOutlinedInput-notchedOutline': {
                                                                borderColor: theme.mode === 'dark' ? alpha(theme.border, 0.3) : alpha(theme.border, 0.4)
                                                            },
                                                            '.MuiSelect-icon': {
                                                                color: theme.mode === 'dark' ? alpha(theme.textMuted, 0.2) : alpha(theme.textMuted, 0.35)
                                                            }
                                                        }
                                                    }}
                                                >
                                                    {selectedModelObj?.versions.map((v: any) => (
                                                        <MenuItem key={v.version_id} value={v.version_id}>
                                                            v{v.version_number}
                                                        </MenuItem>
                                                    ))}
                                                </Select>
                                            </FormControl>
                                        </Grid>
                                    </Grid>

                                    {/* Interactive Comparison Preview Card */}
                                    <Box sx={{ mt: 3 }}>
                                        {selectedModelObj ? (
                                            <Box sx={{ 
                                                p: 2, 
                                                borderRadius: '16px', 
                                                bgcolor: alpha(theme.primary, 0.02), 
                                                border: `1px dashed ${alpha(theme.primary, 0.15)}` 
                                            }}>
                                                <Typography variant="caption" sx={{ color: theme.primary, display: 'block', mb: 1, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                                    Comparison Summary
                                                </Typography>
                                                <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 1.5, gap: 0.5 }}>
                                                    <Chip size="small" label={`Factory: ${selectedModelObj.factoryName}`} sx={{ bgcolor: alpha(theme.border, 0.4), color: theme.textSecondary, fontWeight: 600, height: 20, fontSize: '0.7rem' }} />
                                                    <Chip size="small" label={`Algorithm: ${selectedModelObj.algorithmName}`} sx={{ bgcolor: alpha(theme.border, 0.4), color: theme.textSecondary, fontWeight: 600, height: 20, fontSize: '0.7rem' }} />
                                                </Stack>
                                                <Typography variant="caption" sx={{ color: theme.textSecondary, fontWeight: 600, display: 'block', mb: 1 }}>
                                                    Versions available for selection:
                                                </Typography>
                                                <Box sx={{ display: 'flex', gap: 0.8, flexWrap: 'wrap' }}>
                                                    {selectedModelObj.versions.map((v: any) => {
                                                        const isSelected = selectedVersionIds.includes(v.version_id);
                                                        return (
                                                            <Box 
                                                                key={v.version_id} 
                                                                sx={{ 
                                                                    px: 1.2, py: 0.3, borderRadius: '6px', 
                                                                    fontSize: '0.7rem', fontWeight: 800,
                                                                    bgcolor: isSelected 
                                                                        ? alpha(theme.primary, 0.15) 
                                                                        : alpha(theme.border, 0.3),
                                                                    color: isSelected 
                                                                        ? theme.primary 
                                                                        : theme.textMuted,
                                                                    border: `1px solid ${isSelected ? theme.primary : 'transparent'}`,
                                                                    transition: 'all 0.2s'
                                                                }}
                                                            >
                                                                v{v.version_number} {isSelected ? '(Selected)' : ''}
                                                            </Box>
                                                        );
                                                    })}
                                                </Box>
                                            </Box>
                                        ) : (
                                            <Box sx={{ 
                                                p: 2.5, 
                                                borderRadius: '16px', 
                                                bgcolor: alpha(theme.warning, 0.02), 
                                                border: `1px dashed ${alpha(theme.warning, 0.15)}` 
                                            }}>
                                                <Typography variant="caption" sx={{ color: theme.warning, display: 'block', mb: 0.8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                                    Iterative Version Analysis
                                                </Typography>
                                                <Typography variant="caption" sx={{ color: theme.textMuted, lineHeight: 1.5, display: 'block', fontSize: '0.78rem' }}>
                                                    Select a model from the list, then select multiple registered versions (2 or more) to compare their evaluation accuracy, F1, latency, and system utilization side-by-side.
                                                </Typography>
                                            </Box>
                                        )}
                                    </Box>
                                </Box>

                                {/* Action Button */}
                                <Box sx={{ mt: 4, display: 'flex', justifyContent: 'flex-end' }}>
                                    <Button
                                        variant="contained"
                                        disabled={!selectedCompareModelId || selectedVersionIds.length < 2}
                                        onClick={() => {
                                            if (selectedModelObj) {
                                                const sortedIds = [...selectedVersionIds];
                                                const idsStr = sortedIds.join(",");
                                                navigate(`/algorithms/${selectedModelObj.algorithmId}/factories/${selectedModelObj.factoryId}/models/${selectedModelObj.model_id}/versions/compare?left=${sortedIds[0]}&right=${sortedIds[sortedIds.length - 1]}&ids=${idsStr}`);
                                            }
                                        }}
                                        sx={{
                                            borderRadius: '12px',
                                            textTransform: 'none',
                                            fontWeight: 800,
                                            px: 4,
                                            py: 1,
                                            boxShadow: `0 8px 24px -8px ${alpha(theme.primary, 0.4)}`,
                                            background: `linear-gradient(135deg, ${theme.primary} 0%, ${alpha(theme.primary, 0.8)} 100%)`,
                                            color: '#fff',
                                            '&:hover': {
                                                boxShadow: `0 12px 32px -8px ${alpha(theme.primary, 0.6)}`,
                                                background: theme.primary
                                            },
                                            '&.Mui-disabled': {
                                                bgcolor: alpha(theme.border, 0.3),
                                                color: theme.textMuted
                                            }
                                        }}
                                    >
                                        {selectedVersionIds.length < 2 ? "Select at least 2 Versions" : t("dashboard.comparePerformance", "Compare Performance")}
                                    </Button>
                                </Box>
                            </Paper>
                        </motion.div>
                    </Grid>

                    {/* Storage Donut */}
                    <Grid size={{ xs: 12, md: 5 }} sx={{ display: 'flex' }}>
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.45 }} style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column' }}>
                            <Paper elevation={0} sx={{ ...paperSx(theme), p: 3, height: '100%', minHeight: 300, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                <SectionHeader 
                                    title={t("dashboard.storageDistribution", "Storage Distribution")} 
                                    subtitle={selectedFactory === 'All' ? "Artifact data by factory (MB)" : "Artifact data by algorithm (MB)"} 
                                    icon={<Storage />} 
                                    color={theme.secondary} 
                                />
                                {storageData.length === 0 ? (
                                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
                                        <Typography sx={{ color: theme.textMuted }}>No storage data yet</Typography>
                                    </Box>
                                ) : (
                                    <>
                                        <Box sx={{ position: 'relative', height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie 
                                                        data={storageData} 
                                                        cx="50%" 
                                                        cy="50%" 
                                                        innerRadius={62} 
                                                        outerRadius={80} 
                                                        dataKey="value" 
                                                        paddingAngle={4} 
                                                        strokeWidth={0}
                                                        onMouseEnter={(_, index) => setHoveredSlice(storageData[index])}
                                                        onMouseLeave={() => setHoveredSlice(null)}
                                                    >
                                                        {storageData.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                                                    </Pie>
                                                    <ReTooltip formatter={(v: any) => [`${v} MB`, 'Storage']}
                                                        contentStyle={{ borderRadius: 16, border: `1px solid ${alpha(theme.border, 0.5)}`, backgroundColor: alpha(theme.paper, 0.9), backdropFilter: 'blur(12px)', padding: '10px 14px' }}
                                                        itemStyle={{ fontWeight: 700, color: theme.textMain }} />
                                                    <Legend iconType="circle" iconSize={8} formatter={(v) => <span style={{ color: theme.textSecondary, fontSize: 11, fontWeight: 600 }}>{v}</span>} />
                                                </PieChart>
                                            </ResponsiveContainer>
                                            <Box sx={{ position: 'absolute', pointerEvents: 'none', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                                                <Typography variant="body2" fontWeight={900} sx={{ color: theme.textMain, lineHeight: 1.1, fontSize: '1rem' }}>
                                                    {hoveredSlice ? `${hoveredSlice.value} MB` : `${storageData.reduce((acc, curr) => acc + curr.value, 0).toFixed(1)} MB`}
                                                </Typography>
                                                <Typography variant="caption" sx={{ color: theme.textMuted, fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: 0.8, mt: 0.3, maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {hoveredSlice ? hoveredSlice.name : 'Total Storage'}
                                                </Typography>
                                            </Box>
                                        </Box>
                                        <Divider sx={{ my: 2, borderColor: alpha(theme.border, 0.4) }} />
                                        <Stack spacing={1}>
                                            {storageData.slice(0, 4).map((d, i) => (
                                                <Stack key={i} direction="row" alignItems="center" spacing={1.5}>
                                                    <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: PALETTE[i % PALETTE.length], flexShrink: 0 }} />
                                                    <Typography variant="caption" fontWeight={600} sx={{ color: theme.textSecondary, flex: 1 }} noWrap>{d.name}</Typography>
                                                    <Typography variant="caption" fontWeight={800} sx={{ color: theme.textMuted }}>{d.value} MB</Typography>
                                                </Stack>
                                            ))}
                                        </Stack>
                                    </>
                                )}
                            </Paper>
                        </motion.div>
                    </Grid>
                </Grid>

                {/* ═══ ROW 3: Factory Deployments (Full-Width Grid) ═══ */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.5 }}>
                    <Box sx={{ mb: 6 }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
                            <Box>
                                <Typography variant="h6" fontWeight={800} sx={{ color: theme.textMain }}>
                                    Factory Deployments
                                </Typography>
                                <Typography variant="caption" sx={{ color: theme.textMuted }}>
                                    Physical factories and registered model instances
                                </Typography>
                            </Box>
                            <Chip 
                                icon={<Circle sx={{ fontSize: '8px !important', color: `${theme.success} !important` }} />}
                                label={`${filteredFactories.reduce((s, f) => s + f.algorithms.reduce((a, al) => a + al.active_models.length, 0), 0)} active deployments`}
                                size="small" 
                                sx={{ bgcolor: alpha(theme.success, 0.1), color: theme.success, fontWeight: 700, border: `1px solid ${alpha(theme.success, 0.2)}` }} 
                            />
                        </Stack>

                        {filteredFactories.length === 0 ? (
                            <Paper elevation={0} sx={{ ...paperSx(theme), p: 6, textAlign: 'center' }}>
                                <Typography sx={{ color: theme.textMuted }}>No factories matching filters found.</Typography>
                                <Button variant="text" size="small" sx={{ mt: 1, textTransform: 'none' }} onClick={() => navigate('/factories')}>
                                    Create a factory
                                </Button>
                            </Paper>
                        ) : (
                            <Grid container spacing={3}>
                                {filteredFactories.map(factory => {
                                    const totalActive = factory.algorithms.reduce((s, a) => s + a.active_models.length, 0);
                                    return (
                                        <Grid key={factory.factory_id} size={{ xs: 12, sm: 6, md: 4 }}>
                                            <Paper 
                                                elevation={0} 
                                                onClick={() => navigate(`/factories/${factory.factory_id}`)}
                                                sx={{ 
                                                    ...paperSx(theme), p: 3, height: '100%', 
                                                    cursor: 'pointer',
                                                    display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                                                    background: mode === 'dark' 
                                                        ? `linear-gradient(145deg, ${alpha(theme.paper, 0.9)} 0%, ${alpha(theme.primary, 0.02)} 100%)` 
                                                        : `linear-gradient(145deg, ${alpha(theme.paper, 0.6)} 0%, ${alpha(theme.primary, 0.01)} 100%)`
                                                }}
                                            >
                                                <Box>
                                                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 2 }}>
                                                        <Stack direction="row" spacing={1.8} alignItems="center">
                                                            <Box sx={{ 
                                                                p: 1.2, 
                                                                bgcolor: totalActive > 0 ? alpha(theme.success, 0.1) : alpha(theme.textMuted, 0.08), 
                                                                borderRadius: '12px', 
                                                                color: totalActive > 0 ? theme.success : theme.textMuted, 
                                                                display: 'flex',
                                                                boxShadow: `inset 0 0 0 1px ${alpha(totalActive > 0 ? theme.success : theme.textMuted, 0.15)}`
                                                            }}>
                                                                <FactoryOutlined fontSize="small" />
                                                            </Box>
                                                            <Box minWidth={0}>
                                                                <Typography variant="body1" fontWeight={800} sx={{ color: theme.textMain }} noWrap>
                                                                    {factory.factory_name}
                                                                </Typography>
                                                            </Box>
                                                        </Stack>
                                                        <Chip 
                                                            icon={<Circle sx={{ fontSize: '8px !important', color: `${totalActive > 0 ? theme.success : theme.textMuted} !important` }} />}
                                                            label={totalActive > 0 ? 'Active' : 'Idle'} 
                                                            size="small" 
                                                            sx={{ 
                                                                height: 22,
                                                                bgcolor: totalActive > 0 ? alpha(theme.success, 0.1) : alpha(theme.textMuted, 0.08), 
                                                                color: totalActive > 0 ? theme.success : theme.textMuted, 
                                                                fontWeight: 700, 
                                                                border: `1px solid ${alpha(totalActive > 0 ? theme.success : theme.textMuted, 0.2)}` 
                                                            }} 
                                                        />
                                                    </Stack>

                                                    <Divider sx={{ my: 1.8, borderColor: alpha(theme.border, 0.4) }} />

                                                    <Stack spacing={1.2} sx={{ mb: 2 }}>
                                                        <Box display="flex" justifyContent="space-between">
                                                            <Typography variant="caption" sx={{ color: theme.textMuted, fontWeight: 600 }}>Algorithms Deployed</Typography>
                                                            <Typography variant="caption" sx={{ color: theme.textSecondary, fontWeight: 800 }}>{factory.algorithms.length}</Typography>
                                                        </Box>
                                                        <Box display="flex" justifyContent="space-between">
                                                            <Typography variant="caption" sx={{ color: theme.textMuted, fontWeight: 600 }}>Active Deployments</Typography>
                                                            <Typography variant="caption" sx={{ color: theme.textSecondary, fontWeight: 800 }}>{totalActive}</Typography>
                                                        </Box>
                                                    </Stack>

                                                    <Box sx={{ mt: 2 }}>
                                                        <Typography variant="caption" fontWeight={700} sx={{ color: theme.textMuted, letterSpacing: 0.5, display: 'block', mb: 1, textTransform: 'uppercase', fontSize: '0.62rem' }}>
                                                            Models & Active Versions
                                                        </Typography>
                                                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.8 }}>
                                                            {factory.algorithms.flatMap(algo => 
                                                                algo.active_models.map(model => (
                                                                    <Tooltip key={model.model_id} title={`${algo.algorithm_name} › Version ${model.version_number}`}>
                                                                        <Chip
                                                                            label={`${model.model_name} v${model.version_number}`}
                                                                            size="small"
                                                                            sx={{
                                                                                height: 22,
                                                                                bgcolor: alpha(theme.primary, 0.08),
                                                                                color: theme.primary,
                                                                                fontWeight: 600,
                                                                                fontSize: '0.7rem',
                                                                                border: `1px solid ${alpha(theme.primary, 0.15)}`,
                                                                                '&:hover': { bgcolor: alpha(theme.primary, 0.12) }
                                                                            }}
                                                                        />
                                                                    </Tooltip>
                                                                ))
                                                            )}
                                                            {totalActive === 0 && (
                                                                <Typography variant="caption" sx={{ color: theme.textMuted, fontStyle: 'italic' }}>
                                                                    No active versions running
                                                                </Typography>
                                                            )}
                                                        </Box>
                                                    </Box>
                                                </Box>

                                                <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                                                    <Button 
                                                        variant="outlined" 
                                                        size="small"
                                                        endIcon={<ArrowForward sx={{ fontSize: '14px !important' }} />} 
                                                        onClick={(e) => { e.stopPropagation(); navigate(`/factories/${factory.factory_id}`); }}
                                                        sx={{ 
                                                            borderRadius: '10px', 
                                                            textTransform: 'none', 
                                                            fontWeight: 700, 
                                                            px: 1.8, 
                                                            py: 0.5,
                                                            fontSize: '0.75rem',
                                                            border: `1px solid ${alpha(theme.primary, 0.25)}`, 
                                                            color: theme.primary,
                                                            bgcolor: alpha(theme.primary, 0.02),
                                                            '&:hover': { 
                                                                bgcolor: theme.primary, 
                                                                color: theme.white,
                                                                borderColor: theme.primary
                                                            } 
                                                        }}
                                                    >
                                                        Configure
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

                {/* ═══ ROW 4: Recent Activity (Horizontal Timeline Cards Stack) ═══ */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.55 }}>
                    <Box sx={{ mb: 6 }}>
                        <Box sx={{ mb: 3 }}>
                            <Typography variant="h6" fontWeight={800} sx={{ color: theme.textMain }}>
                                {t("dashboard.activityLog", "Platform Activity")}
                            </Typography>
                            <Typography variant="caption" sx={{ color: theme.textMuted }}>
                                {t("dashboard.activityLogSub", "Real-time event stream across your factories")}
                            </Typography>
                        </Box>
                        
                        {filteredActivity.length === 0 ? (
                            <Paper elevation={0} sx={{ ...paperSx(theme), p: 4, textAlign: 'center' }}>
                                <Typography sx={{ color: theme.textMuted }}>No recent activity recorded yet.</Typography>
                            </Paper>
                        ) : (
                            <Stack spacing={2}>
                                {filteredActivity.slice(0, 5).map((item, i) => {
                                    const isFactoryEvent = item.type === "factory_event";
                                    
                                    const isCreated = item.created_at === item.timestamp;
                                    const actionTitle = isFactoryEvent 
                                        ? t("dashboard.factoryCreated", "Factory Created") 
                                        : (isCreated ? t("dashboard.versionCreated", "Version Created") : t("dashboard.versionActivated", "Version Activated"));
                                        
                                    const actionDesc = isFactoryEvent 
                                        ? `Created new production unit ${item.factory_name}` 
                                        : (isCreated 
                                            ? `Created v${item.version_number} of model ${item.model_name}`
                                            : `Updated parameters of v${item.version_number} of model ${item.model_name}`);
                                            
                                    const clickPath = isFactoryEvent 
                                        ? '/factories' 
                                        : `/algorithms/${item.algorithm_id}/factories/${item.factory_id}/models/${item.model_id}/versions/${item.version_id}`;

                                    const actionColor = isFactoryEvent 
                                        ? theme.secondary 
                                        : (isCreated ? theme.success : theme.primary);
                                        
                                    const ActionIcon = isFactoryEvent 
                                        ? FactoryOutlined 
                                        : (isCreated ? AddCircleOutlined : EditOutlined);

                                    return (
                                        <Paper
                                            key={i}
                                            elevation={0}
                                            onClick={() => navigate(clickPath)}
                                            sx={{
                                                p: 2,
                                                borderRadius: '20px',
                                                border: `1px solid ${alpha(theme.border, 0.4)}`,
                                                bgcolor: theme.mode === 'dark' ? alpha(theme.paper, 0.4) : alpha(theme.paper, 0.7),
                                                cursor: 'pointer',
                                                transition: 'all 0.25s ease',
                                                backdropFilter: 'blur(20px)',
                                                '&:hover': {
                                                    bgcolor: theme.mode === 'dark' ? alpha(theme.paper, 0.8) : theme.background,
                                                    borderColor: alpha(actionColor, 0.4),
                                                    transform: 'translateY(-2px)',
                                                    boxShadow: `0 8px 24px -12px ${alpha(actionColor, 0.25)}`
                                                }
                                            }}
                                        >
                                            <Stack
                                                direction={{ xs: 'column', md: 'row' }}
                                                spacing={{ xs: 2, md: 3 }}
                                                alignItems={{ xs: 'flex-start', md: 'center' }}
                                                justifyContent="space-between"
                                            >
                                                {/* Left: Icon & Action Title */}
                                                <Stack direction="row" spacing={2} alignItems="center" sx={{ minWidth: 0, flex: 1 }}>
                                                    <Box sx={{
                                                        p: 1.5, borderRadius: '12px', bgcolor: alpha(actionColor, 0.1), color: actionColor,
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        boxShadow: `inset 0 0 0 1px ${alpha(actionColor, 0.15)}`, flexShrink: 0,
                                                    }}>
                                                        <ActionIcon fontSize="medium" />
                                                    </Box>
                                                    <Box minWidth={0}>
                                                        <Typography variant="subtitle2" fontWeight={800} sx={{ color: theme.textMain, display: 'flex', alignItems: 'center', gap: 1 }}>
                                                            {actionTitle}
                                                            <Chip 
                                                                label={isFactoryEvent ? "system" : (isCreated ? "new" : "update")} 
                                                                size="small" 
                                                                sx={{ 
                                                                    height: 16, 
                                                                    fontSize: '0.62rem', 
                                                                    fontWeight: 800, 
                                                                    bgcolor: alpha(actionColor, 0.1), 
                                                                    color: actionColor,
                                                                    border: `1px solid ${alpha(actionColor, 0.2)}`,
                                                                    textTransform: 'uppercase'
                                                                }} 
                                                            />
                                                        </Typography>
                                                        <Typography variant="body2" sx={{ color: theme.textSecondary, fontWeight: 500, mt: 0.2 }} noWrap>
                                                            {actionDesc}
                                                        </Typography>
                                                    </Box>
                                                </Stack>

                                                {/* Middle: Breadcrumb scope (Factory / Algorithm) */}
                                                <Stack direction="row" spacing={1} alignItems="center" sx={{ display: { xs: 'none', sm: 'flex' } }}>
                                                    <Chip
                                                        label={item.factory_name}
                                                        size="small"
                                                        sx={{
                                                            bgcolor: alpha(theme.primary, 0.05),
                                                            color: theme.textSecondary,
                                                            fontWeight: 700,
                                                            fontSize: '0.72rem',
                                                            border: `1px solid ${alpha(theme.border, 0.5)}`
                                                        }}
                                                    />
                                                    {!isFactoryEvent && (
                                                        <>
                                                            <Typography variant="caption" sx={{ color: theme.textMuted }}>›</Typography>
                                                            <Chip
                                                                label={item.algorithm_name}
                                                                size="small"
                                                                sx={{
                                                                    bgcolor: alpha(theme.secondary, 0.05),
                                                                    color: theme.textSecondary,
                                                                    fontWeight: 700,
                                                                    fontSize: '0.72rem',
                                                                    border: `1px solid ${alpha(theme.border, 0.5)}`
                                                                }}
                                                            />
                                                        </>
                                                    )}
                                                </Stack>

                                                {/* Right: Timestamp & Arrow Link */}
                                                <Stack direction="row" spacing={2} alignItems="center" sx={{ alignSelf: { xs: 'flex-end', md: 'center' } }}>
                                                    <Typography variant="caption" sx={{ color: theme.textMuted, fontWeight: 600 }}>
                                                        {timeAgo(item.timestamp)}
                                                    </Typography>
                                                    <Box sx={{
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        width: 28, height: 28, borderRadius: '50%',
                                                        bgcolor: alpha(theme.border, 0.2), color: theme.textSecondary,
                                                        transition: 'all 0.2s',
                                                        '&:hover': {
                                                            bgcolor: actionColor,
                                                            color: theme.white,
                                                        }
                                                    }}>
                                                        <ArrowForward sx={{ fontSize: 16 }} />
                                                    </Box>
                                                </Stack>
                                            </Stack>
                                        </Paper>
                                    );
                                })}
                            </Stack>
                        )}
                    </Box>
                </motion.div>
            </Container>

            <style>{`
                @keyframes dashPulse { 0%, 100% { opacity: 1; box-shadow: 0 0 10px currentColor; } 50% { opacity: 0.5; box-shadow: 0 0 20px currentColor; } }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </Box>
    );
}
