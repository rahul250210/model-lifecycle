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
  List,
  ListItem,
  ListItemText,
  Button,
} from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
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
  type: string;
  size: number;
}

interface ExperimentRun {
  id: number;
  run_name: string;
  status: "RUNNING" | "FINISHED" | "FAILED";
  params: Record<string, string | number>;
  metrics: Record<string, number>;
  artifacts: Artifact[];
  linked_version?: string;
  started_at: string;
  finished_at?: string;
}

/* =======================
   Component
======================= */

export default function ExperimentRun() {
  const { factoryId, algorithmId, modelId, experimentId, runId } =
    useParams();
  const navigate = useNavigate();

  const [run, setRun] = useState<ExperimentRun | null>(null);
  const [loading, setLoading] = useState(true);

  /* =======================
     Fetch run
  ======================= */

  useEffect(() => {
    const fetchRun = async () => {
      try {
        const res = await axios.get(
          `/factories/${factoryId}/algorithms/${algorithmId}/models/${modelId}/experiments/${experimentId}/runs/${runId}`
        );
        setRun(res.data);
      } catch (err) {
        console.error("Failed to load experiment run", err);
      } finally {
        setLoading(false);
      }
    };

    fetchRun();
  }, [
    factoryId,
    algorithmId,
    modelId,
    experimentId,
    runId,
  ]);

  /* =======================
     Loading
  ======================= */

  if (loading || !run) {
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
     Status Icon
  ======================= */

  const statusIcon =
    run.status === "FINISHED" ? (
      <CheckCircleIcon color="success" />
    ) : run.status === "FAILED" ? (
      <ErrorIcon color="error" />
    ) : (
      <PlayArrowIcon color="primary" />
    );

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
              `/factories/${factoryId}/algorithms/${algorithmId}/models/${modelId}/experiments/${experimentId}`
            )
          }
          sx={{ mr: 2 }}
        >
          Back
        </Button>

        <Typography variant="h4" fontWeight={700}>
          Run: {run.run_name}
        </Typography>
      </Box>

      {/* =======================
          Run Overview
      ======================= */}
      <Card elevation={2} sx={{ borderRadius: 3, mb: 4 }}>
        <CardContent>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            {statusIcon}
            <Typography variant="h6" fontWeight={600}>
              Status: {run.status}
            </Typography>
          </Box>

          <Divider sx={{ my: 2 }} />

          <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
            <Chip
              label={`Started: ${new Date(
                run.started_at
              ).toLocaleString()}`}
            />
            {run.finished_at && (
              <Chip
                label={`Finished: ${new Date(
                  run.finished_at
                ).toLocaleString()}`}
              />
            )}
            {run.linked_version && (
              <Chip label={`Model Version: ${run.linked_version}`} />
            )}
          </Box>
        </CardContent>
      </Card>

      {/* =======================
          Params & Metrics
      ======================= */}
      <Grid container spacing={3}>
        {/* Params */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card elevation={2} sx={{ borderRadius: 3 }}>
            <CardContent>
              <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
                Parameters
              </Typography>

              {Object.keys(run.params).length === 0 ? (
                <Typography color="text.secondary">
                  No parameters logged.
                </Typography>
              ) : (
                <List dense>
                  {Object.entries(run.params).map(([k, v]) => (
                    <ListItem key={k}>
                      <ListItemText
                        primary={k}
                        secondary={String(v)}
                        slotProps={{
                          primary: { sx: { wordBreak: 'break-all' } },
                          secondary: { sx: { wordBreak: 'break-all' } }
                        }}
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Metrics */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card elevation={2} sx={{ borderRadius: 3 }}>
            <CardContent>
              <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
                Metrics
              </Typography>

              {Object.keys(run.metrics).length === 0 ? (
                <Typography color="text.secondary">
                  No metrics logged.
                </Typography>
              ) : (
                <List dense>
                  {Object.entries(run.metrics).map(([k, v]) => (
                    <ListItem key={k}>
                      <ListItemText
                        primary={k}
                        secondary={v}
                        slotProps={{
                          primary: { sx: { wordBreak: 'break-all' } },
                          secondary: { sx: { wordBreak: 'break-all' } }
                        }}
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* =======================
          Artifacts
      ======================= */}
      <Card elevation={2} sx={{ borderRadius: 3, mt: 4 }}>
        <CardContent>
          <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
            Artifacts
          </Typography>

          {run.artifacts.length === 0 ? (
            <Typography color="text.secondary">
              No artifacts uploaded.
            </Typography>
          ) : (
            <List>
              {run.artifacts.map((a) => (
                <ListItem
                  key={a.id}
                  secondaryAction={
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
                  }
                >
                  <ListItemText
                    primary={a.name}
                    secondary={`${a.type} • ${(a.size / 1024).toFixed(
                      2
                    )} KB`}
                    slotProps={{
                      primary: { sx: { wordBreak: 'break-all' } },
                      secondary: { sx: { wordBreak: 'break-all' } }
                    }}
                  />
                </ListItem>
              ))}
            </List>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
