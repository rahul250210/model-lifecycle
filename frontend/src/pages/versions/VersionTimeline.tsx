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
} from "@mui/icons-material";

import { useNavigate, useParams } from "react-router-dom";
import axios from "../../api/axios";

/* ==========================================================================
   THEME PALETTE
========================================================================== */
const themePalette = {
  primary: "#4F46E5",
  primaryLight: "#EEF2FF",
  textMain: "#1E293B",
  textMuted: "#64748B",
  background: "#F8FAFC",
  border: "#E2E8F0",
  white: "#FFFFFF",
  success: "#10B981",
  warning: "#F59E0B",
  danger: "#EF4444",
};

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

export default function VersionTimeline() {
  const { factoryId, algorithmId, modelId } = useParams();
  const navigate = useNavigate();

  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(true);
  const [rollbackLoading, setRollbackLoading] = useState<number | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<Version | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

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

  const handleRollback = async (versionId: number) => {
    if (!window.confirm("Rollback to this version and set it as active?")) return;
    try {
      setRollbackLoading(versionId);
      await axios.post(
        `/factories/${factoryId}/algorithms/${algorithmId}/models/${modelId}/versions/${versionId}/checkout`
      );
      await fetchVersions();
    } catch (err) {
      console.error("Rollback failed", err);
    } finally {
      setRollbackLoading(null);
    }
  };

  const handleDelete = async () => {
    if (!selectedVersion) return;
    try {
      setDeleteLoading(true);
      await axios.delete(
        `/factories/${factoryId}/algorithms/${algorithmId}/models/${modelId}/versions/${selectedVersion.id}`
      );
      setDeleteOpen(false);
      setSelectedVersion(null);
      await fetchVersions();
    } catch (err) {
      console.error("Delete failed", err);
    } finally {
      setDeleteLoading(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ height: "80vh", display: "flex", justifyContent: "center", alignItems: "center" }}>
        <CircularProgress size={40} sx={{ color: themePalette.primary }} />
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: themePalette.background, pb: 10 }}>
      <Container maxWidth="md">
        {/* Header Section */}
        <Box sx={{ pt: 6, pb: 4 }}>
          <Stack direction="row" spacing={2} alignItems="center">
            <IconButton
              onClick={() => navigate(`/factories/${factoryId}/algorithms/${algorithmId}/models/${modelId}`)}
              sx={{ 
                bgcolor: themePalette.white, 
                border: `1px solid ${themePalette.border}`,
                boxShadow: "0 2px 4px rgba(0,0,0,0.02)",
                "&:hover": { bgcolor: themePalette.primaryLight, color: themePalette.primary }
              }}
            >
              <ArrowBackIcon fontSize="small" />
            </IconButton>
            <Box>
              <Typography variant="h4" fontWeight={900} sx={{ color: themePalette.textMain, letterSpacing: "-0.02em" }}>
                Model <Box component="span" sx={{ color: themePalette.primary }}>History</Box>
              </Typography>
              <Typography variant="body2" sx={{ color: themePalette.textMuted, fontWeight: 500 }}>
                Track evolution, metrics, and manage production rollbacks.
              </Typography>
            </Box>
          </Stack>
        </Box>

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
            <HistoryIcon sx={{ fontSize: 64, color: alpha(themePalette.textMuted, 0.2), mb: 2 }} />
            <Typography variant="h6" fontWeight={700} color={themePalette.textMain}>No Versions Found</Typography>
            <Typography variant="body2" color={themePalette.textMuted}>This model hasn't been iterated yet.</Typography>
          </Paper>
        ) : (
          <Timeline position="right" sx={{ p: 0 }}>
            {versions.map((version, index) => (
              <TimelineItem key={version.id}>
                <TimelineOppositeContent sx={{ flex: 0.1, minWidth: 100, py: 3 }}>
                  <Typography variant="caption" fontWeight={800} sx={{ color: themePalette.textMuted }}>
                    {new Date(version.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </Typography>
                </TimelineOppositeContent>

                <TimelineSeparator>
                  <TimelineDot
                    sx={{
                      bgcolor: version.is_active ? themePalette.success : "transparent",
                      border: `2px solid ${version.is_active ? themePalette.success : themePalette.primary}`,
                      boxShadow: version.is_active ? `0 0 0 4px ${alpha(themePalette.success, 0.15)}` : "none",
                      p: 0.8
                    }}
                  >
                    <TimelineIcon sx={{ fontSize: 16, color: version.is_active ? "#fff" : themePalette.primary }} />
                  </TimelineDot>
                  {index !== versions.length - 1 && <TimelineConnector sx={{ bgcolor: themePalette.border }} />}
                </TimelineSeparator>

                <TimelineContent sx={{ py: 3, px: 3 }}>
                  <Card 
                    elevation={0} 
                    sx={{ 
                      borderRadius: "20px", 
                      border: `1px solid ${version.is_active ? themePalette.success : themePalette.border}`,
                      bgcolor: themePalette.white,
                      transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                      "&:hover": { 
                        transform: "translateY(-4px)",
                        boxShadow: `0 12px 24px -8px ${alpha(themePalette.textMain, 0.1)}`,
                        borderColor: themePalette.primary
                      }
                    }}
                  >
                    <CardContent sx={{ p: 3 }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
                        <Box>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Typography variant="h6" fontWeight={800} sx={{ color: themePalette.textMain }}>
                              Version {version.version_number}
                            </Typography>
                            {version.is_active && (
                              <Chip 
                                label="Live" 
                                size="small" 
                                sx={{ 
                                  bgcolor: alpha(themePalette.success, 0.1), 
                                  color: themePalette.success, 
                                  fontWeight: 800, 
                                  fontSize: "0.65rem",
                                  height: 20
                                }} 
                              />
                            )}
                          </Stack>
                          {version.note && (
                            <Typography variant="body2" sx={{ color: themePalette.textMuted, mt: 1, lineHeight: 1.6 }}>
                              {version.note}
                            </Typography>
                          )}
                        </Box>

                        <Stack direction="row" spacing={0.5}>
                          {!version.is_active && (
                            <Tooltip title="Rollback to this version">
                              <IconButton
                                size="small"
                                onClick={() => handleRollback(version.id)}
                                disabled={rollbackLoading !== null}
                                sx={{ color: themePalette.warning, bgcolor: alpha(themePalette.warning, 0.05) }}
                              >
                                {rollbackLoading === version.id ? <CircularProgress size={18} color="inherit" /> : <RollbackIcon fontSize="small" />}
                              </IconButton>
                            </Tooltip>
                          )}
                          <Tooltip title="View Details">
                            <IconButton
                              size="small"
                              onClick={() => navigate(`/factories/${factoryId}/algorithms/${algorithmId}/models/${modelId}/versions/${version.id}`)}
                              sx={{ color: themePalette.primary, bgcolor: alpha(themePalette.primary, 0.05) }}
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
                              sx={{ bgcolor: alpha(themePalette.danger, 0.05) }}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </Stack>

                      {/* Version Metrics Snapshot */}
                      <Stack direction="row" spacing={3} sx={{ mt: 3, pt: 2, borderTop: `1px solid ${themePalette.border}` }}>
                        <Box>
                          <Typography variant="caption" fontWeight={700} sx={{ color: themePalette.textMuted, textTransform: "uppercase", display: "block" }}>Accuracy</Typography>
                          <Typography variant="body2" fontWeight={800} color={themePalette.textMain}>{version.accuracy ? `${version.accuracy}%` : "—"}</Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" fontWeight={700} sx={{ color: themePalette.textMuted, textTransform: "uppercase", display: "block" }}>F1 Score</Typography>
                          <Typography variant="body2" fontWeight={800} color={themePalette.textMain}>{version.f1_score ? `${version.f1_score}%` : "—"}</Typography>
                        </Box>
                      </Stack>
                    </CardContent>
                  </Card>
                </TimelineContent>
              </TimelineItem>
            ))}
          </Timeline>
        )}
      </Container>

      {/* Aesthetic Delete Dialog */}
      <Dialog 
        open={deleteOpen} 
        onClose={() => setDeleteOpen(false)}
        PaperProps={{ sx: { borderRadius: "24px", p: 1 } }}
      >
        <DialogTitle sx={{ fontWeight: 800 }}>
          Delete Version {selectedVersion?.version_number}
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ color: themePalette.textMuted, mb: 2 }}>
            {selectedVersion?.is_active
              ? "This version is currently LIVE. Deleting it will impact production stability."
              : "Are you sure you want to remove this iteration? This action is permanent."}
          </Typography>
          {selectedVersion?.is_active && (
            <Paper elevation={0} sx={{ p: 2, bgcolor: alpha(themePalette.danger, 0.05), borderRadius: "12px", border: `1px solid ${alpha(themePalette.danger, 0.1)}` }}>
              <Typography color="error" variant="body2" fontWeight={700}>
                ⚠️ High Risk Action: Active Model Deletion
              </Typography>
            </Paper>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setDeleteOpen(false)} sx={{ color: themePalette.textMuted, fontWeight: 700 }}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            onClick={handleDelete}
            disabled={deleteLoading}
            sx={{ borderRadius: "10px", px: 3, fontWeight: 700, boxShadow: "none" }}
          >
            {deleteLoading ? <CircularProgress size={20} color="inherit" /> : "Delete Version"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}