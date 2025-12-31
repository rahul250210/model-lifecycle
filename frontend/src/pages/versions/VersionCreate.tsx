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
} from "@mui/material";

import UploadFileIcon from "@mui/icons-material/UploadFile";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useNavigate, useParams } from "react-router-dom";
import axios from "../../api/axios";

export default function VersionCreate() {
  const { factoryId, algorithmId, modelId } = useParams();
  const navigate = useNavigate();

  /* =======================
     State
  ======================= */

  const [datasetFiles, setDatasetFiles] = useState<File[]>([]);
  const [datasetFolderSelected, setDatasetFolderSelected] = useState(false);
  const [datasetImagesSelected, setDatasetImagesSelected] = useState(false);

  const [modelFile, setModelFile] = useState<File | null>(null);
  const [codeFile, setCodeFile] = useState<File | null>(null);

  /* 🔥 Model evaluation metrics */
  const [metrics, setMetrics] = useState({
    accuracy: "",
    precision: "",
    recall: "",
    f1_score: "",
  });

  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  /* =======================
     Helpers
  ======================= */

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
    variant: active ? "contained" : "outlined",
    color: active ? "success" : "primary",
    sx: { textTransform: "none" },
  });

  /* =======================
     Submit
  ======================= */

  const handleSubmit = async () => {
    if (datasetFiles.length === 0 || !modelFile) {
      setError("Dataset (folder or images) and Model file are required");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const formData = new FormData();

      datasetFiles.forEach((f) =>
        formData.append("dataset_files", f)
      );

      formData.append("model", modelFile);
      if (codeFile) formData.append("code", codeFile);
      formData.append("note", note);

      /* 🔥 Send structured metrics */
      Object.entries(metrics).forEach(([key, value]) => {
        if (value !== "") {
          formData.append(key, value);
        }
      });

      await axios.post(
        `/factories/${factoryId}/algorithms/${algorithmId}/models/${modelId}/versions`,
        formData
      );

      navigate(
        `/factories/${factoryId}/algorithms/${algorithmId}/models/${modelId}/versions`
      );
    } catch {
      setError("Failed to create version");
    } finally {
      setLoading(false);
    }
  };

  /* =======================
     Render
  ======================= */

  return (
    <Box sx={{ p: 4, maxWidth: 1000, mx: "auto" }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", mb: 3 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)}>
          Back
        </Button>
        <Typography variant="h4" fontWeight={700} sx={{ ml: 2 }}>
          Create New Version
        </Typography>
      </Box>

      <Card>
        <CardContent>
          <Typography variant="h6" fontWeight={600}>
            Version Artifacts
          </Typography>

          <Divider sx={{ my: 2 }} />

          {/* ================= DATASET ================= */}
          <Grid container spacing={2}>
            <Grid item>
              <Button
                component="label"
                startIcon={<UploadFileIcon />}
                {...getButtonProps(datasetFolderSelected)}
              >
                Upload Dataset Folder
                <input
                  type="file"
                  hidden
                  multiple
                  webkitdirectory="true"
                  directory="true"
                  onChange={(e) => {
                    if (e.target.files) {
                      addDatasetFiles(Array.from(e.target.files));
                      setDatasetFolderSelected(true);
                    }
                  }}
                />
              </Button>
            </Grid>

            <Grid item>
              <Button
                component="label"
                startIcon={<UploadFileIcon />}
                {...getButtonProps(datasetImagesSelected)}
              >
                Upload Images
                <input
                  type="file"
                  hidden
                  multiple
                  accept="image/*"
                  onChange={(e) => {
                    if (e.target.files) {
                      addDatasetFiles(Array.from(e.target.files));
                      setDatasetImagesSelected(true);
                    }
                  }}
                />
              </Button>
            </Grid>

            {/* ================= MODEL ================= */}
            <Grid item>
              <Button
                component="label"
                startIcon={<UploadFileIcon />}
                {...getButtonProps(!!modelFile)}
              >
                Upload Model *
                <input
                  hidden
                  type="file"
                  onChange={(e) =>
                    setModelFile(e.target.files?.[0] || null)
                  }
                />
              </Button>
            </Grid>

            {/* ================= CODE ================= */}
            <Grid item>
              <Button
                component="label"
                startIcon={<UploadFileIcon />}
                {...getButtonProps(!!codeFile)}
              >
                Upload Training Code
                <input
                  hidden
                  type="file"
                  onChange={(e) =>
                    setCodeFile(e.target.files?.[0] || null)
                  }
                />
              </Button>
            </Grid>
          </Grid>

          {/* ================= METRICS ================= */}
          <Divider sx={{ my: 3 }} />
          <Typography variant="h6" fontWeight={600}>
            Model Evaluation Metrics
          </Typography>

          <Grid container spacing={2} sx={{ mt: 1 }}>
            {[
              ["accuracy", "Accuracy"],
              ["precision", "Precision"],
              ["recall", "Recall"],
              ["f1_score", "F1 Score"],
            ].map(([key, label]) => (
              <Grid item xs={12} sm={6} key={key}>
                <TextField
                  fullWidth
                  label={label}
                  type="number"
                  inputProps={{ step: "0.01", min: 0, max: 1 }}
                  value={(metrics as any)[key]}
                  onChange={(e) =>
                    setMetrics({ ...metrics, [key]: e.target.value })
                  }
                />
              </Grid>
            ))}
          </Grid>

          {/* ================= NOTE ================= */}
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Version Note"
            sx={{ mt: 3 }}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />

          {error && (
            <Typography color="error" sx={{ mt: 1 }}>
              {error}
            </Typography>
          )}

          <Box sx={{ textAlign: "right", mt: 3 }}>
            <Button
              variant="contained"
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? <CircularProgress size={20} /> : "Create Version"}
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
