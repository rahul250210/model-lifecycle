"use client";

import React, { useState, useRef, useEffect, useMemo, useCallback, memo } from 'react';
import {
    Box, IconButton, Typography, Paper, TextField, Stack, Avatar,
    alpha, CircularProgress, Fab, Zoom, Chip, Tooltip,
    Dialog, DialogContent,
} from '@mui/material';
import {
    Close as CloseIcon, Send as SendIcon,
    AutoAwesome as BotIcon, Person as UserIcon,
    Chat as ChatIcon,
    BarChart as BarChartIcon,
    OpenInFull as ExpandIcon,
    FileDownload as DownloadIcon,
    DeleteSweepOutlined as ClearIcon,
    OpenInNew as LaunchIcon,
    Factory as FactoryIcon,
    Hub as AlgorithmIcon,
    Category as ModelIcon,
    Layers as VersionIcon,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
} from 'recharts';
import axios, { API_BASE_URL } from '../../api/axios';
import { useTheme } from '../../theme/ThemeContext';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Message {
    id: string;
    role: 'user' | 'bot';
    content: string;
    data?: any[];
    query?: string;
    type?: 'text' | 'sql' | 'error' | 'comparison' | 'download' | 'factories' | 'zip_download';
    entity_type?: string;
    report_type?: string;
    report_name?: string | null;
    algorithm_id?: number | null;
    algorithm_name?: string | null;
    factory_id?: number | null;
    factory_name?: string | null;
    model_id?: number | null;
    download_url?: string;
    components?: string[];
    model_name?: string;
    version_number?: number;
    actions?: {
        type: 'download';
        label: string;
        download_type: string;
        entity_type: string;
        entity_id: number;
        download_url?: string;
    }[];
    response_type?: string;
    show_compare?: boolean;
    comparison_title?: string;
    entities?: string[];
    metrics?: { name: string; entity1?: number | null; entity2?: number | null }[];
    timestamp: Date;
}

// ─── Suggested queries ────────────────────────────────────────────────────────
const SUGGESTIONS = [
    'Show top 5 models by accuracy',
    'List all factories',
    'Average accuracy of active versions',
    'Which models have F1 > 0.9?',
];

// ─── Loading Animation Dots ───────────────────────────────────────────────────
const LoadingDots = () => {
    const { theme } = useTheme();
    const dotVariants = {
        initial: { y: 0 },
        animate: { y: -6 }
    };
    const transition = {
        duration: 0.5,
        repeat: Infinity,
        repeatType: "reverse" as const,
        ease: "easeInOut" as const
    };

    return (
        <Stack direction="row" spacing={0.6} sx={{ py: 1.2, px: 0.4, display: 'flex', alignItems: 'center' }}>
            {[0, 1, 2].map((idx) => (
                <motion.div
                    key={idx}
                    variants={dotVariants}
                    initial="initial"
                    animate="animate"
                    transition={{
                        ...transition,
                        delay: idx * 0.15
                    }}
                    style={{
                        width: 7,
                        height: 7,
                        backgroundColor: theme.primary,
                        borderRadius: "50%"
                    }}
                />
            ))}
        </Stack>
    );
};

