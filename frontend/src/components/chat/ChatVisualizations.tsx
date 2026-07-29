import React from 'react';
import { Box, Typography, Paper, Stack, alpha, Chip, Tooltip, Dialog, DialogContent, Button, IconButton } from '@mui/material';
import { BarChart as BarChartIcon, Launch as LaunchIcon, Close as CloseIcon, Layers as VersionIcon, FileDownload as DownloadIcon } from '@mui/icons-material';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../../api/axios';

interface ChatComparisonChartProps {
    comparison_title?: string;
    entities: string[];
    metrics: any[];
    theme: any;
    mode: string;
}

export function ChatComparisonChart({ comparison_title, entities, metrics, theme, mode }: ChatComparisonChartProps) {
    if (!entities || entities.length < 2 || !metrics || metrics.length === 0) return null;

    const colors = [
        theme.primary,
        theme.secondary ?? theme.info ?? '#00B0FF',
        theme.success ?? '#10B981',
        theme.warning ?? '#F59E0B',
        theme.error ?? '#EF4444',
        '#8B5CF6',
        '#EC4899',
    ];

    const isPercentageMetricName = (name: string) => {
        return ['accuracy', 'precision', 'recall', 'f1_score', 'cpu_utilization', 'gpu_utilization'].includes(name.toLowerCase());
    };

    const getHumanName = (name: string) => {
        switch (name.toLowerCase()) {
            case 'accuracy': return 'Accuracy';
            case 'precision': return 'Precision';
            case 'recall': return 'Recall';
            case 'f1_score': return 'F1 Score';
            case 'cpu_utilization': return 'CPU Util (%)';
            case 'gpu_utilization': return 'GPU Util (%)';
            case 'inference_time': return 'Inference (ms)';
            case 'cpu_memory_usage': return 'CPU Mem (MB)';
            case 'gpu_memory_usage': return 'GPU Mem (MB)';
            default: return name;
        }
    };

    const scaleValue = (val: any, name: string) => {
        if (val === null || val === undefined) return 0;
        const lowerName = name.toLowerCase();
        const isPerf = ['accuracy', 'precision', 'recall', 'f1_score'].includes(lowerName);
        if (isPerf && val <= 1.0) {
            return Math.round(val * 1000) / 10;
        }
        return val;
    };

    const percentageMetrics = metrics.filter(m => isPercentageMetricName(m.name));
    const absoluteMetrics = metrics.filter(m => !isPercentageMetricName(m.name));

    const percentageData = percentageMetrics.map(m => {
        const item: any = { name: getHumanName(m.name) };
        entities.forEach((entity, idx) => {
            item[entity] = scaleValue(m[`entity${idx + 1}`], m.name);
        });
        return item;
    });

    const absoluteData = absoluteMetrics.map(m => {
        const item: any = { name: getHumanName(m.name) };
        entities.forEach((entity, idx) => {
            item[entity] = scaleValue(m[`entity${idx + 1}`], m.name);
        });
        return item;
    });

    const tooltipStyle = {
        borderRadius: 12,
        background: mode === 'dark' ? '#1e293b' : '#fff',
        border: `1px solid ${alpha(theme.border, 0.35)}`,
        fontSize: 11, fontWeight: 700,
        boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
        color: theme.textMain,
    };

    return (
        <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2, width: '100%' }}>
            {comparison_title && (
                <Typography variant="subtitle2" sx={{ fontWeight: 800, color: theme.primary, letterSpacing: '0.02em', mb: 0.5 }}>
                    📊 {comparison_title}
                </Typography>
            )}

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ width: '100%' }}>
                {percentageData.length > 0 && (
                    <Box sx={{
                        flex: 1, p: 2, borderRadius: '14px',
                        bgcolor: mode === 'dark' ? 'rgba(15, 23, 42, 0.3)' : 'rgba(255, 255, 255, 0.6)',
                        border: `1px solid ${alpha(theme.border, 0.25)}`,
                        minWidth: 0,
                    }}>
                        <Typography variant="caption" sx={{ display: 'block', fontWeight: 800, color: theme.textSecondary, mb: 1.5, letterSpacing: 0.5 }}>
                            PERFORMANCE & UTILIZATION (%)
                        </Typography>
                        <Box sx={{ height: 200, width: '100%' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={percentageData} margin={{ top: 5, right: 10, left: -25, bottom: 5 }} barGap={4}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={alpha(theme.textMain, 0.06)} />
                                    <XAxis dataKey="name" tick={{ fill: theme.textSecondary, fontSize: 10, fontWeight: 700 }} axisLine={false} tickLine={false} />
                                    <YAxis domain={[0, 100]} tick={{ fill: theme.textMuted, fontSize: 9 }} axisLine={false} tickLine={false} width={30} />
                                    <RechartsTooltip contentStyle={tooltipStyle} />
                                    <Legend wrapperStyle={{ fontSize: 10, fontWeight: 700, paddingTop: 8 }} iconType="circle" iconSize={7} />
                                    {entities.map((entity, idx) => (
                                        <Bar key={entity} dataKey={entity} fill={colors[idx % colors.length]} radius={[4, 4, 0, 0]} maxBarSize={20} />
                                    ))}
                                </BarChart>
                            </ResponsiveContainer>
                        </Box>
                    </Box>
                )}

                {absoluteData.length > 0 && (
                    <Box sx={{
                        flex: 1, p: 2, borderRadius: '14px',
                        bgcolor: mode === 'dark' ? 'rgba(15, 23, 42, 0.3)' : 'rgba(255, 255, 255, 0.6)',
                        border: `1px solid ${alpha(theme.border, 0.25)}`,
                        minWidth: 0,
                    }}>
                        <Typography variant="caption" sx={{ display: 'block', fontWeight: 800, color: theme.textSecondary, mb: 1.5, letterSpacing: 0.5 }}>
                            LATENCY & RESOURCE USAGE
                        </Typography>
                        <Box sx={{ height: 200, width: '100%' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={absoluteData} margin={{ top: 5, right: 10, left: -25, bottom: 5 }} barGap={4}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={alpha(theme.textMain, 0.06)} />
                                    <XAxis dataKey="name" tick={{ fill: theme.textSecondary, fontSize: 10, fontWeight: 700 }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fill: theme.textMuted, fontSize: 9 }} axisLine={false} tickLine={false} width={30} />
                                    <RechartsTooltip contentStyle={tooltipStyle} />
                                    <Legend wrapperStyle={{ fontSize: 10, fontWeight: 700, paddingTop: 8 }} iconType="circle" iconSize={7} />
                                    {entities.map((entity, idx) => (
                                        <Bar key={entity} dataKey={entity} fill={colors[idx % colors.length]} radius={[4, 4, 0, 0]} maxBarSize={20} />
                                    ))}
                                </BarChart>
                            </ResponsiveContainer>
                        </Box>
                    </Box>
                )}
            </Stack>
        </Box>
    );
}

// ─── Comparison Modal ─────────────────────────────────────────────────────────
export function ComparisonModal({ versions, open, onClose, theme, mode }: { versions: any[], open: boolean, onClose: () => void, theme: any, mode: string }) {
    const navigate = useNavigate();
    if (!versions || versions.length < 2) return null;

    // Detect if there are multiple models, factories, or algorithms in the compared versions
    const hasMultipleModels = new Set(versions.map(v => v.model_name)).size > 1;
    const hasMultipleFactories = new Set(versions.map(v => v.factory_name)).size > 1;
    const hasMultipleAlgos = new Set(versions.map(v => v.algorithm_name)).size > 1;

    // Helper to get descriptive label for each version in chart/chips
    const getVersionLabel = (v: any) => {
        let label = `v${v.version_number}`;
        if (hasMultipleModels) {
            label = `${v.model_name || 'Model'} ${label}`;
        }
        if (hasMultipleFactories) {
            label = `${label} (${v.factory_name || 'Global'})`;
        } else if (hasMultipleAlgos) {
            label = `${label} (${v.algorithm_name || 'Global'})`;
        }
        return label;
    };

    const model = versions[0].model_name || 'Model';

    const colors = [
        theme.primary,
        theme.secondary ?? theme.info,
        theme.success ?? '#10B981',
        theme.warning ?? '#F59E0B',
        theme.error ?? '#EF4444',
        '#8B5CF6',
        '#EC4899',
    ];

    const metricData = [
        { name: 'Accuracy' },
        { name: 'Precision' },
        { name: 'Recall' },
        { name: 'F1 Score' },
    ];
    versions.forEach(v => {
        const label = getVersionLabel(v);
        (metricData[0] as any)[label] = +(v.accuracy ?? 0);
        (metricData[1] as any)[label] = +(v.precision ?? 0);
        (metricData[2] as any)[label] = +(v.recall ?? 0);
        (metricData[3] as any)[label] = +(v.f1_score ?? 0);
    });

    const resourceData = [
        { name: 'Inference (ms)' },
        { name: 'CPU %' },
        { name: 'GPU %' },
        { name: 'CPU Memory (MB)' },
        { name: 'GPU Memory (MB)' },
    ];
    versions.forEach(v => {
        const label = getVersionLabel(v);
        (resourceData[0] as any)[label] = +(v.inference_time ?? 0);
        (resourceData[1] as any)[label] = +(v.cpu_utilization ?? 0);
        (resourceData[2] as any)[label] = +(v.gpu_utilization ?? 0);
        (resourceData[3] as any)[label] = +(v.cpu_memory_usage ?? 0);
        (resourceData[4] as any)[label] = +(v.gpu_memory_usage ?? 0);
    });

    const allParamKeys = ['batch_size', 'epochs', 'learning_rate', 'optimizer', 'image_size'];

    const artSize = (v: any) => (v.artifacts ?? []).reduce((s: number, a: any) => s + (a.size ?? 0), 0);
    const fmtSize = (b: number) => b > 1024 * 1024
        ? `${(b / 1024 / 1024).toFixed(2)} MB`
        : b > 1024 ? `${(b / 1024).toFixed(1)} KB` : `${b} B`;

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <Paper sx={{
                    p: 1.5,
                    borderRadius: '12px',
                    bgcolor: mode === 'dark' ? '#1c1c2b' : '#ffffff',
                    border: `1px solid ${alpha(theme.border, 0.25)}`,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                    minWidth: 160,
                    pointerEvents: 'none',
                }}>
                    <Typography variant="caption" fontWeight={900} sx={{ display: 'block', mb: 1, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: `1px solid ${alpha(theme.border, 0.1)}`, pb: 0.5 }}>
                        {label}
                    </Typography>
                    <Stack spacing={0.8}>
                        {payload.map((entry: any) => (
                            <Stack key={entry.name} direction="row" spacing={1.5} alignItems="center" justifyContent="space-between">
                                <Stack direction="row" spacing={1} alignItems="center">
                                    <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: entry.color }} />
                                    <Typography variant="caption" fontWeight={750} sx={{ color: theme.textSecondary, fontSize: '0.72rem' }}>
                                        {entry.name}
                                    </Typography>
                                </Stack>
                                <Typography variant="body2" fontWeight={850} sx={{ color: theme.textMain, fontFamily: "'JetBrains Mono', monospace", fontSize: '0.74rem' }}>
                                    {entry.value}
                                </Typography>
                            </Stack>
                        ))}
                    </Stack>
                </Paper>
            );
        }
        return null;
    };

    const StatChip = ({ label, color }: { label: string, color: string }) => (
        <Chip label={label} size="small" sx={{
            fontWeight: 800, fontSize: '0.7rem', height: 24,
            bgcolor: alpha(color, 0.1), color,
            border: `1px solid ${alpha(color, 0.25)}`,
        }} />
    );

    const columns = ['Parameter', ...versions.map(v => getVersionLabel(v))];

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="md"
            fullWidth
            sx={{ zIndex: 10000 }}
            PaperProps={{
                sx: {
                    borderRadius: '24px',
                    bgcolor: mode === 'dark' ? '#12121f' : '#f8f9fc',
                    backgroundImage: 'none',
                    border: `1px solid ${alpha(theme.border, 0.3)}`,
                    boxShadow: `0 40px 100px rgba(0,0,0,0.4)`,
                    overflow: 'hidden',
                }
            }}
        >
            <Box sx={{
                px: 3.5, py: 2.2,
                display: 'flex',
                flexDirection: { xs: 'column', md: 'row' },
                alignItems: { xs: 'flex-start', md: 'center' },
                justifyContent: 'space-between',
                gap: 2,
                background: `linear-gradient(135deg, ${alpha(theme.primary, 0.12)} 0%, ${alpha(theme.secondary ?? theme.primary, 0.06)} 100%)`,
                borderBottom: `1px solid ${alpha(theme.border, 0.2)}`,
            }}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'flex-start', sm: 'center' }} sx={{ minWidth: 0, flex: 1, width: '100%' }}>
                    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0 }}>
                        <Box sx={{
                            width: 36, height: 36, borderRadius: '12px',
                            background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary ?? theme.primary})`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: `0 4px 12px ${alpha(theme.primary, 0.4)}`,
                            flexShrink: 0
                        }}>
                            <BarChartIcon sx={{ color: '#fff', fontSize: 18 }} />
                        </Box>
                        <Box sx={{ minWidth: 0 }}>
                            <Typography variant="h6" fontWeight={900} sx={{ color: theme.textMain, letterSpacing: '-0.02em', lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                Version Comparison
                            </Typography>
                            <Typography variant="caption" sx={{ color: theme.textMuted, fontWeight: 600, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {hasMultipleModels ? 'Cross-Model Performance' : model}
                            </Typography>
                        </Box>
                    </Stack>
                    <Box sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.5,
                        flexWrap: 'wrap',
                        minWidth: 0
                    }}>
                        {versions.map((v, i) => (
                            <span key={`${v.model_id}-${v.version_number}`} style={{ display: 'inline-flex', alignItems: 'center', flexWrap: 'nowrap' }}>
                                <StatChip label={getVersionLabel(v)} color={colors[i % colors.length]} />
                                {i < versions.length - 1 && (
                                    <Typography variant="caption" fontWeight={850} sx={{ color: theme.textMuted, mx: 0.5 }}>VS</Typography>
                                )}
                            </span>
                        ))}
                    </Box>
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ flexShrink: 0, alignSelf: { xs: 'flex-end', md: 'auto' } }}>
                    {versions.every(v => v.id) && versions[0].model_id && versions[0].algorithm_id && versions[0].factory_id && (
                        <Button
                            variant="outlined"
                            size="small"
                            startIcon={<LaunchIcon sx={{ fontSize: '14px !important' }} />}
                            onClick={() => {
                                onClose();
                                const idsStr = versions.map(v => v.id).join(",");
                                navigate(`/algorithms/${versions[0].algorithm_id}/factories/${versions[0].factory_id}/models/${versions[0].model_id}/versions/compare?left=${versions[0].id}&right=${versions[versions.length - 1].id}&ids=${idsStr}`);
                            }}
                            sx={{
                                color: theme.primary,
                                borderColor: alpha(theme.primary, 0.4),
                                borderRadius: '10px',
                                textTransform: 'none',
                                fontWeight: 800,
                                px: 2,
                                py: 0.6,
                                fontSize: '0.75rem',
                                whiteSpace: 'nowrap',
                                '&:hover': {
                                    bgcolor: theme.primary,
                                    color: '#fff',
                                    borderColor: theme.primary
                                },
                                transition: 'all 0.2s',
                            }}
                        >
                            In-Depth Analysis
                        </Button>
                    )}
                    <IconButton onClick={onClose} size="small" sx={{
                        color: theme.textMuted,
                        bgcolor: alpha(theme.textMain, 0.05), borderRadius: '10px',
                        '&:hover': { bgcolor: alpha(theme.error, 0.1), color: theme.error },
                    }}>
                        <CloseIcon fontSize="small" />
                    </IconButton>
                </Stack>
            </Box>

            <DialogContent sx={{ p: 3.5, overflowX: 'hidden', bgcolor: mode === 'dark' ? '#0d0d15' : '#f4f6fa' }}>
                <Box sx={{
                    display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 3, flexWrap: 'wrap', mb: 3.5, p: 1.8,
                    borderRadius: '16px', bgcolor: mode === 'dark' ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.015)',
                    border: `1px solid ${alpha(theme.border, 0.1)}`, boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)'
                }}>
                    {versions.map((v, i) => (
                        <Stack key={v.id} direction="row" spacing={1} alignItems="center">
                            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: colors[i % colors.length] }} />
                            <Typography variant="caption" sx={{ fontWeight: 800, color: theme.textSecondary, fontSize: '0.72rem' }}>
                                {getVersionLabel(v)}
                            </Typography>
                        </Stack>
                    ))}
                </Box>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3.5, mb: 3.5 }}>
                    <Box sx={{
                        p: 3, borderRadius: '20px', bgcolor: mode === 'dark' ? 'rgba(30, 30, 46, 0.4)' : 'rgba(255, 255, 255, 0.8)',
                        border: `1px solid ${alpha(theme.border, 0.2)}`, boxShadow: mode === 'dark' ? '0 10px 30px rgba(0,0,0,0.2)' : '0 10px 30px rgba(0,0,0,0.03)',
                        backdropFilter: 'blur(10px)',
                    }}>
                        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2.5 }}>
                            <Box sx={{
                                width: 32, height: 32, borderRadius: '10px', bgcolor: alpha(theme.primary, 0.1), color: theme.primary,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                                <BarChartIcon sx={{ fontSize: 16 }} />
                            </Box>
                            <Typography variant="subtitle2" sx={{ fontWeight: 900, color: theme.textMain, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                Performance Metrics
                            </Typography>
                        </Stack>
                        <Box sx={{ height: 240 }}>
                            <ResponsiveContainer>
                                <BarChart data={metricData} margin={{ top: 5, right: 10, left: -15, bottom: 5 }} barGap={6}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={alpha(theme.textMain, 0.07)} />
                                    <XAxis dataKey="name" tick={{ fill: theme.textSecondary, fontSize: 11, fontWeight: 700 }} axisLine={false} tickLine={false} />
                                    <YAxis domain={[0, 100]} tick={{ fill: theme.textMuted, fontSize: 10 }} axisLine={false} tickLine={false} width={30} />
                                    <RechartsTooltip content={<CustomTooltip />} />
                                    {versions.map((v, index) => {
                                        const label = getVersionLabel(v);
                                        return <Bar key={label} dataKey={label} fill={colors[index % colors.length]} radius={[6, 6, 0, 0]} barSize={versions.length > 2 ? 14 : 24} />;
                                    })}
                                </BarChart>
                            </ResponsiveContainer>
                        </Box>
                    </Box>
                    <Box sx={{
                        p: 3, borderRadius: '20px', bgcolor: mode === 'dark' ? 'rgba(30, 30, 46, 0.4)' : 'rgba(255, 255, 255, 0.8)',
                        border: `1px solid ${alpha(theme.border, 0.2)}`, boxShadow: mode === 'dark' ? '0 10px 30px rgba(0,0,0,0.2)' : '0 10px 30px rgba(0,0,0,0.03)',
                        backdropFilter: 'blur(10px)',
                    }}>
                        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2.5 }}>
                            <Box sx={{
                                width: 32, height: 32, borderRadius: '10px', bgcolor: alpha(theme.secondary ?? theme.info, 0.1), color: theme.secondary ?? theme.info,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                                <VersionIcon sx={{ fontSize: 16 }} />
                            </Box>
                            <Typography variant="subtitle2" sx={{ fontWeight: 900, color: theme.textMain, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                Resource Usage
                            </Typography>
                        </Stack>
                        <Box sx={{ height: 240 }}>
                            <ResponsiveContainer>
                                <BarChart data={resourceData} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }} barGap={4}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={alpha(theme.textMain, 0.07)} />
                                    <XAxis type="number" tick={{ fill: theme.textMuted, fontSize: 10 }} axisLine={false} tickLine={false} />
                                    <YAxis dataKey="name" type="category" width={110} tick={{ fill: theme.textSecondary, fontSize: 10, fontWeight: 700 }} axisLine={false} tickLine={false} />
                                    <RechartsTooltip content={<CustomTooltip />} />
                                    {versions.map((v, index) => {
                                        const label = getVersionLabel(v);
                                        return <Bar key={label} dataKey={label} fill={colors[index % colors.length]} radius={[0, 6, 6, 0]} barSize={versions.length > 2 ? 8 : 14} />;
                                    })}
                                </BarChart>
                            </ResponsiveContainer>
                        </Box>
                    </Box>
                </Box>
                {allParamKeys.length > 0 && (
                    <Box sx={{
                        p: 3, borderRadius: '20px', bgcolor: mode === 'dark' ? 'rgba(30, 30, 46, 0.4)' : 'rgba(255, 255, 255, 0.8)',
                        border: `1px solid ${alpha(theme.border, 0.2)}`, boxShadow: mode === 'dark' ? '0 10px 30px rgba(0,0,0,0.2)' : '0 10px 30px rgba(0,0,0,0.03)',
                        backdropFilter: 'blur(10px)', mb: 3.5,
                    }}>
                        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2.5 }}>
                            <Box sx={{
                                width: 32, height: 32, borderRadius: '10px', bgcolor: alpha(theme.primary, 0.1), color: theme.primary,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                                <VersionIcon sx={{ fontSize: 16 }} />
                            </Box>
                            <Box>
                                <Typography variant="subtitle2" sx={{ fontWeight: 900, color: theme.textMain, textTransform: 'uppercase', letterSpacing: 0.5, lineHeight: 1.1 }}>
                                    Configuration Parameters
                                </Typography>
                                <Typography variant="caption" sx={{ color: theme.textMuted, fontWeight: 600 }}>
                                    Highlighted rows indicate shifts across versions
                                </Typography>
                            </Box>
                        </Stack>
                        <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(${versions.length + 1}, 1fr)`, borderRadius: '16px', overflow: 'hidden', border: `1px solid ${alpha(theme.border, 0.25)}` }}>
                            {columns.map((h, i) => (
                                <Box key={h} sx={{
                                    px: 2.5, py: 1.8, bgcolor: mode === 'dark' ? 'rgba(20, 20, 35, 0.7)' : 'rgba(235, 238, 245, 0.8)',
                                    borderRight: i < columns.length - 1 ? `1px solid ${alpha(theme.border, 0.2)}` : 'none',
                                }}>
                                    <Typography variant="caption" fontWeight={900} sx={{ color: i === 0 ? theme.textSecondary : colors[(i - 1) % colors.length], letterSpacing: 1, textTransform: 'uppercase', fontSize: '0.68rem' }}>{h}</Typography>
                                </Box>
                            ))}
                            {allParamKeys.map((k, ri) => {
                                const firstVal = (versions[0].parameters ?? {})[k];
                                const changed = versions.some(v => (v.parameters ?? {})[k] !== firstVal);
                                return [k, ...versions.map(v => String((v.parameters ?? {})[k] ?? '—'))].map((val, ci) => (
                                    <Box key={`${k}-${ci}`} sx={{
                                        px: 2.5, py: 1.5,
                                        bgcolor: changed ? (mode === 'dark' ? 'rgba(245, 158, 11, 0.05)' : 'rgba(245, 158, 11, 0.03)') : (ri % 2 === 0 ? 'transparent' : alpha(theme.textMain, 0.015)),
                                        borderRight: ci < columns.length - 1 ? `1px solid ${alpha(theme.border, 0.15)}` : 'none',
                                        borderTop: `1px solid ${alpha(theme.border, 0.15)}`,
                                        borderLeft: ci === 0 && changed ? `4px solid ${theme.warning ?? '#F59E0B'}` : 'none',
                                        display: 'flex', alignItems: 'center',
                                    }}>
                                        <Typography variant="body2" sx={{
                                            fontFamily: "'JetBrains Mono', 'Fira Code', monospace", fontSize: '0.74rem',
                                            fontWeight: ci === 0 ? 800 : 500,
                                            color: ci === 0 ? (changed ? (theme.warning ?? '#F59E0B') : theme.textSecondary) : theme.textMain,
                                        }}>{val}</Typography>
                                    </Box>
                                ));
                            })}
                        </Box>
                    </Box>
                )}
                {versions.some(v => artSize(v) > 0) && (
                    <Box sx={{
                        p: 3, borderRadius: '20px', bgcolor: mode === 'dark' ? 'rgba(30, 30, 46, 0.4)' : 'rgba(255, 255, 255, 0.8)',
                        border: `1px solid ${alpha(theme.border, 0.2)}`, boxShadow: mode === 'dark' ? '0 10px 30px rgba(0,0,0,0.2)' : '0 10px 30px rgba(0,0,0,0.03)',
                        backdropFilter: 'blur(10px)',
                    }}>
                        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2.5 }}>
                            <Box sx={{
                                width: 32, height: 32, borderRadius: '10px', bgcolor: alpha(theme.success ?? '#10B981', 0.1), color: theme.success ?? '#10B981',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                                <DownloadIcon sx={{ fontSize: 16 }} />
                            </Box>
                            <Typography variant="subtitle2" sx={{ fontWeight: 900, color: theme.textMain, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                Total Artifact Footprint
                            </Typography>
                        </Stack>
                        <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(200px, 1fr))`, gap: 2.5 }}>
                            {versions.map((v, index) => {
                                const label = getVersionLabel(v);
                                const color = colors[index % colors.length];
                                return (
                                    <Tooltip key={label} title={`Download all artifacts for v${v.version_number}`}>
                                        <Box
                                            onClick={() => {
                                                const algId = v.algorithm_id || versions[0].algorithm_id;
                                                const facId = v.factory_id || versions[0].factory_id;
                                                const modId = v.model_id || versions[0].model_id;
                                                if (algId && facId && modId && v.id) {
                                                    const downloadUrl = `${API_BASE_URL}/algorithms/${algId}/factories/${facId}/models/${modId}/versions/${v.id}/download?dataset=true&labels=true&model=true&code=true`;
                                                    window.location.href = downloadUrl;
                                                }
                                            }}
                                            sx={{
                                                p: 2.5, borderRadius: '16px', bgcolor: alpha(color, 0.05), border: `1px solid ${alpha(color, 0.15)}`,
                                                display: 'flex', alignItems: 'center', gap: 2, cursor: 'pointer',
                                                transition: 'transform 0.2s, box-shadow 0.2s, background-color 0.2s',
                                                '&:hover': {
                                                    transform: 'translateY(-2px)', boxShadow: `0 8px 20px ${alpha(color, 0.15)}`, bgcolor: alpha(color, 0.08),
                                                }
                                            }}
                                        >
                                            <Box sx={{
                                                width: 44, height: 44, borderRadius: '12px', bgcolor: alpha(color, 0.1), color: color,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                                            }}>
                                                <DownloadIcon sx={{ fontSize: 22 }} />
                                            </Box>
                                            <Box>
                                                <Typography variant="caption" sx={{ color: theme.textSecondary, fontWeight: 700, display: 'block', mb: 0.3 }}>{label}</Typography>
                                                <Typography variant="body1" sx={{ color: theme.textMain, fontWeight: 900, fontFamily: "'JetBrains Mono', monospace" }}>{fmtSize(artSize(v))}</Typography>
                                            </Box>
                                        </Box>
                                    </Tooltip>
                                );
                            })}
                        </Box>
                    </Box>
                )}
            </DialogContent>
        </Dialog>
    );
}
