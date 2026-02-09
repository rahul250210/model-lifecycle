"use client";

import { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Stack,
  IconButton,
  CircularProgress,
  Container,
  Chip,
  alpha,
} from "@mui/material";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import axios from "../../api/axios";
import { useTheme } from "../../theme/ThemeContext";
import {
  TrendingUp as GainIcon,
  TrendingDown as LossIcon,
  DragHandle as NeutralIcon,
  ArrowBack as ArrowBackIcon,
  FlashOn as QuickIcon,
  Assessment as MetricsIcon,
  Timeline as ParamsIcon,
} from "@mui/icons-material";

/* =======================
   Types
======================= */

interface Version {
  id: number;
  version_number: number;
  parent_version_id?: number;
  metrics?: Record<string, number>;
  parameters?: Record<string, any>;
  created_at: string;
  is_active: boolean;
  note?: string;
  accuracy?: number;
  precision?: number;
  recall?: number;
  f1_score?: number;
  tp?: number;
  tn?: number;
  fp?: number;
  fn?: number;
}

/* =======================
   Component
======================= */

export default function VersionCompare() {
  const { factoryId, algorithmId, modelId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { theme } = useTheme();

  const leftId = searchParams.get("left");
  const rightId = searchParams.get("right");

  const [left, setLeft] = useState<Version | null>(null);
  const [right, setRight] = useState<Version | null>(null);
  const [modelName, setModelName] = useState<string>("Model");
  const [loading, setLoading] = useState(true);

  /* =======================
     Fetch versions
  ======================= */

  useEffect(() => {
    const fetchVersions = async () => {
      try {
        const [l, r, m] = await Promise.all([
          axios.get(
            `/factories/${factoryId}/algorithms/${algorithmId}/models/${modelId}/versions/${leftId}`
          ),
          axios.get(
            `/factories/${factoryId}/algorithms/${algorithmId}/models/${modelId}/versions/${rightId}`
          ),
          axios.get(
            `/factories/${factoryId}/algorithms/${algorithmId}/models/${modelId}`
          ),
        ]);

        setLeft(l.data);
        setRight(r.data);
        setModelName(m.data.name);
      } catch (err) {
        console.error("Failed to compare versions", err);
      } finally {
        setLoading(false);
      }
    };

    if (leftId && rightId) fetchVersions();
  }, [factoryId, algorithmId, modelId, leftId, rightId]);

  /* =======================
     Loading
  ======================= */

  if (loading || !left || !right) {
    return (
      <Box
        sx={{
          height: "70vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: theme.background
        }}
      >
        <CircularProgress size={42} sx={{ color: theme.primary }} />
      </Box>
    );
  }

  /* =======================
     Helpers
  ======================= */

  const getMetricValue = (v: Version, key: string) => {
    if (key === 'accuracy') return v.accuracy;
    if (key === 'precision') return v.precision;
    if (key === 'recall') return v.recall;
    if (key === 'f1_score') return v.f1_score;
    if (key === 'tp') return v.tp;
    if (key === 'tn') return v.tn;
    if (key === 'fp') return v.fp;
    if (key === 'fn') return v.fn;
    return v.metrics?.[key];
  };

  const isPercentage = (key: string) => {
    return ['accuracy', 'precision', 'recall', 'f1_score'].includes(key);
  };

  const allMetricKeys = Array.from(
    new Set([
      'accuracy', 'precision', 'recall', 'f1_score',
      'tp', 'tn', 'fp', 'fn',
      ...Object.keys(left.metrics || {}),
      ...Object.keys(right.metrics || {}),
    ])
  );

  const allParamKeys = Array.from(
    new Set([
      ...Object.keys(left.parameters || {}),
      ...Object.keys(right.parameters || {}),
    ])
  );

  const DiffBadge = ({ l, r, isPct }: { l: any, r: any, isPct: boolean }) => {
    if (typeof l !== 'number' || typeof r !== 'number') return null;
    const diff = r - l;
    if (Math.abs(diff) < 0.0001) return <Chip size="small" icon={<NeutralIcon sx={{ fontSize: '14px !important' }} />} label="Same" sx={{ bgcolor: alpha(theme.textMuted, 0.05), color: theme.textMuted, fontWeight: 700 }} />;

    const isPositive = diff > 0;
    // For FP and FN, positive diff is usually bad, but sticking to standard math color for now to avoid confusion
    const color = isPositive ? theme.success : theme.danger;
    const Icon = isPositive ? GainIcon : LossIcon;

    return (
      <Chip
        size="small"
        icon={<Icon sx={{ fontSize: '14px !important', color: 'inherit !important' }} />}
        label={`${isPositive ? '+' : ''}${isPct ? diff.toFixed(2) + '%' : diff}`}
        sx={{
          bgcolor: alpha(color, 0.1),
          color: color,
          fontWeight: 800,
          border: `1px solid ${alpha(color, 0.2)}`
        }}
      />
    );
  };

  return (
    <Box sx={{
      minHeight: "100vh",
      bgcolor: theme.background,
      position: "relative"
    }}>
      {/* BACKGROUND DECORATION */}
      <Box sx={{
        position: "fixed",
        top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 0,
        background: `
          radial-gradient(circle at 80% 10%, ${alpha(theme.primary, 0.08)} 0%, transparent 40%),
          radial-gradient(circle at 10% 40%, ${alpha(theme.secondary || theme.primary, 0.08)} 0%, transparent 40%)
        `,
        pointerEvents: "none"
      }} />

      {/* Fixed Sticky Header */}
      <Box sx={{
        position: "sticky",
        top: 0,
        bgcolor: alpha(theme.background, 0.7),
        backdropFilter: "blur(24px)",
        zIndex: 100,
        borderBottom: `1px solid ${alpha(theme.border, 0.5)}`,
      }}>
        <Container maxWidth="xl" sx={{ width: '100%', maxWidth: '1400px !important' }}>
          <Box sx={{ py: 2, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Stack direction="row" spacing={3} alignItems="center">
              <IconButton
                onClick={() => navigate(`/factories/${factoryId}/algorithms/${algorithmId}/models/${modelId}/versions`)}
                sx={{
                  bgcolor: theme.paper,
                  border: `1px solid ${theme.border}`,
                  boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
                  '&:hover': { bgcolor: theme.primaryLight, borderColor: theme.primary, transform: "translateX(-4px)" },
                  transition: "all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)"
                }}
              >
                <ArrowBackIcon fontSize="small" sx={{ color: theme.textMain }} />
              </IconButton>
              <Box>
                <Typography variant="h4" fontWeight={900} sx={{
                  color: theme.textMain,
                  letterSpacing: "-0.05em",
                  background: `linear-gradient(135deg, ${theme.textMain} 0%, ${alpha(theme.textMain, 0.6)} 100%)`,
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent"
                }}>
                  Iterative <Box component="span" sx={{ color: theme.primary, WebkitTextFillColor: "initial" }}>Analysis</Box>
                </Typography>
                <Typography variant="body2" sx={{ color: theme.textMuted, fontWeight: 700, mt: 0.2 }}>
                  Iterating from <Box component="span" sx={{ color: theme.textMain }}>v-{left.version_number}</Box> to <Box component="span" sx={{ color: theme.primary }}>v-{right.version_number}</Box>
                </Typography>
              </Box>
            </Stack>

            <Stack direction="row" spacing={2} sx={{ display: { xs: 'none', md: 'flex' } }}>
              <Box sx={{ textAlign: 'right' }}>
                <Typography variant="overline" fontWeight={900} sx={{ color: theme.textMuted, letterSpacing: 2 }}>MODEL IDENTITY</Typography>
                <Typography variant="body2" fontWeight={700} sx={{ color: theme.textMain }}>{modelName}</Typography>
              </Box>
            </Stack>
          </Box>
        </Container>
      </Box>

      {/* Main Content Area */}
      <Box sx={{ py: 6, zIndex: 1 }}>
        <Container maxWidth="xl" sx={{ width: '100%', maxWidth: '1400px !important' }}>

          {/* Identity Scorecards */}
          <Grid container spacing={4} sx={{ mb: 8 }}>
            {[left, right].map((v, i) => (
              <Grid size={{ xs: 12, md: 6 }} key={v.id}>
                <Box sx={{ position: 'relative' }}>
                  <Card sx={{
                    borderRadius: "32px",
                    bgcolor: alpha(theme.paper, 0.6),
                    backdropFilter: "blur(12px)",
                    border: `1px solid ${i === 0 ? alpha(theme.primary, 0.2) : alpha(theme.secondary || theme.primary, 0.2)}`,
                    boxShadow: i === 0
                      ? `0 20px 60px ${alpha(theme.primary, 0.08)}`
                      : `0 20px 60px ${alpha(theme.secondary || theme.primary, 0.08)}`,
                    overflow: 'hidden',
                    transition: "all 0.3s ease",
                  }}>
                    <Box sx={{
                      position: 'absolute', top: 0, left: 0, width: '100%', height: '6px',
                      background: i === 0
                        ? `linear-gradient(90deg, ${theme.primary}, ${alpha(theme.primary, 0.1)})`
                        : `linear-gradient(90deg, ${theme.secondary || theme.primary}, ${alpha(theme.secondary || theme.primary, 0.1)})`
                    }} />
                    <CardContent sx={{ p: 4 }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                        <Box>
                          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1 }}>
                            <Box sx={{
                              p: 1.25, borderRadius: '14px',
                              bgcolor: i === 0 ? alpha(theme.primary, 0.1) : alpha(theme.secondary || theme.primary, 0.1),
                              color: i === 0 ? theme.primary : (theme.secondary || theme.primary)
                            }}>
                              <QuickIcon sx={{ fontSize: 28 }} />
                            </Box>
                            <Box>
                              <Typography variant="overline" fontWeight={900} sx={{ color: theme.textMuted, letterSpacing: 2, display: 'block' }}>
                                TARGET CANDIDATE
                              </Typography>
                              <Typography variant="h5" fontWeight={900} sx={{ color: theme.textMain }}>
                                Version {v.version_number}
                              </Typography>
                            </Box>
                          </Stack>
                        </Box>
                        {v.is_active && (
                          <Chip
                            label="PROD"
                            size="small"
                            sx={{
                              bgcolor: theme.success, color: "#fff", fontWeight: 900,
                              px: 1, height: 24, fontSize: '11px', letterSpacing: 1,
                              boxShadow: `0 4px 12px ${alpha(theme.success, 0.3)}`
                            }}
                          />
                        )}
                      </Stack>

                      <Grid container spacing={2} sx={{ mt: 3 }}>
                        <Grid size={{ xs: 6 }}>
                          <Box sx={{ p: 2, borderRadius: '20px', bgcolor: alpha(theme.textMain, 0.03), border: `1px solid ${alpha(theme.border, 0.5)}` }}>
                            <Typography variant="caption" fontWeight={800} sx={{ color: theme.textMuted, display: 'block' }}>ACCURACY</Typography>
                            <Typography variant="h6" fontWeight={900} sx={{ color: theme.textMain }}>{v.accuracy ? `${v.accuracy}%` : "—"}</Typography>
                          </Box>
                        </Grid>
                        <Grid size={{ xs: 6 }}>
                          <Box sx={{ p: 2, borderRadius: '20px', bgcolor: alpha(theme.textMain, 0.03), border: `1px solid ${alpha(theme.border, 0.5)}` }}>
                            <Typography variant="caption" fontWeight={800} sx={{ color: theme.textMuted, display: 'block' }}>F1 SCORE</Typography>
                            <Typography variant="h6" fontWeight={900} sx={{ color: theme.textMain }}>{v.f1_score ? `${v.f1_score}%` : "—"}</Typography>
                          </Box>
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                </Box>
              </Grid>
            ))}
          </Grid>

          {/* Metrics Comparison */}
          <Box sx={{ mb: 10 }}>
            <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 4 }}>
              <Box sx={{ p: 1.5, borderRadius: "16px", bgcolor: alpha(theme.success, 0.1), color: theme.success, display: 'flex' }}>
                <MetricsIcon />
              </Box>
              <Box>
                <Typography variant="h5" fontWeight={900} sx={{ color: theme.textMain, letterSpacing: "-0.02em" }}>
                  Metric Convergence Overview
                </Typography>
                <Typography variant="body2" sx={{ color: theme.textMuted, fontWeight: 600 }}>
                  Detailed analysis of performance gain/loss across standard evaluation criteria.
                </Typography>
              </Box>
            </Stack>

            <Card sx={{
              borderRadius: "32px", overflow: 'hidden',
              border: `1px solid ${alpha(theme.border, 0.7)}`,
              bgcolor: alpha(theme.paper, 0.5),
              backdropFilter: "blur(12px)",
              boxShadow: "0 10px 40px -10px rgba(0,0,0,0.05)"
            }}>
              <Box sx={{
                display: 'grid',
                gridTemplateColumns: '1.5fr 1fr 1fr 1fr',
                bgcolor: alpha(theme.textMain, 0.04),
                p: "16px 24px",
                borderBottom: `2px solid ${theme.border}`,
                alignItems: 'center'
              }}>
                <Typography variant="caption" fontWeight={900} sx={{ color: theme.textMuted, letterSpacing: 2 }}>METRIC DEFINITION</Typography>
                <Typography variant="caption" fontWeight={900} sx={{ color: theme.textMain, textAlign: 'center', bgcolor: alpha(theme.textMain, 0.05), py: 0.5, borderRadius: '6px' }}>VERSION {left.version_number}</Typography>
                <Typography variant="caption" fontWeight={900} sx={{ color: theme.primary, textAlign: 'center', bgcolor: alpha(theme.primary, 0.08), py: 0.5, borderRadius: '6px' }}>VERSION {right.version_number}</Typography>
                <Typography variant="caption" fontWeight={900} sx={{ color: theme.textMuted, textAlign: 'center' }}>DELTA</Typography>
              </Box>
              {allMetricKeys.map((key, idx) => {
                const lVal = getMetricValue(left, key);
                const rVal = getMetricValue(right, key);
                const isPct = isPercentage(key);

                return (
                  <Box key={key} sx={{
                    display: 'grid',
                    gridTemplateColumns: '1.5fr 1fr 1fr 1fr',
                    p: "14px 24px",
                    alignItems: 'center',
                    bgcolor: idx % 2 === 0 ? 'transparent' : alpha(theme.textMain, 0.02),
                    borderBottom: idx === allMetricKeys.length - 1 ? 'none' : `1px solid ${alpha(theme.border, 0.3)}`,
                    transition: "all 0.2s ease",
                    "&:hover": { bgcolor: alpha(theme.primary, 0.03) }
                  }}>
                    <Stack direction="row" spacing={2} alignItems="center">
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: idx % 3 === 0 ? theme.primary : idx % 3 === 1 ? theme.success : theme.warning }} />
                      <Typography variant="body2" fontWeight={800} sx={{ color: theme.textMain, textTransform: 'uppercase' }}>
                        {key.replace(/_/g, ' ')}
                      </Typography>
                    </Stack>
                    <Typography variant="body2" fontWeight={700} sx={{ color: theme.textMain, textAlign: 'center', fontFamily: "'JetBrains Mono', 'Roboto Mono', monospace" }}>
                      {lVal !== undefined && lVal !== null ? (isPct ? `${lVal}%` : lVal) : '—'}
                    </Typography>
                    <Typography variant="body2" fontWeight={700} sx={{ color: theme.textMain, textAlign: 'center', fontFamily: "'JetBrains Mono', 'Roboto Mono', monospace" }}>
                      {rVal !== undefined && rVal !== null ? (isPct ? `${rVal}%` : rVal) : '—'}
                    </Typography>
                    <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                      <DiffBadge l={lVal} r={rVal} isPct={isPct} />
                    </Box>
                  </Box>
                );
              })}
            </Card>
          </Box>

          {/* Parameters Comparison */}
          {allParamKeys.length > 0 && (
            <Box sx={{ mb: 6 }}>
              <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 4 }}>
                <Box sx={{ p: 1.5, borderRadius: "16px", bgcolor: alpha(theme.primary, 0.1), color: theme.primary, display: 'flex' }}>
                  <ParamsIcon />
                </Box>
                <Box>
                  <Typography variant="h5" fontWeight={900} sx={{ color: theme.textMain, letterSpacing: "-0.02em" }}>
                    Configuration & Schema Shift
                  </Typography>
                  <Typography variant="body2" sx={{ color: theme.textMuted, fontWeight: 600 }}>
                    Identifying hyperparameter adjustments and operational changes.
                  </Typography>
                </Box>
              </Stack>

              <Card sx={{
                borderRadius: "32px", overflow: 'hidden',
                border: `1px solid ${alpha(theme.border, 0.7)}`,
                bgcolor: alpha(theme.paper, 0.5),
                backdropFilter: "blur(12px)",
                boxShadow: "0 10px 40px -10px rgba(0,0,0,0.05)"
              }}>
                <Box sx={{
                  display: 'grid',
                  gridTemplateColumns: '1.5fr 1fr 1fr 1fr',
                  bgcolor: alpha(theme.textMain, 0.04),
                  p: "16px 24px",
                  borderBottom: `2px solid ${theme.border}`,
                  alignItems: 'center'
                }}>
                  <Typography variant="caption" fontWeight={900} sx={{ color: theme.textMuted, letterSpacing: 2 }}>PARAMETER</Typography>
                  <Typography variant="caption" fontWeight={900} sx={{ color: theme.textMain, textAlign: 'center', bgcolor: alpha(theme.textMain, 0.05), py: 0.5, borderRadius: '6px' }}>VERSION {left.version_number}</Typography>
                  <Typography variant="caption" fontWeight={900} sx={{ color: theme.primary, textAlign: 'center', bgcolor: alpha(theme.primary, 0.08), py: 0.5, borderRadius: '6px' }}>VERSION {right.version_number}</Typography>
                  <Typography variant="caption" fontWeight={900} sx={{ color: theme.textMuted, textAlign: 'center' }}>STATE</Typography>
                </Box>
                {allParamKeys.map((key, idx) => {
                  const lVal = left.parameters?.[key];
                  const rVal = right.parameters?.[key];
                  const hasChanged = JSON.stringify(lVal) !== JSON.stringify(rVal);

                  return (
                    <Box key={key} sx={{
                      display: 'grid',
                      gridTemplateColumns: '1.5fr 1fr 1fr 1fr',
                      p: "14px 24px",
                      alignItems: 'center',
                      bgcolor: idx % 2 === 0 ? 'transparent' : alpha(theme.textMain, 0.02),
                      borderBottom: idx === allParamKeys.length - 1 ? 'none' : `1px solid ${alpha(theme.border, 0.3)}`,
                      transition: "all 0.2s ease",
                      "&:hover": { bgcolor: alpha(theme.primary, 0.03) }
                    }}>
                      <Typography variant="body2" fontWeight={800} sx={{ color: theme.textMain, textTransform: 'capitalize' }}>
                        {key.replace(/_/g, ' ')}
                      </Typography>
                      <Typography variant="body2" fontWeight={700} sx={{ color: theme.textMuted, textAlign: 'center', fontStyle: 'italic', fontFamily: "'JetBrains Mono', 'Roboto Mono', monospace" }}>
                        {lVal !== undefined ? String(lVal) : '—'}
                      </Typography>
                      <Typography variant="body2" fontWeight={700} sx={{ color: theme.textMuted, textAlign: 'center', fontStyle: 'italic', fontFamily: "'JetBrains Mono', 'Roboto Mono', monospace" }}>
                        {rVal !== undefined ? String(rVal) : '—'}
                      </Typography>
                      <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                        {hasChanged ? (
                          <Chip
                            label="MODIFIED"
                            size="small"
                            sx={{
                              bgcolor: alpha(theme.warning, 0.1), color: theme.warning,
                              fontWeight: 900, borderRadius: '8px', border: `1px solid ${alpha(theme.warning, 0.2)}`,
                              fontSize: '10px'
                            }}
                          />
                        ) : (
                          <Typography variant="caption" fontWeight={800} sx={{ color: alpha(theme.textMuted, 0.4) }}>STABLE</Typography>
                        )}
                      </Box>
                    </Box>
                  );
                })}
              </Card>
            </Box>
          )}

        </Container>
      </Box>
    </Box>
  );
}
