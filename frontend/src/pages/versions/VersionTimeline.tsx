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
  Description as DescriptionIcon,
  Assessment as AssessmentIcon,
  Visibility as ViewIcon,
} from "@mui/icons-material";
import { useNavigate, useParams } from "react-router-dom";
import axios from "../../api/axios";

/* ==========================================================================
   CONSISTENT THEME PALETTE
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
};

interface Version {
  id: number;
  version_number: number;
  accuracy?: number;
  precision?: number;
  recall?: number;
  f1_score?: number;
  note?: string;
  created_at: string;
}

export default function VersionTimeline() {
  const { factoryId, algorithmId, modelId } = useParams();
  const navigate = useNavigate();
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchVersions = async () => {
      try {
        const res = await axios.get(
          `/factories/${factoryId}/algorithms/${algorithmId}/models/${modelId}/versions`
        );
        // Sort by version number descending for timeline
        const sorted = [...res.data].sort((a, b) => b.version_number - a.version_number);
        setVersions(sorted);
      } catch (err) {
        console.error("Failed to load versions", err);
      } finally {
        setLoading(false);
      }
    };
    fetchVersions();
  }, [factoryId, algorithmId, modelId]);

  if (loading) {
    return (
      <Box sx={{ height: "80vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <CircularProgress size={40} sx={{ color: themePalette.primary }} />
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: themePalette.background, pb: 10 }}>
      <Container maxWidth="md">
        {/* Header */}
        <Box sx={{ pt: 4, pb: 6 }}>
          <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
            <IconButton 
              onClick={() => navigate(-1)}
              sx={{ 
                bgcolor: themePalette.white, 
                border: `1px solid ${themePalette.border}`,
                "&:hover": { bgcolor: themePalette.primaryLight, color: themePalette.primary }
              }}
            >
              <ArrowBackIcon fontSize="small" />
            </IconButton>
            <Typography variant="overline" fontWeight={800} color="primary" sx={{ letterSpacing: 2 }}>
              Iteration History
            </Typography>
          </Stack>
          <Typography variant="h3" fontWeight={900} sx={{ color: themePalette.textMain, letterSpacing: "-0.04em" }}>
            Model <Box component="span" sx={{ color: themePalette.primary }}>Timeline</Box>
          </Typography>
        </Box>

        {versions.length === 0 ? (
          <Paper variant="outlined" sx={{ py: 10, textAlign: 'center', borderRadius: '24px', borderStyle: 'dashed' }}>
            <HistoryIcon sx={{ fontSize: 48, color: alpha(themePalette.textMuted, 0.3), mb: 2 }} />
            <Typography variant="h6" fontWeight={700} color={themePalette.textMain}>No history found</Typography>
            <Typography variant="body2" color={themePalette.textMuted}>Create your first model version to see the evolution timeline.</Typography>
          </Paper>
        ) : (
          <Timeline position="right" sx={{ p: 0 }}>
            {versions.map((version, index) => (
              <TimelineItem key={version.id}>
                <TimelineOppositeContent sx={{ flex: 0.1, minWidth: 100, py: 2, px: 2 }}>
                  <Typography variant="caption" fontWeight={800} sx={{ color: themePalette.textMuted }}>
                    {new Date(version.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </Typography>
                </TimelineOppositeContent>

                <TimelineSeparator>
                  <TimelineDot 
                    sx={{ 
                      bgcolor: index === 0 ? themePalette.primary : "transparent", 
                      border: `2px solid ${themePalette.primary}`,
                      boxShadow: index === 0 ? `0 0 0 4px ${alpha(themePalette.primary, 0.1)}` : 'none',
                      p: 0.8
                    }} 
                  >
                    <TimelineIcon sx={{ fontSize: 16, color: index === 0 ? "#fff" : themePalette.primary }} />
                  </TimelineDot>
                  {index !== versions.length - 1 && <TimelineConnector sx={{ bgcolor: themePalette.border }} />}
                </TimelineSeparator>

                <TimelineContent sx={{ py: 2, px: 3, mb: 4 }}>
                  <Card 
                    elevation={0} 
                    sx={{ 
                      borderRadius: "20px", 
                      border: `1px solid ${themePalette.border}`,
                      bgcolor: themePalette.white,
                      transition: "all 0.3s ease",
                      "&:hover": { 
                        borderColor: themePalette.primary,
                        boxShadow: `0 10px 15px -3px ${alpha("#000", 0.05)}`
                      }
                    }}
                  >
                    <CardContent sx={{ p: 3 }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 2 }}>
                        <Box>
                          <Typography variant="h6" fontWeight={800} sx={{ color: themePalette.textMain }}>
                            Version {version.version_number}
                          </Typography>
                          {index === 0 && (
                            <Chip label="Latest Release" size="small" sx={{ mt: 0.5, bgcolor: alpha(themePalette.success, 0.1), color: themePalette.success, fontWeight: 700, borderRadius: '6px' }} />
                          )}
                        </Box>
                        <Button
                          startIcon={<ViewIcon fontSize="small" />}
                          onClick={() => navigate(`/factories/${factoryId}/algorithms/${algorithmId}/models/${modelId}/versions/${version.id}`)}
                          sx={{ textTransform: 'none', fontWeight: 700, color: themePalette.primary, borderRadius: '8px' }}
                        >
                          Details
                        </Button>
                      </Stack>

                      {version.note && (
                        <Box sx={{ display: 'flex', gap: 1, mb: 2, bgcolor: themePalette.background, p: 1.5, borderRadius: '12px' }}>
                          <DescriptionIcon sx={{ fontSize: 18, color: themePalette.textMuted, mt: 0.3 }} />
                          <Typography variant="body2" sx={{ color: themePalette.textMuted, lineHeight: 1.6 }}>
                            {version.note}
                          </Typography>
                        </Box>
                      )}

                      <Stack direction="row" spacing={1.5}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <AssessmentIcon sx={{ fontSize: 16, color: themePalette.success }} />
                          <Typography variant="caption" fontWeight={700}>Acc: {version.accuracy ? `${version.accuracy}%` : "N/A"}</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <AssessmentIcon sx={{ fontSize: 16, color: themePalette.primary }} />
                          <Typography variant="caption" fontWeight={700}>F1: {version.f1_score ? `${version.f1_score}%` : "N/A"}</Typography>
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
    </Box>
  );
}