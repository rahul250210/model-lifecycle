"use client";

import { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  CircularProgress,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Chip,
} from "@mui/material";
import ScienceIcon from "@mui/icons-material/Science";
import AddIcon from "@mui/icons-material/Add";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useNavigate, useParams } from "react-router-dom";
import axios from "../../api/axios";

/* =======================
   Types
======================= */

interface Experiment {
  id: number;
  name: string;
  runs_count: number;
  best_metric?: number;
  metric_name?: string;
  updated_at: string;
}

/* =======================
   Component
======================= */

export default function ExperimentList() {
  const { factoryId, algorithmId, modelId } = useParams();
  const navigate = useNavigate();

  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [loading, setLoading] = useState(true);

  /* =======================
     Fetch experiments
  ======================= */

  useEffect(() => {
    const fetchExperiments = async () => {
      try {
        const res = await axios.get(
          `/factories/${factoryId}/algorithms/${algorithmId}/models/${modelId}/experiments`
        );
        setExperiments(res.data);
      } catch (err) {
        console.error("Failed to load experiments", err);
      } finally {
        setLoading(false);
      }
    };

    fetchExperiments();
  }, [factoryId, algorithmId, modelId]);

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
              `/factories/${factoryId}/algorithms/${algorithmId}/models/${modelId}`
            )
          }
          sx={{ mr: 2 }}
        >
          Back
        </Button>

        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h4" fontWeight={700}>
            Experiments
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Track training runs and metrics
          </Typography>
        </Box>

        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() =>
            navigate(
              `/factories/${factoryId}/algorithms/${algorithmId}/models/${modelId}/experiments/create`
            )
          }
        >
          New Experiment
        </Button>
      </Box>

      {/* =======================
          Experiment Table
      ======================= */}
      {experiments.length === 0 ? (
        <Typography color="text.secondary">
          No experiments created yet.
        </Typography>
      ) : (
        <Card elevation={2} sx={{ borderRadius: 3 }}>
          <CardContent>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Experiment</TableCell>
                  <TableCell>Runs</TableCell>
                  <TableCell>Best Metric</TableCell>
                  <TableCell>Last Updated</TableCell>
                </TableRow>
              </TableHead>

              <TableBody>
                {experiments.map((exp) => (
                  <TableRow
                    key={exp.id}
                    hover
                    sx={{ cursor: "pointer" }}
                    onClick={() =>
                      navigate(
                        `/factories/${factoryId}/algorithms/${algorithmId}/models/${modelId}/experiments/${exp.id}`
                      )
                    }
                  >
                    <TableCell>
                      <Box sx={{ display: "flex", alignItems: "center" }}>
                        <ScienceIcon sx={{ mr: 1 }} color="primary" />
                        {exp.name}
                      </Box>
                    </TableCell>

                    <TableCell>
                      <Chip
                        label={`${exp.runs_count} runs`}
                        size="small"
                      />
                    </TableCell>

                    <TableCell>
                      {exp.best_metric !== undefined ? (
                        `${exp.metric_name}: ${exp.best_metric}`
                      ) : (
                        "—"
                      )}
                    </TableCell>

                    <TableCell>
                      {new Date(exp.updated_at).toLocaleString()}
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
