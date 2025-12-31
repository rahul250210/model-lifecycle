"use client";

import { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  CircularProgress,
  Divider,
  Chip,
} from "@mui/material";
import FactoryIcon from "@mui/icons-material/Factory";
import SchemaIcon from "@mui/icons-material/Schema";
import HubIcon from "@mui/icons-material/Hub";
import AddIcon from "@mui/icons-material/Add";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import axios from "../../api/axios";

/* =======================
   Types
======================= */

interface Factory {
  id: number;
  name: string;
  description?: string;
  algorithms_count: number;
  models_count: number;
  created_at: string;
}

interface Algorithm {
  id: number;
  name: string;
  models_count: number;
  created_at: string;
}

/* =======================
   Component
======================= */

export default function FactoryOverview() {
  const { factoryId } = useParams();
  const navigate = useNavigate();

  const [factory, setFactory] = useState<Factory | null>(null);
  const [algorithms, setAlgorithms] = useState<Algorithm[]>([]);
  const [loading, setLoading] = useState(true);

  /* =======================
     Fetch data
  ======================= */

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [factoryRes, algoRes] = await Promise.all([
          axios.get(`/factories/${factoryId}`),
          axios.get(`/factories/${factoryId}/algorithms`),
        ]);

        setFactory(factoryRes.data);
        setAlgorithms(algoRes.data);
      } catch (err) {
        console.error("Failed to load factory overview", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [factoryId]);

  /* =======================
     Loading State
  ======================= */

  if (loading || !factory) {
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
          onClick={() => navigate("/factories")}
          sx={{ mr: 2 }}
        >
          Back
        </Button>

        <Typography variant="h4" fontWeight={700}>
          {factory.name}
        </Typography>
      </Box>

      {/* =======================
          Factory Summary
      ======================= */}
      <Card elevation={2} sx={{ borderRadius: 3, mb: 4 }}>
        <CardContent>
          <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
            <FactoryIcon color="primary" sx={{ mr: 1 }} />
            <Typography variant="h6" fontWeight={600}>
              Factory Overview
            </Typography>
          </Box>

          <Typography color="text.secondary" sx={{ mb: 2 }}>
            {factory.description || "No description provided."}
          </Typography>

          <Divider sx={{ mb: 2 }} />

          <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
            <Chip
              icon={<SchemaIcon />}
              label={`${factory.algorithms_count} Algorithms`}
            />
            <Chip
              icon={<HubIcon />}
              label={`${factory.models_count} Models`}
            />
            <Chip
              label={`Created on ${new Date(
                factory.created_at
              ).toLocaleDateString()}`}
            />
          </Box>
        </CardContent>
      </Card>

      {/* =======================
          Algorithms Section
      ======================= */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 2,
        }}
      >
        <Typography variant="h5" fontWeight={600}>
          Algorithms
        </Typography>

        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() =>
            navigate(`/factories/${factory.id}/algorithms/create`)
          }
        >
          Create Algorithm
        </Button>
      </Box>

      {/* =======================
          Algorithm Cards
      ======================= */}
      {algorithms.length === 0 ? (
        <Typography color="text.secondary" sx={{ mt: 4 }}>
          No algorithms created yet.
        </Typography>
      ) : (
        <Grid container spacing={3}>
          {algorithms.map((algo) => (
            <Grid  xs={12} sm={6} md={4} lg={3} key={algo.id}>
              <motion.div whileHover={{ scale: 1.03 }}>
                <Card
                  elevation={1}
                  sx={{
                    borderRadius: 3,
                    cursor: "pointer",
                    height: "100%",
                  }}
                  onClick={() =>
                    navigate(
                      `/factories/${factory.id}/algorithms/${algo.id}/models`
                    )
                  }
                >
                  <CardContent>
                    <Typography variant="h6" fontWeight={600}>
                      {algo.name}
                    </Typography>

                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mt: 1 }}
                    >
                      {algo.models_count} Models
                    </Typography>

                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ mt: 2, display: "block" }}
                    >
                      Created on{" "}
                      {new Date(algo.created_at).toLocaleDateString()}
                    </Typography>
                  </CardContent>
                </Card>
              </motion.div>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
}
