"use client";

import { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  CircularProgress,
  Divider,
  Chip,
  Grid,
} from "@mui/material";

import HubIcon from "@mui/icons-material/Hub";
import LayersIcon from "@mui/icons-material/Layers";
import AddIcon from "@mui/icons-material/Add";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import { useNavigate, useParams } from "react-router-dom";
import axios from "../../api/axios";

/* =======================
   Types
======================= */

interface Model {
  id: number;
  name: string;
  description?: string;
  versions_count: number;
  created_at: string;
}

interface VersionMetrics {
  id: number;
  version_number: number;
  accuracy?: number;
  precision?: number;
  recall?: number;
  f1_score?: number;
  created_at: string;
}

/* =======================
   Component
======================= */

export default function ModelOverview() {
  const { factoryId, algorithmId, modelId } = useParams();
  const navigate = useNavigate();

  const [model, setModel] = useState<Model | null>(null);
  const [versions, setVersions] = useState<VersionMetrics[]>([]);
  const [loading, setLoading] = useState(true);

  /* =======================
     Fetch data
  ======================= */

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [modelRes, versionsRes] = await Promise.all([
          axios.get(
            `/factories/${factoryId}/algorithms/${algorithmId}/models/${modelId}`
          ),
          axios.get(
            `/factories/${factoryId}/algorithms/${algorithmId}/models/${modelId}/versions`
          ),
        ]);

        // sort versions by version_number ASC for graphs
        const sortedVersions = [...versionsRes.data].sort(
          (a, b) => a.version_number - b.version_number
        );

        setModel(modelRes.data);
        setVersions(sortedVersions);
      } catch (err) {
        console.error("Failed to load model overview", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [factoryId, algorithmId, modelId]);

  if (loading || !model) {
    return (
      <Box
        sx={{
          height: "70vh",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <CircularProgress size={42} />
      </Box>
    );
  }

  /* =======================
     Prepare chart data
  ======================= */

  const chartData = versions.map((v) => ({
    version: `v${v.version_number}`,
    accuracy: v.accuracy ?? null,
    precision: v.precision ?? null,
    recall: v.recall ?? null,
    f1_score: v.f1_score ?? null,
  }));

  /* =======================
     Metric Chart Component
  ======================= */

  const MetricChart = ({
    title,
    dataKey,
    color,
  }: {
    title: string;
    dataKey: string;
    color: string;
  }) => (
    <Card sx={{ borderRadius: 3, height: "100%" }}>
      <CardContent>
        <Typography fontWeight={600} sx={{ mb: 2 }}>
          {title}
        </Typography>

        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="version" />
            <YAxis domain={[0, 100]} />
            <Tooltip />
            <Line
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              strokeWidth={3}
              dot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );

  return (
    <Box sx={{ p: 4 }}>
      {/* ================= HEADER ================= */}
      <Box sx={{ display: "flex", alignItems: "center", mb: 3 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() =>
            navigate(`/factories/${factoryId}/algorithms/${algorithmId}/models`)
          }
          sx={{ mr: 2 }}
        >
          Back
        </Button>

        <Typography variant="h4" fontWeight={700}>
          {model.name}
        </Typography>
      </Box>

      {/* ================= MODEL SUMMARY ================= */}
      <Card sx={{ borderRadius: 3, mb: 4 }}>
        <CardContent>
          <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
            <HubIcon color="primary" sx={{ mr: 1 }} />
            <Typography variant="h6" fontWeight={600}>
              Model Overview
            </Typography>
          </Box>

          <Typography color="text.secondary" sx={{ mb: 2 }}>
            {model.description || "No description provided."}
          </Typography>

          <Divider sx={{ mb: 2 }} />

          <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
            <Chip
              icon={<LayersIcon />}
              label={`${model.versions_count} Versions`}
            />
            <Chip
              label={`Created on ${new Date(
                model.created_at
              ).toLocaleDateString()}`}
            />
          </Box>
        </CardContent>
      </Card>

      {/* ================= ACTIONS ================= */}
      <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid item xs={12} md={6}>
          <Button
            fullWidth
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() =>
              navigate(
                `/factories/${factoryId}/algorithms/${algorithmId}/models/${modelId}/versions/create`
              )
            }
          >
            Create Version
          </Button>
        </Grid>

        <Grid item xs={12} md={6}>
          <Button
            fullWidth
            variant="outlined"
            onClick={() =>
              navigate(
                `/factories/${factoryId}/algorithms/${algorithmId}/models/${modelId}/versions`
              )
            }
          >
            View All Versions
          </Button>
        </Grid>
      </Grid>

      {/* ================= METRICS COMPARISON ================= */}
      <Typography variant="h5" fontWeight={700} sx={{ mb: 3 }}>
        Model Evaluation Comparison
      </Typography>

      {versions.length === 0 ? (
        <Typography color="text.secondary">
          No versions created yet.
        </Typography>
      ) : (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <MetricChart
              title="Accuracy (%)"
              dataKey="accuracy"
              color="#22c55e"
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <MetricChart
              title="Precision (%)"
              dataKey="precision"
              color="#6366f1"
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <MetricChart
              title="Recall (%)"
              dataKey="recall"
              color="#f97316"
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <MetricChart
              title="F1 Score (%)"
              dataKey="f1_score"
              color="#ec4899"
            />
          </Grid>
        </Grid>
      )}
    </Box>
  );
}
