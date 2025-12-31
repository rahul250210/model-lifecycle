"use client";

import { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  CircularProgress,
  Button,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DownloadIcon from "@mui/icons-material/Download";
import { useNavigate, useParams } from "react-router-dom";
import axios from "../../api/axios";

/* =======================
   Types
======================= */

type ArtifactType = "text" | "json" | "csv" | "image" | "binary";

interface Artifact {
  id: number;
  name: string;
  type: ArtifactType;
  size: number;
  preview_url?: string;
}

/* =======================
   Component
======================= */

export default function ArtifactViewer() {
  const { artifactId } = useParams();
  const navigate = useNavigate();

  const [artifact, setArtifact] = useState<Artifact | null>(null);
  const [content, setContent] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  /* =======================
     Fetch artifact metadata + preview
  ======================= */

  useEffect(() => {
    const fetchArtifact = async () => {
      try {
        const metaRes = await axios.get(`/artifacts/${artifactId}`);
        setArtifact(metaRes.data);

        // Fetch preview content if available
        if (metaRes.data.type !== "binary") {
          const contentRes = await axios.get(
            `/artifacts/${artifactId}/preview`
          );
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

  /* =======================
     Loading
  ======================= */

  if (loading || !artifact) {
    return (
      <Box
        sx={{
          height: "70vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <CircularProgress size={42} />
      </Box>
    );
  }

  /* =======================
     Renderers
  ======================= */

  const renderContent = () => {
    switch (artifact.type) {
      case "text":
        return (
          <pre style={{ whiteSpace: "pre-wrap" }}>
            {content}
          </pre>
        );

      case "json":
        return (
          <pre>
            {JSON.stringify(content, null, 2)}
          </pre>
        );

      case "csv":
        if (!Array.isArray(content) || content.length === 0) {
          return (
            <Typography color="text.secondary">
              No preview available.
            </Typography>
          );
        }

        const headers = Object.keys(content[0]);

        return (
          <Table size="small">
            <TableHead>
              <TableRow>
                {headers.map((h) => (
                  <TableCell key={h}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {content.slice(0, 20).map((row, idx) => (
                <TableRow key={idx}>
                  {headers.map((h) => (
                    <TableCell key={h}>
                      {row[h]}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        );

      case "image":
        return (
          <Box sx={{ textAlign: "center" }}>
            <img
              src={`/api/artifacts/${artifact.id}/download`}
              alt={artifact.name}
              style={{ maxWidth: "100%" }}
            />
          </Box>
        );

      default:
        return (
          <Typography color="text.secondary">
            Preview not supported for this file type.
          </Typography>
        );
    }
  };

  return (
    <Box sx={{ p: 4 }}>
      {/* =======================
          Header
      ======================= */}
      <Box sx={{ display: "flex", alignItems: "center", mb: 3 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate(-1)}
          sx={{ mr: 2 }}
        >
          Back
        </Button>

        <Typography variant="h4" fontWeight={700}>
          {artifact.name}
        </Typography>
      </Box>

      {/* =======================
          Viewer
      ======================= */}
      <Card elevation={2} sx={{ borderRadius: 3 }}>
        <CardContent>
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Size: {(artifact.size / 1024).toFixed(2)} KB
            </Typography>
          </Box>

          {renderContent()}

          {/* Download */}
          <Box sx={{ mt: 3 }}>
            <Button
              startIcon={<DownloadIcon />}
              onClick={() =>
                window.open(
                  `/api/artifacts/${artifact.id}/download`
                )
              }
            >
              Download
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
