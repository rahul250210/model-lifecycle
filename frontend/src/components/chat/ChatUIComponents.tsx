import React from 'react';
import { Box, Typography, Stack, alpha, Chip, Avatar, IconButton } from '@mui/material';
import {
    BarChart as BarChartIcon,
    OpenInFull as ExpandIcon,
    FileDownload as DownloadIcon,
    Launch as LaunchIcon,
    Add as AddIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    Factory as FactoryIcon,
    Hub as AlgorithmIcon,
    Category as ModelIcon,
    Layers as VersionIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../../api/axios';
import { useTheme } from '../../theme/ThemeContext';

export function ComparisonButton({ versions, onClick }: { versions: any[], onClick: () => void }) {
    const { theme } = useTheme();
    if (!versions || versions.length < 2) return null;

    return (
        <Box
            onClick={onClick}
            sx={{
                mt: 1.5, cursor: 'pointer', borderRadius: '14px',
                background: `linear-gradient(135deg, ${alpha(theme.primary, 0.08)}, ${alpha(theme.secondary ?? theme.info ?? theme.primary, 0.08)})`,
                border: `1px solid ${alpha(theme.primary, 0.2)}`,
                px: 2, py: 1.5,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                transition: 'all 0.2s ease',
                '&:hover': {
                    background: `linear-gradient(135deg, ${alpha(theme.primary, 0.14)}, ${alpha(theme.secondary ?? theme.info ?? theme.primary, 0.14)})`,
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
                                bgcolor: alpha(i === 0 ? theme.primary : theme.secondary ?? theme.info ?? theme.primary, 0.15),
                                color: i === 0 ? theme.primary : theme.secondary ?? theme.info ?? theme.primary,
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

export function DownloadZipButton({ downloadUrl, modelName, versionNumber, components }: { downloadUrl: string, modelName: string, versionNumber: number, components: string[] }) {
    const { theme } = useTheme();

    const handleDownload = () => {
        try {
            const finalUrl = downloadUrl.startsWith('http') ? downloadUrl : `${API_BASE_URL}${downloadUrl}`;
            window.location.href = finalUrl;
        } catch (e) {
            console.error('ZIP Download setup failed:', e);
        }
    };

    return (
        <Box
            onClick={handleDownload}
            sx={{
                mt: 1.5, cursor: 'pointer',
                borderRadius: '14px',
                background: `linear-gradient(135deg, ${alpha(theme.success ?? '#10B981', 0.1)}, ${alpha(theme.primary, 0.08)})`,
                border: `1px solid ${alpha(theme.success ?? '#10B981', 0.3)}`,
                px: 2, py: 1.5,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                transition: 'all 0.2s ease',
                '&:hover': {
                    background: `linear-gradient(135deg, ${alpha(theme.success ?? '#10B981', 0.16)}, ${alpha(theme.primary, 0.12)})`,
                    border: `1px solid ${alpha(theme.success ?? '#10B981', 0.5)}`,
                    transform: 'translateY(-1px)',
                    boxShadow: `0 6px 20px ${alpha(theme.success ?? '#10B981', 0.2)}`,
                },
            }}
        >
            <Stack direction="row" spacing={1} alignItems="center">
                <DownloadIcon sx={{ fontSize: 16, color: theme.success ?? '#10B981' }} />
                <Box>
                    <Typography variant="caption" fontWeight={800} sx={{ color: theme.textMain, fontSize: '0.72rem', display: 'block', lineHeight: 1.2 }}>
                        {`Download ${modelName} v${versionNumber} Export Bundle`}
                    </Typography>
                    <Typography variant="caption" sx={{ color: theme.textMuted, fontSize: '0.62rem' }}>
                        ZIP · Included: {components.join(', ')}
                    </Typography>
                </Box>
            </Stack>
            <DownloadIcon sx={{ fontSize: 14, color: theme.success ?? '#10B981', opacity: 0.6 }} />
        </Box>
    );
}

export function ActionButton({ action }: { action: { type: string; label: string; download_type?: string; entity_type?: string; entity_id?: number; download_url?: string; icon?: string; path?: string; intent?: string; } }) {
    const { theme } = useTheme();
    const navigate = useNavigate();

    const handleClick = () => {
        try {
            if (action.type === 'navigate' && action.path) {
                navigate(action.path);
                return;
            }

            let url = action.download_url;
            if (!url) {
                if (action.download_type === 'artifact') {
                    url = `/artifacts/${action.entity_id}/download`;
                }
            }

            if (!url) {
                console.error('No download URL available for action:', action);
                return;
            }

            const finalUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
            window.location.href = finalUrl;
        } catch (e) {
            console.error('Action execution failed:', e);
        }
    };

    const isNavigate = action.type === 'navigate';
    const isReport = action.download_type === 'report';

    let IconComponent = DownloadIcon;
    let iconColor = theme.success ?? '#10B981';
    let subLabel = isReport ? 'CSV · All fields included' : 'Export Bundle · ZIP';

    if (isNavigate) {
        if (action.intent === 'create' || action.icon === 'add') {
            IconComponent = AddIcon;
            iconColor = theme.primary;
            subLabel = 'Create new entity';
        } else if (action.intent === 'edit' || action.icon === 'edit') {
            IconComponent = EditIcon;
            iconColor = theme.warning || '#F59E0B';
            subLabel = 'Modify settings';
        } else if (action.intent === 'delete' || action.icon === 'delete') {
            IconComponent = DeleteIcon;
            iconColor = theme.error || '#EF4444';
            subLabel = 'Remove entity';
        } else {
            IconComponent = LaunchIcon;
            iconColor = theme.primary;
            subLabel = 'Open page';
        }
    }

    return (
        <Box
            onClick={handleClick}
            sx={{
                mt: 1.5, cursor: 'pointer',
                borderRadius: '14px',
                background: `linear-gradient(135deg, ${alpha(iconColor, 0.1)}, ${alpha(theme.primary, 0.08)})`,
                border: `1px solid ${alpha(iconColor, 0.3)}`,
                px: 2, py: 1.5,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                transition: 'all 0.2s ease',
                '&:hover': {
                    background: `linear-gradient(135deg, ${alpha(iconColor, 0.16)}, ${alpha(theme.primary, 0.12)})`,
                    border: `1px solid ${alpha(iconColor, 0.5)}`,
                    transform: 'translateY(-1px)',
                    boxShadow: `0 6px 20px ${alpha(iconColor, 0.2)}`,
                },
            }}
        >
            <Stack direction="row" spacing={1} alignItems="center">
                <IconComponent sx={{ fontSize: 16, color: iconColor }} />
                <Box>
                    <Typography variant="caption" fontWeight={800} sx={{ color: theme.textMain, fontSize: '0.72rem', display: 'block', lineHeight: 1.2 }}>
                        {action.label}
                    </Typography>
                    <Typography variant="caption" sx={{ color: theme.textMuted, fontSize: '0.62rem' }}>
                        {subLabel}
                    </Typography>
                </Box>
            </Stack>
            <IconComponent sx={{ fontSize: 14, color: iconColor, opacity: 0.6 }} />
        </Box>
    );
}

export function EntityList({ data, type }: { data: any[], type: 'factories' | 'algorithms' | 'models' | 'versions' }) {
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
                            path = `/algorithms`;
                        }
                    } else if (type === 'versions') {
                        const algId = item.algorithm_id;
                        const facId = item.factory_id;
                        const modelId = item.model_id;
                        if (algId && facId && modelId) {
                            path = `/algorithms/${algId}/factories/${facId}/models/${modelId}/versions/${id}`;
                        } else {
                            path = `/algorithms`;
                        }
                    }
                }

                let Icon = FactoryIcon;
                let color = theme.primary;
                if (type === 'algorithms') {
                    Icon = AlgorithmIcon;
                    color = theme.secondary ?? theme.info ?? theme.primary;
                } else if (type === 'models') {
                    Icon = ModelIcon;
                    color = '#8B5CF6';
                } else if (type === 'versions') {
                    Icon = VersionIcon;
                    color = theme.success ?? '#10B981';
                }

                return (
                    <Box
                        key={id ?? index}
                        onClick={path ? () => navigate(path) : undefined}
                        sx={{
                            p: 2, borderRadius: '16px',
                            background: mode === 'dark' ? 'rgba(30, 41, 59, 0.65)' : 'rgba(255, 255, 255, 0.9)',
                            border: `1px solid ${alpha(color, 0.12)}`,
                            boxShadow: `0 4px 12px ${alpha('#000', 0.03)}`,
                            cursor: path ? 'pointer' : 'default',
                            transition: 'all 0.2s ease',
                            display: 'flex', gap: 1.5, alignItems: 'center', position: 'relative', overflow: 'hidden',
                            '&:hover': path ? {
                                transform: 'translateY(-2px)', borderColor: color, boxShadow: `0 6px 18px ${alpha(color, 0.15)}`,
                                '& .launch-icon': { opacity: 1, transform: 'translateX(0)' }
                            } : {},
                        }}
                    >
                        {path && (
                            <Box sx={{
                                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                                background: `linear-gradient(135deg, ${alpha(color, 0.04)}, transparent)`, pointerEvents: 'none',
                            }} />
                        )}
                        <Avatar sx={{
                            width: 40, height: 40, borderRadius: '12px',
                            background: `linear-gradient(135deg, ${alpha(color, 0.12)}, ${alpha(theme.secondary ?? theme.info ?? theme.primary, 0.08)})`,
                            color: color, border: `1px solid ${alpha(color, 0.18)}`,
                        }}>
                            <Icon sx={{ fontSize: 20 }} />
                        </Avatar>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography variant="subtitle2" fontWeight={800} sx={{ color: theme.textMain, fontSize: '0.88rem', mb: 0.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {name}
                            </Typography>
                            {description && (
                                <Typography variant="caption" sx={{ color: theme.textMuted, fontSize: '0.74rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.3, mb: 0.5 }}>
                                    {description}
                                </Typography>
                            )}
                            {type === 'versions' && (() => {
                                const formatAccuracy = (val: any) => {
                                    if (val === undefined || val === null) return '';
                                    const num = Number(val);
                                    if (isNaN(num)) return String(val);
                                    if (num <= 1.0) return `${(num * 100).toFixed(1)}%`;
                                    return `${num.toFixed(1)}%`;
                                };
                                const formatF1 = (val: any) => {
                                    if (val === undefined || val === null) return '';
                                    const num = Number(val);
                                    if (isNaN(num)) return String(val);
                                    return num.toFixed(3);
                                };
                                return (
                                    <Stack direction="row" spacing={1} sx={{ mt: 0.5, flexWrap: 'wrap', gap: 0.5 }}>
                                        {item.accuracy !== undefined && item.accuracy !== null && (
                                            <Chip label={`Acc: ${formatAccuracy(item.accuracy)}`} size="small" sx={{ height: 18, fontSize: '0.62rem', fontWeight: 700, bgcolor: mode === 'dark' ? alpha(theme.success ?? '#10B981', 0.18) : alpha(theme.success ?? '#10B981', 0.1), color: mode === 'dark' ? '#34d399' : theme.success ?? '#10B981', border: `1px solid ${alpha(theme.success ?? '#10B981', 0.3)}` }} />
                                        )}
                                        {item.f1_score !== undefined && item.f1_score !== null && (
                                            <Chip label={`F1: ${formatF1(item.f1_score)}`} size="small" sx={{ height: 18, fontSize: '0.62rem', fontWeight: 700, bgcolor: mode === 'dark' ? alpha(theme.primary, 0.18) : alpha(theme.primary, 0.1), color: mode === 'dark' ? '#818cf8' : theme.primary, border: `1px solid ${alpha(theme.primary, 0.3)}` }} />
                                        )}
                                        {item.precision !== undefined && item.precision !== null && (
                                            <Chip label={`Prec: ${formatAccuracy(item.precision)}`} size="small" sx={{ height: 18, fontSize: '0.62rem', fontWeight: 700, bgcolor: mode === 'dark' ? alpha(theme.secondary ?? theme.info ?? theme.primary, 0.18) : alpha(theme.secondary ?? theme.info ?? theme.primary, 0.1), color: mode === 'dark' ? '#60a5fa' : theme.secondary ?? theme.info ?? theme.primary, border: `1px solid ${alpha(theme.secondary ?? theme.info ?? theme.primary, 0.3)}` }} />
                                        )}
                                    </Stack>
                                );
                            })()}
                            {formattedDate && (
                                <Typography variant="caption" sx={{ color: theme.textMuted, fontSize: '0.64rem', display: 'block', fontWeight: 600, mt: 0.5 }}>
                                    Created on {formattedDate}
                                </Typography>
                            )}
                        </Box>
                        {path && (
                            <IconButton className="launch-icon" size="small" sx={{ color: color, opacity: 0.5, transform: 'translateX(-4px)', transition: 'all 0.2s ease', bgcolor: alpha(color, 0.04), '&:hover': { bgcolor: alpha(color, 0.1) } }}>
                                <LaunchIcon sx={{ fontSize: 14 }} />
                            </IconButton>
                        )}
                    </Box>
                );
            })}
        </Stack>
    );
}
