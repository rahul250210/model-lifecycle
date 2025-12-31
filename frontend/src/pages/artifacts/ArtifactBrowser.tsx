"use client";

import { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  CircularProgress,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Chip,
  Button,
} from "@mui/material";
import FolderIcon from "@mui/icons-material/Folder";
import DownloadIcon from "@mui/icons-material/Download";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useNavigate, useParams } from "react-router-dom";
import axios from "../../api/axios";

/* =======================
   Types
======================= */

interface Artifact {
  id: number;
  name: string;
  type: "dataset" | "model" | "code" | "metrics" | "logs";
  size: number;
  created_at: string;
}

/* =======================
   Component
======================= */

export default function ArtifactBrowser() {
  const { factoryId, algorithmId, modelId, versionId } = useParams();
  const navigate = useNavigate();

  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [loading, setLoading] = useState(true);

  /* =======================
     Fetch artifacts
  ======================= */

  useEffect(() => {
    const fetchArtifacts = async () => {
      try {
        const res = await axios.get(
          `/factories/${factoryId}/algorithms/${algorithmId}/models/${modelId}/versions/${versionId}/artifacts`
        );
        setArtifacts(res.data);
      } catch (err) {
        console.error("Failed to load artifacts", err);
      } finally {
        setLoading(false);
      }
    };

    fetchArtifacts();
  }, [factoryId, algorithmId, modelId, versionId]);

  /* =======================
     Loading
  ======================= */

  if (loading) {
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

  return (
    <Box sx={{ p: 4 }}>
      {/* =======================
          Header
      ======================= */}
      <Box sx={{ display: "flex", alignItems: "center", mb: 3 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() =>
            navigate(
              `/factories/${factoryId}/algorithms/${algorithmId}/models/${modelId}/versions/${versionId}`
            )
          }
          sx={{ mr: 2 }}
        >
          Back
        </Button>

        <Typography variant="h4" fontWeight={700}>
          Artifacts
        </Typography>
      </Box>

      {/* =======================
          Artifact Table
      ======================= */}
      {artifacts.length === 0 ? (
        <Typography color="text.secondary">
          No artifacts found.
        </Typography>
      ) : (
        <Card elevation={2} sx={{ borderRadius: 3 }}>
          <CardContent>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Artifact</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Size</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell align="right">Action</TableCell>
                </TableRow>
              </TableHead>

              <TableBody>
                {artifacts.map((a) => (
                  <TableRow key={a.id} hover>
                    <TableCell>
                      <Box sx={{ display: "flex", alignItems: "center" }}>
                        <FolderIcon sx={{ mr: 1 }} />
                        {a.name}
                      </Box>
                    </TableCell>

                    <TableCell>
                      <Chip
                        label={a.type.toUpperCase()}
                        size="small"
                      />
                    </TableCell>

                    <TableCell>
                      {(a.size / 1024).toFixed(2)} KB
                    </TableCell>

                    <TableCell>
                      {new Date(a.created_at).toLocaleString()}
                    </TableCell>

                    <TableCell align="right">
                      <Button
                        size="small"
                        startIcon={<DownloadIcon />}
                        onClick={() =>
                          window.open(
                            `/api/artifacts/${a.id}/download`
                          )
                        }
                      >
                        Download
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
