"use client";

import { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  TextField,
  CircularProgress,
  IconButton,
  alpha,
  Container,
  Paper,
  Stack,
  FormControlLabel,
  Switch,
  Grid,
  Divider,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DescriptionIcon from "@mui/icons-material/Description";
import AssessmentIcon from "@mui/icons-material/Assessment";
import SettingsIcon from "@mui/icons-material/Settings";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import InventoryIcon from "@mui/icons-material/Inventory";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { useNavigate, useParams } from "react-router-dom";
import axios from "../../api/axios";

const ALLOWED_MODEL_EXTENSIONS = [
  ".pt",
  ".pth",
  ".onnx",
  ".h5",
  ".ckpt",
];

const ALLOWED_CODE_EXTENSIONS = [".py"];


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

export default function VersionEdit() {
  const { factoryId, algorithmId, modelId, versionId } = useParams();
  const navigate = useNavigate();

  const [note, setNote] = useState("");
  const [isActive, setIsActive] = useState(false);
  const [metrics, setMetrics] = useState({
    accuracy: "",
    precision: "",
    recall: "",
    f1_score: "",
  });

  const [parameters, setParameters] = useState({
    batch_size: "",
    epochs: "",
    learning_rate: "",
    optimizer: "",
    image_size: "",
  });

  // Artifact States
  const [datasetFiles, setDatasetFiles] = useState<File[]>([]);
  const [labelFiles, setLabelFiles] = useState<File[]>([]);

  const [modelFiles, setModelFiles] = useState<File[]>([]);
  const [codeFile, setCodeFile] = useState<File | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const hasValidExtension = (file: File, allowed: string[]) => {
    const name = file.name.toLowerCase();
    return allowed.some((ext) => name.endsWith(ext));
  };

  const mergeUniqueFiles = (prev: File[], next: File[]) => {
    const map = new Map<string, File>();
    [...prev, ...next].forEach((f) =>
      map.set(`${f.name}-${f.size}`, f)
    );
    return Array.from(map.values());
  };

  useEffect(() => {
    const fetchVersion = async () => {
      try {
        const res = await axios.get(
          `/factories/${factoryId}/algorithms/${algorithmId}/models/${modelId}/versions/${versionId}`
        );
        const data = res.data;
        setNote(data.note || "");
        setIsActive(data.is_active || false);
        setMetrics({
          accuracy: data.accuracy?.toString() || "",
          precision: data.precision?.toString() || "",
          recall: data.recall?.toString() || "",
          f1_score: data.f1_score?.toString() || "",
        });
        setParameters({
          batch_size: data.parameters?.batch_size?.toString() || "",
          epochs: data.parameters?.epochs?.toString() || "",
          learning_rate: data.parameters?.learning_rate?.toString() || "",
          optimizer: data.parameters?.optimizer || "",
          image_size: data.parameters?.image_size?.toString() || "",
        });

      } catch (err) {
        console.error("Failed to load version", err);
        setError("Failed to load version details");
      } finally {
        setLoading(false);
      }
    };
    fetchVersion();
  }, [factoryId, algorithmId, modelId, versionId]);

  

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

  const addModelFiles = (files: File[]) => {
  const valid = files.filter(f =>
    ALLOWED_MODEL_EXTENSIONS.some(ext =>
      f.name.toLowerCase().endsWith(ext)
    )
  );

  setModelFiles(prev => {
      const map = new Map<string, File>();
      [...prev, ...valid].forEach(f => map.set(`${f.name}-${f.size}`, f));
      return Array.from(map.values());
    });
  };

  const removeModelFile = (index: number) => {
    setModelFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
  try {
    setSaving(true);
    setError("");
   
    if (codeFile && !hasValidExtension(codeFile, ALLOWED_CODE_EXTENSIONS)) {
        setError("Invalid code file format.");
        return;
      }

    const formData = new FormData();
    formData.append("note", note);

   Object.entries(metrics).forEach(([key, value]) => {
      if (value !== "") {
        formData.append(key, value);
      }
    });

   Object.entries(parameters).forEach(([key, value]) => {
      if (value !== "") {
        formData.append(key, value);
      }
    });


    if (datasetFiles.length > 0) {
          datasetFiles.forEach((f) =>
            formData.append("dataset_files", f)
          );
    }

    if (labelFiles.length > 0) {
          labelFiles.forEach((f) =>
            formData.append("label_files", f)
          );
    }
    
    if (modelFiles.length > 0){
          modelFiles.forEach((f) => {
              formData.append("model_files", f);
            });
    }
    if (codeFile) formData.append("code", codeFile);

    // 1️⃣ Edit version (files + metrics)
    await axios.post(
      `/factories/${factoryId}/algorithms/${algorithmId}/models/${modelId}/versions/${versionId}/edit`,
      formData
    );

    // 2️⃣ Activate version if toggle ON
    if (isActive) {
      await axios.post(
        `/factories/${factoryId}/algorithms/${algorithmId}/models/${modelId}/versions/${versionId}/checkout`
      );
    }

    navigate(
      `/factories/${factoryId}/algorithms/${algorithmId}/models/${modelId}/versions/${versionId}`
    );
  } catch (err) {
    console.error("Failed to update version", err);
    setError("Failed to save changes.");
  } finally {
    setSaving(false);
  }
};


  if (loading) {
    return (
      <Box sx={{ height: "100vh", display: "flex", justifyContent: "center", alignItems: "center", bgcolor: themePalette.background }}>
        <CircularProgress size={40} sx={{ color: themePalette.primary }} />
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: themePalette.background, pb: 10 }}>
      <Container maxWidth="md">
        {/* Header Section */}
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
              Edit Version Artifacts
            </Typography>
            <Typography variant="body2" sx={{ color: themePalette.textMuted, fontWeight: 500 }}>
              Update model metadata, evaluation metrics, and replace production files.
            </Typography>
          </Box>
        </Box>

        <Stack spacing={4}>
          {/* Artifact Management Section */}
          <Card elevation={0} sx={{ borderRadius: "24px", border: `1px solid ${themePalette.border}` }}>
            <CardContent sx={{ p: 4 }}>
              <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 3 }}>
                <InventoryIcon sx={{ color: themePalette.primary }} />
                <Typography variant="h6" fontWeight={800}>File Management</Typography>
              </Stack>
              
              <Grid container spacing={4}>
  {/* ================= REPLACE DATASET ================= */}
  <Grid item xs={12} md={3}>
    <Stack spacing={1.5} alignItems="center">
      <Typography variant="caption" fontWeight={700} sx={{ color: themePalette.textMuted }}>
        REPLACE DATASET
      </Typography>

     <Button
        component="label"
        fullWidth
        startIcon={<UploadFileIcon />}
        {...getButtonProps(datasetFiles.length > 0)}
      >
        Replace Dataset
        <input
          hidden
          type="file"
          webkitdirectory="true"
          multiple
          onChange={(e) => {
            if (!e.target.files) return;
            setDatasetFiles(Array.from(e.target.files)); // 🔁 REPLACE
            e.target.value = "";
          }}
        />
      </Button>
     

    </Stack>
  </Grid>

  {/* ================= REPLACE LABELS ================= */}
  <Grid item xs={12} md={3}>
    <Stack spacing={1.5} alignItems="center">
      <Typography variant="caption" fontWeight={700} sx={{ color: themePalette.textMuted }}>
        REPLACE LABELS
      </Typography>

      <Button
        component="label"
        fullWidth
        startIcon={<UploadFileIcon />}
        {...getButtonProps(labelFiles.length > 0)}
      >
        Replace Labels
        <input
          hidden
          type="file"
          webkitdirectory="true"
          multiple
          accept=".txt,.json,.xml"
          onChange={(e) => {
            if (!e.target.files) return;
            setLabelFiles(Array.from(e.target.files)); // 🔁 REPLACE
            e.target.value = "";
          }}
        />
      </Button>

     

    </Stack>
  </Grid>

  {/* ================= REPLACE MODEL ================= */}
 <Grid item xs={12} md={3}>
  <Stack spacing={1.5} alignItems="center">
    <Typography
      variant="caption"
      fontWeight={700}
      sx={{ color: themePalette.textMuted }}
    >
      ADD MODELS
    </Typography>

    <Button
      component="label"
      fullWidth
      startIcon={
        modelFiles.length > 0 ? <CheckCircleIcon /> : <UploadFileIcon />
      }
      {...getButtonProps(modelFiles.length > 0)}
    >
      {modelFiles.length > 0
        ? `${modelFiles.length} Models Selected`
        : "Add Model Files"}
      <input
        hidden
        type="file"
        multiple
        onChange={(e) => {
          if (e.target.files) {
            addModelFiles(Array.from(e.target.files));
          }
        }}
      />
    </Button>

    {/* Selected models list */}
    {modelFiles.map((file, idx) => (
      <Paper
        key={idx}
        variant="outlined"
        sx={{
          width: "100%",
          px: 1.5,
          py: 1,
          borderRadius: "10px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: 13,
        }}
      >
        <Typography
          variant="caption"
          sx={{
            maxWidth: 150,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {file.name}
        </Typography>

        <IconButton
          size="small"
          color="error"
          onClick={() => removeModelFile(idx)}
        >
          ✕
        </IconButton>
      </Paper>
    ))}
  </Stack>
</Grid>


  {/* ================= REPLACE CODE ================= */}
  <Grid item xs={12} md={3}>
    <Stack spacing={1.5} alignItems="center">
      <Typography variant="caption" fontWeight={700} sx={{ color: themePalette.textMuted }}>
        REPLACE CODE
      </Typography>

      <Button
        component="label"
        fullWidth
        startIcon={codeFile ? <CheckCircleIcon /> : <UploadFileIcon />}
        {...getButtonProps(!!codeFile)}
      >
        {codeFile ? "New Script Selected" : "Replace Script"}
        <input
          hidden
          type="file"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            if (!hasValidExtension(file, ALLOWED_CODE_EXTENSIONS)) {
              setError("Only .py allowed");
              return;
            }
            setError("");
            setCodeFile(file);
          }}
        />
      </Button>
    </Stack>
  </Grid>
