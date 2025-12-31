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

export default function VersionEdit() {
  const { factoryId, algorithmId, modelId, versionId } = useParams();
  const navigate = useNavigate();

  const [datasetFiles, setDatasetFiles] = useState<File[]>([]);
  const [modelFile, setModelFile] = useState<File | null>(null);
  const [codeFile, setCodeFile] = useState<File | null>(null);
  const [metricsFile, setMetricsFile] = useState<File | null>(null);
  const [note, setNote] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    try {
      setLoading(true);
      setError("");

      const formData = new FormData();

      datasetFiles.forEach((file) => {
        formData.append("dataset_files", file);
      });

      if (modelFile) formData.append("model", modelFile);
      if (codeFile) formData.append("code", codeFile);
      if (metricsFile) formData.append("metrics", metricsFile);
      formData.append("note", note);

      await axios.post(
        `/factories/${factoryId}/algorithms/${algorithmId}/models/${modelId}/versions/${versionId}/edit`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );

      navigate(
        `/factories/${factoryId}/algorithms/${algorithmId}/models/${modelId}/versions`
      );
    } catch (err) {
      console.error(err);
      setError("Failed to edit version");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: 4, maxWidth: 1000, mx: "auto" }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", mb: 3 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() =>
            navigate(
              `/factories/${factoryId}/algorithms/${algorithmId}/models/${modelId}/versions`
            )
          }
          sx={{ mr: 2 }}
        >
          Back
        </Button>

        <Typography variant="h4" fontWeight={700}>
          Edit Version v{versionId}
        </Typography>
      </Box>

      <Card elevation={2} sx={{ borderRadius: 3 }}>
        <CardContent>
          <Typography variant="h6" fontWeight={600}>
            Replace Artifacts (Optional)
          </Typography>

          <Divider sx={{ my: 3 }} />

          <Grid container spacing={3}>
          
           {/* Dataset Folder Upload */}
            <Grid xs={12} md={6}>
            <Button
                component="label"
                fullWidth
                variant="outlined"
                startIcon={<UploadFileIcon />}
            >
                Upload Dataset Folder
                <input
                type="file"
                hidden
                multiple
                webkitdirectory="true"
                directory="true"
                onChange={(e) => {
                    const files = e.target.files ? Array.from(e.target.files) : [];
                    setDatasetFiles((prev) => [...prev, ...files]);
                }}
                />
            </Button>
            </Grid>

            {/* Dataset Images Upload */}
            <Grid xs={12} md={6}>
            <Button
                component="label"
                fullWidth
                variant="outlined"
                startIcon={<UploadFileIcon />}
            >
                Upload Dataset Images
                <input
                type="file"
                hidden
                multiple
                accept="image/*"
                onChange={(e) => {
                    const files = e.target.files ? Array.from(e.target.files) : [];
                    setDatasetFiles((prev) => [...prev, ...files]);
                }}
                />
            </Button>
            </Grid>


            {/* Model */}
            <Grid xs={12} md={6}>
              <Button component="label" fullWidth variant="outlined" startIcon={<UploadFileIcon />}>
                Replace Model
                <input type="file" hidden onChange={(e) => setModelFile(e.target.files?.[0] || null)} />
              </Button>
            </Grid>

            {/* Code */}
            <Grid xs={12} md={6}>
              <Button component="label" fullWidth variant="outlined" startIcon={<UploadFileIcon />}>
                Replace Code
                <input type="file" hidden onChange={(e) => setCodeFile(e.target.files?.[0] || null)} />
              </Button>
            </Grid>

            {/* Metrics */}
            <Grid xs={12} md={6}>
              <Button component="label" fullWidth variant="outlined" startIcon={<UploadFileIcon />}>
                Replace Metrics
                <input type="file" hidden accept=".json" onChange={(e) => setMetricsFile(e.target.files?.[0] || null)} />
              </Button>
            </Grid>
          </Grid>

          <TextField
            label="Edit Note"
            placeholder="e.g. Updated model weights"
            fullWidth
            multiline
            rows={3}
            sx={{ mt: 3 }}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />

          {error && (
            <Typography color="error" sx={{ mt: 2 }}>
              {error}
            </Typography>
          )}

          <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 2, mt: 4 }}>
            <Button variant="outlined" disabled={loading} onClick={() => navigate(-1)}>
              Cancel
            </Button>

            <Button variant="contained" disabled={loading} onClick={handleSubmit}>
              {loading ? <CircularProgress size={22} /> : "Save as New Version"}
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
