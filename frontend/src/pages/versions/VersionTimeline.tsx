"use client";

import { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Button,
  CircularProgress,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useNavigate, useParams } from "react-router-dom";
import axios from "../../api/axios";

import VersionsDashboard from "./VersionsDashboard";

/* =======================
   Types
======================= */

interface Version {
  id: number;
  version_number: number;
  note?: string;
  is_active: boolean;
  created_at: string;
}

/* =======================
   Component
======================= */

export default function VersionTimeline() {
  const { factoryId, algorithmId, modelId } = useParams();
  const navigate = useNavigate();

  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(true);

  /* =======================
     Fetch versions
  ======================= */

  const fetchVersions = async () => {
    try {
      const res = await axios.get(
        `/factories/${factoryId}/algorithms/${algorithmId}/models/${modelId}/versions`
      );
      setVersions(res.data);
    } catch (err) {
      console.error("Failed to load versions", err);
    } finally {
      setLoading(false);
    }
  };

 

  useEffect(() => {
    fetchVersions();
  }, [factoryId, algorithmId, modelId]);

  /* =======================
     Rollback
  ======================= */

  const handleRollback = async (versionId: number) => {
    try {
      await axios.post(
        `/factories/${factoryId}/algorithms/${algorithmId}/models/${modelId}/versions/${versionId}/checkout`
      );
      fetchVersions();
    } catch (err) {
      console.error("Rollback failed", err);
    }
  };

  /* =======================
     DELETE VERSION
  ======================= */

  const handleDelete = async (versionId: number) => {
  
    try {
      await axios.delete(
        `/factories/${factoryId}/algorithms/${algorithmId}/models/${modelId}/versions/${versionId}`
      );
      fetchVersions(); // refresh list
    } catch (err) {
      console.error("Delete failed", err);
    }
  };

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
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", mb: 3 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() =>
            navigate(
              `/factories/${factoryId}/algorithms/${algorithmId}/models/${modelId}`
            )
          }
          sx={{ mr: 2 }}
        >
          Back
        </Button>

        <Typography variant="h4" fontWeight={700}>
          Version Lineage
        </Typography>
      </Box>

      {/* Versions */}
      {versions.length === 0 ? (
        <Typography color="text.secondary">
          No versions created yet.
        </Typography>
      ) : (
        <VersionsDashboard
          versions={versions}
          basePath={`/factories/${factoryId}/algorithms/${algorithmId}/models/${modelId}/versions`}
          onRollback={handleRollback}
          onDelete={handleDelete}   // 🔥 PASS DELETE
        />
      )}
    </Box>
  );
}
