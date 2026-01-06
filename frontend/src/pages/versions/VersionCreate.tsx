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
  Tooltip,
} from "@mui/material";

import UploadFileIcon from "@mui/icons-material/UploadFile";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AssessmentIcon from "@mui/icons-material/Assessment";
import InventoryIcon from "@mui/icons-material/Inventory";
import DescriptionIcon from "@mui/icons-material/Description";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import HistoryEduIcon from "@mui/icons-material/HistoryEdu";
import { useNavigate, useParams } from "react-router-dom";
import axios from "../../api/axios";

const ALLOWED_MODEL_EXTENSIONS = [".pt", ".pth", ".onnx", ".h5", ".ckpt"];
const ALLOWED_CODE_EXTENSIONS = [".py"];
const ALLOWED_LABEL_EXTENSIONS = [".txt", ".json", ".xml"];

const themePalette = {
  primary: "#4F46E5",
  primaryLight: "#EEF2FF",
  textMain: "#1E293B",
  textMuted: "#64748B",
  background: "#F8FAFC",
  border: "#E2E8F0",
  white: "#FFFFFF",
  success: "#10B981",
  error: "#EF4444",
};

export default function VersionCreate() {
  const { factoryId, algorithmId, modelId } = useParams();
  const navigate = useNavigate();

  const [datasetFiles, setDatasetFiles] = useState<File[]>([]);
  const [labelFiles, setLabelFiles] = useState<File[]>([]);
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

  const mergeFiles = (prev: File[], next: File[]) => {
    const map = new Map<string, File>();
    [...prev, ...next].forEach((f) => map.set(`${f.name}-${f.size}`, f));
    return Array.from(map.values());
  };

  const filterLabelFiles = (files: File[]) =>
    files.filter((f) =>
      ALLOWED_LABEL_EXTENSIONS.some((ext) =>
        f.name.toLowerCase().endsWith(ext)
      )
    );

  const getButtonStyles = (isStaged: boolean) => ({
    width: "100%",
    py: 2.5,
    borderRadius: "16px",
    textTransform: "none",
    fontWeight: 700,
    border: isStaged ? `2px solid ${themePalette.success}` : `1px dashed ${themePalette.border}`,
    bgcolor: isStaged ? alpha(themePalette.success, 0.05) : themePalette.white,
    color: isStaged ? themePalette.success : themePalette.textMuted,
    transition: "all 0.3s ease",
    "&:hover": {
      bgcolor: isStaged ? alpha(themePalette.success, 0.1) : alpha(themePalette.primary, 0.05),
      borderColor: themePalette.primary,
    },
  });

  const handleSubmit = async () => {
    if (datasetFiles.length === 0 || !labelFiles.length || !modelFile) {
      setError("Dataset images, labels, and model file are required");
      return;
    }

    try {
      setLoading(true);
      setError("");
      const formData = new FormData();
      datasetFiles.forEach((f) => formData.append("dataset_files", f));
      labelFiles.forEach((f) => formData.append("label_files", f));
      formData.append("model", modelFile);
      if (codeFile) formData.append("code", codeFile);
      formData.append("note", note);
      Object.entries(metrics).forEach(([key, value]) => {
        if (value !== "") formData.append(key, value);
      });

      await axios.post(`/factories/${factoryId}/algorithms/${algorithmId}/models/${modelId}/versions`, formData);
      navigate(`/factories/${factoryId}/algorithms/${algorithmId}/models/${modelId}/versions`);
    } catch {
      setError("Failed to create version. Check file sizes and formats.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: themePalette.background, pb: 10 }}>
      <Container maxWidth="md">
        {/* HEADER */}
        <Box sx={{ pt: 6, pb: 4, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Stack direction="row" spacing={2} alignItems="center">
            <IconButton 
              onClick={() => navigate(-1)}
              sx={{ bgcolor: themePalette.white, border: `1px solid ${themePalette.border}`, '&:hover': { bgcolor: themePalette.primaryLight } }}
            >
              <ArrowBackIcon fontSize="small" />
            </IconButton>
            <Box>
              <Typography variant="h4" fontWeight={900} sx={{ color: themePalette.textMain, letterSpacing: "-0.02em" }}>
                Commit <Box component="span" sx={{ color: themePalette.primary }}>New Version</Box>
              </Typography>
              <Typography variant="body2" sx={{ color: themePalette.textMuted, fontWeight: 500 }}>
                Register a new iteration with optimized weights and updated datasets.
              </Typography>
            </Box>
          </Stack>
        </Box>

        <Stack spacing={4}>
          {/* STEP 1: DATASET ARTIFACTS */}
          <Card elevation={0} sx={{ borderRadius: "24px", border: `1px solid ${themePalette.border}` }}>
            <CardContent sx={{ p: 4 }}>
              <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 3 }}>
                <InventoryIcon sx={{ color: themePalette.primary }} />
                <Typography variant="h6" fontWeight={800}>Dataset Artifacts</Typography>
              </Stack>
              
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Button component="label" sx={getButtonStyles(datasetFiles.length > 0)} startIcon={datasetFiles.length > 0 ? <CheckCircleIcon /> : <FolderOpenIcon />}>
                    {datasetFiles.length > 0 ? `${datasetFiles.length} Images Staged` : "Upload Images Folder"}
                    <input hidden type="file" webkitdirectory="true" multiple  onChange={(e) => e.target.files && setDatasetFiles(mergeFiles(datasetFiles, Array.from(e.target.files)))} />
                  </Button>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Button component="label" sx={getButtonStyles(labelFiles.length > 0)} startIcon={labelFiles.length > 0 ? <CheckCircleIcon /> : <UploadFileIcon />}>
                    {labelFiles.length > 0 ? `${labelFiles.length} Labels Staged` : "Upload Labels Folder"}
                    <input hidden type="file" webkitdirectory="true" multiple onChange={(e) => e.target.files && setLabelFiles(mergeFiles(labelFiles, filterLabelFiles(Array.from(e.target.files))))} />
                  </Button>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* STEP 2: MODEL WEIGHTS */}
          <Card elevation={0} sx={{ borderRadius: "24px", border: `1px solid ${themePalette.border}` }}>
            <CardContent sx={{ p: 4 }}>
              <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 3 }}>
                <HistoryEduIcon sx={{ color: themePalette.primary }} />
                <Typography variant="h6" fontWeight={800}>Weights & Source</Typography>
              </Stack>
              
              <Stack spacing={2}>
                <Button component="label" sx={getButtonStyles(!!modelFile)} startIcon={modelFile ? <CheckCircleIcon /> : <UploadFileIcon />}>
                  {modelFile ? `Weights: ${modelFile.name}` : "Upload Model Weights (.pt, .pth, .onnx) *"}
                  <input hidden type="file" onChange={(e) => setModelFile(e.target.files?.[0] || null)} />
                </Button>

                <Button component="label" sx={getButtonStyles(!!codeFile)} startIcon={codeFile ? <CheckCircleIcon /> : <UploadFileIcon />}>
                  {codeFile ? `Script: ${codeFile.name}` : "Upload Training Script (.py) - optional"}
                  <input hidden type="file" onChange={(e) => setCodeFile(e.target.files?.[0] || null)} />
                </Button>
              </Stack>
            </CardContent>
          </Card>

          {/* STEP 3: PERFORMANCE METRICS */}
          <Card elevation={0} sx={{ borderRadius: "24px", border: `1px solid ${themePalette.border}` }}>
            <CardContent sx={{ p: 4 }}>
              <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 3 }}>
                <AssessmentIcon sx={{ color: themePalette.primary }} />
                <Typography variant="h6" fontWeight={800}>Evaluation Metrics</Typography>
              </Stack>
              
              <Grid container spacing={3}>
                {Object.keys(metrics).map((k) => (
                  <Grid item xs={12} sm={6} key={k}>
                    <Typography variant="caption" fontWeight={800} sx={{ color: themePalette.textMuted, mb: 1, display: 'block', textTransform: 'uppercase' }}>{k.replace('_', ' ')} (%)</Typography>
                    <TextField
                      fullWidth
                      placeholder="0.00"
                      value={(metrics as any)[k]}
                      onChange={(e) => setMetrics({ ...metrics, [k]: e.target.value })}
                      sx={{ "& .MuiOutlinedInput-root": { borderRadius: "12px", bgcolor: themePalette.background } }}
                    />
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>

          {/* FINAL NOTES */}
          <Card elevation={0} sx={{ borderRadius: "24px", border: `1px solid ${themePalette.border}` }}>
            <CardContent sx={{ p: 4 }}>
              <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
                <DescriptionIcon sx={{ color: themePalette.primary }} />
                <Typography variant="h6" fontWeight={800}>Version Summary</Typography>
              </Stack>
              <TextField
                fullWidth
                multiline
                rows={3}
                placeholder="What changes were made in this iteration? (e.g., Improved lighting augmentations)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                sx={{ "& .MuiOutlinedInput-root": { borderRadius: "16px", bgcolor: themePalette.background } }}
              />
            </CardContent>
          </Card>

          {error && (
            <Paper elevation={0} sx={{ p: 2, bgcolor: alpha(themePalette.error, 0.05), border: `1px solid ${themePalette.error}`, borderRadius: "12px" }}>
              <Typography color="error" variant="body2" fontWeight={700}>{error}</Typography>
            </Paper>
          )}

          {/* SUBMIT ACTION */}
          <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 2, pt: 2 }}>
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
                px: 6, py: 1.5, borderRadius: "14px", fontWeight: 700, textTransform: 'none',
                boxShadow: `0 10px 15px -3px ${alpha(themePalette.primary, 0.3)}` 
              }}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : "Commit Version"}
            </Button>
          </Box>
        </Stack>
      </Container>
    </Box>
  );
}