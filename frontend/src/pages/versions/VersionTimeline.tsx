"use client";

import { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  CircularProgress,
  IconButton,
  alpha,
  Container,
  Stack,
  Chip,
  Paper,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Checkbox,
} from "@mui/material";

import {
  Timeline,
  TimelineItem,
  TimelineSeparator,
  TimelineConnector,
  TimelineContent,
  TimelineDot,
  TimelineOppositeContent,
} from "@mui/lab";

import {
  ArrowBack as ArrowBackIcon,
  Timeline as TimelineIcon,
  History as HistoryIcon,
  Visibility as ViewIcon,
  SettingsBackupRestore as RollbackIcon,
  Delete as DeleteIcon,
  CompareRounded as CompareIcon,
  CheckCircle as CheckIcon,
} from "@mui/icons-material";

import { useNavigate, useParams } from "react-router-dom";
import axios from "../../api/axios";

import { useTheme } from "../../theme/ThemeContext";

/* ==========================================================================
   TYPES
 ========================================================================== */
interface Version {
  id: number;
  version_number: number;
  accuracy?: number;
  precision?: number;
  recall?: number;
  f1_score?: number;
  note?: string;
  is_active: boolean;
  created_at: string;
}

import { useBackgroundUploader } from "../../contexts/BackgroundUploaderContext";


