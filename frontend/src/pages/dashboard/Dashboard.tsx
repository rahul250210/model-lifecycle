"use client";

import { useState, useEffect } from 'react';
import {
    Box, Grid, Typography, CircularProgress, Paper, Stack, Container,
    Chip, Avatar, Divider, LinearProgress, Button, IconButton, Accordion,
    AccordionSummary, AccordionDetails, alpha, Tooltip,
} from '@mui/material';
import {
    FactoryOutlined, PrecisionManufacturing, SmartToy, CheckCircle,
    Storage, ExpandMore, TrendingUp, EmojiEvents,
    ArrowForward, Refresh, LayersOutlined, Circle,
} from '@mui/icons-material';
import {
    ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid,
    Tooltip as ReTooltip, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { motion } from 'framer-motion';
import { format, parseISO } from 'date-fns';
import { useTheme } from '../../theme/ThemeContext';
import axiosInstance from '../../api/axios';
import { useNavigate } from 'react-router-dom';

// ─── Types ───────────────────────────────────────────────────────────────────
interface Stats { factories: number; algorithms: number; models: number; active_versions: number; total_storage_bytes: number; }
interface ActivityItem { timestamp: string; version_number: number; model_name: string; algorithm_name: string; factory_name: string; }
interface ChartDataItem { name: string; value: number; }
interface TrendItem { date: string; count: number; }
interface PerformanceItem { name: string; accuracy: number; f1_score: number; algorithm: string; }
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
function ScoreCard({ title, value, icon, color, sub }: any) {
    const { theme } = useTheme();
    return (
        <Paper elevation={0} sx={{ ...paperSx(theme), p: 3, display: 'flex', alignItems: 'center', gap: 2.5, height: '100%' }}>
            <Box sx={{
                p: 1.8, borderRadius: '18px', bgcolor: alpha(color, 0.15), color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: `inset 0 0 0 1px ${alpha(color, 0.2)}`, flexShrink: 0,
            }}>
                {icon}
            </Box>
            <Box minWidth={0}>
                <Typography variant="overline" fontWeight={700} sx={{ color: theme.textMuted, letterSpacing: 1.2, display: 'block', lineHeight: 1.2, fontSize: '0.7rem' }}>
                    {title}
                </Typography>
                <Typography variant="h5" fontWeight={800} noWrap sx={{ color: theme.textMain, lineHeight: 1.2, mt: 0.3 }}>
                    {value}
                </Typography>
                {sub && <Typography variant="caption" sx={{ color: theme.textMuted }}>{sub}</Typography>}
            </Box>
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

    const [stats, setStats] = useState<Stats | null>(null);
    const [activity, setActivity] = useState<ActivityItem[]>([]);
    const [storageData, setStorageData] = useState<ChartDataItem[]>([]);
    const [trends, setTrends] = useState<TrendItem[]>([]);
    const [performance, setPerformance] = useState<PerformanceItem[]>([]);
    const [factoryStatus, setFactoryStatus] = useState<FactoryStatus[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const PALETTE = [theme.primary, theme.secondary, theme.success, theme.warning, theme.error, theme.info, '#f97316', '#ec4899'];

    const load = async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true); else setLoading(true);
        try {
            const [s, a, sd, t, p, fs] = await Promise.all([
                axiosInstance.get('/dashboard/stats'),
                axiosInstance.get('/dashboard/recent-activity'),
                axiosInstance.get('/dashboard/charts/storage-distribution'),
                axiosInstance.get('/dashboard/charts/activity-trends?days=30'),
                axiosInstance.get('/dashboard/charts/performance-metrics'),
                axiosInstance.get('/dashboard/factory-status'),
            ]);
            setStats(s.data);
            setActivity(a.data);
            setStorageData(sd.data.map((d: any) => ({ ...d, value: +(d.value / 1048576).toFixed(1) })));
            setTrends(t.data);
            setPerformance(p.data);
            setFactoryStatus(fs.data);
        } catch (e) { console.error(e); }
        finally { setLoading(false); setRefreshing(false); }
    };
    useEffect(() => { load(); }, []);

    if (loading) return (
        <Box sx={{ height: '80vh', display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 2 }}>
            <CircularProgress size={42} sx={{ color: theme.primary }} />
            <Typography sx={{ color: theme.textMuted, fontWeight: 500 }}>Loading platform data…</Typography>
        </Box>
    );

    const topModel = performance[0] ?? null;
    const totalEvents = trends.reduce((s, d) => s + d.count, 0);

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
                                    System Live
                                </Typography>
                            </Stack>
                            <Typography variant="h3" fontWeight={900} sx={{
                                letterSpacing: '-0.03em', mb: 1,
                                background: `linear-gradient(135deg, ${theme.textMain} 0%, ${theme.textSecondary} 100%)`,
                                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                            }}>
                                Platform Overview
                            </Typography>
                            <Typography variant="h6" sx={{ color: theme.textMuted, fontWeight: 500, maxWidth: 520 }}>
                                Real-time intelligence across your ML model lifecycle — factories, algorithms, versions, and performance.
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
                            <Button variant="outlined" startIcon={<LayersOutlined />} onClick={() => navigate('/factories')}
                                sx={{ borderRadius: '12px', fontWeight: 700, px: 3, py: 1, textTransform: 'none', border: `1px solid ${theme.border}`, color: theme.textSecondary, bgcolor: alpha(theme.paper, 0.8), '&:hover': { bgcolor: theme.background, borderColor: theme.textSecondary } }}>
                                Manage Factories
                            </Button>
                        </Stack>
                    </Stack>
                </Box>

                {/* ═══ KPI SCORECARDS ═══ */}
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
                    <Grid container spacing={3} sx={{ mb: 5 }}>
                        {[
                            { title: 'Factories', value: stats?.factories ?? 0, icon: <FactoryOutlined />, color: theme.primary, sub: 'Production units' },
                            { title: 'Algorithms', value: stats?.algorithms ?? 0, icon: <PrecisionManufacturing />, color: theme.secondary, sub: 'Algorithm types' },
                            { title: 'Models', value: stats?.models ?? 0, icon: <SmartToy />, color: theme.success, sub: 'Trained models' },
                            { title: 'Active Versions', value: stats?.active_versions ?? 0, icon: <CheckCircle />, color: theme.warning, sub: 'Deployed now' },
                            { title: 'Total Storage', value: formatBytes(stats?.total_storage_bytes ?? 0), icon: <Storage />, color: theme.info, sub: 'Artifact data' },
                        ].map((c, i) => (
                            <Grid key={c.title} size={{ xs: 12, sm: 6, md: 12 / 5 }}>
                                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: i * 0.07 }}>
                                    <ScoreCard {...c} />
                                </motion.div>
                            </Grid>
                        ))}
                    </Grid>
                </motion.div>

                {/* ═══ CHARTS ROW 1: Activity Trend + Top Model ═══ */}
                <Grid container spacing={3} sx={{ mb: 4 }}>
                    {/* Activity Trend */}
                    <Grid size={{ xs: 12, md: topModel ? 7 : 12 }}>
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }}>
                            <Paper elevation={0} sx={{ ...paperSx(theme), p: 3, height: '100%', minHeight: 340 }}>
                                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 3 }}>
                                    <SectionHeader title="Activity Trend" subtitle="Version events — last 30 days" icon={<TrendingUp />} color={theme.primary} />
                                    {totalEvents > 0 && (
                                        <Chip label={`${totalEvents} total events`} size="small"
                                            sx={{ bgcolor: alpha(theme.primary, 0.1), color: theme.primary, fontWeight: 700, border: `1px solid ${alpha(theme.primary, 0.2)}` }} />
                                    )}
                                </Stack>
                                {trends.length === 0 ? (
                                    <Box sx={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Typography sx={{ color: theme.textMuted }}>No activity data yet</Typography>
                                    </Box>
                                ) : (
                                    <Box sx={{ height: 260 }}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={trends} margin={{ top: 8, right: 8, bottom: 8, left: -16 }}>
                                                <defs>
                                                    <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor={theme.primary} stopOpacity={0.35} />
                                                        <stop offset="95%" stopColor={theme.primary} stopOpacity={0} />
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={alpha(theme.border, 0.3)} />
                                                <XAxis dataKey="date" axisLine={false} tickLine={false}
                                                    tick={{ fill: theme.textMuted, fontSize: 11, fontWeight: 600 }}
                                                    tickFormatter={v => v.slice(5)} />
                                                <YAxis axisLine={false} tickLine={false}
                                                    tick={{ fill: theme.textMuted, fontSize: 11, fontWeight: 600 }}
                                                    allowDecimals={false} />
                                                <ReTooltip contentStyle={{
                                                    borderRadius: 16, border: `1px solid ${alpha(theme.border, 0.5)}`,
                                                    boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
                                                    backgroundColor: alpha(theme.paper, 0.9),
                                                    backdropFilter: 'blur(12px)', padding: '10px 14px',
                                                }} itemStyle={{ fontWeight: 700, color: theme.primary }}
                                                    labelStyle={{ color: theme.textMuted, fontWeight: 600, fontSize: 11 }} cursor={{ stroke: theme.textMuted, strokeWidth: 1, strokeDasharray: '4 4' }} />
                                                <Area type="monotone" dataKey="count" name="Events" stroke={theme.primary} strokeWidth={2.5}
                                                    fill="url(#trendGrad)" dot={false} activeDot={{ r: 6, fill: theme.primary, strokeWidth: 0 }} />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </Box>
                                )}
                            </Paper>
                        </motion.div>
                    </Grid>

                    {/* Top Model Spotlight */}
                    {topModel && (
                        <Grid size={{ xs: 12, md: 5 }}>
                            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.35 }}>
                                <Paper elevation={0} sx={{
                                    borderRadius: '24px', p: 3, height: '100%', minHeight: 340, position: 'relative', overflow: 'hidden',
                                    background: mode === 'dark'
                                        ? `linear-gradient(145deg, ${alpha(theme.warning, 0.12)} 0%, ${alpha(theme.secondary, 0.08)} 100%)`
                                        : `linear-gradient(145deg, ${alpha(theme.warning, 0.08)} 0%, ${alpha(theme.secondary, 0.05)} 100%)`,
                                    border: `1px solid ${alpha(theme.warning, 0.25)}`,
                                    backdropFilter: 'blur(20px)',
                                }}>
                                    <Box sx={{ position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: '50%', bgcolor: alpha(theme.warning, 0.08), filter: 'blur(30px)' }} />
                                    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 3 }}>
                                        <Box sx={{ p: 1, bgcolor: alpha(theme.warning, 0.15), borderRadius: '14px', color: theme.warning, display: 'flex' }}>
                                            <EmojiEvents />
                                        </Box>
                                        <Box>
                                            <Typography variant="h6" fontWeight={800} sx={{ background: `linear-gradient(45deg, ${theme.textMain}, ${theme.textSecondary})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                                                Top Performer
                                            </Typography>
                                            <Typography variant="caption" sx={{ color: theme.textMuted }}>Best active model by accuracy</Typography>
                                        </Box>
                                    </Stack>

                                    <Typography variant="h5" fontWeight={800} sx={{ color: theme.textMain, mb: 0.5 }} noWrap>{topModel.name}</Typography>
                                    <Chip label={topModel.algorithm} size="small" sx={{ mb: 3, bgcolor: alpha(theme.secondary, 0.1), color: theme.secondary, fontWeight: 700, border: `1px solid ${alpha(theme.secondary, 0.2)}` }} />

                                    {[
                                        { label: 'Accuracy', val: topModel.accuracy, color: theme.primary },
                                        { label: 'F1 Score', val: topModel.f1_score, color: theme.success },
                                    ].map(m => (
                                        <Box key={m.label} sx={{ mb: 2 }}>
                                            <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.8 }}>
                                                <Typography variant="body2" fontWeight={700} sx={{ color: theme.textSecondary }}>{m.label}</Typography>
                                                <Typography variant="body2" fontWeight={800} sx={{ color: m.color }}>{(m.val * 100).toFixed(1)}%</Typography>
                                            </Stack>
                                            <LinearProgress variant="determinate" value={m.val * 100} sx={{
                                                height: 8, borderRadius: 4,
                                                bgcolor: alpha(m.color, 0.12),
                                                '& .MuiLinearProgress-bar': { bgcolor: m.color, borderRadius: 4, boxShadow: `0 0 8px ${alpha(m.color, 0.5)}` },
                                            }} />
                                        </Box>
                                    ))}

                                    {performance.length > 1 && (
                                        <Typography variant="caption" sx={{ color: theme.textMuted, mt: 1, display: 'block' }}>
                                            +{performance.length - 1} other active models tracked
                                        </Typography>
                                    )}
                                </Paper>
                            </motion.div>
                        </Grid>
                    )}
                </Grid>

                {/* ═══ CHARTS ROW 2: Leaderboard + Storage ═══ */}
                <Grid container spacing={3} sx={{ mb: 4 }}>
                    {/* Performance Leaderboard */}
                    <Grid size={{ xs: 12, md: 7 }}>
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.4 }}>
                            <Paper elevation={0} sx={{ ...paperSx(theme), overflow: 'hidden' }}>
                                <Box sx={{ p: 3, borderBottom: `1px solid ${alpha(theme.border, 0.4)}`, bgcolor: mode === 'dark' ? alpha(theme.paper, 0.9) : alpha(theme.paper, 0.6) }}>
                                    <SectionHeader title="Performance Leaderboard" subtitle="Active models ranked by accuracy" icon={<EmojiEvents />} color={theme.warning} />
                                </Box>
                                <Stack spacing={0}>
                                    {performance.length === 0 ? (
                                        <Box sx={{ p: 6, textAlign: 'center' }}>
                                            <Typography sx={{ color: theme.textMuted }}>No active models with metrics yet</Typography>
                                        </Box>
                                    ) : performance.slice(0, 6).map((p, i) => (
                                        <Box key={i} sx={{
                                            p: 2.5, display: 'flex', alignItems: 'center', gap: 2,
                                            borderBottom: i < Math.min(performance.length, 6) - 1 ? `1px solid ${alpha(theme.border, 0.3)}` : 'none',
                                            '&:hover': { bgcolor: alpha(theme.primary, 0.04) }, transition: 'background 0.2s',
                                        }}>
                                            <Box sx={{
                                                width: 40, height: 40, borderRadius: '12px', flexShrink: 0,
                                                bgcolor: i === 0 ? alpha('#FFD700', 0.15) : i === 1 ? alpha('#C0C0C0', 0.15) : i === 2 ? alpha('#CD7F32', 0.15) : alpha(theme.primary, 0.08),
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: i < 3 ? '1.2rem' : '0.85rem', fontWeight: 800,
                                                color: i < 3 ? undefined : theme.textMuted,
                                            }}>
                                                {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                                            </Box>
                                            <Box flex={1} minWidth={0}>
                                                <Stack direction="row" spacing={1} alignItems="center">
                                                    <Typography variant="body1" fontWeight={700} sx={{ color: theme.textMain }} noWrap>{p.name}</Typography>
                                                    {i === 0 && <Chip label="Best" size="small" sx={{ height: 20, bgcolor: alpha('#FFD700', 0.15), color: '#b8860b', fontWeight: 700, fontSize: '0.65rem' }} />}
                                                </Stack>
                                                <Typography variant="caption" sx={{ color: theme.textMuted }}>{p.algorithm}</Typography>
                                            </Box>
                                            <Box textAlign="right" flexShrink={0}>
                                                <Typography variant="body1" fontWeight={800} sx={{ color: theme.primary }}>{(p.accuracy * 100).toFixed(1)}%</Typography>
                                                <Typography variant="caption" sx={{ color: theme.textMuted }}>F1: {(p.f1_score * 100).toFixed(1)}%</Typography>
                                            </Box>
                                        </Box>
                                    ))}
                                </Stack>
                            </Paper>
                        </motion.div>
                    </Grid>

                    {/* Storage Donut */}
                    <Grid size={{ xs: 12, md: 5 }}>
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.45 }}>
                            <Paper elevation={0} sx={{ ...paperSx(theme), p: 3, height: '100%', minHeight: 300 }}>
                                <SectionHeader title="Storage Distribution" subtitle="Artifact data by factory (MB)" icon={<Storage />} color={theme.secondary} />
                                {storageData.length === 0 ? (
                                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
                                        <Typography sx={{ color: theme.textMuted }}>No storage data yet</Typography>
                                    </Box>
                                ) : (
                                    <>
                                        <Box sx={{ height: 200 }}>
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie data={storageData} cx="50%" cy="50%" innerRadius={52} outerRadius={80} dataKey="value" paddingAngle={4} strokeWidth={0}>
                                                        {storageData.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                                                    </Pie>
                                                    <ReTooltip formatter={(v: any) => [`${v} MB`, 'Storage']}
                                                        contentStyle={{ borderRadius: 16, border: `1px solid ${alpha(theme.border, 0.5)}`, backgroundColor: alpha(theme.paper, 0.9), backdropFilter: 'blur(12px)', padding: '10px 14px' }}
                                                        itemStyle={{ fontWeight: 700, color: theme.textMain }} />
                                                    <Legend iconType="circle" iconSize={8} formatter={(v) => <span style={{ color: theme.textSecondary, fontSize: 11, fontWeight: 600 }}>{v}</span>} />
                                                </PieChart>
                                            </ResponsiveContainer>
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

                {/* ═══ ROW 3: Activity Feed + Factory Status ═══ */}
                <Grid container spacing={3}>
                    {/* Activity Feed */}
                    <Grid size={{ xs: 12, md: 4 }}>
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.5 }}>
                            <Paper elevation={0} sx={{ ...paperSx(theme), overflow: 'hidden' }}>
                                <Box sx={{ p: 3, borderBottom: `1px solid ${alpha(theme.border, 0.4)}`, bgcolor: mode === 'dark' ? alpha(theme.paper, 0.9) : alpha(theme.paper, 0.6) }}>
                                    <Typography variant="h6" fontWeight={800} sx={{ color: theme.textMain }}>Recent Activity</Typography>
                                </Box>
                                <Stack spacing={0}>
                                    {activity.length === 0 ? (
                                        <Box sx={{ p: 6, textAlign: 'center' }}>
                                            <Typography sx={{ color: theme.textMuted }}>No recent activity recorded yet.</Typography>
                                        </Box>
                                    ) : activity.slice(0, 8).map((item, i) => (
                                        <Box key={i} sx={{
                                            p: 2.5, display: 'flex', gap: 2, alignItems: 'flex-start',
                                            borderBottom: i < Math.min(activity.length, 8) - 1 ? `1px solid ${alpha(theme.border, 0.3)}` : 'none',
                                            '&:hover': { bgcolor: alpha(theme.primary, 0.04) }, transition: 'background 0.2s',
                                        }}>
                                            <Avatar sx={{ width: 40, height: 40, borderRadius: '12px', bgcolor: alpha(theme.primary, 0.12), color: theme.primary, fontSize: 14, fontWeight: 800, boxShadow: `0 4px 12px ${alpha(theme.primary, 0.15)}`, flexShrink: 0 }}>
                                                {item.model_name?.[0]?.toUpperCase() ?? '?'}
                                            </Avatar>
                                            <Box flex={1} minWidth={0}>
                                                <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                                                    <Typography variant="body2" fontWeight={700} sx={{ color: theme.textMain }} noWrap>
                                                        {item.model_name}
                                                        <Chip component="span" label={`v${item.version_number}`} size="small"
                                                            sx={{ ml: 0.8, height: 20, fontSize: '0.65rem', fontWeight: 700, bgcolor: alpha(theme.primary, 0.1), color: theme.primary, verticalAlign: 'middle' }} />
                                                    </Typography>
                                                    <Typography variant="caption" sx={{ color: theme.textMuted, flexShrink: 0, ml: 1 }}>
                                                        {timeAgo(item.timestamp)}
                                                    </Typography>
                                                </Stack>
                                                <Typography variant="caption" sx={{ color: theme.textMuted }}>
                                                    {item.factory_name} › {item.algorithm_name}
                                                </Typography>
                                            </Box>
                                        </Box>
                                    ))}
                                </Stack>
                            </Paper>
                        </motion.div>
                    </Grid>

                    {/* Factory Status */}
                    <Grid size={{ xs: 12, md: 8 }}>
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.55 }}>
                            <Paper elevation={0} sx={{ ...paperSx(theme), overflow: 'hidden' }}>
                                <Box sx={{ p: 3, borderBottom: `1px solid ${alpha(theme.border, 0.4)}`, bgcolor: mode === 'dark' ? alpha(theme.paper, 0.9) : alpha(theme.paper, 0.6) }}>
                                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                                        <Typography variant="h6" fontWeight={800} sx={{ color: theme.textMain }}>Factory Deployment Status</Typography>
                                        <Chip icon={<Circle sx={{ fontSize: '10px !important', color: `${theme.success} !important` }} />}
                                            label={`${factoryStatus.reduce((s, f) => s + f.algorithms.reduce((a, al) => a + al.active_models.length, 0), 0)} active deployments`}
                                            size="small" sx={{ bgcolor: alpha(theme.success, 0.1), color: theme.success, fontWeight: 700, border: `1px solid ${alpha(theme.success, 0.2)}` }} />
                                    </Stack>
                                </Box>
                                <Box sx={{ maxHeight: 440, overflowY: 'auto', p: 2 }}>
                                    {factoryStatus.length === 0 ? (
                                        <Box sx={{ p: 6, textAlign: 'center' }}>
                                            <Typography sx={{ color: theme.textMuted }}>No factories found.</Typography>
                                            <Button variant="text" size="small" sx={{ mt: 1, textTransform: 'none' }} onClick={() => navigate('/factories')}>
                                                Create your first factory
                                            </Button>
                                        </Box>
                                    ) : (
                                        <Stack spacing={2}>
                                            {factoryStatus.map(factory => {
                                                const totalActive = factory.algorithms.reduce((s, a) => s + a.active_models.length, 0);
                                                return (
                                                    <Accordion key={factory.factory_id} disableGutters elevation={0}
                                                        sx={{ bgcolor: alpha(theme.primary, 0.02), border: `1px solid ${alpha(theme.border, 0.4)}`, borderRadius: '16px !important', '&:before': { display: 'none' }, '&:hover': { borderColor: alpha(theme.primary, 0.3) }, transition: 'border-color 0.2s' }}>
                                                        <AccordionSummary expandIcon={<ExpandMore sx={{ color: theme.textMuted }} />} sx={{ minHeight: 56, px: 2.5 }}>
                                                            <Stack direction="row" alignItems="center" spacing={2} sx={{ width: '100%', mr: 1 }}>
                                                                <Box sx={{ p: 1.2, bgcolor: alpha(theme.primary, 0.1), borderRadius: '12px', color: theme.primary, display: 'flex' }}>
                                                                    <FactoryOutlined fontSize="small" />
                                                                </Box>
                                                                <Box flex={1}>
                                                                    <Typography fontWeight={800} sx={{ color: theme.textMain }}>{factory.factory_name}</Typography>
                                                                    <Typography variant="caption" sx={{ color: theme.textMuted }}>{factory.algorithms.length} algorithm{factory.algorithms.length !== 1 ? 's' : ''}</Typography>
                                                                </Box>
                                                                <Chip label={`${totalActive} active`} size="small"
                                                                    sx={{ bgcolor: totalActive > 0 ? alpha(theme.success, 0.1) : alpha(theme.textMuted, 0.08), color: totalActive > 0 ? theme.success : theme.textMuted, fontWeight: 700, border: `1px solid ${alpha(totalActive > 0 ? theme.success : theme.textMuted, 0.2)}` }} />
                                                            </Stack>
                                                        </AccordionSummary>
                                                        <AccordionDetails sx={{ pt: 0, pb: 2, px: 2.5 }}>
                                                            <Stack spacing={1.5}>
                                                                {factory.algorithms.map((algo, ai) => (
                                                                    <Box key={algo.algorithm_id}>
                                                                        {ai > 0 && <Divider sx={{ mb: 1.5, borderColor: alpha(theme.border, 0.3) }} />}
                                                                        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.8, pl: 0.5 }}>
                                                                            <PrecisionManufacturing sx={{ color: theme.secondary, fontSize: 16 }} />
                                                                            <Typography variant="body2" fontWeight={700} sx={{ color: theme.textSecondary }}>{algo.algorithm_name}</Typography>
                                                                            <Chip label={`${algo.active_models.length} model${algo.active_models.length !== 1 ? 's' : ''}`} size="small"
                                                                                sx={{ height: 18, fontSize: '0.65rem', bgcolor: alpha(theme.secondary, 0.1), color: theme.secondary }} />
                                                                        </Stack>
                                                                        {algo.active_models.length === 0 ? (
                                                                            <Typography variant="caption" sx={{ color: theme.textMuted, pl: 3.5 }}>No active models deployed</Typography>
                                                                        ) : (
                                                                            <Stack spacing={0.5} sx={{ pl: 3.5 }}>
                                                                                {algo.active_models.map(m => (
                                                                                    <Stack key={m.model_id} direction="row" alignItems="center" spacing={1}>
                                                                                        <Circle sx={{ color: theme.success, fontSize: 8 }} />
                                                                                        <Typography variant="caption" fontWeight={700} sx={{ color: theme.textMain }}>{m.model_name}</Typography>
                                                                                        <Chip label={`v${m.version_number}`} size="small" sx={{ height: 18, fontSize: '0.65rem', bgcolor: alpha(theme.success, 0.1), color: theme.success }} />
                                                                                        <Typography variant="caption" sx={{ color: theme.textMuted, ml: 'auto' }}>{timeAgo(m.updated_at)}</Typography>
                                                                                        <Button size="small" endIcon={<ArrowForward sx={{ fontSize: '12px !important' }} />}
                                                                                            onClick={() => navigate('/factories')}
                                                                                            sx={{ minWidth: 0, fontSize: '0.7rem', textTransform: 'none', color: theme.primary, fontWeight: 700, py: 0, px: 1 }}>
                                                                                            View
                                                                                        </Button>
                                                                                    </Stack>
                                                                                ))}
                                                                            </Stack>
                                                                        )}
                                                                    </Box>
                                                                ))}
                                                            </Stack>
                                                        </AccordionDetails>
                                                    </Accordion>
                                                );
                                            })}
                                        </Stack>
                                    )}
                                </Box>
                            </Paper>
                        </motion.div>
                    </Grid>
                </Grid>
            </Container>

            <style>{`
                @keyframes dashPulse { 0%, 100% { opacity: 1; box-shadow: 0 0 10px currentColor; } 50% { opacity: 0.5; box-shadow: 0 0 20px currentColor; } }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </Box>
    );
}
