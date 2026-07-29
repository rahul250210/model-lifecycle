"use client";

import React, { useState, useRef, useEffect, useMemo, useCallback, memo } from 'react';
import {
    Box, IconButton, Typography, Paper, TextField, Stack, Avatar,
    alpha, Fab, Zoom, Chip, Tooltip,
    Dialog, DialogContent, DialogTitle, DialogActions, Button
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
    Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon,
    Remove as MinimizeIcon, RestartAlt as RevertIcon
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { API_BASE_URL } from '../../api/axios';
import { useTheme } from '../../theme/ThemeContext';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { ChatComparisonChart, ComparisonModal } from './ChatVisualizations';
import { ComparisonButton, DownloadZipButton, ActionButton, EntityList } from './ChatUIComponents';
// ─── Types ────────────────────────────────────────────────────────────────────
interface Message {
    id: string;
    role: 'user' | 'bot';
    content: string;
    data?: any[];
    query?: string;
    type?: 'text' | 'sql' | 'error' | 'comparison' | 'download' | 'factories' | 'zip_download' | 'streaming';
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

// ─── Memoized BotMessageContent (prevents re-parsing markdown on every render)
// This is the #1 performance fix: ReactMarkdown + its custom components are only
// re-created when `content` or the theme actually changes.
interface BotMessageContentProps {
    content: string;
    msgType?: string;
    themeRef: any;  // stable theme reference
    mode: 'dark' | 'light';
    onExpandTable: (content: React.ReactNode, title?: string, filename?: string) => void;
}

const BotMessageContent = memo(({ content, msgType, themeRef: theme, mode, onExpandTable }: BotMessageContentProps) => {
    const cleanContent = useMemo(() => {
        let cleaned = content.replace(/<!--[\s\S]*?-->/g, '');
        // Strip out fuzzy name matching confidence warning
        cleaned = cleaned.replace(/⚠️\s*\*This response has lower confidence due to fuzzy name matching\.\s*Please verify if this matches your expectation\.\*/gi, '');
        cleaned = cleaned.replace(/This response has lower confidence due to fuzzy name matching\.\s*Please verify if this matches your expectation\./gi, '');
        return cleaned.trim();
    }, [content]);
    const mdComponents = useMemo(() => ({
        a: ({ node, href, children, ...props }: any) => {
            const navigate = useNavigate();
            const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
                if (href) {
                    const isAppRoute = href.startsWith('/') || href.startsWith('file:///') || href.includes(window.location.host);
                    if (isAppRoute) {
                        e.preventDefault();
                        let path = href;
                        if (href.startsWith('file:///')) {
                            path = href.substring(8).replace(/^[a-zA-Z]:/, '');
                            if (!path.startsWith('/')) {
                                path = '/' + path;
                            }
                        } else if (href.includes(window.location.host)) {
                            const urlObj = new URL(href);
                            path = urlObj.pathname + urlObj.search + urlObj.hash;
                        }
                        navigate(path);
                    }
                }
            };
            return (
                <Box
                    component="a"
                    href={href}
                    onClick={handleClick}
                    sx={{
                        color: theme.primary,
                        fontWeight: 700,
                        textDecoration: 'none',
                        cursor: 'pointer',
                        '&:hover': { textDecoration: 'underline' }
                    }}
                    {...props}
                >
                    {children}
                </Box>
            );
        },
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
        p: ({ node, ...props }: any) => <Typography variant="body2" sx={{ mb: 1, color: msgType === 'user' ? '#fff' : theme.textMain, fontSize: '0.86rem', lineHeight: 1.65, wordBreak: 'break-word', overflowWrap: 'break-word' }} {...props} />,
        ul: ({ node, ...props }: any) => <Box component="ul" sx={{ pl: 2, mb: 1 }} {...props} />,
        ol: ({ node, ...props }: any) => <Box component="ol" sx={{ pl: 2, mb: 1 }} {...props} />,
        li: ({ node, ...props }: any) => <Box component="li" sx={{ mb: 0.5 }} {...props} />,
        code: ({ node, inline, ...props }: any) => inline ? (
            <Box component="code" sx={{
                bgcolor: mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)',
                px: 0.6, py: 0.2, borderRadius: '4px', fontSize: '0.78rem', fontFamily: 'monospace',
                color: msgType === 'user' ? '#fff' : theme.primary, fontWeight: 700,
                wordBreak: 'break-word', overflowWrap: 'break-word'
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
        table: ({ node, children, ...props }: any) => {
            const handleExpand = () => {
                let filename = 'table_export.csv';
                const match = content.match(/<!-- EXPORTABLE_TABULAR_DATA: (.*?) -->/);
                if (match && match[1]) {
                    try {
                        const jsonStr = atob(match[1]);
                        const data = JSON.parse(jsonStr);
                        if (data && data.filename) {
                            filename = data.filename;
                        }
                    } catch (e) {
                        console.error("Error decoding tabular data for filename", e);
                    }
                }
                if (filename === 'table_export.csv') {
                    if (content.toLowerCase().includes('factory') || content.toLowerCase().includes('production site')) {
                        filename = 'factories_list.csv';
                    } else if (content.toLowerCase().includes('model') && content.toLowerCase().includes('comparison')) {
                        filename = 'model_comparison.csv';
                    } else if (content.toLowerCase().includes('algorithm')) {
                        filename = 'algorithm_list.csv';
                    }
                }

                onExpandTable(
                    <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                        {children}
                    </Box>,
                    "Full Table View",
                    filename
                );
            };

            return (
                <Box sx={{ my: 1.5 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 0.5 }}>
                        <Button
                            size="small"
                            variant="text"
                            onClick={handleExpand}
                            startIcon={<LaunchIcon sx={{ fontSize: 12 }} />}
                            sx={{
                                textTransform: 'none',
                                fontSize: '0.7rem',
                                fontWeight: 800,
                                py: 0.2,
                                px: 1,
                                borderRadius: '6px',
                                color: theme.primary,
                                bgcolor: alpha(theme.primary, 0.05),
                                '&:hover': {
                                    bgcolor: alpha(theme.primary, 0.12),
                                },
                            }}
                        >
                            Open in Large View
                        </Button>
                    </Box>
                    <Box sx={{
                        overflowX: 'auto',
                        overflowY: 'auto',
                        maxHeight: '320px',
                        borderRadius: '14px',
                        border: `1px solid ${alpha(theme.primary, 0.15)}`,
                        boxShadow: `0 4px 20px -4px ${alpha(theme.primary, 0.08)}`,
                        bgcolor: mode === 'dark' ? alpha('#0f172a', 0.6) : alpha('#fff', 0.95),
                        backdropFilter: 'blur(8px)',
                        '&::-webkit-scrollbar': {
                            width: '6px',
                            height: '6px',
                        },
                        '&::-webkit-scrollbar-track': {
                            bgcolor: 'transparent',
                        },
                        '&::-webkit-scrollbar-thumb': {
                            bgcolor: alpha(theme.primary, 0.25),
                            borderRadius: '4px',
                            '&:hover': {
                                bgcolor: alpha(theme.primary, 0.45),
                            },
                        },
                    }}>
                        <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.76rem' }} {...props}>
                            {children}
                        </Box>
                    </Box>
                </Box>
            );
        },
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
    }), [theme.primary, theme.secondary, theme.textMain, theme.textMuted, theme.textSecondary, theme.border, theme.success, theme.error, theme.warning, mode, msgType, onExpandTable]);

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
    onExpandTable: (content: React.ReactNode, title?: string, filename?: string) => void;
}

const MessageRow = memo(({ msg, isNew, theme, mode, onComparisonClick, onExpandTable }: MessageRowProps) => {
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
                            wordBreak: 'break-word',
                            overflowWrap: 'break-word',
                            '& p': { m: 0, mb: 1 }, '& p:last-child': { mb: 0 },
                            '& strong': { fontWeight: 800 },
                            '& a': { color: theme.primary, textDecoration: 'none', fontWeight: 700, '&:hover': { textDecoration: 'underline' } },
                            '& ul, & ol': { pl: 2.5, m: 0, mb: 1 },
                            '& li': { mb: 0.5 },
                        }}>
                            {msg.role === 'user' ? (
                                <span>{msg.content}</span>
                            ) : msg.type === 'streaming' ? (
                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                    <LoadingDots />
                                </Box>
                            ) : (
                                <BotMessageContent
                                    content={msg.content}
                                    msgType={msg.type}
                                    themeRef={theme}
                                    mode={mode}
                                    onExpandTable={onExpandTable}
                                />
                            )}
                        </Typography>

                        {/* SQL Results */}
                        {msg.type === 'sql' && msg.data && msg.data.length > 0 && (
                            isEntityList
                                ? <EntityList data={msg.data} type={entityType as any} />
                                : cols.length > 0 && (
                                    <Box sx={{ mt: 1.5 }}>
                                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 0.5 }}>
                                            <Button
                                                size="small"
                                                variant="text"
                                                onClick={() => {
                                                    const rowData = msg.data || [];
                                                    let filename = 'query_results.csv';
                                                    if (msg.query) {
                                                        const q = msg.query.toLowerCase();
                                                        if (q.includes('factories')) {
                                                            filename = 'factories_list.csv';
                                                        } else if (q.includes('models')) {
                                                            filename = 'models_list.csv';
                                                        } else if (q.includes('algorithms')) {
                                                            filename = 'algorithms_list.csv';
                                                        } else if (q.includes('versions')) {
                                                            filename = 'versions_list.csv';
                                                        } else if (q.includes('experiments')) {
                                                            filename = 'experiments_list.csv';
                                                        }
                                                    }
                                                    onExpandTable(
                                                        <Box sx={{ overflowX: 'auto', p: 1 }}>
                                                            <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                                                                <Box component="thead">
                                                                    <Box component="tr" sx={{ background: `linear-gradient(135deg, ${alpha(theme.primary, 0.12)}, ${alpha(theme.primary, 0.06)})`, borderBottom: `2px solid ${alpha(theme.primary, 0.2)}` }}>
                                                                        {cols.map(col => (
                                                                            <Box key={col} component="th" sx={{ px: 2, py: 1.5, textAlign: 'left', fontWeight: 800, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: 0.8, color: theme.primary, whiteSpace: 'nowrap' }}>
                                                                                {col.replace(/_/g, ' ')}
                                                                            </Box>
                                                                        ))}
                                                                    </Box>
                                                                </Box>
                                                                <Box component="tbody">
                                                                    {rowData.map((row: any, rIdx: number) => (
                                                                        <Box key={rIdx} component="tr" sx={{ bgcolor: rIdx % 2 === 0 ? 'transparent' : alpha(theme.textMain, 0.025), borderBottom: rIdx < rowData.length - 1 ? `1px solid ${alpha(theme.border, 0.2)}` : 'none', transition: 'background 0.15s', '&:hover': { bgcolor: alpha(theme.primary, 0.04) } }}>
                                                                            {cols.map(col => (
                                                                                <Box key={col} component="td" sx={{ px: 2, py: 1.2, color: theme.textMain, fontWeight: 500, fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                                                                                    {row[col] !== null && row[col] !== undefined ? String(row[col]) : <Box component="span" sx={{ color: theme.textMuted, fontStyle: 'italic' }}>—</Box>}
                                                                                </Box>
                                                                            ))}
                                                                        </Box>
                                                                    ))}
                                                                </Box>
                                                            </Box>
                                                        </Box>,
                                                        "Full Table View",
                                                        filename
                                                    );
                                                }}
                                                startIcon={<LaunchIcon sx={{ fontSize: 12 }} />}
                                                sx={{
                                                    textTransform: 'none',
                                                    fontSize: '0.7rem',
                                                    fontWeight: 800,
                                                    py: 0.2,
                                                    px: 1,
                                                    borderRadius: '6px',
                                                    color: theme.primary,
                                                    bgcolor: alpha(theme.primary, 0.05),
                                                    '&:hover': {
                                                        bgcolor: alpha(theme.primary, 0.12),
                                                    },
                                                }}
                                            >
                                                Open in Large View
                                            </Button>
                                        </Box>
                                        <Box sx={{ borderRadius: '14px', overflow: 'hidden', border: `1px solid ${alpha(theme.border, 0.35)}`, boxShadow: `0 4px 16px -4px ${alpha('#000', 0.06)}` }}>
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
                        {msg.actions && msg.actions.length > 0 && msg.actions
                            .filter(act => {
                                if (msg.type === 'zip_download' && act.download_type === 'zip') {
                                    return false;
                                }
                                return true;
                            })
                            .map((act, index) => (
                                <ActionButton key={index} action={act} />
                            ))
                        }
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
    const [expandedTable, setExpandedTable] = useState<{ open: boolean; content: React.ReactNode; title?: string; filename?: string }>({ open: false, content: null, title: 'Table View', filename: 'table_export.csv' });
    const [messages, setMessages] = useState<Message[]>([{
        id: '1', role: 'bot', type: 'text', timestamp: new Date(),
        content: "Hi, I'm **MIRA** — your **MARS Intelligent Repository Assistant**! 🤖\n\nI can help you explore your models, factories, versions, and performance metrics — just ask me anything.",
    }]);
    const [isLoading, setIsLoading] = useState(false);
    const [clearWarningOpen, setClearWarningOpen] = useState(false);
    const abortControllerRef = useRef<AbortController | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const handleComparisonClick = useCallback((data: any[]) => {
        setComparisonModal({ open: true, data });
    }, []);

    const handleExpandTable = useCallback((content: React.ReactNode, title?: string, filename?: string) => {
        setExpandedTable({ open: true, content, title, filename });
    }, []);

    const handleDownloadExpandedTable = useCallback(() => {
        const table = document.querySelector('.expanded-table-container table');
        if (!table) return;

        const rows = Array.from(table.querySelectorAll('tr'));
        const csvContent = rows.map(row => {
            const cells = Array.from(row.querySelectorAll('th, td'));
            return cells.map(cell => {
                let text = cell.textContent || '';
                text = text.trim().replace(/"/g, '""');
                return `"${text}"`;
            }).join(',');
        }).join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);

        let filename = expandedTable.filename || 'table_export.csv';
        if (!filename.endsWith('.csv')) {
            filename += '.csv';
        }
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }, [expandedTable.filename]);

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

        const userMsgId = Date.now().toString(36) + Math.random().toString(36).substring(2);
        setMessages(prev => [...prev, { id: userMsgId, role: 'user', content: msg, timestamp: new Date() }]);

        setIsLoading(true);
        abortControllerRef.current = new AbortController();
        try {
            const historyContext = messages.map(m => ({
                role: m.role,
                content: m.content
            }));

            // Add a temporary bot message for streaming status
            const tempBotId = Date.now().toString(36) + Math.random().toString(36).substring(2);
            setMessages(prev => [...prev, {
                id: tempBotId, role: 'bot',
                content: "Initializing...", type: 'streaming',
                timestamp: new Date(),
            }]);

            const response = await fetch(`${API_BASE_URL}/chatbot/stream`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: msg, context: historyContext }),
                signal: abortControllerRef.current.signal
            });

            if (!response.body) throw new Error("No response body");

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            let buffer = "";
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n\n");
                buffer = lines.pop() || ""; // Keep the incomplete line in the buffer

                for (const chunk of lines) {
                    const chunkLines = chunk.split("\n");
                    let dataStr = "";
                    for (const line of chunkLines) {
                        if (line.startsWith("data: ")) {
                            dataStr = line.substring(6);
                            break;
                        }
                    }

                    if (chunk.startsWith("event: status")) {
                        if (dataStr) {
                            const data = JSON.parse(dataStr);
                            setMessages(prev => prev.map(m =>
                                m.id === tempBotId ? { ...m, content: `*${data.status}*` } : m
                            ));
                        }
                    } else if (chunk.startsWith("event: done") || chunk.startsWith("event: error")) {
                        if (dataStr) {
                            const data = JSON.parse(dataStr);
                            
                            // Emit global event to refresh UI lists if creation was successful
                            if (data.type === 'interactive_creation' && data.success) {
                                window.dispatchEvent(new CustomEvent('entityCreated'));
                            }
                            
                            setMessages(prev => prev.map(m =>
                                m.id === tempBotId ? {
                                    ...m,
                                    content: data.response || data.answer || '',
                                    data: data.data, query: data.query,
                                    type: data.type, report_type: data.report_type, report_name: data.report_name,
                                    algorithm_id: data.algorithm_id, algorithm_name: data.algorithm_name,
                                    factory_id: data.factory_id, factory_name: data.factory_name,
                                    model_id: data.model_id, entity_type: data.entity_type,
                                    download_url: data.download_url, components: data.components,
                                    model_name: data.model_name, version_number: data.version_number,
                                    actions: data.actions || [], response_type: data.response_type,
                                    show_compare: data.show_compare, comparison_title: data.comparison_title,
                                    entities: data.entities, metrics: data.metrics,
                                } : m
                            ));
                        }
                    }
                }
            }
        } catch (err: any) {
            if (err.name === 'AbortError') {
                return; // Suppress error for aborted requests
            }
            setMessages(prev => [...prev, {
                id: (Date.now() + 1).toString(), role: 'bot', type: 'error',
                content: `Connection error: ${err.response?.data?.detail || err.message || 'Unknown error'}`,
                timestamp: new Date(),
            }]);
        } finally {
            setIsLoading(false);
            abortControllerRef.current = null;
        }
    };

    const handleClearChat = () => {
        if (isLoading) {
            setClearWarningOpen(true);
            return;
        }
        performClear();
    };

    const performClear = () => {
        if (isLoading && abortControllerRef.current) {
            abortControllerRef.current.abort();
            setIsLoading(false);
            abortControllerRef.current = null;
        }
        setMessages([{
            id: '1', role: 'bot', type: 'text', timestamp: new Date(),
            content: "Chat history cleared. How can I help you explore MARS today? 🤖",
        }]);
        setClearWarningOpen(false);
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
                            width: { xs: '340px', sm: '560px' }, height: 700, borderRadius: '28px',
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
                                    <Tooltip title="Minimize">
                                        <IconButton size="small" onClick={() => setIsOpen(false)} sx={{
                                            color: 'rgba(255,255,255,0.85)',
                                            bgcolor: 'rgba(255,255,255,0.1)',
                                            borderRadius: '10px',
                                            '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' },
                                        }}>
                                            <MinimizeIcon fontSize="small" />
                                        </IconButton>
                                    </Tooltip>
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
                                        onComparisonClick={handleComparisonClick}
                                        onExpandTable={handleExpandTable}
                                    />
                                ))}




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
            <ComparisonModal theme={theme} mode={mode}
                versions={comparisonModal.data}
                open={comparisonModal.open}
                onClose={() => setComparisonModal({ open: false, data: [] })}
            />

            {/* ── Expanded Table Modal ── */}
            <Dialog
                open={expandedTable.open}
                onClose={() => setExpandedTable(prev => ({ ...prev, open: false }))}
                maxWidth="lg"
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
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: `linear-gradient(135deg, ${alpha(theme.primary, 0.12)} 0%, ${alpha(theme.secondary ?? theme.primary, 0.06)} 100%)`,
                    borderBottom: `1px solid ${alpha(theme.border, 0.2)}`,
                }}>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                        <Box sx={{
                            width: 36, height: 36, borderRadius: '12px',
                            background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary ?? theme.primary})`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: `0 4px 12px ${alpha(theme.primary, 0.4)}`,
                        }}>
                            <ExpandIcon sx={{ color: '#fff', fontSize: 18 }} />
                        </Box>
                        <Typography variant="h6" fontWeight={900} sx={{ color: theme.textMain, letterSpacing: '-0.02em' }}>
                            {expandedTable.title || 'Table View'}
                        </Typography>
                    </Stack>
                    <IconButton
                        onClick={() => setExpandedTable(prev => ({ ...prev, open: false }))}
                        size="small"
                        sx={{
                            color: theme.textMuted,
                            bgcolor: alpha(theme.textMain, 0.05), borderRadius: '10px',
                            '&:hover': { bgcolor: alpha(theme.error, 0.1), color: theme.error },
                        }}
                    >
                        <CloseIcon fontSize="small" />
                    </IconButton>
                </Box>
                <DialogContent sx={{ p: 3.5, bgcolor: mode === 'dark' ? '#0d0d15' : '#f4f6fa', overflowX: 'auto' }}>
                    <Box className="expanded-table-container" sx={{
                        borderRadius: '16px',
                        border: `1px solid ${alpha(theme.border, 0.25)}`,
                        boxShadow: `0 8px 30px rgba(0,0,0,0.12)`,
                        bgcolor: mode === 'dark' ? '#0f172a' : '#fff',
                        p: 2.5,
                        minWidth: 'fit-content'
                    }}>
                        {expandedTable.content}
                    </Box>
                </DialogContent>
                <DialogActions sx={{ px: 3.5, py: 2, borderTop: `1px solid ${alpha(theme.border, 0.15)}`, bgcolor: mode === 'dark' ? '#12121f' : '#f8f9fc', justifyContent: 'flex-end', gap: 1.5 }}>
                    <Button
                        onClick={handleDownloadExpandedTable}
                        variant="outlined"
                        startIcon={<DownloadIcon />}
                        sx={{
                            fontWeight: 800,
                            borderRadius: '10px',
                            textTransform: 'none',
                            px: 3,
                            color: theme.primary,
                            borderColor: alpha(theme.primary, 0.4),
                            '&:hover': {
                                borderColor: theme.primary,
                                bgcolor: alpha(theme.primary, 0.08),
                            }
                        }}
                    >
                        Download CSV
                    </Button>
                </DialogActions>
            </Dialog>

            {/* ── Clear Warning Dialog ── */}
            <Dialog
                open={clearWarningOpen}
                onClose={() => setClearWarningOpen(false)}
                sx={{ zIndex: 10000 }}
                PaperProps={{
                    sx: {
                        borderRadius: '16px',
                        bgcolor: mode === 'dark' ? '#12121f' : '#fff',
                        border: `1px solid ${alpha(theme.border, 0.3)}`
                    }
                }}
            >
                <DialogTitle sx={{ fontWeight: 800, color: theme.textMain }}>Clear Conversation?</DialogTitle>
                <DialogContent>
                    <Typography sx={{ color: theme.textSecondary, fontSize: '0.9rem' }}>
                        The chatbot is still generating a response. Do you still want to clear the history and stop the response?
                    </Typography>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button
                        onClick={() => setClearWarningOpen(false)}
                        sx={{ color: theme.textMain, fontWeight: 700 }}
                    >
                        Cancel
                    </Button>
                    <Button
                        color="error"
                        variant="contained"
                        onClick={performClear}
                        sx={{ fontWeight: 700, borderRadius: '8px' }}
                    >
                        Yes, Clear
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
