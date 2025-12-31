"use client";

import { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  CircularProgress,
  Divider,
  Chip,
} from "@mui/material";
import CompareArrowsIcon from "@mui/icons-material/CompareArrows";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import axios from "../../api/axios";

/* =======================
   Types
======================= */

interface Version {
  id: number;
  version: string;
  parent_version_id?: number;
  metrics?: Record<string, number>;
  created_at: string;
  is_active: boolean;
}

/* =======================
   Component
======================= */

export default function VersionCompare() {
  const { factoryId, algorithmId, modelId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const leftId = searchParams.get("left");
  const rightId = searchParams.get("right");

  const [left, setLeft] = useState<Version | null>(null);
  const [right, setRight] = useState<Version | null>(null);
  const [loading, setLoading] = useState(true);

  /* =======================
     Fetch versions
  ======================= */

  useEffect(() => {
    const fetchVersions = async () => {
      try {
        const [l, r] = await Promise.all([
          axios.get(
            `/factories/${factoryId}/algorithms/${algorithmId}/models/${modelId}/versions/${leftId}`
          ),
          axios.get(
            `/factories/${factoryId}/algorithms/${algorithmId}/models/${modelId}/versions/${rightId}`
          ),
        ]);

        setLeft(l.data);
        setRight(r.data);
      } catch (err) {
        console.error("Failed to compare versions", err);
      } finally {
        setLoading(false);
      }
    };

    if (leftId && rightId) fetchVersions();
  }, [factoryId, algorithmId, modelId, leftId, rightId]);

  /* =======================
     Loading
  ======================= */

  if (loading || !left || !right) {
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
     Helpers
  ======================= */

  const allMetricKeys = Array.from(
    new Set([
      ...Object.keys(left.metrics || {}),
      ...Object.keys(right.metrics || {}),
    ])
  );

  return (
    <Box sx={{ p: 4 }}>
      {/* =======================
          Header
      ======================= */}
      <Box sx={{ display: "flex", alignItems: "center", mb: 3 }}>
        <ArrowBackIcon
          onClick={() =>
            navigate(
              `/factories/${factoryId}/algorithms/${algorithmId}/models/${modelId}/versions`
            )
          }
          style={{ cursor: "pointer", marginRight: 12 }}
        />
        <Typography variant="h4" fontWeight={700}>
          Compare Versions
        </Typography>
      </Box>

      {/* =======================
          Comparison Cards
      ======================= */}
      <Grid container spacing={3}>
        {[left, right].map((v, idx) => (
          <Grid  xs={12} md={6} key={v.id}>
            <Card elevation={2} sx={{ borderRadius: 3 }}>
              <CardContent>
                <Typography variant="h6" fontWeight={600}>
                  Version {v.version}
                </Typography>

                <Box sx={{ display: "flex", gap: 1, mt: 1 }}>
                  {v.is_active && (
                    <Chip
                      label="Active"
                      color="success"
                      size="small"
                    />
                  )}
                  {v.parent_version_id && (
                    <Chip
                      label={`Parent: v${v.parent_version_id}`}
                      size="small"
                    />
                  )}
                </Box>

                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: "block", mt: 2 }}
                >
                  Created on{" "}
                  {new Date(v.created_at).toLocaleString()}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* =======================
          Metrics Comparison
      ======================= */}
      <Card
        elevation={2}
        sx={{ borderRadius: 3, mt: 4 }}
      >
        <CardContent>
          <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
            <CompareArrowsIcon sx={{ mr: 1 }} />
            <Typography variant="h6" fontWeight={600}>
              Metrics Comparison
            </Typography>
          </Box>

          <Divider sx={{ mb: 2 }} />

          {allMetricKeys.length === 0 ? (
            <Typography color="text.secondary">
              No metrics available to compare.
            </Typography>
          ) : (
            <Grid container spacing={2}>
              {allMetricKeys.map((key) => {
                const l = left.metrics?.[key];
                const r = right.metrics?.[key];
                const diff =
                  l !== undefined && r !== undefined
                    ? (r - l).toFixed(4)
                    : "-";

                return (
                  <Grid  xs={12} key={key}>
                    <Box
                      sx={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr 1fr 1fr",
                        gap: 2,
                      }}
                    >
                      <Typography fontWeight={600}>
                        {key}
                      </Typography>
                      <Typography>
                        {l ?? "—"}
                      </Typography>
                      <Typography>
                        {r ?? "—"}
                      </Typography>
                      <Typography
                        color={
                          typeof diff === "string"
                            ? "text.secondary"
                            : Number(diff) >= 0
                            ? "success.main"
                            : "error.main"
                        }
                      >
                        {diff}
                      </Typography>
                    </Box>
                  </Grid>
                );
              })}
            </Grid>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
