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
  IconButton,
  alpha,
  Paper,
  Stack,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import FactoryIcon from "@mui/icons-material/Factory";
import DescriptionIcon from "@mui/icons-material/Description";
import { useNavigate } from "react-router-dom";
import axios from "../../api/axios";

/* ==========================================================================
   CONSISTENT THEME PALETTE
   ========================================================================== */
const themePalette = {
  primary: "#4F46E5",
  primaryLight: "#EEF2FF",
  textMain: "#1E293B",
  textMuted: "#64748B",
  background: "#F8FAFC",
  border: "#E2E8F0",
  white: "#FFFFFF",
};

export default function FactoryCreate() {
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
    <Box 
      sx={{ 
        p: { xs: 2, md: 4 }, 
        maxWidth: 700, 
        mx: "auto",
        animation: "fadeInUp 0.6s ease-out",
        "@keyframes fadeInUp": {
          "0%": { opacity: 0, transform: "translateY(20px)" },
          "100%": { opacity: 1, transform: "translateY(0)" }
        }
      }}
    >
      {/* Navigation Header */}
      <Box sx={{ display: "flex", alignItems: "center", mb: 4 }}>
        <IconButton 
          onClick={() => navigate("/factories")}
          sx={{ 
            mr: 2, 
            bgcolor: themePalette.white, 
            border: `1px solid ${themePalette.border}`,
            "&:hover": { bgcolor: themePalette.primaryLight, color: themePalette.primary }
          }}
        >
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Box>
          <Typography variant="h5" fontWeight={800} sx={{ color: themePalette.textMain, letterSpacing: "-0.02em" }}>
            Create New Factory
          </Typography>
          <Typography variant="body2" sx={{ color: themePalette.textMuted, fontWeight: 500 }}>
            Establish a new production environment for your models.
          </Typography>
        </Box>
      </Box>

      {/* Form Card */}
      <Card 
        elevation={0} 
        sx={{ 
          borderRadius: "24px", 
          border: `1px solid ${themePalette.border}`,
          bgcolor: themePalette.white,
          overflow: "hidden"
        }}
      >
        <Box 
          sx={{ 
            py: 2, 
            px: 4, 
            bgcolor: alpha(themePalette.primary, 0.03), 
            borderBottom: `1px solid ${themePalette.border}`,
            display: 'flex',
            alignItems: 'center',
            gap: 1.5
          }}
        >
          <FactoryIcon sx={{ color: themePalette.primary, fontSize: 20 }} />
          <Typography variant="subtitle2" fontWeight={700} sx={{ color: themePalette.primary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Configuration Details
          </Typography>
        </Box>

        <CardContent sx={{ p: 4 }}>
          <Stack spacing={4}>
            {/* Factory Name Input */}
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Typography variant="body2" fontWeight={700} sx={{ color: themePalette.textMain }}>
                  Factory Name
                </Typography>
                <Typography variant="caption" sx={{ color: "#EF4444" }}>*</Typography>
              </Box>
              <TextField
                placeholder="e.g. Neural Hub East, Silicon Valley Cluster"
                fullWidth
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (error) setError("");
                }}
                error={!!error}
                variant="outlined"
                sx={{
                  "& .MuiOutlinedInput-root": {
                    borderRadius: "12px",
                    bgcolor: "#FCFDFF",
                    transition: "all 0.2s",
                    "&:hover": { bgcolor: "#fff" },
                    "&.Mui-focused": { bgcolor: "#fff", boxShadow: `0 0 0 4px ${alpha(themePalette.primary, 0.1)}` }
                  }
                }}
              />
            </Box>

            {/* Description Input */}
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Typography variant="body2" fontWeight={700} sx={{ color: themePalette.textMain }}>
                  Description
                </Typography>
                <Typography variant="caption" sx={{ color: themePalette.textMuted }}>(Optional)</Typography>
              </Box>
              <TextField
                placeholder="Briefly explain the purpose of this production facility..."
                fullWidth
                multiline
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                variant="outlined"
                sx={{
                  "& .MuiOutlinedInput-root": {
                    borderRadius: "12px",
                    bgcolor: "#FCFDFF",
                    transition: "all 0.2s",
                    "&:hover": { bgcolor: "#fff" },
                    "&.Mui-focused": { bgcolor: "#fff", boxShadow: `0 0 0 4px ${alpha(themePalette.primary, 0.1)}` }
                  }
                }}
              />
            </Box>

            {/* Error Message */}
            {error && (
              <Paper 
                elevation={0} 
                sx={{ 
                  p: 1.5, 
                  bgcolor: "#FEF2F2", 
                  border: "1px solid #FEE2E2", 
                  borderRadius: "10px",
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <Typography variant="caption" fontWeight={600} sx={{ color: "#B91C1C" }}>
                  {error}
                </Typography>
              </Paper>
            )}

            {/* Action Buttons */}
            <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 2, pt: 2 }}>
              <Button
                variant="text"
                onClick={() => navigate("/factories")}
                disabled={loading}
                sx={{ 
                  px: 3, 
                  borderRadius: "10px", 
                  color: themePalette.textMuted, 
                  fontWeight: 700,
                  textTransform: 'none',
                  "&:hover": { bgcolor: alpha(themePalette.textMuted, 0.05) }
                }}
              >
                Cancel
              </Button>

              <Button
                variant="contained"
                onClick={handleSubmit}
                disabled={loading}
                sx={{ 
                  px: 4, 
                  py: 1.2,
                  borderRadius: "12px", 
                  bgcolor: themePalette.primary,
                  fontWeight: 700,
                  textTransform: 'none',
                  boxShadow: `0 10px 15px -3px ${alpha(themePalette.primary, 0.3)}`,
                  "&:hover": { 
                    bgcolor: "#4338CA",
                    boxShadow: `0 12px 20px -3px ${alpha(themePalette.primary, 0.4)}`
                  }
                }}
              >
                {loading ? (
                  <CircularProgress size={20} color="inherit" />
                ) : (
                  "Create Factory"
                )}
              </Button>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      {/* Subtle Bottom Tip */}
      <Box sx={{ mt: 4, display: 'flex', justifyContent: 'center' }}>
        <Paper 
          elevation={0} 
          sx={{ 
            px: 2, 
            py: 1, 
            borderRadius: "20px", 
            bgcolor: alpha(themePalette.textMuted, 0.05),
            display: 'flex',
            alignItems: 'center',
            gap: 1
          }}
        >
          <DescriptionIcon sx={{ fontSize: 14, color: themePalette.textMuted }} />
          <Typography variant="caption" sx={{ color: themePalette.textMuted, fontWeight: 500 }}>
            Factories act as root containers for your specific MLOps workflows.
          </Typography>
        </Paper>
      </Box>
    </Box>
  );
}