</Grid>

              
            </CardContent>
          </Card>

          {/* Metrics Section */}
          <Card elevation={0} sx={{ borderRadius: "24px", border: `1px solid ${themePalette.border}` }}>
            <CardContent sx={{ p: 4 }}>
              <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 3 }}>
                <AssessmentIcon sx={{ color: themePalette.primary }} />
                <Typography variant="h6" fontWeight={800}>Performance Evaluation</Typography>
              </Stack>
              <Grid container spacing={3}>
                {Object.entries(metrics).map(([key, value]) => (
                  <Grid item xs={12} sm={3} key={key}>
                    <Typography variant="body2" fontWeight={700} sx={{ mb: 1, color: themePalette.textMain, textTransform: 'capitalize' }}>{key.replace('_', ' ')}</Typography>
                    <TextField
                      fullWidth
                      type="number"
                      placeholder="0.00"
                      inputProps={{ step: "0.01", min: 0, max: 100 }}
                      value={value}
                      onChange={(e) => setMetrics({ ...metrics, [key]: e.target.value })}
                      sx={{ "& .MuiOutlinedInput-root": { borderRadius: "12px", bgcolor: themePalette.background } }}
                    />
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>
          
          <Card elevation={0} sx={{ borderRadius: "24px", border: `1px solid ${themePalette.border}` }}>
            <CardContent sx={{ p: 4 }}>
              <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 3 }}>
                <SettingsIcon sx={{ color: themePalette.primary }} />
                <Typography variant="h6" fontWeight={800}>
                  Training Parameters
                </Typography>
              </Stack>

              <Grid container spacing={3}>
                {Object.entries(parameters).map(([key, value]) => (
                  <Grid item xs={12} sm={6} key={key}>
                    <Typography
                      variant="caption"
                      fontWeight={800}
                      sx={{ color: themePalette.textMuted, textTransform: "uppercase" }}
                    >
                      {key.replace("_", " ")}
                    </Typography>

                    <TextField
                      fullWidth
                      value={value}
                      onChange={(e) =>
                        setParameters({ ...parameters, [key]: e.target.value })
                      }
                      sx={{
                        "& .MuiOutlinedInput-root": {
                          borderRadius: "12px",
                          bgcolor: themePalette.background,
                        },
                      }}
                    />
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>

          {/* Status Section */}
          <Card elevation={0} sx={{ borderRadius: "24px", border: `1px solid ${themePalette.border}` }}>
            <CardContent sx={{ p: 4 }}>
              <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 3 }}>
                <SettingsIcon sx={{ color: themePalette.primary }} />
                <Typography variant="h6" fontWeight={800}>Deployment Settings</Typography>
              </Stack>
              <Paper variant="outlined" sx={{ p: 2, borderRadius: "16px", display: "flex", alignItems: "center", justifyContent: "space-between", borderColor: isActive ? themePalette.success : themePalette.border }}>
                <Box>
                  <Typography variant="body2" fontWeight={700}>Active Production Status</Typography>
                  <Typography variant="caption" color="text.secondary">Set this as the primary active version for production inference.</Typography>
                </Box>
                <FormControlLabel control={<Switch checked={isActive} onChange={(e) => setIsActive(e.target.checked)} color="success" />} label="" />
              </Paper>
            </CardContent>
          </Card>

          {/* Notes Section */}
          <Card elevation={0} sx={{ borderRadius: "24px", border: `1px solid ${themePalette.border}` }}>
            <CardContent sx={{ p: 4 }}>
              <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 3 }}>
                <DescriptionIcon sx={{ color: themePalette.primary }} />
                <Typography variant="h6" fontWeight={800}>Revision Context</Typography>
              </Stack>
              <TextField fullWidth multiline rows={3} placeholder="Describe the changes made in this revision..." value={note} onChange={(e) => setNote(e.target.value)}
                sx={{ "& .MuiOutlinedInput-root": { borderRadius: "16px", bgcolor: themePalette.background } }}
              />
            </CardContent>
          </Card>

          {error && (
            <Paper elevation={0} sx={{ p: 2, bgcolor: "#FEF2F2", border: "1px solid #FEE2E2", borderRadius: "12px" }}>
              <Typography variant="body2" fontWeight={600} color="#B91C1C">{error}</Typography>
            </Paper>
          )}

          <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 2 }}>
            <Button variant="text" onClick={() => navigate(-1)} sx={{ px: 4, borderRadius: "12px", fontWeight: 700, color: themePalette.textMuted }}>Discard</Button>
            <Button variant="contained" onClick={handleSave} disabled={saving}
              sx={{ px: 6, py: 1.5, borderRadius: "14px", bgcolor: themePalette.primary, fontWeight: 700, boxShadow: `0 10px 15px -3px ${alpha(themePalette.primary, 0.3)}` }}
            >
              {saving ? <CircularProgress size={24} color="inherit" /> : "Commit Changes"}
            </Button>
          </Box>
        </Stack>
      </Container>
    </Box>
  );
}