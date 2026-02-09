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

import { useTheme } from "../../theme/ThemeContext";

export default function FactoryCreate() {
  const navigate = useNavigate();
  const { theme } = useTheme();

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
    <Box sx={{ p: { xs: 2, md: 4 }, minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Navigation Header */}
      <Box sx={{ display: "flex", alignItems: "center", mb: 4 }}>
        <IconButton
          onClick={() => navigate("/factories")}
          sx={{
            mr: 2,
            bgcolor: theme.paper,
            border: `1px solid ${theme.border}`,
            "&:hover": { bgcolor: theme.primaryLight, color: theme.primary }
          }}
        >
          <ArrowBackIcon fontSize="small" sx={{ color: theme.textMain }} />
        </IconButton>
        <Box>
          <Typography variant="h5" fontWeight={800} sx={{ color: theme.textMain, letterSpacing: "-0.02em" }}>
            Create New Factory
          </Typography>
          <Typography variant="body2" sx={{ color: theme.textMuted, fontWeight: 500 }}>
            Establish a new production environment for your models.
          </Typography>
        </Box>
      </Box>

      <Box sx={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        animation: "fadeInUp 0.6s ease-out",
        "@keyframes fadeInUp": {
          "0%": { opacity: 0, transform: "translateY(20px)" },
          "100%": { opacity: 1, transform: "translateY(0)" }
        }
      }}>
        <Box sx={{ width: "100%", maxWidth: 700 }}>
          {/* Form Card */}
          <Card
            elevation={0}
            sx={{
              borderRadius: "24px",
              border: `1px solid ${theme.border}`,
              bgcolor: theme.paper,
              overflow: "hidden"
            }}
          >
            <Box
              sx={{
                py: 2,
                px: 4,
                bgcolor: alpha(theme.primary, 0.03),
                borderBottom: `1px solid ${theme.border}`,
                display: 'flex',
                alignItems: 'center',
                gap: 1.5
              }}
            >
              <FactoryIcon sx={{ color: theme.primary, fontSize: 20 }} />
              <Typography variant="subtitle2" fontWeight={700} sx={{ color: theme.primary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Configuration Details
              </Typography>
            </Box>

            <CardContent sx={{ p: 4 }}>
              <Stack spacing={4}>
                {/* Factory Name Input */}
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Typography variant="body2" fontWeight={700} sx={{ color: theme.textMain }}>
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
                        bgcolor: theme.background,
                        transition: "all 0.2s",
                        "&:hover": { bgcolor: theme.paper },
                        "&.Mui-focused": { bgcolor: theme.paper, boxShadow: `0 0 0 4px ${alpha(theme.primary, 0.1)}` },
                        "& .MuiOutlinedInput-input": { color: theme.textMain }
                      }
                    }}
                  />
                </Box>

                {/* Description Input */}
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Typography variant="body2" fontWeight={700} sx={{ color: theme.textMain }}>
                      Description
                    </Typography>
                    <Typography variant="caption" sx={{ color: theme.textMuted }}>(Optional)</Typography>
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
                        bgcolor: theme.background,
                        transition: "all 0.2s",
                        "&:hover": { bgcolor: theme.paper },
                        "&.Mui-focused": { bgcolor: theme.paper, boxShadow: `0 0 0 4px ${alpha(theme.primary, 0.1)}` },
                        "& .MuiOutlinedInput-input": { color: theme.textMain }
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
                      bgcolor: alpha(theme.danger, 0.05),
                      border: `1px solid ${theme.danger}`,
                      borderRadius: "10px",
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    <Typography variant="caption" fontWeight={600} sx={{ color: theme.danger }}>
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
                      color: theme.textMuted,
                      fontWeight: 700,
                      textTransform: 'none',
                      "&:hover": { bgcolor: alpha(theme.textMuted, 0.05) }
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
                      bgcolor: theme.primary,
                      fontWeight: 700,
                      textTransform: 'none',
                      boxShadow: `0 10px 15px -3px ${alpha(theme.primary, 0.3)}`,
                      "&:hover": {
                        bgcolor: "#4338CA",
                        boxShadow: `0 12px 20px -3px ${alpha(theme.primary, 0.4)}`
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
                bgcolor: alpha(theme.textMuted, 0.05),
                display: 'flex',
                alignItems: 'center',
                gap: 1
              }}
            >
              <DescriptionIcon sx={{ fontSize: 14, color: theme.textMuted }} />
              <Typography variant="caption" sx={{ color: theme.textMuted, fontWeight: 500 }}>
                Factories act as root containers for your specific MLOps workflows.
              </Typography>
            </Paper>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}