export default function VersionTimeline() {
  const { factoryId, algorithmId, modelId } = useParams();
  const navigate = useNavigate();
  const { theme } = useTheme();
  // Call context hook at top level
  const { cancelUploadsForVersion } = useBackgroundUploader();

  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(true);
  const [rollbackLoading, setRollbackLoading] = useState<number | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [rollbackOpen, setRollbackOpen] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<Version | null>(null);

  // Selection for Comparison
  const [isCompareMode, setIsCompareMode] = useState(false);
  const [selectedForCompare, setSelectedForCompare] = useState<number[]>([]);

  const fetchVersions = async () => {
    try {
      const res = await axios.get(
        `/factories/${factoryId}/algorithms/${algorithmId}/models/${modelId}/versions`
      );
      const sorted = [...res.data].sort((a, b) => b.version_number - a.version_number);
      setVersions(sorted);
    } catch (err) {
      console.error("Failed to load versions", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVersions();
  }, [factoryId, algorithmId, modelId]);

  const processRollback = async () => {
    if (!selectedVersion) return;

    try {
      setRollbackLoading(selectedVersion.id);
      setRollbackOpen(false);

      await axios.post(
        `/factories/${factoryId}/algorithms/${algorithmId}/models/${modelId}/versions/${selectedVersion.id}/checkout`
      );
      await fetchVersions();
    } catch (err) {
      console.error("Rollback failed", err);
    } finally {
      setRollbackLoading(null);
      setSelectedVersion(null);
    }
  };

  const handleDelete = async () => {
    if (!selectedVersion) return;

    // Store previous state for rollback
    const previousVersions = versions;
    const versionToDelete = selectedVersion;

    // Trigger Background Upload Cancellation (if any)
    cancelUploadsForVersion(versionToDelete.id);

    // OPTIMISTIC UPDATE:
    // 1. Remove deleted version
    // 2. If it was active, set the next most recent version as active
    setVersions(prev => {
      const remaining = prev.filter(v => v.id !== versionToDelete.id);

      if (versionToDelete.is_active && remaining.length > 0) {
        // Since list is already sorted descending by version_number (from fetchVersions)
        // The first item in remaining is the "next active" candidate
        // Clone to avoid mutation of state object directly if shallow copy isn't enough
        const newActive = { ...remaining[0], is_active: true };
        return [newActive, ...remaining.slice(1)];
      }

      return remaining;
    });

    setDeleteOpen(false);
    setSelectedVersion(null);

    try {
      // Fire and forget (awaiting but UI is already updated)
      await axios.delete(
        `/factories/${factoryId}/algorithms/${algorithmId}/models/${modelId}/versions/${versionToDelete.id}`
      );
    } catch (err) {
      console.error("Delete failed", err);
      // REVERT on failure
      setVersions(previousVersions);
      alert("Failed to delete version.");
    }
  };

  const toggleCompareSelection = (id: number) => {
    setSelectedForCompare(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= 2) return prev; // Limit to 2
      return [...prev, id];
    });
  };

  if (loading) {
    return (
      <Box sx={{ height: "100vh", display: "flex", justifyContent: "center", alignItems: "center", bgcolor: theme.background }}>
        <CircularProgress size={40} sx={{ color: theme.primary }} />
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: theme.background, position: "relative" }}>
      {/* Fixed Header with Glassmorphism */}
      <Box sx={{
        position: "sticky",
        top: 64, // Accounts for fixed AppBar height
        bgcolor: alpha(theme.background, 0.8),
        backdropFilter: "blur(12px)",
        zIndex: 100,
        borderBottom: `1px solid ${theme.border}`
      }}>
        <Container maxWidth={false} sx={{ ml: 0 }}>
          <Box sx={{ pt: 4, pb: 2, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Stack direction="row" spacing={2} alignItems="center">
              <IconButton
                onClick={() => navigate(`/factories/${factoryId}/algorithms/${algorithmId}/models/${modelId}`)}
                sx={{
                  bgcolor: theme.paper,
                  border: `1px solid ${theme.border}`,
                  '&:hover': { bgcolor: theme.primaryLight, transform: "translateY(-1px)" },
                  transition: "all 0.2s"
                }}
              >
                <ArrowBackIcon fontSize="small" sx={{ color: theme.textMain }} />
              </IconButton>
              <Box>
                <Typography variant="h4" fontWeight={900} sx={{ color: theme.textMain, letterSpacing: "-0.02em" }}>
                  Model <Box component="span" sx={{ color: theme.primary }}>History</Box>
                </Typography>
                <Typography variant="body2" sx={{ color: theme.textMuted, fontWeight: 600, mt: 0.5 }}>
                  Track evolution, metrics, and manage production rollbacks.
                </Typography>
              </Box>
            </Stack>

            <Button
              variant={isCompareMode ? "contained" : "outlined"}
              startIcon={isCompareMode ? <CheckIcon /> : <CompareIcon />}
              onClick={() => {
                setIsCompareMode(!isCompareMode);
                setSelectedForCompare([]);
              }}
              sx={{
                borderRadius: "14px",
                px: 3,
                py: 1.25,
                textTransform: "none",
                fontWeight: 800,
                borderColor: theme.border,
                color: isCompareMode ? "#fff" : theme.textMain,
                bgcolor: isCompareMode ? theme.primary : "transparent",
                "&:hover": {
                  bgcolor: isCompareMode ? theme.primaryDark : alpha(theme.primary, 0.05),
                  borderColor: theme.primary
                }
              }}
            >
              {isCompareMode ? "Exit Compare" : "Compare Versions"}
            </Button>
          </Box>
        </Container>
      </Box>

      {/* Scrollable Centered Content */}
      <Box sx={{ py: 4, zIndex: 1 }}>
        <Container maxWidth="lg">
          {versions.length === 0 ? (
            <Paper
              variant="outlined"
              sx={{
                p: 8,
                textAlign: "center",
                borderRadius: "24px",
                borderStyle: "dashed",
                bgcolor: "transparent"
              }}
            >
              <HistoryIcon sx={{ fontSize: 64, color: alpha(theme.textMuted, 0.2), mb: 2 }} />
              <Typography variant="h6" fontWeight={700} color={theme.textMain}>No Versions Found</Typography>
              <Typography variant="body2" color={theme.textMuted}>This model hasn't been iterated yet.</Typography>
            </Paper>
          ) : (
            <Timeline position="right" sx={{ p: 0 }}>
              {versions.map((version, index) => (
                <TimelineItem key={version.id}>
                  <TimelineOppositeContent sx={{ flex: 0.1, minWidth: 100, py: 3 }}>
                    <Typography variant="caption" fontWeight={600} sx={{ color: theme.textMuted }}>
                      {new Date(version.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </Typography>
                  </TimelineOppositeContent>

                  <TimelineSeparator>
                    <TimelineDot
                      sx={{
                        bgcolor: version.is_active ? theme.success : "transparent",
                        border: `2px solid ${version.is_active ? theme.success : theme.primary}`,
                        boxShadow: version.is_active ? `0 0 0 4px ${alpha(theme.success, 0.15)}` : "none",
                        p: 0.8
                      }}
                    >
                      <TimelineIcon sx={{ fontSize: 16, color: version.is_active ? "#fff" : theme.primary }} />
                    </TimelineDot>
                    {index !== versions.length - 1 && <TimelineConnector sx={{ bgcolor: theme.border }} />}
                  </TimelineSeparator>

                  <TimelineContent sx={{ py: 3, px: 1 }}>
                    <Card
                      elevation={0}
                      sx={{
                        borderRadius: "20px",
                        border: `1px solid ${selectedForCompare.includes(version.id) ? theme.primary : version.is_active ? theme.success : theme.border}`,
                        bgcolor: theme.paper,
                        cursor: "default",
                        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                        "&:hover": {
                          boxShadow: `0 12px 24px -8px ${alpha(theme.textMain, 0.1)}`,
                          borderColor: theme.primary
                        },
                        ...(selectedForCompare.includes(version.id) && {
                          bgcolor: alpha(theme.primary, 0.02),
                          boxShadow: `0 0 0 2px ${theme.primary}`
                        })
                      }}
                    >
                      <CardContent sx={{ p: 3 }}>
                        <Stack direction="column" justifyContent="space-between" alignItems="flex-start" sx={{ width: '100%' }}>
                          <Box sx={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <Stack direction="row" spacing={2} alignItems="center">
                              {isCompareMode && (
                                <Checkbox
                                  checked={selectedForCompare.includes(version.id)}
                                  onChange={() => toggleCompareSelection(version.id)}
                                  sx={{
                                    color: theme.textMuted,
                                    "&.Mui-checked": { color: theme.primary },
                                  }}
                                />
                              )}
                              <Box>
                                <Stack direction="row" spacing={1} alignItems="center">
                                  <Typography variant="h6" fontWeight={600} sx={{ color: theme.textMain }}>
                                    Version {version.version_number}
                                  </Typography>
                                  {version.is_active && (
                                    <Chip
                                      label="Live"
                                      size="small"
                                      sx={{
                                        bgcolor: alpha(theme.success, 0.1),
                                        color: theme.success,
                                        fontWeight: 700,
                                        fontSize: "0.65rem",
                                        height: 20
                                      }}
                                    />
                                  )}
                                </Stack>
                                {version.note && (
                                  <Typography variant="body2" sx={{ color: theme.textMuted, mt: 1, lineHeight: 1.6 }}>
                                    {version.note}
                                  </Typography>
                                )}
                              </Box>
                            </Stack>

                            <Stack direction="row" spacing={0.5}>
                              {!version.is_active && (
                                <Tooltip title="Rollback to this version">
                                  <IconButton
                                    size="small"
                                    onClick={() => {
                                      setSelectedVersion(version);
                                      setRollbackOpen(true);
                                    }}
                                    disabled={rollbackLoading !== null}
                                    sx={{ color: theme.warning, bgcolor: alpha(theme.warning, 0.05) }}
                                  >
                                    {rollbackLoading === version.id ? <CircularProgress size={18} color="inherit" /> : <RollbackIcon fontSize="small" />}
                                  </IconButton>
                                </Tooltip>
                              )}
                              <Tooltip title="View Details">
                                <IconButton
                                  size="small"
                                  onClick={() => navigate(`/factories/${factoryId}/algorithms/${algorithmId}/models/${modelId}/versions/${version.id}`)}
                                  sx={{ color: theme.primary, bgcolor: alpha(theme.primary, 0.05) }}
                                >
                                  <ViewIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Delete">
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() => {
                                    setSelectedVersion(version);
                                    setDeleteOpen(true);
                                  }}
                                  sx={{ bgcolor: alpha(theme.danger, 0.05) }}
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </Stack>
                          </Box>

                          {/* Version Metrics Snapshot */}
                          <Stack direction="row" spacing={3} sx={{ mt: 3, pt: 2, borderTop: `1px solid ${theme.border}`, width: '100%' }}>
                            <Box>
                              <Typography variant="caption" fontWeight={600} sx={{ color: theme.textMuted, textTransform: "uppercase", display: "block" }}>Accuracy</Typography>
                              <Typography variant="body2" fontWeight={600} color={theme.textMain}>{version.accuracy ? `${version.accuracy}%` : "—"}</Typography>
                            </Box>
                            <Box>
                              <Typography variant="caption" fontWeight={600} sx={{ color: theme.textMuted, textTransform: "uppercase", display: "block" }}>F1 Score</Typography>
                              <Typography variant="body2" fontWeight={600} color={theme.textMain}>{version.f1_score ? `${version.f1_score}%` : "—"}</Typography>
                            </Box>
                          </Stack>
                        </Stack>
                      </CardContent>
                    </Card>
                  </TimelineContent>
                </TimelineItem>
              ))}
            </Timeline>
          )}

          {/* Floating Compare Dock */}
          {isCompareMode && (
            <Box
              sx={{
                position: "fixed",
                bottom: 40,
                left: "50%",
                transform: "translateX(-15%)", // Offset from sidebar
                zIndex: 100,
                bgcolor: alpha(theme.paper, 0.9),
                backdropFilter: "blur(20px)",
                px: 4,
                py: 2,
                borderRadius: "24px",
                border: `1px solid ${theme.primary}`,
                boxShadow: `0 20px 40px ${alpha(theme.primary, 0.15)}`,
                display: "flex",
                alignItems: "center",
                gap: 4,
                transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                opacity: selectedForCompare.length > 0 ? 1 : 0,
                pointerEvents: selectedForCompare.length > 0 ? "auto" : "none",
              }}
            >
              <Box>
                <Typography variant="caption" fontWeight={800} sx={{ color: theme.primary, letterSpacing: 1.5, display: "block" }}>
                  COMPARISON STAGED
                </Typography>
                <Typography variant="body2" fontWeight={700} sx={{ color: theme.textMain }}>
                  {selectedForCompare.length} of 2 versions selected
                </Typography>
              </Box>

              <Button
                variant="contained"
                disabled={selectedForCompare.length !== 2}
                onClick={() => {
                  const [v1, v2] = selectedForCompare;
                  navigate(`/factories/${factoryId}/algorithms/${algorithmId}/models/${modelId}/versions/compare?left=${v1}&right=${v2}`);
                }}
                sx={{
                  borderRadius: "14px",
                  px: 4,
                  py: 1.25,
                  textTransform: "none",
                  fontWeight: 800,
                  bgcolor: theme.primary,
                  boxShadow: `0 8px 20px ${alpha(theme.primary, 0.3)}`,
                  "&:hover": { bgcolor: theme.primaryDark }
                }}
              >
                Compare Now
              </Button>
            </Box>
          )}
        </Container>
      </Box>

      {/* Aesthetic Delete Dialog */}
      <Dialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        PaperProps={{ sx: { borderRadius: "24px", p: 1, bgcolor: theme.background } }}
      >
        <DialogTitle sx={{ fontWeight: 800, color: theme.textMain }}>
          Delete Version {selectedVersion?.version_number}
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ color: theme.textMuted, mb: 2 }}>
            {selectedVersion?.is_active
              ? "This version is currently LIVE. Deleting it will impact production stability."
              : "Are you sure you want to remove this iteration? This action is permanent."}
          </Typography>
          {selectedVersion?.is_active && (
            <Paper elevation={0} sx={{ p: 2, bgcolor: alpha(theme.danger, 0.05), borderRadius: "12px", border: `1px solid ${alpha(theme.danger, 0.1)}` }}>
              <Typography color="error" variant="body2" fontWeight={700}>
                ⚠️ High Risk Action: Active Model Deletion
              </Typography>
            </Paper>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setDeleteOpen(false)} sx={{ color: theme.textMuted, fontWeight: 700 }}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            onClick={handleDelete}
            sx={{
              borderRadius: "10px",
              px: 3,
              fontWeight: 700,
              boxShadow: "none",
            }}
          >
            Delete Version
          </Button>
        </DialogActions>
      </Dialog>


      {/* Rollback Confirmation Dialog */}
      <Dialog
        open={rollbackOpen}
        onClose={() => setRollbackOpen(false)}
        PaperProps={{ sx: { borderRadius: "24px", p: 1, bgcolor: theme.background } }}
      >
        <DialogTitle sx={{ fontWeight: 800, color: theme.textMain }}>
          Confirm Rollback to v{selectedVersion?.version_number}
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ color: theme.textMuted, mb: 2 }}>
            This will set Version {selectedVersion?.version_number} as the <strong>Active Production Model</strong>.
            All new inference requests will be routed to this version.
          </Typography>
          <Paper elevation={0} sx={{ p: 2, bgcolor: alpha(theme.warning, 0.05), borderRadius: "12px", border: `1px solid ${alpha(theme.warning, 0.1)}` }}>
            <Stack direction="row" spacing={1.5} alignItems="flex-start">
              <RollbackIcon sx={{ color: theme.warning, mt: 0.3 }} fontSize="small" />
              <Box>
                <Typography color={theme.warning} variant="body2" fontWeight={700}>
                  Production Environment Change
                </Typography>
                <Typography variant="caption" sx={{ color: theme.textMuted }}>
                  Ensure downstream services are compatible with this version's input/output schema.
                </Typography>
              </Box>
            </Stack>
          </Paper>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setRollbackOpen(false)} sx={{ color: theme.textMuted, fontWeight: 700 }}>Cancel</Button>
          <Button
            variant="contained"
            onClick={processRollback}
            sx={{
              borderRadius: "10px",
              px: 3,
              fontWeight: 700,
              boxShadow: "none",
              bgcolor: theme.warning,
              color: "#fff",
              "&:hover": { bgcolor: alpha(theme.warning, 0.9) }
            }}
          >
            Confirm Rollback
          </Button>
        </DialogActions>
      </Dialog>
    </Box >
  );
}