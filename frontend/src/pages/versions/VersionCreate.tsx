"use client";

import { useState } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  TextField,
  Divider,
  CircularProgress,
  Grid,
  IconButton,
  alpha,
  Container,
  Paper,
  Stack,
} from "@mui/material";

import UploadFileIcon from "@mui/icons-material/UploadFile";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AssessmentIcon from "@mui/icons-material/Assessment";
import InventoryIcon from "@mui/icons-material/Inventory";
import DescriptionIcon from "@mui/icons-material/Description";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { useNavigate, useParams } from "react-router-dom";
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
  success: "#10B981",
};

export default function VersionCreate() {
  const { factoryId, algorithmId, modelId } = useParams();
  const navigate = useNavigate();

  const [datasetFiles, setDatasetFiles] = useState<File[]>([]);
  const [datasetFolderSelected, setDatasetFolderSelected] = useState(false);
  const [datasetImagesSelected, setDatasetImagesSelected] = useState(false);

  const [modelFile, setModelFile] = useState<File | null>(null);
  const [codeFile, setCodeFile] = useState<File | null>(null);

  const [metrics, setMetrics] = useState({
    accuracy: "",
    precision: "",
    recall: "",
    f1_score: "",
  });

  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const addDatasetFiles = (files: File[]) => {
    setDatasetFiles((prev) => {
      const map = new Map<string, File>();
      [...prev, ...files].forEach((f) =>
        map.set(`${f.name}-${f.size}`, f)
      );
      return Array.from(map.values());
    });
  };

  const getButtonProps = (active: boolean) => ({
    variant: "outlined" as const,
    sx: {
      textTransform: "none",
      borderRadius: "12px",
      py: 1.5,
      border: active ? `2px solid ${themePalette.success}` : `1px dashed ${themePalette.border}`,
      bgcolor: active ? alpha(themePalette.success, 0.05) : "transparent",
      color: active ? themePalette.success : themePalette.textMuted,
      fontWeight: 700,
      "&:hover": {
        bgcolor: active ? alpha(themePalette.success, 0.08) : alpha(themePalette.primary, 0.04),
        borderColor: active ? themePalette.success : themePalette.primary,
      }
    },
  });

  const handleSubmit = async () => {
    if (datasetFiles.length === 0 || !modelFile) {
      setError("Dataset (folder or images) and Model file are required");
      return;
    }

    try {
      setLoading(true);
      setError("");
      const formData = new FormData();
      datasetFiles.forEach((f) => formData.append("dataset_files", f));
      formData.append("model", modelFile);
      if (codeFile) formData.append("code", codeFile);
      formData.append("note", note);
      Object.entries(metrics).forEach(([key, value]) => {
        if (value !== "") formData.append(key, value);
      });

      await axios.post(
        `/factories/${factoryId}/algorithms/${algorithmId}/models/${modelId}/versions`,
        formData
      );
      navigate(`/factories/${factoryId}/algorithms/${algorithmId}/models/${modelId}/versions`);
    } catch {
      setError("Failed to create version");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: themePalette.background, pb: 10 }}>
      <Container maxWidth="md">
        {/* Header */}
        <Box sx={{ pt: 4, pb: 4, display: "flex", alignItems: "center" }}>
          <IconButton 
            onClick={() => navigate(-1)}
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
            <Typography variant="h4" fontWeight={800} sx={{ color: themePalette.textMain, letterSpacing: "-0.02em" }}>
              New Model Iteration
            </Typography>
            <Typography variant="body2" sx={{ color: themePalette.textMuted, fontWeight: 500 }}>
              Upload artifacts and evaluation results to create a new version.
            </Typography>
          </Box>
        </Box>

        <Stack spacing={4}>
          {/* Artifacts Selection */}
          <Card elevation={0} sx={{ borderRadius: "24px", border: `1px solid ${themePalette.border}` }}>
            <CardContent sx={{ p: 4 }}>
              <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 3 }}>
                <InventoryIcon sx={{ color: themePalette.primary }} />
                <Typography variant="h6" fontWeight={800}>Required Artifacts</Typography>
              </Stack>
              
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" fontWeight={700} sx={{ color: themePalette.textMuted, mb: 1, display: 'block' }}>DATASET BUNDLE</Typography>
                  <Stack spacing={1.5}>
                    <Button component="label" startIcon={datasetFolderSelected ? <CheckCircleIcon /> : <UploadFileIcon />} {...getButtonProps(datasetFolderSelected)}>
                      Folder Upload
                      <input type="file" hidden multiple webkitdirectory="true" onChange={(e) => { if (e.target.files) { addDatasetFiles(Array.from(e.target.files)); setDatasetFolderSelected(true); } }} />
                    </Button>
                    <Button component="label" startIcon={datasetImagesSelected ? <CheckCircleIcon /> : <UploadFileIcon />} {...getButtonProps(datasetImagesSelected)}>
                      Image Selection
                      <input type="file" hidden multiple accept="image/*" onChange={(e) => { if (e.target.files) { addDatasetFiles(Array.from(e.target.files)); setDatasetImagesSelected(true); } }} />
                    </Button>
                  </Stack>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" fontWeight={700} sx={{ color: themePalette.textMuted, mb: 1, display: 'block' }}>WEIGHTS & SOURCE</Typography>
                  <Stack spacing={1.5}>
                    <Button component="label" startIcon={modelFile ? <CheckCircleIcon /> : <UploadFileIcon />} {...getButtonProps(!!modelFile)}>
                      Model weights (.pt, .h5) *
                      <input hidden type="file" onChange={(e) => setModelFile(e.target.files?.[0] || null)} />
                    </Button>
                    <Button component="label" startIcon={codeFile ? <CheckCircleIcon /> : <UploadFileIcon />} {...getButtonProps(!!codeFile)}>
                      Training script (optional)
                      <input hidden type="file" onChange={(e) => setCodeFile(e.target.files?.[0] || null)} />
                    </Button>
                  </Stack>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Metrics Input */}
          <Card elevation={0} sx={{ borderRadius: "24px", border: `1px solid ${themePalette.border}` }}>
            <CardContent sx={{ p: 4 }}>
              <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 3 }}>
                <AssessmentIcon sx={{ color: themePalette.primary }} />
                <Typography variant="h6" fontWeight={800}>Evaluation Metrics</Typography>
              </Stack>
              
              <Grid container spacing={3}>
                {[
                  ["accuracy", "Accuracy"],
                  ["precision", "Precision"],
                  ["recall", "Recall"],
                  ["f1_score", "F1 Score"],
                ].map(([key, label]) => (
                  <Grid item xs={12} sm={3} key={key}>
                    <Typography variant="body2" fontWeight={700} sx={{ mb: 1, color: themePalette.textMain }}>{label}</Typography>
                    <TextField
                      fullWidth
                      type="number"
                      placeholder="0.00"
                      inputProps={{ step: "0.01", min: 0, max: 1 }}
                      value={(metrics as any)[key]}
                      onChange={(e) => setMetrics({ ...metrics, [key]: e.target.value })}
                      sx={{
                        "& .MuiOutlinedInput-root": {
                          borderRadius: "12px",
                          bgcolor: themePalette.background,
                          "& fieldset": { borderColor: themePalette.border }
                        }
                      }}
                    />
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>

          {/* Note Input */}
          <Card elevation={0} sx={{ borderRadius: "24px", border: `1px solid ${themePalette.border}` }}>
            <CardContent sx={{ p: 4 }}>
              <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 3 }}>
                <DescriptionIcon sx={{ color: themePalette.primary }} />
                <Typography variant="h6" fontWeight={800}>Deployment Note</Typography>
              </Stack>
              <TextField
                fullWidth
                multiline
                rows={3}
                placeholder="Describe key changes in this version (e.g., hyperparameter tuning, new data augmentations)..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    borderRadius: "16px",
                    bgcolor: themePalette.background,
                    "& fieldset": { borderColor: themePalette.border }
                  }
                }}
              />
            </CardContent>
          </Card>

          {error && (
            <Paper elevation={0} sx={{ p: 2, bgcolor: "#FEF2F2", border: "1px solid #FEE2E2", borderRadius: "12px" }}>
              <Typography variant="body2" fontWeight={600} color="#B91C1C">{error}</Typography>
            </Paper>
          )}

          <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 2 }}>
            <Button 
              variant="text" 
              onClick={() => navigate(-1)}
              sx={{ px: 4, borderRadius: "12px", fontWeight: 700, color: themePalette.textMuted }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleSubmit}
              disabled={loading}
              sx={{ 
                px: 6, 
                py: 1.5,
                borderRadius: "14px", 
                bgcolor: themePalette.primary,
                fontWeight: 700,
                boxShadow: `0 10px 15px -3px ${alpha(themePalette.primary, 0.3)}`,
                "&:hover": { bgcolor: "#4338CA" }
              }}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : "Deploy Version"}
            </Button>
          </Box>
        </Stack>
      </Container>
    </Box>
  );
}