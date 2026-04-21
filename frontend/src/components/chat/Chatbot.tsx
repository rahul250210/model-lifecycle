"use client";

import { useState, useRef, useEffect } from 'react';
import {
    Box, IconButton, Typography, Paper, TextField, Stack, Avatar,
    alpha, CircularProgress, Fab, Zoom, Table, TableBody, TableCell,
    TableContainer, TableHead, TableRow, Chip, Divider, Tooltip, Collapse,
} from '@mui/material';
import {
    Close as CloseIcon, Send as SendIcon,
    AutoAwesome as BotIcon, Person as UserIcon,
    Psychology as ThinkingIcon, TableChart as SqlIcon,
    Chat as ChatIcon, ContentCopy as CopyIcon, Check as CheckIcon,
    Circle, ExpandMore as ExpandMoreIcon, ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import axios, { API_BASE_URL } from '../../api/axios';
import { useTheme } from '../../theme/ThemeContext';
import ReactMarkdown from 'react-markdown';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Message {
    id: string;
    role: 'user' | 'bot';
    content: string;
    data?: any[];
    query?: string;
    type?: 'text' | 'sql' | 'error';
    timestamp: Date;
}

// ─── Suggested queries ────────────────────────────────────────────────────────
const SUGGESTIONS = [
    'Show top 5 models by accuracy',
    'List all factories',
    'Average accuracy of active versions',
    'Which models have F1 > 0.9?',
];

// ─── Helper: format value nicely ─────────────────────────────────────────────
function isISODate(val: string): boolean {
    return /^\d{4}-\d{2}-\d{2}T/.test(val);
}
function fmtVal(val: any): string {
    if (val === null || val === undefined || val === '') return '—';
    if (typeof val === 'string' && isISODate(val)) {
        try {
            return new Date(val).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        } catch { return val; }
    }
    if (typeof val === 'boolean') return val ? '✓ Yes' : '✗ No';
    if (typeof val === 'number') {
        if (val > 0 && val <= 1) return (val * 100).toFixed(1) + '%';
        if (Number.isFinite(val)) return Number.isInteger(val) ? String(val) : val.toFixed(3);
    }
    if (typeof val === 'string' && val.length === 0) return '—';
    return String(val);
}

// ─── SQL table component ──────────────────────────────────────────────────────
function SqlTable({ data, theme }: { data: any[]; theme: any }) {
    if (!data || data.length === 0) return (
        <Typography variant="caption" sx={{ color: theme.textMuted, fontStyle: 'italic' }}>No results found.</Typography>
    );
    const headers = Object.keys(data[0]);
    return (
        <Box sx={{ mt: 1.5 }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                <SqlIcon sx={{ fontSize: 14, color: theme.primary }} />
                <Typography variant="caption" fontWeight={700} sx={{ color: theme.primary }}>
                    {data.length} row{data.length !== 1 ? 's' : ''} returned
                </Typography>
            </Stack>
            <TableContainer sx={{
                borderRadius: '12px',
                border: `1px solid ${alpha(theme.border, 0.3)}`,
                maxHeight: 220,
                bgcolor: alpha(theme.background, 0.4),
                backdropFilter: 'blur(8px)',
            }}>
                <Table size="small" stickyHeader>
                    <TableHead>
                        <TableRow>
                            {headers.map(h => (
                                <TableCell key={h} sx={{
                                    fontWeight: 800, fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: 0.6,
                                    bgcolor: alpha(theme.primary, 0.07), color: theme.textSecondary,
                                    borderBottom: `1px solid ${alpha(theme.border, 0.25)}`, whiteSpace: 'nowrap', py: 1, px: 1.5,
                                }}>{h.replace(/_/g, ' ')}</TableCell>
                            ))}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {data.map((row, i) => (
                            <TableRow key={i} sx={{ '&:hover': { bgcolor: alpha(theme.primary, 0.03) }, transition: 'background 0.15s' }}>
                                {headers.map(h => (
                                    <TableCell key={h} sx={{
                                        color: fmtVal(row[h]) === '—' ? theme.textMuted : theme.textMain,
                                        fontSize: '0.8rem', fontWeight: 600,
                                        borderBottom: i < data.length - 1 ? `1px solid ${alpha(theme.border, 0.15)}` : 'none',
                                        py: 0.9, px: 1.5, whiteSpace: 'nowrap',
                                        fontStyle: fmtVal(row[h]) === '—' ? 'italic' : 'normal',
                                    }}>{fmtVal(row[h])}</TableCell>
                                ))}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );
}


// ─── SQL collapsible query toggle ──────────────────────────────────────────
function SqlQueryToggle({ query, theme }: { query: string; theme: any }) {
    const [open, setOpen] = useState(false);
    const [copied, setCopied] = useState(false);
    const copy = () => {
        navigator.clipboard.writeText(query);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };
    return (
        <Box sx={{ mt: 1.5 }}>
            <Stack direction="row" alignItems="center" spacing={0.5}>
                <IconButton size="small" onClick={() => setOpen(o => !o)} sx={{ p: 0.3, color: theme.textMuted, '&:hover': { color: theme.primary } }}>
                    {open ? <ExpandLessIcon sx={{ fontSize: 14 }} /> : <ExpandMoreIcon sx={{ fontSize: 14 }} />}
                </IconButton>
                <Typography
                    variant="caption"
                    onClick={() => setOpen(o => !o)}
                    sx={{ color: theme.textMuted, fontWeight: 600, fontSize: '0.68rem', cursor: 'pointer', userSelect: 'none', '&:hover': { color: theme.primary } }}
                >
                    {open ? 'Hide SQL' : 'View SQL query'}
                </Typography>
            </Stack>
            <Collapse in={open}>
                <Box sx={{ mt: 0.8, p: 1.2, bgcolor: alpha(theme.background, 0.6), borderRadius: '10px', border: `1px solid ${alpha(theme.border, 0.2)}` }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                        <Typography variant="caption" sx={{ fontFamily: 'monospace', color: theme.textSecondary, fontSize: '0.71rem', lineHeight: 1.6, flex: 1, wordBreak: 'break-all', pr: 1 }}>
                            {query}
                        </Typography>
                        <Tooltip title={copied ? 'Copied!' : 'Copy'}>
                            <IconButton size="small" onClick={copy} sx={{ p: 0.3, flexShrink: 0, color: theme.textMuted, '&:hover': { color: theme.primary } }}>
                                {copied ? <CheckIcon sx={{ fontSize: 12 }} /> : <CopyIcon sx={{ fontSize: 12 }} />}
                            </IconButton>
                        </Tooltip>
                    </Stack>
                </Box>
            </Collapse>
        </Box>
    );
}

// ─── Main Chatbot ─────────────────────────────────────────────────────────────
export default function Chatbot() {
    const { theme } = useTheme();
    const [isOpen, setIsOpen] = useState(false);
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<Message[]>([{
        id: '1', role: 'bot', type: 'text', timestamp: new Date(),
        content: "Hi! I'm your **MLOps AI assistant** powered by Gemini. Ask me anything about your models, factories, or performance metrics.\n\nTry one of the suggestions below ↓",
    }]);
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isLoading]);

    const send = async (text: string) => {
        const msg = text.trim();
        if (!msg || isLoading) return;
        setInput('');
        setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', content: msg, timestamp: new Date() }]);
        setIsLoading(true);
        try {
            const { data } = await axios.post(`${API_BASE_URL}/chatbot/ask`, { message: msg });
            setMessages(prev => [...prev, {
                id: (Date.now() + 1).toString(), role: 'bot',
                content: data.answer, data: data.data, query: data.query,
                type: data.type, timestamp: new Date(),
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
                    >
                        <Paper elevation={0} sx={{
                            width: 440, height: 640, borderRadius: '28px',
                            display: 'flex', flexDirection: 'column', overflow: 'hidden', mb: 2,
                            bgcolor: theme.mode === 'dark' ? alpha(theme.paper, 0.88) : alpha('#fff', 0.92),
                            backdropFilter: 'blur(24px) saturate(160%)',
                            border: `1px solid ${alpha(theme.border, 0.35)}`,
                            boxShadow: theme.mode === 'dark'
                                ? `0 32px 80px rgba(0,0,0,0.5), 0 0 0 1px ${alpha(theme.primary, 0.1)}`
                                : `0 32px 80px ${alpha('#000', 0.14)}, 0 0 0 1px ${alpha(theme.primary, 0.07)}`,
                        }}>

                            {/* ── Header ── */}
                            <Box sx={{
                                px: 2.5, py: 2, display: 'flex', alignItems: 'center', gap: 1.5,
                                borderBottom: `1px solid ${alpha(theme.border, 0.2)}`,
                                background: `linear-gradient(135deg, ${alpha(theme.primary, 0.12)} 0%, ${alpha(theme.secondary, 0.05)} 100%)`,
                                flexShrink: 0,
                            }}>
                                <Box sx={{
                                    width: 42, height: 42, borderRadius: '14px', flexShrink: 0,
                                    background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})`,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    boxShadow: `0 4px 14px ${alpha(theme.primary, 0.35)}`,
                                }}>
                                    <BotIcon sx={{ color: '#fff', fontSize: 22 }} />
                                </Box>
                                <Box flex={1}>
                                    <Stack direction="row" alignItems="center" spacing={1}>
                                        <Typography variant="subtitle1" fontWeight={800} sx={{ color: theme.textMain, lineHeight: 1.1 }}>
                                            MARS AI Assistant
                                        </Typography>
                                        <Chip label="Gemini" size="small" sx={{
                                            height: 18, fontSize: '0.6rem', fontWeight: 800,
                                            bgcolor: alpha(theme.primary, 0.12), color: theme.primary,
                                            border: `1px solid ${alpha(theme.primary, 0.2)}`,
                                        }} />
                                    </Stack>
                                    <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mt: 0.2 }}>
                                        <Circle sx={{ fontSize: 8, color: theme.success }} />
                                        <Typography variant="caption" sx={{ color: theme.textMuted, fontSize: '0.7rem' }}>
                                            Connected to MLOps Engine
                                        </Typography>
                                    </Stack>
                                </Box>
                                <IconButton size="small" onClick={() => setIsOpen(false)} sx={{
                                    color: theme.textMuted, bgcolor: alpha(theme.textMain, 0.05), borderRadius: '10px',
                                    '&:hover': { bgcolor: alpha(theme.error, 0.08), color: theme.error },
                                }}>
                                    <CloseIcon fontSize="small" />
                                </IconButton>
                            </Box>

                            {/* ── Messages ── */}
                            <Box sx={{
                                flex: 1, overflowY: 'auto', px: 2, py: 2,
                                display: 'flex', flexDirection: 'column', gap: 1.5,
                                '&::-webkit-scrollbar': { width: 5 },
                                '&::-webkit-scrollbar-thumb': { bgcolor: alpha(theme.primary, 0.2), borderRadius: 10 },
                                '&::-webkit-scrollbar-track': { bgcolor: 'transparent' },
                            }}>
                                {messages.map((msg, idx) => (
                                    <motion.div
                                        key={msg.id}
                                        initial={{ opacity: 0, y: 10, scale: 0.97 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        transition={{ duration: 0.25, delay: idx === messages.length - 1 ? 0 : 0 }}
                                    >
                                        <Box sx={{ display: 'flex', flexDirection: msg.role === 'user' ? 'row-reverse' : 'row', gap: 1.2, alignItems: 'flex-start' }}>
                                            {/* Avatar */}
                                            <Avatar sx={{
                                                width: 32, height: 32, flexShrink: 0, borderRadius: '10px',
                                                background: msg.role === 'user'
                                                    ? `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})`
                                                    : alpha(theme.primary, 0.1),
                                                color: msg.role === 'user' ? '#fff' : theme.primary,
                                                boxShadow: msg.role === 'user' ? `0 4px 12px ${alpha(theme.primary, 0.3)}` : 'none',
                                            }}>
                                                {msg.role === 'user' ? <UserIcon sx={{ fontSize: 16 }} /> : <BotIcon sx={{ fontSize: 16 }} />}
                                            </Avatar>

                                            {/* Bubble */}
                                            <Box sx={{ maxWidth: '80%', minWidth: 0 }}>
                                                <Paper elevation={0} sx={{
                                                    px: 1.8, py: 1.4, borderRadius: msg.role === 'user' ? '18px 6px 18px 18px' : '6px 18px 18px 18px',
                                                    background: msg.role === 'user'
                                                        ? `linear-gradient(135deg, ${theme.primary} 0%, ${alpha(theme.secondary, 0.9)} 100%)`
                                                        : msg.type === 'error'
                                                            ? alpha(theme.error, 0.08)
                                                            : alpha(theme.paper, 0.9),
                                                    border: msg.role === 'bot' ? `1px solid ${alpha(msg.type === 'error' ? theme.error : theme.border, 0.25)}` : 'none',
                                                    boxShadow: msg.role === 'user'
                                                        ? `0 4px 16px ${alpha(theme.primary, 0.25)}`
                                                        : `0 2px 8px ${alpha('#000', 0.05)}`,
                                                }}>
                                                    <Typography variant="body2" sx={{
                                                        color: msg.role === 'user' ? '#fff' : msg.type === 'error' ? theme.error : theme.textMain,
                                                        lineHeight: 1.65, fontSize: '0.875rem',
                                                        '& p': { m: 0 },
                                                        '& strong': { fontWeight: 800 },
                                                        '& code': { bgcolor: alpha(theme.textMain, 0.08), px: 0.5, py: 0.1, borderRadius: '4px', fontSize: '0.8rem' },
                                                        '& ul, & ol': { pl: 2, m: 0 },
                                                    }}>
                                                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                                                    </Typography>

                                                    {/* SQL Results */}
                                                    {msg.type === 'sql' && msg.data && (
                                                        <>
                                                            <Divider sx={{ my: 1.2, borderColor: alpha(theme.border, 0.2) }} />
                                                            <SqlTable data={msg.data} theme={theme} />
                                                        </>
                                                    )}

                                                    {/* SQL query — hidden by default behind a toggle */}
                                                    {msg.query && <SqlQueryToggle query={msg.query} theme={theme} />}
                                                </Paper>

                                                {/* Timestamp */}
                                                <Typography variant="caption" sx={{
                                                    color: theme.textMuted, fontSize: '0.65rem', fontWeight: 500,
                                                    display: 'block', textAlign: msg.role === 'user' ? 'right' : 'left',
                                                    mt: 0.4, px: 0.5,
                                                }}>
                                                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </Typography>
                                            </Box>
                                        </Box>
                                    </motion.div>
                                ))}

                                {/* Typing indicator */}
                                {isLoading && (
                                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                                        <Box sx={{ display: 'flex', gap: 1.2, alignItems: 'flex-start' }}>
                                            <Avatar sx={{ width: 32, height: 32, borderRadius: '10px', bgcolor: alpha(theme.primary, 0.1), color: theme.primary }}>
                                                <ThinkingIcon sx={{ fontSize: 16 }} />
                                            </Avatar>
                                            <Paper elevation={0} sx={{
                                                px: 2, py: 1.5, borderRadius: '6px 18px 18px 18px',
                                                bgcolor: alpha(theme.paper, 0.9), border: `1px solid ${alpha(theme.border, 0.2)}`,
                                                display: 'flex', alignItems: 'center', gap: 1.2,
                                            }}>
                                                <CircularProgress size={13} thickness={5} sx={{ color: theme.primary }} />
                                                <Typography variant="caption" fontWeight={700} sx={{ color: theme.textMuted }}>
                                                    Thinking…
                                                </Typography>
                                            </Paper>
                                        </Box>
                                    </motion.div>
                                )}
                                <div ref={messagesEndRef} />
                            </Box>

                            {/* ── Suggested Queries ── */}
                            <AnimatePresence>
                                {showSuggestions && (
                                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                                        <Box sx={{ px: 2, pb: 1.5 }}>
                                            <Typography variant="caption" fontWeight={700} sx={{ color: theme.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, fontSize: '0.65rem', mb: 0.8, display: 'block' }}>
                                                Suggested
                                            </Typography>
                                            <Stack direction="row" spacing={0.8} flexWrap="wrap" sx={{ gap: 0.8 }}>
                                                {SUGGESTIONS.map(s => (
                                                    <Chip key={s} label={s} size="small" onClick={() => send(s)} sx={{
                                                        cursor: 'pointer', fontSize: '0.7rem', fontWeight: 600, height: 26,
                                                        bgcolor: alpha(theme.primary, 0.07),
                                                        color: theme.textSecondary,
                                                        border: `1px solid ${alpha(theme.border, 0.4)}`,
                                                        '&:hover': { bgcolor: alpha(theme.primary, 0.14), borderColor: alpha(theme.primary, 0.4), color: theme.primary },
                                                        transition: 'all 0.2s',
                                                    }} />
                                                ))}
                                            </Stack>
                                        </Box>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* ── Input ── */}
                            <Box sx={{
                                px: 2, pb: 2, pt: 1.5,
                                borderTop: `1px solid ${alpha(theme.border, 0.15)}`,
                                bgcolor: alpha(theme.paper, 0.4),
                                flexShrink: 0,
                            }}>
                                <Stack direction="row" spacing={1} alignItems="flex-end">
                                    <TextField
                                        fullWidth multiline maxRows={4}
                                        placeholder="Ask about your models or metrics…"
                                        size="small" value={input}
                                        onChange={e => setInput(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
                                        sx={{
                                            '& .MuiOutlinedInput-root': {
                                                borderRadius: '16px', fontSize: '0.875rem',
                                                bgcolor: alpha(theme.background, 0.5),
                                                color: theme.textMain,
                                                '& fieldset': { borderColor: alpha(theme.border, 0.3), transition: 'border-color 0.2s' },
                                                '&:hover fieldset': { borderColor: alpha(theme.primary, 0.4) },
                                                '&.Mui-focused fieldset': { borderColor: theme.primary, borderWidth: 1.5 },
                                                '& textarea::placeholder': { color: theme.textMuted, opacity: 1 },
                                            },
                                        }}
                                    />
                                    <Tooltip title={isLoading ? 'Thinking…' : 'Send (Enter)'}>
                                        <span>
                                            <IconButton onClick={() => send(input)} disabled={!input.trim() || isLoading} sx={{
                                                width: 42, height: 42, borderRadius: '14px', flexShrink: 0,
                                                background: !input.trim() || isLoading
                                                    ? alpha(theme.textMain, 0.06)
                                                    : `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})`,
                                                color: !input.trim() || isLoading ? alpha(theme.textMain, 0.3) : '#fff',
                                                boxShadow: !input.trim() || isLoading ? 'none' : `0 4px 14px ${alpha(theme.primary, 0.4)}`,
                                                transition: 'all 0.2s',
                                                '&:hover': { transform: !input.trim() || isLoading ? 'none' : 'translateY(-1px)', boxShadow: `0 6px 18px ${alpha(theme.primary, 0.5)}` },
                                            }}>
                                                <SendIcon sx={{ fontSize: 18 }} />
                                            </IconButton>
                                        </span>
                                    </Tooltip>
                                </Stack>
                                <Typography variant="caption" sx={{ color: theme.textMuted, fontSize: '0.62rem', display: 'block', mt: 0.8, textAlign: 'center' }}>
                                    Enter to send · Shift+Enter for new line
                                </Typography>
                            </Box>
                        </Paper>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── FAB ── */}
            <Zoom in>
                <Fab sx={{
                    width: 60, height: 60, flexShrink: 0,
                    background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})`,
                    color: '#fff',
                    boxShadow: `0 8px 24px ${alpha(theme.primary, 0.45)}`,
                    '&:hover': {
                        transform: 'scale(1.08)',
                        boxShadow: `0 12px 30px ${alpha(theme.primary, 0.55)}`,
                    },
                    transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                    position: 'relative',
                }} onClick={() => setIsOpen(o => !o)}>
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={isOpen ? 'close' : 'open'}
                            initial={{ rotate: -90, scale: 0.5 }}
                            animate={{ rotate: 0, scale: 1 }}
                            exit={{ rotate: 90, scale: 0.5 }}
                            transition={{ duration: 0.18 }}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                            {isOpen ? <CloseIcon /> : <ChatIcon />}
                        </motion.div>
                    </AnimatePresence>
                </Fab>
            </Zoom>
        </Box>
    );
}
