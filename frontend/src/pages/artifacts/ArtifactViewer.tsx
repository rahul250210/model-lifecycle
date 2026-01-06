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

type ArtifactType =
  | "text"
  | "json"
  | "csv"
  | "image"
  | "binary"
  | "code";


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

  const getExtension = (name: string) =>
  name.split(".").pop()?.toLowerCase();

  const isCodeFile = (ext?: string) =>
    ["py", "js", "ts", "cpp", "c", "h", "hpp", "java", "go", "rs"].includes(ext || "");

  const isTextFile = (ext?: string) =>
    ["txt", "log", "md"].includes(ext || "");

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

  const normalizeContent = (value: any): string => {
        if (typeof value === "string") return value;

        if (value && typeof value === "object") {
          if ("message" in value) return value.message;
          return JSON.stringify(value, null, 2);
        }

        return "";
      };

      

  /* =======================
     Renderers
  ======================= */

 const renderContent = () => {
  const ext = getExtension(artifact.name);

  // ---------- CODE ----------
  if (isCodeFile(ext)) {
    return (
      <pre
        style={{
          whiteSpace: "pre-wrap",
          background: "#0f172a",
          color: "#e5e7eb",
          padding: "16px",
          borderRadius: "8px",
          overflowX: "auto",
          fontSize: "14px",
          lineHeight: 1.6,
        }}
      >
        {normalizeContent(content)}
      </pre>
    );
  }

  // ---------- JSON ----------
  if (ext === "json") {
    return <pre>{JSON.stringify(content, null, 2)}</pre>;
  }

  // ---------- CSV ----------
  if (ext === "csv") {
    if (!Array.isArray(content) || content.length === 0) {
      return <Typography>No preview available.</Typography>;
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
          {content.map((row, idx) => (
            <TableRow key={idx}>
              {headers.map((h) => (
                <TableCell key={h}>{row[h]}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  // ---------- IMAGE ----------
  if (["png", "jpg", "jpeg", "webp"].includes(ext || "")) {
    return (
      <Box sx={{ textAlign: "center" }}>
        <img
          src={`/api/artifacts/${artifact.id}/download`}
          alt={artifact.name}
          style={{ maxWidth: "100%" }}
        />
      </Box>
    );
  }

  // ---------- TEXT ----------
  if (isTextFile(ext)) {
    return <pre>{normalizeContent(content)}</pre>;
  }

  // ---------- FALLBACK ----------
  return (
    <Typography color="text.secondary">
      {normalizeContent(content) || "Preview not supported for this file type."}
    </Typography>
  );
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
