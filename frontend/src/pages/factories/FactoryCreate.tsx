"use client";

import { useState } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  CircularProgress,
  Divider,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import FactoryIcon from "@mui/icons-material/Factory";
import { useNavigate } from "react-router-dom";
import axios from "../../api/axios";

/* =======================
   Component
======================= */

export default function FactoryCreate() {
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  /* =======================
     Submit Handler
  ======================= */

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError("Factory name is required");
      return;
    }

    try {
      setLoading(true);
      setError("");

      await axios.post("/factories", {
        name,
        description,
      });

      navigate("/factories");
    } catch (err) {
      console.error(err);
      setError("Failed to create factory. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: 4, maxWidth: 900, mx: "auto" }}>
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
          Create Factory
        </Typography>
      </Box>

      {/* =======================
          Card
      ======================= */}
      <Card elevation={2} sx={{ borderRadius: 3 }}>
        <CardContent sx={{ p: 4 }}>
          {/* Title */}
          <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
            <FactoryIcon color="primary" sx={{ mr: 1 }} />
            <Typography variant="h6" fontWeight={600}>
              Factory Details
            </Typography>
          </Box>

          <Divider sx={{ mb: 3 }} />

          {/* Factory Name */}
          <TextField
            label="Factory Name"
            placeholder="e.g. Suwon, Sejong, Bhushan"
            fullWidth
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            sx={{ mb: 3 }}
          />

          {/* Description */}
          <TextField
            label="Description (optional)"
            placeholder="Describe the purpose of this factory"
            fullWidth
            multiline
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            sx={{ mb: 3 }}
          />

          {/* Error */}
          {error && (
            <Typography color="error" sx={{ mb: 2 }}>
              {error}
            </Typography>
          )}

          {/* Actions */}
          <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 2 }}>
            <Button
              variant="outlined"
              onClick={() => navigate("/factories")}
              disabled={loading}
            >
              Cancel
            </Button>

            <Button
              variant="contained"
              onClick={handleSubmit}
              disabled={loading}
              sx={{ px: 4 }}
            >
              {loading ? (
                <CircularProgress size={22} color="inherit" />
              ) : (
                "Create Factory"
              )}
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