// ─── Comparison Modal ─────────────────────────────────────────────────────────
function ComparisonModal({ versions, open, onClose }: { versions: any[], open: boolean, onClose: () => void }) {
    const { theme } = useTheme();
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

    const allParamKeys = Array.from(new Set(versions.flatMap(v => Object.keys(v.parameters ?? {}))));

    const artSize = (v: any) => (v.artifacts ?? []).reduce((s: number, a: any) => s + (a.size ?? 0), 0);
    const fmtSize = (b: number) => b > 1024 * 1024
        ? `${(b / 1024 / 1024).toFixed(2)} MB`
        : b > 1024 ? `${(b / 1024).toFixed(1)} KB` : `${b} B`;

    const tooltipStyle = {
        borderRadius: 12,
        background: theme.mode === 'dark' ? '#1a1a2e' : '#fff',
        border: `1px solid ${alpha(theme.border, 0.3)}`,
        fontSize: 12, fontWeight: 700,
        boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
    };

    const SectionTitle = ({ children }: { children: string }) => (
        <Typography variant="overline" sx={{
            display: 'block', fontWeight: 900, letterSpacing: 2,
            color: theme.textMuted, fontSize: '0.65rem', mb: 2,
        }}>{children}</Typography>
    );

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
            PaperProps={{
                sx: {
                    borderRadius: '24px',
                    bgcolor: theme.mode === 'dark' ? '#12121f' : '#f8f9fc',
                    backgroundImage: 'none',
                    border: `1px solid ${alpha(theme.border, 0.3)}`,
                    boxShadow: `0 40px 100px rgba(0,0,0,0.4)`,
                    overflow: 'hidden',
                }
            }}
        >
            {/* ── Modal Header ── */}
            <Box sx={{
                px: 3.5, py: 2.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: `linear-gradient(135deg, ${alpha(theme.primary, 0.12)} 0%, ${alpha(theme.secondary ?? theme.primary, 0.06)} 100%)`,
                borderBottom: `1px solid ${alpha(theme.border, 0.2)}`,
            }}>
                <Stack spacing={0.3}>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                        <Box sx={{
                            width: 36, height: 36, borderRadius: '12px',
                            background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary ?? theme.primary})`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: `0 4px 12px ${alpha(theme.primary, 0.4)}`,
                        }}>
                            <BarChartIcon sx={{ color: '#fff', fontSize: 18 }} />
                        </Box>
                        <Box>
                            <Typography variant="h6" fontWeight={900} sx={{ color: theme.textMain, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                                Version Comparison
                            </Typography>
                            <Typography variant="caption" sx={{ color: theme.textMuted, fontWeight: 600 }}>
                                {hasMultipleModels ? 'Cross-Model Performance' : model}
                            </Typography>
                        </Box>
                    </Stack>
                </Stack>
                <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flexWrap: 'wrap', gap: 1 }}>
                    {versions.map((v, i) => (
                        <span key={`${v.model_id}-${v.version_number}`} style={{ display: 'inline-flex', alignItems: 'center' }}>
                            <StatChip label={getVersionLabel(v)} color={colors[i % colors.length]} />
                            {i < versions.length - 1 && (
                                <Typography variant="caption" fontWeight={850} sx={{ color: theme.textMuted, mx: 0.5 }}>VS</Typography>
                            )}
                        </span>
                    ))}
                    {versions.every(v => v.id) && !hasMultipleModels && versions[0].model_id && versions[0].algorithm_id && versions[0].factory_id && (
                        <Tooltip title="View In-Depth Comparison Page">
                            <IconButton onClick={() => {
                                onClose();
                                const idsStr = versions.map(v => v.id).join(",");
                                navigate(`/algorithms/${versions[0].algorithm_id}/factories/${versions[0].factory_id}/models/${versions[0].model_id}/versions/compare?left=${versions[0].id}&right=${versions[versions.length - 1].id}&ids=${idsStr}`);
                            }} size="small" sx={{
                                color: theme.primary,
                                bgcolor: alpha(theme.primary, 0.08), borderRadius: '10px',
                                '&:hover': { bgcolor: theme.primary, color: '#fff' },
                                ml: 0.5,
                            }}>
                                <LaunchIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    )}
                    <IconButton onClick={onClose} size="small" sx={{
                        color: theme.textMuted, ml: 1,
                        bgcolor: alpha(theme.textMain, 0.05), borderRadius: '10px',
                        '&:hover': { bgcolor: alpha(theme.error, 0.1), color: theme.error },
                    }}>
                        <CloseIcon fontSize="small" />
                    </IconButton>
                </Stack>
            </Box>

            <DialogContent sx={{ p: 3.5, overflowX: 'hidden' }}>
                {/* ── Performance Metrics ── */}
                <Box sx={{
                    mb: 3.5, p: 3, borderRadius: '18px',
                    bgcolor: alpha(theme.paper, theme.mode === 'dark' ? 0.6 : 0.8),
                    border: `1px solid ${alpha(theme.border, 0.2)}`,
                }}>
                    <SectionTitle>📊 Performance Metrics</SectionTitle>
                    <Box sx={{ height: 240 }}>
                        <ResponsiveContainer>
                            <BarChart data={metricData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }} barGap={6}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={alpha(theme.textMain, 0.07)} />
                                <XAxis dataKey="name" tick={{ fill: theme.textSecondary, fontSize: 12, fontWeight: 700 }} axisLine={false} tickLine={false} />
                                <YAxis domain={[0, 100]} tick={{ fill: theme.textMuted, fontSize: 11 }} axisLine={false} tickLine={false} width={35} />
                                <RechartsTooltip contentStyle={tooltipStyle} />
                                <Legend wrapperStyle={{ fontSize: 12, fontWeight: 700, paddingTop: 12 }} iconType="circle" iconSize={9} />
                                {versions.map((v, index) => {
                                    const label = getVersionLabel(v);
                                    return (
                                        <Bar key={label} dataKey={label} fill={colors[index % colors.length]} radius={[6, 6, 0, 0]} barSize={versions.length > 2 ? 18 : 28} />
                                    );
                                })}
                            </BarChart>
                        </ResponsiveContainer>
                    </Box>
                </Box>

                {/* ── Resource Usage ── */}
                <Box sx={{
                    mb: 3.5, p: 3, borderRadius: '18px',
                    bgcolor: alpha(theme.paper, theme.mode === 'dark' ? 0.6 : 0.8),
                    border: `1px solid ${alpha(theme.border, 0.2)}`,
                }}>
                    <SectionTitle>⚡ Resource Usage</SectionTitle>
                    <Box sx={{ height: 220 }}>
                        <ResponsiveContainer>
                            <BarChart data={resourceData} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }} barGap={4}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={alpha(theme.textMain, 0.07)} />
                                <XAxis type="number" tick={{ fill: theme.textMuted, fontSize: 11 }} axisLine={false} tickLine={false} />
                                <YAxis dataKey="name" type="category" width={130} tick={{ fill: theme.textSecondary, fontSize: 11, fontWeight: 700 }} axisLine={false} tickLine={false} />
                                <RechartsTooltip contentStyle={tooltipStyle} />
                                <Legend wrapperStyle={{ fontSize: 12, fontWeight: 700, paddingTop: 12 }} iconType="circle" iconSize={9} />
                                {versions.map((v, index) => {
                                    const label = getVersionLabel(v);
                                    return (
                                        <Bar key={label} dataKey={label} fill={colors[index % colors.length]} radius={[0, 6, 6, 0]} barSize={versions.length > 2 ? 10 : 16} />
                                    );
                                })}
                            </BarChart>
                        </ResponsiveContainer>
                    </Box>
                </Box>

                {/* ── Parameters ── */}
                {allParamKeys.length > 0 && (
                    <Box sx={{
                        mb: 3.5, p: 3, borderRadius: '18px',
                        bgcolor: alpha(theme.paper, theme.mode === 'dark' ? 0.6 : 0.8),
                        border: `1px solid ${alpha(theme.border, 0.2)}`,
                    }}>
                        <SectionTitle>🔧 Parameters</SectionTitle>
                        <Box sx={{
                            display: 'grid',
                            gridTemplateColumns: `repeat(${versions.length + 1}, 1fr)`,
                            borderRadius: '12px', overflow: 'hidden',
                            border: `1px solid ${alpha(theme.border, 0.2)}`,
                        }}>
                            {/* Header row */}
                            {columns.map((h, i) => (
                                <Box key={h} sx={{
                                    px: 2, py: 1.2,
                                    bgcolor: alpha(theme.textMain, 0.04),
                                    borderRight: i < columns.length - 1 ? `1px solid ${alpha(theme.border, 0.15)}` : 'none',
                                }}>
                                    <Typography variant="caption" fontWeight={900} sx={{
                                        color: i === 0 ? theme.textMuted : colors[(i - 1) % colors.length],
                                        letterSpacing: 1, textTransform: 'uppercase', fontSize: '0.62rem',
                                    }}>{h}</Typography>
                                </Box>
                            ))}
                            {/* Data rows */}
                            {allParamKeys.map((k, ri) => (
                                [k, ...versions.map(v => String((v.parameters ?? {})[k] ?? '—'))].map((val, ci) => (
                                    <Box key={`${k}-${ci}`} sx={{
                                        px: 2, py: 1,
                                        bgcolor: ri % 2 === 0 ? 'transparent' : alpha(theme.textMain, 0.02),
                                        borderRight: ci < columns.length - 1 ? `1px solid ${alpha(theme.border, 0.15)}` : 'none',
                                        borderTop: `1px solid ${alpha(theme.border, 0.15)}`,
                                    }}>
                                        <Typography variant="body2" sx={{
                                            fontSize: '0.78rem', fontWeight: ci === 0 ? 700 : 500,
                                            color: ci === 0 ? theme.textSecondary : theme.textMain,
                                        }}>{val}</Typography>
                                    </Box>
                                ))
                            ))}
                        </Box>
                    </Box>
                )}

                {/* ── Artifact Sizes ── */}
                {versions.some(v => artSize(v) > 0) && (
                    <Box sx={{
                        p: 3, borderRadius: '18px',
                        bgcolor: alpha(theme.paper, theme.mode === 'dark' ? 0.6 : 0.8),
                        border: `1px solid ${alpha(theme.border, 0.2)}`,
                    }}>
                        <SectionTitle>📦 Artifact Sizes</SectionTitle>
                        <Stack direction="row" spacing={3} sx={{ flexWrap: 'wrap', gap: 2 }}>
                            {versions.map((v, index) => {
                                const label = getVersionLabel(v);
                                const color = colors[index % colors.length];
                                return (
                                    <Box key={label} sx={{
                                        flex: '1 1 200px', p: 2.5, borderRadius: '14px',
                                        bgcolor: alpha(color, 0.06),
                                        border: `1px solid ${alpha(color, 0.2)}`,
                                        textAlign: 'center',
                                    }}>
                                        <Typography variant="h5" fontWeight={900} sx={{ color }}>
                                            {fmtSize(artSize(v))}
                                        </Typography>
                                        <Typography variant="caption" fontWeight={700} sx={{ color: theme.textMuted }}>
                                            {label} total artifacts
                                        </Typography>
                                    </Box>
                                );
                            })}
                        </Stack>
                    </Box>
                )}
            </DialogContent>
        </Dialog>
    );
}

// ─── Compact comparison trigger button (shown in chat bubble) ──────────────────────
function ComparisonButton({ versions, onClick }: { versions: any[], onClick: () => void }) {
    const { theme } = useTheme();
    if (!versions || versions.length < 2) return null;

    return (
        <Box
            onClick={onClick}
            sx={{
                mt: 1.5, cursor: 'pointer', borderRadius: '14px',
                background: `linear-gradient(135deg, ${alpha(theme.primary, 0.08)}, ${alpha(theme.secondary ?? theme.info, 0.08)})`,
                border: `1px solid ${alpha(theme.primary, 0.2)}`,
                px: 2, py: 1.5,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                transition: 'all 0.2s ease',
                '&:hover': {
                    background: `linear-gradient(135deg, ${alpha(theme.primary, 0.14)}, ${alpha(theme.secondary ?? theme.info, 0.14)})`,
                    border: `1px solid ${alpha(theme.primary, 0.4)}`,
                    transform: 'translateY(-1px)',
                    boxShadow: `0 6px 20px ${alpha(theme.primary, 0.18)}`,
                },
            }}
        >
            <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap', gap: 1 }}>
                <BarChartIcon sx={{ fontSize: 16, color: theme.primary }} />
                <Stack direction="row" spacing={0.5} alignItems="center" sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                    {versions.map((v, i) => (
                        <span key={v.version_number} style={{ display: 'inline-flex', alignItems: 'center' }}>
                            <Chip label={`v${v.version_number}`} size="small" sx={{
                                height: 18, fontSize: '0.6rem', fontWeight: 800,
                                bgcolor: alpha(i === 0 ? theme.primary : theme.secondary ?? theme.info, 0.15),
                                color: i === 0 ? theme.primary : theme.secondary ?? theme.info,
                            }} />
                            {i < versions.length - 1 && (
                                <Typography variant="caption" sx={{ color: theme.textMuted, fontWeight: 700, fontSize: '0.65rem', mx: 0.5 }}>vs</Typography>
                            )}
                        </span>
                    ))}
                </Stack>
                <Typography variant="caption" fontWeight={700} sx={{ color: theme.textSecondary, fontSize: '0.7rem' }}>
                    View full comparison
                </Typography>
            </Stack>
            <ExpandIcon sx={{ fontSize: 14, color: theme.primary, opacity: 0.7 }} />
        </Box>
    );
}

// ─── Inline Comparison Chart (shown in chat bubble for comparing models/versions) ───
interface ChatComparisonChartProps {
    comparison_title?: string;
    entities: string[];
    metrics: { name: string; entity1?: number | null; entity2?: number | null }[];
    theme: any;
    mode: 'dark' | 'light';
}

function ChatComparisonChart({ comparison_title, entities, metrics, theme, mode }: ChatComparisonChartProps) {
    if (!entities || entities.length < 2 || !metrics || metrics.length === 0) return null;

    const e1 = entities[0];
    const e2 = entities[1];

    const colors = [
        theme.primary,
        theme.secondary ?? theme.info ?? '#00B0FF',
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

    const percentageData = percentageMetrics.map(m => ({
        name: getHumanName(m.name),
        [e1]: scaleValue(m.entity1, m.name),
        [e2]: scaleValue(m.entity2, m.name),
    }));

    const absoluteData = absoluteMetrics.map(m => ({
        name: getHumanName(m.name),
        [e1]: scaleValue(m.entity1, m.name),
        [e2]: scaleValue(m.entity2, m.name),
    }));

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
                                    <Bar dataKey={e1} fill={colors[0]} radius={[4, 4, 0, 0]} maxBarSize={20} />
                                    <Bar dataKey={e2} fill={colors[1]} radius={[4, 4, 0, 0]} maxBarSize={20} />
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
                                    <Bar dataKey={e1} fill={colors[0]} radius={[4, 4, 0, 0]} maxBarSize={20} />
                                    <Bar dataKey={e2} fill={colors[1]} radius={[4, 4, 0, 0]} maxBarSize={20} />
                                </BarChart>
                            </ResponsiveContainer>
                        </Box>
                    </Box>
                )}
            </Stack>
        </Box>
    );
}

// ─── Download Report Button (shown in chat bubble) ───────────────────────────────
function DownloadReportButton({
    reportType,
    reportName,
    algorithmId,
    algorithmName,
    factoryId,
    factoryName,
    modelId,
}: {
    reportType: string;
    reportName?: string | null;
    algorithmId?: number | null;
    algorithmName?: string | null;
    factoryId?: number | null;
    factoryName?: string | null;
    modelId?: number | null;
}) {
    const { theme } = useTheme();
    const [downloading, setDownloading] = useState(false);

    const handleDownload = async () => {
        setDownloading(true);
        try {
            const params = new URLSearchParams({ report_type: reportType });
            if (reportName) params.append('name', reportName);
            if (algorithmId) params.append('algorithm_id', String(algorithmId));
            if (algorithmName) params.append('algorithm_name', algorithmName);
            if (factoryId) params.append('factory_id', String(factoryId));
            if (factoryName) params.append('factory_name', factoryName);
            if (modelId) params.append('model_id', String(modelId));
            const res = await fetch(`${API_BASE_URL}/chatbot/download-report?${params.toString()}`);
            const blob = await res.blob();
            const disposition = res.headers.get('Content-Disposition') ?? '';

            // Try to parse filename from Content-Disposition header (plain or RFC-5987 encoded)
            let filename = '';
            const rfcMatch = disposition.match(/filename\*=(?:UTF-8'')?([^\s;]+)/i);
            const plainMatch = disposition.match(/filename="([^"]+)"/);
            if (rfcMatch) {
                filename = decodeURIComponent(rfcMatch[1]);
            } else if (plainMatch) {
                filename = plainMatch[1];
            }

            // Fallback: build a descriptive name from reportType + reportName
            if (!filename) {
                const safeName = reportName
                    ? reportName.replace(/\s+/g, '_')
                    : 'all';
                filename = `MARS_${reportType}_report_${safeName}.csv`;
            }

            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = filename; a.click();
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error('Download failed:', e);
        } finally {
            setDownloading(false);
        }
    };


    const labelMap: Record<string, string> = { factory: 'Factory', algorithm: 'Algorithm', model: 'Model' };
    const label = labelMap[reportType] ?? 'Report';
    const nameStr = reportName ? ` — ${reportName}` : ' (All)';

    return (
        <Box
            onClick={downloading ? undefined : handleDownload}
            sx={{
                mt: 1.5, cursor: downloading ? 'default' : 'pointer',
                borderRadius: '14px',
                background: downloading
                    ? alpha(theme.textMain, 0.04)
                    : `linear-gradient(135deg, ${alpha(theme.success, 0.1)}, ${alpha(theme.primary, 0.08)})`,
                border: `1px solid ${alpha(downloading ? theme.border : theme.success, 0.3)}`,
                px: 2, py: 1.5,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                transition: 'all 0.2s ease',
                '&:hover': downloading ? {} : {
                    background: `linear-gradient(135deg, ${alpha(theme.success, 0.16)}, ${alpha(theme.primary, 0.12)})`,
                    border: `1px solid ${alpha(theme.success, 0.5)}`,
                    transform: 'translateY(-1px)',
                    boxShadow: `0 6px 20px ${alpha(theme.success, 0.2)}`,
                },
            }}
        >
            <Stack direction="row" spacing={1} alignItems="center">
                {downloading
                    ? <CircularProgress size={14} sx={{ color: theme.primary }} />
                    : <DownloadIcon sx={{ fontSize: 16, color: theme.success }} />}
                <Box>
                    <Typography variant="caption" fontWeight={800} sx={{ color: theme.textMain, fontSize: '0.72rem', display: 'block', lineHeight: 1.2 }}>
                        {downloading ? 'Preparing CSV…' : `Download ${label} Report${nameStr}`}
                    </Typography>
                    {!downloading && (
                        <Typography variant="caption" sx={{ color: theme.textMuted, fontSize: '0.62rem' }}>
                            CSV · All fields included
                        </Typography>
                    )}
                </Box>
            </Stack>
            {!downloading && <DownloadIcon sx={{ fontSize: 14, color: theme.success, opacity: 0.6 }} />}
        </Box>
    );
}

// ─── Download Zip Button (shown in chat bubble for model version export bundle) ───
function DownloadZipButton({ downloadUrl, modelName, versionNumber, components }: { downloadUrl: string, modelName: string, versionNumber: number, components: string[] }) {
    const { theme } = useTheme();
    const [downloading, setDownloading] = useState(false);

    const handleDownload = async () => {
        setDownloading(true);
        try {
            const finalUrl = downloadUrl.startsWith('http') ? downloadUrl : `${API_BASE_URL}${downloadUrl}`;
            const res = await fetch(finalUrl);
            if (!res.ok) {
                throw new Error(`Failed to download: ${res.statusText}`);
            }
            const blob = await res.blob();
            const disposition = res.headers.get('Content-Disposition') ?? '';

            let filename = '';
            const rfcMatch = disposition.match(/filename\*=(?:UTF-8'')?([^\s;]+)/i);
            const plainMatch = disposition.match(/filename="([^"]+)"/);
            if (rfcMatch) {
                filename = decodeURIComponent(rfcMatch[1]);
            } else if (plainMatch) {
                filename = plainMatch[1];
            }

            if (!filename) {
                filename = `${modelName}_v${versionNumber}_bundle.zip`;
            }

            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error('ZIP Download failed:', e);
        } finally {
            setDownloading(false);
        }
    };

    return (
        <Box
            onClick={downloading ? undefined : handleDownload}
            sx={{
                mt: 1.5, cursor: downloading ? 'default' : 'pointer',
                borderRadius: '14px',
                background: downloading
                    ? alpha(theme.textMain, 0.04)
                    : `linear-gradient(135deg, ${alpha(theme.success, 0.1)}, ${alpha(theme.primary, 0.08)})`,
                border: `1px solid ${alpha(downloading ? theme.border : theme.success, 0.3)}`,
                px: 2, py: 1.5,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                transition: 'all 0.2s ease',
                '&:hover': downloading ? {} : {
                    background: `linear-gradient(135deg, ${alpha(theme.success, 0.16)}, ${alpha(theme.primary, 0.12)})`,
                    border: `1px solid ${alpha(theme.success, 0.5)}`,
                    transform: 'translateY(-1px)',
                    boxShadow: `0 6px 20px ${alpha(theme.success, 0.2)}`,
                },
            }}
        >
            <Stack direction="row" spacing={1} alignItems="center">
                {downloading
                    ? <CircularProgress size={14} sx={{ color: theme.primary }} />
                    : <DownloadIcon sx={{ fontSize: 16, color: theme.success }} />}
                <Box>
                    <Typography variant="caption" fontWeight={800} sx={{ color: theme.textMain, fontSize: '0.72rem', display: 'block', lineHeight: 1.2 }}>
                        {downloading ? 'Preparing ZIP…' : `Download ${modelName} v${versionNumber} Export Bundle`}
                    </Typography>
                    {!downloading && (
                        <Typography variant="caption" sx={{ color: theme.textMuted, fontSize: '0.62rem' }}>
                            ZIP · Included: {components.join(', ')}
                        </Typography>
                    )}
                </Box>
            </Stack>
            {!downloading && <DownloadIcon sx={{ fontSize: 14, color: theme.success, opacity: 0.6 }} />}
        </Box>
    );
}

// ─── Action Button (renders dynamic actions) ──────────────────────────────────
function ActionButton({ action }: { action: { type: string; label: string; download_type: string; entity_type: string; entity_id: number; download_url?: string } }) {
    const { theme } = useTheme();
    const [downloading, setDownloading] = useState(false);

    const handleDownload = async () => {
        setDownloading(true);
        try {
            let url = action.download_url;
            if (!url) {
                if (action.download_type === 'report') {
                    const params = new URLSearchParams({ report_type: action.entity_type });
                    if (action.entity_type === 'model') {
                        params.append('model_id', String(action.entity_id));
                    } else if (action.entity_type === 'factory') {
                        params.append('factory_id', String(action.entity_id));
                    } else if (action.entity_type === 'algorithm') {
                        params.append('algorithm_id', String(action.entity_id));
                    }
                    url = `/chatbot/download-report?${params.toString()}`;
                } else if (action.download_type === 'artifact') {
                    url = `/artifacts/${action.entity_id}/download`;
                }
            }

            if (!url) {
                console.error('No download URL available for action:', action);
                return;
            }

            const finalUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
            const res = await fetch(finalUrl);
            if (!res.ok) {
                throw new Error(`Failed to download: ${res.statusText}`);
            }
            const blob = await res.blob();
            const disposition = res.headers.get('Content-Disposition') ?? '';

            let filename = '';
            const rfcMatch = disposition.match(/filename\*=(?:UTF-8'')?([^\s;]+)/i);
            const plainMatch = disposition.match(/filename="([^"]+)"/);
            if (rfcMatch) {
                filename = decodeURIComponent(rfcMatch[1]);
            } else if (plainMatch) {
                filename = plainMatch[1];
            }

            if (!filename) {
                filename = action.label.replace(/\s+/g, '_') + (action.download_type === 'report' ? '.csv' : '.zip');
            }

            const blobUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(blobUrl);
        } catch (e) {
            console.error('Action download failed:', e);
        } finally {
            setDownloading(false);
        }
    };

    const isReport = action.download_type === 'report';

    return (
        <Box
            onClick={downloading ? undefined : handleDownload}
            sx={{
                mt: 1.5, cursor: downloading ? 'default' : 'pointer',
                borderRadius: '14px',
                background: downloading
                    ? alpha(theme.textMain, 0.04)
                    : `linear-gradient(135deg, ${alpha(theme.success, 0.1)}, ${alpha(theme.primary, 0.08)})`,
                border: `1px solid ${alpha(downloading ? theme.border : theme.success, 0.3)}`,
                px: 2, py: 1.5,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                transition: 'all 0.2s ease',
                '&:hover': downloading ? {} : {
                    background: `linear-gradient(135deg, ${alpha(theme.success, 0.16)}, ${alpha(theme.primary, 0.12)})`,
                    border: `1px solid ${alpha(theme.success, 0.5)}`,
                    transform: 'translateY(-1px)',
                    boxShadow: `0 6px 20px ${alpha(theme.success, 0.2)}`,
                },
            }}
        >
            <Stack direction="row" spacing={1} alignItems="center">
                {downloading
                    ? <CircularProgress size={14} sx={{ color: theme.primary }} />
                    : <DownloadIcon sx={{ fontSize: 16, color: theme.success }} />}
                <Box>
                    <Typography variant="caption" fontWeight={800} sx={{ color: theme.textMain, fontSize: '0.72rem', display: 'block', lineHeight: 1.2 }}>
                        {downloading ? 'Preparing download…' : action.label}
                    </Typography>
                    {!downloading && (
                        <Typography variant="caption" sx={{ color: theme.textMuted, fontSize: '0.62rem' }}>
                            {isReport ? 'CSV · All fields included' : 'Export Bundle · ZIP'}
                        </Typography>
                    )}
                </Box>
            </Stack>
            {!downloading && <DownloadIcon sx={{ fontSize: 14, color: theme.success, opacity: 0.6 }} />}
        </Box>
    );
}

// ─── Entity list view ───────────────────────────────────────────────────────
function EntityList({ data, type }: { data: any[], type: 'factories' | 'algorithms' | 'models' | 'versions' }) {
    const { theme, mode } = useTheme();
    const navigate = useNavigate();

    return (
        <Stack spacing={1.5} sx={{ mt: 1.5, width: '100%' }}>
            {data.map((item, index) => {
                const id = item.id;
                const name = item.name || (type === 'versions' ? `Version ${item.version_number}` : `Item ${index + 1}`);
                const description = item.description || item.note;
                const formattedDate = item.created_at 
                    ? new Date(item.created_at).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                    })
                    : null;

                // Determine navigation path
                let path: string | null = null;
                if (id !== undefined && id !== null) {
                    if (type === 'factories') {
                        path = `/factories/${id}`;
                    } else if (type === 'algorithms') {
                        path = `/algorithms/${id}/factories`;
                    } else if (type === 'models') {
                        const algId = item.algorithm_id;
                        const facId = item.factory_id;
                        if (algId && facId) {
                            path = `/algorithms/${algId}/factories/${facId}/models/${id}`;
                        } else {
                            path = `/algorithms`; // Fallback
                        }
                    } else if (type === 'versions') {
                        const algId = item.algorithm_id;
                        const facId = item.factory_id;
                        const modelId = item.model_id;
                        if (algId && facId && modelId) {
                            path = `/algorithms/${algId}/factories/${facId}/models/${modelId}/versions/${id}`;
                        } else {
                            path = `/algorithms`; // Fallback
                        }
                    }
                }

                // Select Icon and Color based on type
                let Icon = FactoryIcon;
                let color = theme.primary;
                if (type === 'algorithms') {
                    Icon = AlgorithmIcon;
                    color = theme.secondary ?? theme.info;
                } else if (type === 'models') {
                    Icon = ModelIcon;
                    color = '#8B5CF6'; // purple color
                } else if (type === 'versions') {
                    Icon = VersionIcon;
                    color = theme.success ?? '#10B981';
                }

                return (
                    <Box
                        key={id ?? index}
                        onClick={path ? () => navigate(path) : undefined}
                        sx={{
                            p: 2,
                            borderRadius: '16px',
                            background: mode === 'dark' 
                                ? 'rgba(30, 41, 59, 0.65)' 
                                : 'rgba(255, 255, 255, 0.9)',
                            border: `1px solid ${alpha(color, 0.12)}`,
                            boxShadow: `0 4px 12px ${alpha('#000', 0.03)}`,
                            cursor: path ? 'pointer' : 'default',
                            transition: 'all 0.2s ease',
                            display: 'flex',
                            gap: 1.5,
                            alignItems: 'center',
                            position: 'relative',
                            overflow: 'hidden',
                            '&:hover': path ? {
                                transform: 'translateY(-2px)',
                                borderColor: color,
                                boxShadow: `0 6px 18px ${alpha(color, 0.15)}`,
                                '& .launch-icon': {
                                    opacity: 1,
                                    transform: 'translateX(0)',
                                }
                            } : {},
                        }}
                    >
                        {/* Soft background glow on hover */}
                        {path && (
                            <Box sx={{
                                position: 'absolute',
                                top: 0, left: 0, right: 0, bottom: 0,
                                background: `linear-gradient(135deg, ${alpha(color, 0.04)}, transparent)`,
                                pointerEvents: 'none',
                            }} />
                        )}

                        {/* Left Avatar */}
                        <Avatar sx={{
                            width: 40,
                            height: 40,
                            borderRadius: '12px',
                            background: `linear-gradient(135deg, ${alpha(color, 0.12)}, ${alpha(theme.secondary ?? theme.info, 0.08)})`,
                            color: color,
                            border: `1px solid ${alpha(color, 0.18)}`,
                        }}>
                            <Icon sx={{ fontSize: 20 }} />
                        </Avatar>

                        {/* Middle Content */}
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography variant="subtitle2" fontWeight={800} sx={{ color: theme.textMain, fontSize: '0.88rem', mb: 0.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {name}
                            </Typography>
                            {description && (
                                <Typography variant="caption" sx={{ 
                                    color: theme.textMuted, 
                                    fontSize: '0.74rem', 
                                    display: '-webkit-box',
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: 'vertical',
                                    overflow: 'hidden',
                                    lineHeight: 1.3,
                                    mb: 0.5,
                                }}>
                                    {description}
                                </Typography>
                            )}

                            {/* Extra metrics for versions */}
                            {type === 'versions' && (
                                <Stack direction="row" spacing={1} sx={{ mt: 0.5, flexWrap: 'wrap', gap: 0.5 }}>
                                    {item.accuracy !== undefined && (
                                        <Chip label={`Acc: ${(Number(item.accuracy) * 100).toFixed(1)}%`} size="small" sx={{ height: 18, fontSize: '0.62rem', fontWeight: 700 }} />
                                    )}
                                    {item.f1_score !== undefined && (
                                        <Chip label={`F1: ${Number(item.f1_score).toFixed(3)}`} size="small" sx={{ height: 18, fontSize: '0.62rem', fontWeight: 700 }} />
                                    )}
                                </Stack>
                            )}

                            {formattedDate && (
                                <Typography variant="caption" sx={{ color: theme.textMuted, fontSize: '0.64rem', display: 'block', fontWeight: 600, mt: 0.5 }}>
                                    Created on {formattedDate}
                                </Typography>
                            )}
                        </Box>

                        {/* Right side: navigate arrow */}
                        {path && (
                            <IconButton 
                                className="launch-icon"
                                size="small" 
                                sx={{ 
                                    color: color, 
                                    opacity: 0.5, 
                                    transform: 'translateX(-4px)',
                                    transition: 'all 0.2s ease',
                                    bgcolor: alpha(color, 0.04),
                                    '&:hover': { bgcolor: alpha(color, 0.1) }
                                }}
                            >
                                <LaunchIcon sx={{ fontSize: 14 }} />
                            </IconButton>
                        )}
                    </Box>
                );
            })}
        </Stack>
    );
}

// ─── Memoized BotMessageContent (prevents re-parsing markdown on every render)
// This is the #1 performance fix: ReactMarkdown + its custom components are only
// re-created when `content` or the theme actually changes.
interface BotMessageContentProps {
    content: string;
    msgType?: string;
    themeRef: any;  // stable theme reference
    mode: 'dark' | 'light';
}

const BotMessageContent = memo(({ content, msgType, themeRef: theme, mode }: BotMessageContentProps) => {
    const cleanContent = useMemo(() => {
        let cleaned = content.replace(/<!--[\s\S]*?-->/g, '');
        // Strip out fuzzy name matching confidence warning
        cleaned = cleaned.replace(/⚠️\s*\*This response has lower confidence due to fuzzy name matching\.\s*Please verify if this matches your expectation\.\*/gi, '');
        cleaned = cleaned.replace(/This response has lower confidence due to fuzzy name matching\.\s*Please verify if this matches your expectation\./gi, '');
        return cleaned.trim();
    }, [content]);
    const mdComponents = useMemo(() => ({
        h1: ({ node, ...props }: any) => <Typography variant="h6" fontWeight={850} sx={{ mt: 1.5, mb: 1, color: theme.textMain, fontSize: '1rem' }} {...props} />,
        h2: ({ node, children, ...props }: any) => (
            <Box sx={{
                display: 'flex', alignItems: 'center', gap: 1,
                mt: 2, mb: 1.2, pb: 0.8,
                borderBottom: `2px solid ${alpha(theme.primary, 0.15)}`,
            }} {...props}>
                <Typography variant="subtitle2" fontWeight={900} sx={{
                    color: theme.primary, fontSize: '0.82rem',
                    letterSpacing: 0.2, lineHeight: 1,
                }}>
                    {children}
                </Typography>
            </Box>
        ),
        h3: ({ node, ...props }: any) => <Typography variant="subtitle2" fontWeight={800} sx={{ mt: 1.2, mb: 0.6, color: theme.textSecondary, fontSize: '0.8rem' }} {...props} />,
        p: ({ node, ...props }: any) => <Typography variant="body2" sx={{ mb: 1, color: msgType === 'user' ? '#fff' : theme.textMain, fontSize: '0.86rem', lineHeight: 1.65 }} {...props} />,
        ul: ({ node, ...props }: any) => <Box component="ul" sx={{ pl: 2, mb: 1 }} {...props} />,
        ol: ({ node, ...props }: any) => <Box component="ol" sx={{ pl: 2, mb: 1 }} {...props} />,
        li: ({ node, ...props }: any) => <Box component="li" sx={{ mb: 0.5 }} {...props} />,
        code: ({ node, inline, ...props }: any) => inline ? (
            <Box component="code" sx={{
                bgcolor: mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)',
                px: 0.6, py: 0.2, borderRadius: '4px', fontSize: '0.78rem', fontFamily: 'monospace',
                color: msgType === 'user' ? '#fff' : theme.primary, fontWeight: 700
            }} {...props} />
        ) : (
            <Box component="pre" sx={{
                bgcolor: mode === 'dark' ? '#0b0f19' : '#f1f5f9',
                p: 1.5, borderRadius: '12px', overflowX: 'auto', mb: 1.5, mt: 1,
                border: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`
            }}>
                <Box component="code" sx={{ fontSize: '0.76rem', fontFamily: 'monospace', color: theme.textMain }} {...props} />
            </Box>
        ),
        table: ({ node, ...props }: any) => (
            <Box sx={{
                overflowX: 'auto', my: 1.5, borderRadius: '14px',
                border: `1px solid ${alpha(theme.primary, 0.15)}`,
                boxShadow: `0 4px 20px -4px ${alpha(theme.primary, 0.08)}`,
                bgcolor: mode === 'dark' ? alpha('#0f172a', 0.6) : alpha('#fff', 0.95),
                backdropFilter: 'blur(8px)',
            }}>
                <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.76rem' }} {...props} />
            </Box>
        ),
        thead: ({ node, ...props }: any) => (
            <Box component="thead" sx={{
                background: mode === 'dark'
                    ? `linear-gradient(135deg, ${alpha(theme.primary, 0.22)}, ${alpha(theme.secondary ?? theme.primary, 0.14)})`
                    : `linear-gradient(135deg, ${alpha(theme.primary, 0.1)}, ${alpha(theme.secondary ?? theme.primary, 0.06)})`,
                borderBottom: `2px solid ${alpha(theme.primary, 0.2)}`,
            }} {...props} />
        ),
        tr: ({ node, ...props }: any) => (
            <Box component="tr" sx={{
                borderBottom: `1px solid ${alpha(theme.border, 0.15)}`,
                transition: 'background 0.15s ease',
                '&:last-child': { borderBottom: 'none' },
                '&:hover': { bgcolor: alpha(theme.primary, 0.04) },
                '&:nth-of-type(even)': { bgcolor: alpha(theme.textMain, 0.018) },
            }} {...props} />
        ),
        th: ({ node, ...props }: any) => (
            <Box component="th" sx={{
                px: 1.5, py: 1.1, textTransform: 'uppercase',
                letterSpacing: 0.9, fontWeight: 900, fontSize: '0.62rem',
                color: theme.primary, textAlign: 'left', whiteSpace: 'nowrap',
            }} {...props} />
        ),
        td: ({ node, children, ...props }: any) => {
            const raw = String(children ?? '');
            const isNA = raw.toLowerCase().includes('not available');
            const isDeployed = raw.includes('✅') || raw.toLowerCase().includes('deployed') || raw.toLowerCase() === 'active';
            const isInactive = raw.toLowerCase() === 'inactive' || raw.toLowerCase() === 'false';
            const isDeltaPos = /^\+\d/.test(raw.trim());
            const isDeltaNeg = /^-\d/.test(raw.trim());
            const isPct = /\d+(\.\d+)?%$/.test(raw.trim()) && !isDeltaPos && !isDeltaNeg;

            let cellContent: React.ReactNode = children;
            if (isNA) {
                cellContent = <Box component="span" sx={{ display: 'inline-block', px: 0.8, py: 0.2, borderRadius: '6px', fontSize: '0.68rem', fontWeight: 700, bgcolor: alpha(theme.textMuted, 0.1), color: theme.textMuted, fontStyle: 'italic' }}>N/A</Box>;
            } else if (isDeployed) {
                cellContent = <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.4, px: 0.9, py: 0.25, borderRadius: '8px', fontSize: '0.68rem', fontWeight: 800, bgcolor: alpha(theme.success ?? '#10B981', 0.12), color: theme.success ?? '#10B981', border: `1px solid ${alpha(theme.success ?? '#10B981', 0.25)}` }}>{raw}</Box>;
            } else if (isInactive) {
                cellContent = <Box component="span" sx={{ display: 'inline-block', px: 0.9, py: 0.25, borderRadius: '8px', fontSize: '0.68rem', fontWeight: 700, bgcolor: alpha(theme.textMuted, 0.1), color: theme.textMuted }}>{raw}</Box>;
            } else if (isDeltaPos) {
                cellContent = <Box component="span" sx={{ display: 'inline-block', px: 0.8, py: 0.2, borderRadius: '6px', fontSize: '0.72rem', fontWeight: 800, color: theme.success ?? '#10B981', bgcolor: alpha(theme.success ?? '#10B981', 0.1) }}>↑ {raw}</Box>;
            } else if (isDeltaNeg) {
                cellContent = <Box component="span" sx={{ display: 'inline-block', px: 0.8, py: 0.2, borderRadius: '6px', fontSize: '0.72rem', fontWeight: 800, color: theme.error ?? '#EF4444', bgcolor: alpha(theme.error ?? '#EF4444', 0.1) }}>↓ {raw}</Box>;
            } else if (isPct) {
                const numVal = parseFloat(raw);
                const metricColor = numVal >= 85 ? (theme.success ?? '#10B981') : numVal >= 70 ? (theme.warning ?? '#F59E0B') : (theme.error ?? '#EF4444');
                cellContent = <Box component="span" sx={{ display: 'inline-block', px: 0.8, py: 0.2, borderRadius: '6px', fontSize: '0.76rem', fontWeight: 800, color: metricColor, bgcolor: alpha(metricColor, 0.1) }}>{raw}</Box>;
            }

            return (
                <Box component="td" sx={{ px: 1.5, py: 0.9, color: theme.textMain, fontWeight: 500, fontSize: '0.76rem', whiteSpace: 'nowrap', verticalAlign: 'middle' }} {...props}>
                    {cellContent}
                </Box>
            );
        },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }), [theme.primary, theme.secondary, theme.textMain, theme.textMuted, theme.textSecondary, theme.border, theme.success, theme.error, theme.warning, mode, msgType]);

    return (
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
            {cleanContent}
        </ReactMarkdown>
    );
});
BotMessageContent.displayName = 'BotMessageContent';

