"use client";

import { useEffect, useState } from "react";
import {
  Box,
  Stack,
  Typography,
  Card,
  CircularProgress,
  Button,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  IconButton,
  Chip,
  Paper,
  alpha,
  Grid,
  Tooltip,
  Container,
  Divider,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DownloadIcon from "@mui/icons-material/Download";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import StorageIcon from "@mui/icons-material/Storage";
import DateRangeIcon from "@mui/icons-material/DateRange";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import axios, { API_BASE_URL } from "../../api/axios";
import { useTheme } from "../../theme/ThemeContext";

export default function ArtifactViewer() {
  const { artifactId } = useParams();
  const navigate = useNavigate();
  const { theme } = useTheme();

  const [artifact, setArtifact] = useState<any | null>(null);
  const [content, setContent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchArtifact = async () => {
      try {
        const metaRes = await axios.get(`/artifacts/${artifactId}`);
        setArtifact(metaRes.data);

        if (metaRes.data.type !== "binary") {
          const contentRes = await axios.get(`/artifacts/${artifactId}/preview`);
          setContent(contentRes.data);
        }
      } catch (err) {
        console.error("Failed to load artifact", err);
      } finally {
        setLoading(false);
      }
    };
    fetchArtifact();
  }, [artifactId]);

  const handleCopy = () => {
    const text = typeof content === "string" ? content : JSON.stringify(content, null, 2);
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading || !artifact) {
    return (
      <Box sx={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", bgcolor: theme.background }}>
        <CircularProgress thickness={5} size={50} sx={{ color: theme.primary }} />
      </Box>
    );
  }

  const renderContent = () => {
    const ext = artifact.name.split(".").pop()?.toLowerCase();

    // CODE & TEXT RENDERER
    if (["py", "js", "ts", "txt", "json", "xml", "sh", "yaml", "yml", "cpp", "c", "h", "hpp", "cc", "java", "go", "rs", "rb", "php"].includes(ext || "")) {
      const lines = (typeof content === "string" ? content : JSON.stringify(content, null, 2)).split("\n");
      return (
        <Box sx={{ position: "relative", bgcolor: alpha(theme.background, 0.4), borderRadius: "16px", border: `1px solid ${alpha(theme.border, 0.6)}`, overflow: "hidden" }}>
          <Box sx={{ display: 'flex', borderBottom: `1px solid ${alpha(theme.border, 0.3)}`, p: 1, px: 2, bgcolor: alpha(theme.textMain, 0.03), justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="caption" sx={{ color: theme.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
              {ext === 'py' ? 'Python Script' : ext?.toUpperCase()} Source
            </Typography>
            <Tooltip title={copied ? "Copied!" : "Copy Code"}>
              <IconButton size="small" onClick={handleCopy} sx={{ color: copied ? theme.success : theme.textMuted }}>
                <ContentCopyIcon fontSize="inherit" />
              </IconButton>
            </Tooltip>
          </Box>
          <Box sx={{ display: "flex", maxHeight: "70vh", overflow: "auto", "&::-webkit-scrollbar": { height: '8px', width: '8px' }, "&::-webkit-scrollbar-thumb": { bgcolor: alpha(theme.primary, 0.2), borderRadius: '10px' } }}>
            {/* Line Numbers */}
            <Box sx={{
              p: 2,
              pr: 1.5,
              textAlign: "right",
              userSelect: "none",
              bgcolor: alpha(theme.textMain, 0.02),
              borderRight: `1px solid ${alpha(theme.border, 0.2)}`,
              minWidth: 40,
              flexShrink: 0
            }}>
              {lines.map((_, i) => (
                <Typography key={i} sx={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: "12px",
                  color: alpha(theme.textMuted, 0.5),
                  lineHeight: 1.7
                }}>
                  {i + 1}
                </Typography>
              ))}
            </Box>
            {/* Code Content */}
            <Box sx={{ p: 2, flexGrow: 1 }}>
              <pre style={{ margin: 0, fontFamily: "'JetBrains Mono', monospace", fontSize: "13px", color: theme.textMain, lineHeight: 1.7 }}>
                {lines.join("\n")}
              </pre>
            </Box>
          </Box>
        </Box>
      );
    }

    // IMAGE RENDERER
    if (["png", "jpg", "jpeg", "webp", "gif"].includes(ext || "")) {
      return (
        <Box sx={{
          p: 4,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          borderRadius: "20px",
          // Checkerboard pattern for transparency
          backgroundImage: `linear-gradient(45deg, ${alpha(theme.textMain, 0.05)} 25%, transparent 25%), linear-gradient(-45deg, ${alpha(theme.textMain, 0.05)} 25%, transparent 25%), linear-gradient(45deg, transparent 75%, ${alpha(theme.textMain, 0.05)} 75%), linear-gradient(-45deg, transparent 75%, ${alpha(theme.textMain, 0.05)} 75%)`,
          backgroundSize: '20px 20px',
          backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
          border: `1px solid ${alpha(theme.border, 0.4)}`,
          minHeight: 400
        }}>
          <img
            src={`${API_BASE_URL}/artifacts/${artifact.id}/image`}
            alt={artifact.name}
            style={{
              maxWidth: "100%",
              maxHeight: "70vh",
              borderRadius: "8px",
              boxShadow: `0 24px 48px -12px ${alpha(theme.textMain, 0.2)}`,
              border: `1px solid ${alpha(theme.border, 0.1)}`
            }}
          />
        </Box>
      );
    }

    // TABLE RENDERER
    if (ext === "csv" && Array.isArray(content)) {
      const headers = Object.keys(content[0] || {});
      return (
        <Box sx={{ overflowX: "auto", borderRadius: "20px", border: `1px solid ${theme.border}`, boxShadow: `0 4px 20px ${alpha(theme.textMain, 0.02)}` }}>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                {headers.map((h) => (
                  <TableCell key={h} sx={{
                    fontWeight: 800,
                    bgcolor: theme.paper,
                    color: theme.primary,
                    borderBottom: `2px solid ${alpha(theme.primary, 0.2)}`,
                    py: 2.5,
                    fontSize: '0.75rem',
                    letterSpacing: 1,
                    textTransform: 'uppercase'
                  }}>
                    {h.replace(/_/g, ' ')}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {content.map((row, idx) => (
                <TableRow key={idx} hover sx={{ "&:hover": { bgcolor: alpha(theme.primary, 0.03) }, "&:nth-of-type(even)": { bgcolor: alpha(theme.textMain, 0.01) } }}>
                  {headers.map((h) => (
                    <TableCell key={h} sx={{ color: theme.textMain, borderColor: alpha(theme.border, 0.4), py: 2, fontSize: '0.875rem' }}>
                      {row[h]}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      );
    }

    return (
      <Paper variant="outlined" sx={{ p: 6, textAlign: 'center', borderRadius: '24px', borderStyle: 'dashed', bgcolor: alpha(theme.background, 0.3) }}>
        <Typography sx={{ color: theme.textMuted, fontWeight: 700 }}>Detailed preview is unavailable for this artifact type.</Typography>
        <Button startIcon={<DownloadIcon />} href={`/api/artifacts/${artifact.id}/download`} sx={{ mt: 2, textTransform: 'none', fontWeight: 700 }}>Download to View</Button>
      </Paper>
    );
  };

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: theme.background, display: 'flex', flexDirection: 'column' }}>
      {/* HEADER: Professional Sticky Header */}
      <Box sx={{
        flexShrink: 0,
        bgcolor: alpha(theme.background, 0.8),
        backdropFilter: "blur(24px)",
        borderBottom: `1px solid ${alpha(theme.border, 0.6)}`,
        zIndex: 10,
        position: 'sticky',
        top: 0
      }}>
        <Container maxWidth="xl" sx={{ py: 2.5 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={4}>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <IconButton
                onClick={() => navigate(-1)}
                sx={{
                  mb: 1,
                  ml: -1,
                  color: theme.textMuted,
                  '&:hover': { color: theme.primary, bgcolor: alpha(theme.primary, 0.05) }
                }}
              >
                <ArrowBackIcon />
              </IconButton>
              <Tooltip title={artifact.name.length > 40 ? artifact.name : ""}>
                <Typography variant="h4" fontWeight={900} noWrap sx={{ color: theme.textMain, letterSpacing: "-0.05em", background: `linear-gradient(135deg, ${theme.textMain} 0%, ${alpha(theme.textMain, 0.6)} 100%)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {artifact.name}
                </Typography>
              </Tooltip>
            </Box>
            <Button
              variant="contained"
              disableElevation
              startIcon={<DownloadIcon />}
              sx={{ borderRadius: "14px", px: 4, py: 1.5, textTransform: "none", fontWeight: 800, bgcolor: theme.primary, boxShadow: `0 8px 24px ${alpha(theme.primary, 0.3)}`, '&:hover': { bgcolor: theme.primaryDark, transform: 'translateY(-1px)' }, transition: 'all 0.2s', flexShrink: 0 }}
              onClick={() => window.location.href = `${API_BASE_URL}/artifacts/${artifact.id}/download`}
            >
              Export Artifact
            </Button>
          </Stack>
        </Container>
      </Box>

      {/* MAIN CONTENT AREA: Split View */}
      <Container maxWidth="xl" sx={{ py: 6, flex: 1 }}>
        <Grid container spacing={4}>
          {/* Main Content Pane */}
          <Grid size={{ xs: 12, md: 8.5 }}>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <Card sx={{
                borderRadius: "32px",
                border: `1px solid ${alpha(theme.border, 0.7)}`,
                boxShadow: `0 24px 64px -12px ${alpha(theme.textMain, 0.08)}`,
                bgcolor: theme.paper,
                overflow: "hidden"
              }}>
                {/* Visual Header */}
                <Box sx={{ p: 2, px: 3, borderBottom: `1px solid ${alpha(theme.border, 0.4)}`, display: "flex", alignItems: 'center', justifyContent: 'space-between', bgcolor: alpha(theme.textMain, 0.01) }}>
                  <Stack direction="row" spacing={1.5}>
                    <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: "#FF5F56" }} />
                    <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: "#FFBD2E" }} />
                    <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: "#27C93F" }} />
                  </Stack>
                  <Typography variant="caption" sx={{ color: theme.textMuted, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase' }}>
                    Contextual Preview
                  </Typography>
                  <Box sx={{ width: 60 }} />
                </Box>
                <Box sx={{ p: 3 }}>
                  <AnimatePresence mode="wait">
                    {renderContent()}
                  </AnimatePresence>
                </Box>
              </Card>
            </motion.div>
          </Grid>

          {/* Sidebar Metadata Pane */}
          <Grid size={{ xs: 12, md: 3.5 }}>
            <Stack spacing={4}>
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
                <Card sx={{ borderRadius: "28px", border: `1px solid ${theme.border}`, bgcolor: theme.paper, p: 3 }}>
                  <Typography variant="overline" color={theme.textMuted} fontWeight={900} sx={{ letterSpacing: 2 }}>Resource Identity</Typography>
                  <Divider sx={{ my: 2, opacity: 0.5 }} />

                  <Stack spacing={3}>
                    <Box>
                      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1 }}>
                        <StorageIcon fontSize="small" sx={{ color: theme.primary }} />
                        <Typography variant="body2" fontWeight={700} color={theme.textMain}>Storage Allocation</Typography>
                      </Stack>
                      <Typography variant="h6" fontWeight={800} color={theme.textMain}>
                        {(artifact.size / 1024).toFixed(2)} <Box component="span" sx={{ fontSize: '0.7em', color: theme.textMuted }}>KB</Box>
                      </Typography>
                    </Box>

                    <Box>
                      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1 }}>
                        <DateRangeIcon fontSize="small" sx={{ color: theme.primary }} />
                        <Typography variant="body2" fontWeight={700} color={theme.textMain}>Registration Date</Typography>
                      </Stack>
                      <Typography variant="body2" fontWeight={600} color={theme.textSecondary}>
                        {new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </Typography>
                    </Box>

                    <Box>
                      <Typography variant="caption" fontWeight={800} sx={{ color: theme.textMuted, display: 'block', mb: 1 }}>TYPE CLASSIFICATION</Typography>
                      <Chip
                        label={artifact.type.toUpperCase()}
                        sx={{ borderRadius: '10px', height: 28, fontWeight: 800, bgcolor: alpha(theme.primary, 0.1), color: theme.primary, border: `1px solid ${alpha(theme.primary, 0.2)}` }}
                      />
                    </Box>
                  </Stack>
                </Card>
              </motion.div>
            </Stack>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}
