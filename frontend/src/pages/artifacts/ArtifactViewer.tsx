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
  useTheme,
  Breadcrumbs,
  Link,
  Tooltip,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DownloadIcon from "@mui/icons-material/Download";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import { useNavigate, useParams } from "react-router-dom";
import axios from "../../api/axios";

/* =======================
   Modern Aesthetic Config
======================= */
const UI_CONSTANTS = {
  glassBg: (color: string) => alpha(color, 0.05),
  blur: "blur(12px)",
  borderRadius: "24px",
  codeBg: "#0B0E14",
};

export default function ArtifactViewer() {
  const { artifactId } = useParams();
  const navigate = useNavigate();
  const theme = useTheme();

  const [artifact, setArtifact] = useState<any | null>(null);
  const [content, setContent] = useState<any>(null);
  const [loading, setLoading] = useState(true);

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

  if (loading || !artifact) {
    return (
      <Box sx={{ height: "80vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <CircularProgress thickness={5} size={50} sx={{ color: theme.palette.primary.main }} />
      </Box>
    );
  }

  const renderContent = () => {
    const ext = artifact.name.split(".").pop()?.toLowerCase();

    // CODE & TEXT RENDERER
    if (["py", "js", "ts", "txt", "json"].includes(ext || "")) {
      return (
        <Box sx={{ position: "relative" }}>
          <Tooltip title="Copy Code">
            <IconButton 
              sx={{ position: "absolute", right: 16, top: 16, color: "grey.500" }}
              onClick={() => navigator.clipboard.writeText(JSON.stringify(content, null, 2))}
            >
              <ContentCopyIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <pre style={{
            margin: 0,
            padding: "24px",
            background: UI_CONSTANTS.codeBg,
            color: "#A9B1D6", // Tokyo Night theme color
            borderRadius: "16px",
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            fontSize: "13px",
            overflow: "auto",
            lineHeight: 1.7,
            border: `1px solid ${alpha("#fff", 0.1)}`
          }}>
            {typeof content === 'string' ? content : JSON.stringify(content, null, 2)}
          </pre>
        </Box>
      );
    }

    // IMAGE RENDERER
    if (["png", "jpg", "jpeg", "webp"].includes(ext || "")) {
      return (
        <Paper elevation={0} sx={{ 
          p: 2, 
          textAlign: "center", 
          bgcolor: UI_CONSTANTS.glassBg(theme.palette.divider),
          borderRadius: "16px" 
        }}>
          <img
            src={`/api/artifacts/${artifact.id}/download`}
            alt={artifact.name}
            style={{ maxWidth: "100%", borderRadius: "8px", boxShadow: theme.shadows[4] }}
          />
        </Paper>
      );
    }

    // TABLE RENDERER
    if (ext === "csv" && Array.isArray(content)) {
      const headers = Object.keys(content[0] || {});
      return (
        <Box sx={{ overflowX: "auto", borderRadius: "12px", border: `1px solid ${theme.palette.divider}` }}>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                {headers.map((h) => (
                  <TableCell key={h} sx={{ fontWeight: 800, bgcolor: "background.paper" }}>{h.toUpperCase()}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {content.slice(0, 10).map((row, idx) => (
                <TableRow key={idx} hover>
                  {headers.map((h) => <TableCell key={h}>{row[h]}</TableCell>)}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      );
    }

    return <Typography color="text.secondary">Detailed preview is unavailable.</Typography>;
  };

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto", p: { xs: 2, md: 4 } }}>
      {/* HEADER & BREADCRUMBS */}
      <Box sx={{ mb: 4 }}>
        <Breadcrumbs sx={{ mb: 1 }}>
          <Link underline="hover" color="inherit" onClick={() => navigate(-1)} sx={{ cursor: "pointer", display: "flex", alignItems: "center" }}>
            <ArrowBackIcon sx={{ mr: 0.5 }} fontSize="inherit" /> Artifacts
          </Link>
          <Typography color="text.primary">{artifact.name}</Typography>
        </Breadcrumbs>
        
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 2 }}>
          <Box>
            <Typography variant="h3" fontWeight={900} sx={{ letterSpacing: "-0.04em", mb: 1 }}>
              {artifact.name}
            </Typography>
            <Stack direction="row" spacing={1}>
              <Chip label={artifact.type.toUpperCase()} size="small" variant="outlined" sx={{ fontWeight: 700 }} />
              <Chip icon={<InfoOutlinedIcon />} label={`${(artifact.size / 1024).toFixed(2)} KB`} size="small" sx={{ fontWeight: 600 }} />
            </Stack>
          </Box>
          <Button
            variant="contained"
            disableElevation
            startIcon={<DownloadIcon />}
            sx={{ borderRadius: "12px", px: 3, py: 1, textTransform: "none", fontWeight: 700 }}
            onClick={() => window.open(`/api/artifacts/${artifact.id}/download`)}
          >
            Download Resource
          </Button>
        </Box>
      </Box>

      {/* VIEWER CONTAINER */}
      <Card sx={{ 
        borderRadius: UI_CONSTANTS.borderRadius, 
        border: `1px solid ${theme.palette.divider}`,
        boxShadow: "0 8px 32px 0 rgba(31, 38, 135, 0.07)",
        backdropFilter: UI_CONSTANTS.blur,
        overflow: "visible"
      }}>
        <Box sx={{ p: 1, borderBottom: `1px solid ${theme.palette.divider}`, display: "flex", gap: 1 }}>
           <Box sx={{ width: 12, height: 12, borderRadius: "50%", bgcolor: "#FF5F56" }} />
           <Box sx={{ width: 12, height: 12, borderRadius: "50%", bgcolor: "#FFBD2E" }} />
           <Box sx={{ width: 12, height: 12, borderRadius: "50%", bgcolor: "#27C93F" }} />
        </Box>
        <Box sx={{ p: 3 }}>
          {renderContent()}
        </Box>
      </Card>
    </Box>
  );
}