// ─── Memoized Message Row ────────────────────────────────────────────────────
interface MessageRowProps {
    msg: Message;
    isNew: boolean;
    theme: any;
    mode: 'dark' | 'light';
    onComparisonClick: (data: any[]) => void;
}

const MessageRow = memo(({ msg, isNew, theme, mode, onComparisonClick }: MessageRowProps) => {
    const motionProps = isNew
        ? { initial: { opacity: 0, y: 12, scale: 0.98 }, animate: { opacity: 1, y: 0, scale: 1 }, transition: { duration: 0.25, type: 'spring' as const, damping: 20 } }
        : { initial: false as const, animate: false as const, transition: {} };

    // Entity type detection for SQL results
    const getEntityType = useCallback((m: Message) => {
        if (m.entity_type) return m.entity_type;
        if (!m.data || m.data.length === 0) return null;
        const keys = Object.keys(m.data[0]).map(k => k.toLowerCase());
        if (keys.includes('version_number') || keys.includes('accuracy') || keys.includes('f1_score')) return 'versions';
        const queryLower = m.query?.toLowerCase() || '';
        const fromMatch = queryLower.match(/\bfrom\s+(\w+)/);
        if (fromMatch) {
            const table = fromMatch[1];
            if (table === 'model_versions') return 'versions';
            if (table === 'models') return 'models';
            if (table === 'factories') return 'factories';
            if (table === 'algorithms') return 'algorithms';
        }
        if (keys.includes('model_name') || queryLower.includes('models') || queryLower.includes('model')) return 'models';
        if (keys.includes('factory_name') || queryLower.includes('factories') || queryLower.includes('factory')) return 'factories';
        if (keys.includes('algorithm_name') || queryLower.includes('algorithms') || queryLower.includes('algorithm')) return 'algorithms';
        return null;
    }, []);

    const entityType = msg.type === 'sql' && msg.data && msg.data.length > 0 ? getEntityType(msg) : null;
    const isEntityList = entityType && msg.data && (msg.data[0].name !== undefined || msg.data[0].version_number !== undefined);

    const cols = useMemo(() => {
        if (!msg.data || msg.data.length === 0) return [];
        const isIdColumn = (col: string) => { const lower = col.toLowerCase(); return lower === 'id' || lower.endsWith('_id'); };
        return Object.keys(msg.data[0]).filter(col => !isIdColumn(col));
    }, [msg.data]);

    return (
        <motion.div key={msg.id} {...motionProps}>
            <Box sx={{ display: 'flex', flexDirection: msg.role === 'user' ? 'row-reverse' : 'row', gap: 1.2, alignItems: 'flex-start' }}>
                {/* Avatar */}
                <Avatar sx={{
                    width: 32, height: 32, flexShrink: 0, borderRadius: '10px',
                    background: msg.role === 'user'
                        ? `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})`
                        : alpha(theme.primary, 0.1),
                    color: msg.role === 'user' ? '#fff' : theme.primary,
                    boxShadow: msg.role === 'user' ? `0 4px 12px ${alpha(theme.primary, 0.35)}` : 'none',
                }}>
                    {msg.role === 'user' ? <UserIcon sx={{ fontSize: 16 }} /> : <BotIcon sx={{ fontSize: 16 }} />}
                </Avatar>

                {/* Bubble */}
                <Box sx={{ maxWidth: '80%', minWidth: 0 }}>
                    <Paper elevation={0} sx={{
                        px: 2, py: 1.5,
                        borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                        background: msg.role === 'user'
                            ? `linear-gradient(135deg, ${theme.primary} 0%, ${theme.secondary} 100%)`
                            : msg.type === 'error'
                                ? alpha(theme.error, 0.08)
                                : mode === 'dark'
                                    ? 'rgba(30, 41, 59, 0.45)'
                                    : 'rgba(241, 245, 249, 0.85)',
                        border: msg.role === 'bot'
                            ? `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)'}`
                            : 'none',
                        boxShadow: msg.role === 'user'
                            ? `0 6px 20px -4px ${alpha(theme.primary, 0.3)}`
                            : `0 4px 12px -2px ${alpha('#000', 0.04)}`,
                    }}>
                        <Typography variant="body2" component="div" sx={{
                            color: msg.role === 'user' ? '#fff' : msg.type === 'error' ? theme.error : theme.textMain,
                            lineHeight: 1.7, fontSize: '0.86rem', fontWeight: 500,
                            '& p': { m: 0, mb: 1 }, '& p:last-child': { mb: 0 },
                            '& strong': { fontWeight: 800 },
                            '& a': { color: theme.primary, textDecoration: 'none', fontWeight: 700, '&:hover': { textDecoration: 'underline' } },
                            '& ul, & ol': { pl: 2.5, m: 0, mb: 1 },
                            '& li': { mb: 0.5 },
                        }}>
                            {msg.role === 'user' ? (
                                <span>{msg.content}</span>
                            ) : (
                                <BotMessageContent
                                    content={msg.content}
                                    msgType={msg.type}
                                    themeRef={theme}
                                    mode={mode}
                                />
                            )}
                        </Typography>

                        {/* SQL Results */}
                        {msg.type === 'sql' && msg.data && msg.data.length > 0 && (
                            isEntityList
                                ? <EntityList data={msg.data} type={entityType as any} />
                                : cols.length > 0 && (
                                    <Box sx={{ mt: 1.5, borderRadius: '14px', overflow: 'hidden', border: `1px solid ${alpha(theme.border, 0.35)}`, boxShadow: `0 4px 16px -4px ${alpha('#000', 0.06)}` }}>
                                        <Box sx={{ overflowX: 'auto' }}>
                                            <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                                                <Box component="thead">
                                                    <Box component="tr" sx={{ background: `linear-gradient(135deg, ${alpha(theme.primary, 0.12)}, ${alpha(theme.primary, 0.06)})`, borderBottom: `2px solid ${alpha(theme.primary, 0.2)}` }}>
                                                        {cols.map(col => (
                                                            <Box key={col} component="th" sx={{ px: 1.5, py: 1, textAlign: 'left', fontWeight: 800, fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: 0.8, color: theme.primary, whiteSpace: 'nowrap' }}>
                                                                {col.replace(/_/g, ' ')}
                                                            </Box>
                                                        ))}
                                                    </Box>
                                                </Box>
                                                <Box component="tbody">
                                                    {msg.data.map((row: any, rIdx: number) => (
                                                        <Box key={rIdx} component="tr" sx={{ bgcolor: rIdx % 2 === 0 ? 'transparent' : alpha(theme.textMain, 0.025), borderBottom: rIdx < msg.data!.length - 1 ? `1px solid ${alpha(theme.border, 0.2)}` : 'none', transition: 'background 0.15s', '&:hover': { bgcolor: alpha(theme.primary, 0.04) } }}>
                                                            {cols.map(col => (
                                                                <Box key={col} component="td" sx={{ px: 1.5, py: 0.9, color: theme.textMain, fontWeight: 500, fontSize: '0.76rem', whiteSpace: 'nowrap', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                    {row[col] !== null && row[col] !== undefined ? String(row[col]) : <Box component="span" sx={{ color: theme.textMuted, fontStyle: 'italic' }}>—</Box>}
                                                                </Box>
                                                            ))}
                                                        </Box>
                                                    ))}
                                                </Box>
                                            </Box>
                                        </Box>
                                        <Box sx={{ px: 1.5, py: 0.7, borderTop: `1px solid ${alpha(theme.border, 0.2)}`, bgcolor: alpha(theme.textMain, 0.02), display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                            <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: theme.success, boxShadow: `0 0 6px ${theme.success}` }} />
                                            <Typography variant="caption" sx={{ color: theme.textMuted, fontSize: '0.62rem', fontWeight: 700 }}>
                                                {msg.data.length} {msg.data.length === 1 ? 'record' : 'records'} retrieved
                                            </Typography>
                                        </Box>
                                    </Box>
                                )
                        )}

                        {/* Comparison button */}
                        {msg.type === 'comparison' && msg.data && msg.data.length >= 2 && (
                            <ComparisonButton
                                versions={msg.data}
                                onClick={() => onComparisonClick(msg.data!)}
                            />
                        )}

                        {/* Inline Comparison Chart */}
                        {msg.show_compare && msg.entities && msg.metrics && (
                            <ChatComparisonChart
                                comparison_title={msg.comparison_title}
                                entities={msg.entities}
                                metrics={msg.metrics}
                                theme={theme}
                                mode={mode}
                            />
                        )}

                        {/* Download report button */}
                        {msg.type === 'download' && msg.report_type && (
                            <DownloadReportButton
                                reportType={msg.report_type}
                                reportName={msg.report_name}
                                algorithmId={msg.algorithm_id}
                                algorithmName={msg.algorithm_name}
                                factoryId={msg.factory_id}
                                factoryName={msg.factory_name}
                                modelId={msg.model_id}
                            />
                        )}

                        {/* Download zip button */}
                        {msg.type === 'zip_download' && msg.download_url && (
                            <DownloadZipButton
                                downloadUrl={msg.download_url}
                                modelName={msg.model_name || 'Model'}
                                versionNumber={msg.version_number || 1}
                                components={msg.components || []}
                            />
                        )}

                        {/* Dynamic Actions */}
                        {msg.actions && msg.actions.length > 0 && msg.actions.map((act, index) => (
                            <ActionButton key={index} action={act} />
                        ))}
                    </Paper>

                    {/* Timestamp */}
                    <Typography variant="caption" sx={{
                        color: theme.textMuted, fontSize: '0.62rem', fontWeight: 600,
                        display: 'block', textAlign: msg.role === 'user' ? 'right' : 'left',
                        mt: 0.4, px: 0.8,
                    }}>
                        {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Typography>
                </Box>
            </Box>
        </motion.div>
    );
});
MessageRow.displayName = 'MessageRow';

// ─── Main Chatbot Redesign ──────────────────────────────────────────────────
export default function Chatbot() {
    const { theme, mode } = useTheme();
    const [isOpen, setIsOpen] = useState(false);
    const [input, setInput] = useState('');
    const [comparisonModal, setComparisonModal] = useState<{ open: boolean; data: any[] }>({ open: false, data: [] });
    const [messages, setMessages] = useState<Message[]>([{
        id: '1', role: 'bot', type: 'text', timestamp: new Date(),
        content: "Hi, I'm **MIRA** — your **MARS Intelligent Repository Assistant**! 🤖\n\nI can help you explore your models, factories, versions, and performance metrics — just ask me anything.",
    }]);
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isLoading]);

    useEffect(() => {
        if (isOpen && messages.length === 1 && messages[0].content.includes("Chat history cleared")) {
            setMessages([{
                id: '1', role: 'bot', type: 'text', timestamp: new Date(),
                content: "Hi, I'm **MIRA** — your **MARS Intelligent Repository Assistant**! 🤖\n\nI can help you explore your models, factories, versions, and performance metrics — just ask me anything.",
            }]);
        }
    }, [isOpen, messages]);

    const send = async (text: string) => {
        const msg = text.trim();
        if (!msg || isLoading) return;
        setInput('');
        setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', content: msg, timestamp: new Date() }]);
        setIsLoading(true);
        try {
            const historyContext = messages.map(m => ({
                role: m.role,
                content: m.content
            }));
            const { data } = await axios.post(`${API_BASE_URL}/chatbot/ask`, {
                message: msg,
                context: historyContext
            });
            setMessages(prev => [...prev, {
                id: (Date.now() + 1).toString(), role: 'bot',
                content: data.response || data.answer || '', data: data.data, query: data.query,
                type: data.type, report_type: data.report_type, report_name: data.report_name,
                algorithm_id: data.algorithm_id,
                algorithm_name: data.algorithm_name,
                factory_id: data.factory_id,
                factory_name: data.factory_name,
                model_id: data.model_id,
                entity_type: data.entity_type,
                download_url: data.download_url,
                components: data.components,
                model_name: data.model_name,
                version_number: data.version_number,
                actions: data.actions || [],
                response_type: data.response_type,
                show_compare: data.show_compare,
                comparison_title: data.comparison_title,
                entities: data.entities,
                metrics: data.metrics,
                timestamp: new Date(),
            }]);
        } catch (err: any) {
            setMessages(prev => [...prev, {
                id: (Date.now() + 1).toString(), role: 'bot', type: 'error',
                content: `Connection error: ${err.response?.data?.detail || err.message || 'Unknown error'}`,
                timestamp: new Date(),
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleClearChat = () => {
        setMessages([{
            id: '1', role: 'bot', type: 'text', timestamp: new Date(),
            content: "Chat history cleared. How can I help you explore MARS today? 🤖",
        }]);
    };

    const showSuggestions = messages.length === 1 && !isLoading;

    return (
        <Box sx={{ position: 'fixed', bottom: 28, right: 28, zIndex: 9999 }}>
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.85, y: 40 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.85, y: 40 }}
                        transition={{ type: 'spring', damping: 22, stiffness: 320 }}
                        style={{
                            position: 'absolute',
                            bottom: '80px',
                            right: 0,
                        }}
                    >
                        <Paper elevation={0} sx={{
                            width: 440, height: 640, borderRadius: '28px',
                            display: 'flex', flexDirection: 'column', overflow: 'hidden',
                            bgcolor: mode === 'dark' ? alpha(theme.paper, 0.82) : alpha('#fff', 0.88),
                            backdropFilter: 'blur(24px) saturate(180%)',
                            border: `1px solid ${alpha(theme.primary, 0.18)}`,
                            boxShadow: mode === 'dark'
                                ? `0 32px 80px rgba(0,0,0,0.5), inset 0 1px 1px 0 rgba(255,255,255,0.06)`
                                : `0 32px 80px ${alpha(theme.primary, 0.12)}, inset 0 1px 1px 0 rgba(255,255,255,0.5)`,
                        }}>

                            {/* ── Header Redesign ── */}
                            <Box sx={{
                                px: 2.5, py: 2, display: 'flex', alignItems: 'center', gap: 1.5,
                                borderBottom: `1px solid ${alpha(theme.border, 0.15)}`,
                                background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.secondary} 100%)`,
                                flexShrink: 0,
                                position: 'relative',
                            }}>
                                <Box sx={{
                                    width: 44, height: 44, borderRadius: '14px', flexShrink: 0,
                                    background: 'rgba(255, 255, 255, 0.18)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    boxShadow: '0 0 16px rgba(255, 255, 255, 0.25)',
                                    border: '1px solid rgba(255, 255, 255, 0.25)',
                                }}>
                                    <BotIcon sx={{ color: '#fff', fontSize: 22 }} />
                                </Box>
                                <Box flex={1}>
                                    <Typography variant="subtitle1" fontWeight={900} sx={{ color: '#fff', lineHeight: 1.1, fontSize: '1.05rem', letterSpacing: '-0.01em' }}>
                                        MIRA
                                    </Typography>
                                    <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mt: 0.4 }}>
                                        {/* Soft pulsing green ring indicator */}
                                        <Box sx={{
                                            width: 8, height: 8, borderRadius: '50%', bgcolor: '#10B981',
                                            animation: 'ringPulse 2s infinite',
                                            '@keyframes ringPulse': {
                                                '0%': { transform: 'scale(0.9)', boxShadow: '0 0 0 0 rgba(16, 185, 129, 0.7)' },
                                                '70%': { transform: 'scale(1)', boxShadow: '0 0 0 5px rgba(16, 185, 129, 0)' },
                                                '100%': { transform: 'scale(0.9)', boxShadow: '0 0 0 0 rgba(16, 185, 129, 0)' },
                                            }
                                        }} />
                                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.68rem', fontWeight: 600 }}>
                                            Active Assistant
                                        </Typography>
                                    </Stack>
                                </Box>
                                <Stack direction="row" spacing={0.5}>
                                    {messages.length > 1 && (
                                        <Tooltip title="Clear conversation">
                                            <IconButton size="small" onClick={handleClearChat} sx={{
                                                color: 'rgba(255,255,255,0.85)',
                                                bgcolor: 'rgba(255,255,255,0.1)',
                                                borderRadius: '10px',
                                                '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' },
                                            }}>
                                                <ClearIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                    )}
                                    <IconButton size="small" onClick={() => setIsOpen(false)} sx={{
                                        color: 'rgba(255,255,255,0.85)',
                                        bgcolor: 'rgba(255,255,255,0.1)',
                                        borderRadius: '10px',
                                        '&:hover': { bgcolor: alpha(theme.error, 0.2), color: '#fff' },
                                    }}>
                                        <CloseIcon fontSize="small" />
                                    </IconButton>
                                </Stack>
                            </Box>

                            {/* ── Messages Roster ── */}
                            <Box sx={{
                                flex: 1, overflowY: 'auto', px: 2.5, py: 2.5,
                                display: 'flex', flexDirection: 'column', gap: 2,
                                '&::-webkit-scrollbar': { width: 5 },
                                '&::-webkit-scrollbar-thumb': { bgcolor: alpha(theme.primary, 0.25), borderRadius: 10 },
                                '&::-webkit-scrollbar-track': { bgcolor: 'transparent' },
                            }}>
                                {messages.map((msg, idx) => (
                                    <MessageRow
                                        key={msg.id}
                                        msg={msg}
                                        isNew={idx === messages.length - 1}
                                        theme={theme}
                                        mode={mode}
                                        onComparisonClick={(data) => setComparisonModal({ open: true, data })}
                                    />
                                ))}



                                {/* Organic Typing Indicator */}
                                {isLoading && (
                                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                                        <Box sx={{ display: 'flex', gap: 1.2, alignItems: 'flex-start' }}>
                                            <Avatar sx={{ width: 32, height: 32, borderRadius: '10px', bgcolor: alpha(theme.primary, 0.1), color: theme.primary }}>
                                                <BotIcon sx={{ fontSize: 16 }} />
                                            </Avatar>
                                            <Paper elevation={0} sx={{
                                                px: 2, py: 1.2, borderRadius: '18px 18px 18px 4px',
                                                bgcolor: mode === 'dark' ? 'rgba(30, 41, 59, 0.45)' : 'rgba(241, 245, 249, 0.85)',
                                                border: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)'}`,
                                                display: 'flex', alignItems: 'center', gap: 1.2,
                                                boxShadow: `0 4px 12px -2px ${alpha('#000', 0.04)}`,
                                            }}>
                                                <LoadingDots />
                                            </Paper>
                                        </Box>
                                    </motion.div>
                                )}
                                <div ref={messagesEndRef} />
                            </Box>

                            {/* ── Scrollable Suggested Queries ── */}
                            <AnimatePresence>
                                {showSuggestions && (
                                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                                        <Box sx={{ px: 2.5, pb: 2, pt: 0.5 }}>
                                            <Typography variant="caption" fontWeight={800} sx={{ color: theme.textMuted, textTransform: 'uppercase', letterSpacing: 1, fontSize: '0.62rem', mb: 1, display: 'block' }}>
                                                Suggested Queries
                                            </Typography>
                                            <Box sx={{
                                                display: 'flex',
                                                gap: 1,
                                                overflowX: 'auto',
                                                pb: 0.5,
                                                '&::-webkit-scrollbar': { height: 4 },
                                                '&::-webkit-scrollbar-thumb': { bgcolor: alpha(theme.primary, 0.2), borderRadius: 10 },
                                                '&::-webkit-scrollbar-track': { bgcolor: 'transparent' },
                                            }}>
                                                {SUGGESTIONS.map(s => (
                                                    <Chip key={s} label={s} size="small" onClick={() => send(s)} sx={{
                                                        cursor: 'pointer', fontSize: '0.7rem', fontWeight: 700, height: 28,
                                                        bgcolor: alpha(theme.primary, 0.06),
                                                        color: theme.primary,
                                                        border: `1px solid ${alpha(theme.primary, 0.15)}`,
                                                        borderRadius: '10px',
                                                        px: 0.5,
                                                        flexShrink: 0,
                                                        '&:hover': {
                                                            bgcolor: theme.primary,
                                                            color: '#fff',
                                                            borderColor: theme.primary,
                                                            boxShadow: `0 4px 10px ${alpha(theme.primary, 0.3)}`
                                                        },
                                                        transition: 'all 0.2s',
                                                    }} />
                                                ))}
                                            </Box>
                                        </Box>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* ── Premium Input capsule ── */}
                            <Box sx={{
                                px: 2.5, pb: 2.5, pt: 1.5,
                                borderTop: `1px solid ${alpha(theme.border, 0.15)}`,
                                bgcolor: alpha(theme.paper, 0.25),
                                flexShrink: 0,
                            }}>
                                <Stack direction="row" spacing={1.2} alignItems="center">
                                    <TextField
                                        fullWidth multiline maxRows={3}
                                        placeholder="Ask MIRA about models, performance..."
                                        size="small" value={input}
                                        onChange={e => setInput(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
                                        sx={{
                                            '& .MuiOutlinedInput-root': {
                                                borderRadius: '20px', fontSize: '0.86rem',
                                                bgcolor: mode === 'dark' ? alpha(theme.background, 0.6) : '#fff',
                                                color: theme.textMain,
                                                px: 2,
                                                py: 1,
                                                '& fieldset': { borderColor: alpha(theme.border, 0.4), transition: 'border-color 0.2s' },
                                                '&:hover fieldset': { borderColor: alpha(theme.primary, 0.4) },
                                                '&.Mui-focused fieldset': { borderColor: theme.primary, borderWidth: 1.5 },
                                                '&.Mui-focused': { boxShadow: `0 0 12px ${alpha(theme.primary, 0.12)}` },
                                                '& textarea::placeholder': { color: theme.textMuted, opacity: 1, fontWeight: 500 },
                                            },
                                        }}
                                    />
                                    <Tooltip title={isLoading ? 'Thinking…' : 'Send Message'}>
                                        <span>
                                            <IconButton onClick={() => send(input)} disabled={!input.trim() || isLoading} sx={{
                                                width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                                                background: !input.trim() || isLoading
                                                    ? alpha(theme.textMuted, 0.08)
                                                    : `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})`,
                                                color: !input.trim() || isLoading ? alpha(theme.textMuted, 0.3) : '#fff',
                                                boxShadow: !input.trim() || isLoading ? 'none' : `0 6px 16px ${alpha(theme.primary, 0.35)}`,
                                                transition: 'all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                                                '&:hover': {
                                                    transform: !input.trim() || isLoading ? 'none' : 'scale(1.06) translateY(-1px)',
                                                    boxShadow: `0 8px 20px ${alpha(theme.primary, 0.45)}`
                                                },
                                            }}>
                                                <SendIcon sx={{ fontSize: 18 }} />
                                            </IconButton>
                                        </span>
                                    </Tooltip>
                                </Stack>
                            </Box>
                        </Paper>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── FAB Launch button with Pulse Glow ring ── */}
            <Zoom in>
                <Fab sx={{
                    width: 62, height: 62, flexShrink: 0,
                    background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})`,
                    color: '#fff',
                    boxShadow: `0 8px 24px ${alpha(theme.primary, 0.45)}`,
                    animation: isOpen ? 'none' : 'pulseGlow 2.5s infinite',
                    '&:hover': {
                        transform: 'scale(1.08) rotate(5deg)',
                        boxShadow: `0 12px 30px ${alpha(theme.primary, 0.55)}`,
                    },
                    transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                    position: 'relative',
                    '@keyframes pulseGlow': {
                        '0%': { transform: 'scale(1)', boxShadow: `0 0 0 0 ${alpha(theme.primary, 0.6)}` },
                        '70%': { transform: 'scale(1.02)', boxShadow: `0 0 0 14px ${alpha(theme.primary, 0)}` },
                        '100%': { transform: 'scale(1)', boxShadow: `0 0 0 0 ${alpha(theme.primary, 0)}` }
                    }
                }} onClick={() => setIsOpen(o => !o)}>
                    {isOpen ? <CloseIcon sx={{ fontSize: 24 }} /> : <ChatIcon sx={{ fontSize: 24 }} />}
                </Fab>
            </Zoom>

            {/* ── Comparison Modal ── */}
            <ComparisonModal
                versions={comparisonModal.data}
                open={comparisonModal.open}
                onClose={() => setComparisonModal({ open: false, data: [] })}
            />
        </Box>
    );
}
