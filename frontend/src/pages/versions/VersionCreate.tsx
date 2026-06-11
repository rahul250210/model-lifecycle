"use client";

import { useEffect, useState, useRef } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  TextField,
  CircularProgress,
  Grid,
  IconButton,
  alpha,
  Container,
  Paper,
  Stack,
  Tooltip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from "@mui/material";

import UploadFileIcon from "@mui/icons-material/UploadFile";
import LayersIcon from "@mui/icons-material/Layers";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AssessmentIcon from "@mui/icons-material/Assessment";
import InventoryIcon from "@mui/icons-material/Inventory";
import DescriptionIcon from "@mui/icons-material/Description";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import HistoryEduIcon from "@mui/icons-material/HistoryEdu";
import { useNavigate, useParams } from "react-router-dom";
import SettingsIcon from "@mui/icons-material/Settings";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";

import axios from "../../api/axios";
import axiosBase from "axios";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../theme/ThemeContext";
import FileUploadDialog from "../../components/FileUploadDialog";
import { useBackgroundUploader } from "../../contexts/BackgroundUploaderContext";
import { PerformanceMetricsInput } from "../../components/versions/PerformanceMetricsInput";
import { ResourceMetricsInput } from "../../components/versions/ResourceMetricsInput";
import type { MetricItem } from "../../components/versions/ResourceMetricsInput";

const ALLOWED_MODEL_EXTENSIONS = [".pt", ".engine", ".pth", ".onnx", ".h5", ".ckpt"];
const ALLOWED_LABEL_EXTENSIONS = [".txt", ".json", ".xml"];
const ALLOWED_CODE_EXTENSIONS = [".py", ".cpp", ".c", ".h", ".hpp", ".cc", ".cxx", ".sh"];

const STANDARD_METRIC_KEYS = [
  "cpu_utilization", "gpu_utilization", "inference_time",
  "cpu_memory_usage", "gpu_memory_usage", "cameras_supported"
];

export default function VersionCreate() {
  const { factoryId, algorithmId, modelId } = useParams();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { queueUpload } = useBackgroundUploader();

  interface BaseVersionOption {
    id: number;
    version_number: number;
    accuracy?: number;
    model_name: string;
    factory_name: string;
    created_at: string;
  }

  const [baseVersions, setBaseVersions] = useState<BaseVersionOption[]>([]);
  const [baseVersionId, setBaseVersionId] = useState<number | "">("");

  useEffect(() => {
    const fetchBaseVersions = async () => {
      try {
        const res = await axios.get(`/algorithms/${algorithmId}/versions`);
        setBaseVersions(res.data);
      } catch (err) {
        console.error("Failed to load base versions", err);
      }
    };
    if (algorithmId) {
      fetchBaseVersions();
    }
  }, [algorithmId]);

  const datasetInputRef = useRef<HTMLInputElement>(null);
  const labelInputRef = useRef<HTMLInputElement>(null);

  const [datasetFiles, setDatasetFiles] = useState<File[]>([]);
  const [labelFiles, setLabelFiles] = useState<File[]>([]);
  const [modelFiles, setModelFiles] = useState<File[]>([]);
  const [codeFiles, setCodeFiles] = useState<File[]>([]);

  // Evaluation Metrics (Standard, Fixed)
  const [evalMetrics, setEvalMetrics] = useState({
    accuracy: "",
    precision: "",
    recall: "",
    f1_score: "",
    frame_tp: "",
    frame_tn: "",
    frame_fp: "",
    frame_fn: "",
    alert_tp: "",
    alert_tn: "",
    alert_fp: "",
    alert_fn: "",
  });

  // Resource Metrics (Dynamic, Addable/Deletable)
  const [resourceMetrics, setResourceMetrics] = useState<MetricItem[]>([
    { key: "cpu_utilization", value: "", unit: "%" },
    { key: "gpu_utilization", value: "", unit: "%" },
    { key: "inference_time", value: "", unit: "ms" },
    { key: "cpu_memory_usage", value: "", unit: "MB" },
    { key: "gpu_memory_usage", value: "", unit: "MB" },
    { key: "cameras_supported", value: "", unit: "Count" },
  ]);

  const [parameters, setParameters] = useState({
    batch_size: "",
    epochs: "",
    learning_rate: "",
    optimizer: "",
    image_size: "",
  });

  const [customParams, setCustomParams] = useState<{ key: string, value: string }[]>([]);

  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const abortControllerRef = useRef<AbortController | null>(null);

  const [isDraggingDataset, setIsDraggingDataset] = useState(false);
  const [isDraggingLabels, setIsDraggingLabels] = useState(false);
  const [isDraggingCode, setIsDraggingCode] = useState(false);

  const [datasetDialogOpen, setDatasetDialogOpen] = useState(false);
  const [labelDialogOpen, setLabelDialogOpen] = useState(false);

  // Helper to recursively get files from dropped items/folders
  const getAllFilesFromEntry = async (entry: any): Promise<File[]> => {
    const files: File[] = [];
    if (entry.isFile) {
      const file = await new Promise<File>((resolve, reject) => entry.file(resolve, reject));
      files.push(file);
    } else if (entry.isDirectory) {
      const directoryReader = entry.createReader();
      const entries = await new Promise<any[]>((resolve, reject) => {
        directoryReader.readEntries(resolve, reject);
      });
      for (const childEntry of entries) {
        files.push(...(await getAllFilesFromEntry(childEntry)));
      }
    }
    return files;
  };

  const handleDrop = async (e: React.DragEvent, type: 'dataset' | 'labels' | 'code') => {
    e.preventDefault();
    if (type === 'dataset') setIsDraggingDataset(false);
    else if (type === 'labels') setIsDraggingLabels(false);
    else setIsDraggingCode(false);

    const items = Array.from(e.dataTransfer.items);
    const files: File[] = [];

    for (const item of items) {
      const entry = item.webkitGetAsEntry();
      if (entry) {
        files.push(...(await getAllFilesFromEntry(entry)));
      }
    }

    if (type === 'dataset') setDatasetFiles(files);
    else if (type === 'labels') {
      const filtered = files.filter(f =>
        ALLOWED_LABEL_EXTENSIONS.some(ext => f.name.toLowerCase().endsWith(ext))
      );
      setLabelFiles(filtered);
    } else if (type === 'code') {
      const filtered = files.filter(f =>
        ALLOWED_CODE_EXTENSIONS.some(ext => f.name.toLowerCase().endsWith(ext))
      );
      setCodeFiles(prev => [...prev, ...filtered]);
    }
  };

  const filterLabelFiles = (files: File[]) =>
    files.filter((f) =>
      ALLOWED_LABEL_EXTENSIONS.some((ext) =>
        f.name.toLowerCase().endsWith(ext)
      )
    );

  const getButtonStyles = (isStaged: boolean, isDragging: boolean = false) => ({
    width: "100%",
    py: 2.0,
    borderRadius: "20px",
    textTransform: "none",
    display: 'flex',
    flexDirection: 'column',
    gap: 1,
    fontWeight: 700,
    border: isDragging
      ? `2px solid ${theme.primary}`
      : isStaged
        ? `2px solid ${theme.success}`
        : `1px dashed ${theme.border}`,
    bgcolor: isDragging
      ? alpha(theme.primary, 0.05)
      : isStaged
        ? alpha(theme.success, 0.05)
        : theme.paper,
    color: isDragging
      ? theme.primary
      : isStaged
        ? theme.success
        : theme.textMuted,
    transition: "all 0.3s ease",
    "&:hover": {
      bgcolor: isDragging ? alpha(theme.primary, 0.08) : alpha(theme.primary, 0.05),
      borderColor: theme.primary,
      // transform: "translateY(-2px)" // Removed bounce effect on hover
    },
  });

  const addModelFiles = (files: File[]) => {
    const valid = files.filter(f => ALLOWED_MODEL_EXTENSIONS.some(ext => f.name.toLowerCase().endsWith(ext)));

    setModelFiles(prev => {
      const newFiles = valid.filter(f => !prev.some(p => p.name === f.name && p.size === f.size));
      return [...prev, ...newFiles];
    });
  };

  const removeModelFile = (index: number) => {
    setModelFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const addCodeFiles = (files: File[]) => {
    const valid = files.filter(f =>
      ALLOWED_CODE_EXTENSIONS.some(ext => f.name.toLowerCase().endsWith(ext))
    );
    if (valid.length < files.length) {
      setError("Some code files were ignored due to invalid extensions.");
    }
    setCodeFiles(prev => [...prev, ...valid]);
  };

  const removeCodeFile = (index: number) => {
    setCodeFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    // Basic validation
    for (const m of resourceMetrics) {
      if (["cpu_utilization", "gpu_utilization"].includes(m.key)) {
        const val = parseFloat(m.value);
        if (!isNaN(val) && val > 100) {
          setError(`${m.key} cannot exceed 100%`);
          return;
        }
      }
    }

    // Validation for Evaluation Metrics
    const metricsToValidate = ['accuracy', 'precision', 'recall', 'f1_score'];
    for (const key of metricsToValidate) {
      const val = (evalMetrics as any)[key];
      if (val !== "") {
        const num = parseFloat(val);
        if (isNaN(num) || num < 0 || num > 100) {
          setError(`${key} must be between 0 and 100`);
          return;
        }
      }
    }

    if (!baseVersionId && datasetFiles.length === 0) {
      setError(t("versionCreate.datasetRequired"));
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      setLoading(true);
      setError("");
      const formData = new FormData();

      if (modelFiles.length > 0) {
        modelFiles.forEach((f) => formData.append("model_files", f, f.name));
      }

      if (codeFiles.length > 0) {
        codeFiles.forEach((f) => formData.append("code_files", f, f.name));
      }
      formData.append("note", note);

      // Add Evaluation Metrics
      Object.entries(evalMetrics).forEach(([key, value]) => {
        if (value !== "") formData.append(key, value);
      });

      // Separate Standard vs Custom Resource Metrics
      const customResourceMetrics: Record<string, any> = {};

      resourceMetrics.forEach((m) => {
        if (!m.key) return; // Skip empty keys

        if (STANDARD_METRIC_KEYS.includes(m.key)) {
          // It's a standard column
          if (m.value !== "") formData.append(m.key, m.value);
        } else {
          // It's custom
          if (m.value !== "") customResourceMetrics[m.key] = { value: m.value, unit: m.unit };
        }
      });

      if (Object.keys(customResourceMetrics).length > 0) {
        formData.append("custom_resource_metrics", JSON.stringify(customResourceMetrics));
      }


      Object.entries(parameters).forEach(([key, value]) => {
        if (value !== "") {
          formData.append(key, value);
        }
      });

      if (customParams.length > 0) {
        const customObj = customParams.reduce((acc, { key, value }) => {
          if (key.trim()) acc[key.trim()] = value;
          return acc;
        }, {} as Record<string, string>);
        formData.append("custom_params", JSON.stringify(customObj));
      }

      if (baseVersionId !== "") {
        formData.append("base_version_id", String(baseVersionId));
      }

      const response = await axios.post(`/algorithms/${algorithmId}/factories/${factoryId}/models/${modelId}/versions`, formData, {
        signal: controller.signal
      });

      const newVersion = response.data;

      // Queue heavy uploads
      if (datasetFiles.length > 0) {
        queueUpload(
          Number(factoryId),
          Number(algorithmId),
          Number(modelId),
          newVersion.id,
          newVersion.version_number,
          datasetFiles,
          "dataset"
        );
      }

      if (labelFiles.length > 0) {
        queueUpload(
          Number(factoryId),
          Number(algorithmId),
          Number(modelId),
          newVersion.id,
          newVersion.version_number,
          labelFiles,
          "label"
        );
      }

      navigate(`/algorithms/${algorithmId}/factories/${factoryId}/models/${modelId}/versions`);
    } catch (err: any) {
      if (err.name === 'AbortError' || axiosBase.isCancel(err)) {
        console.log("Version creation aborted - backend rollbacked.");
      } else {
        console.error(err);
        const msg = err.response?.data?.detail || err.message || "Failed to create version. Check file sizes and formats.";
        setError(msg);
      }
    } finally {
      if (abortControllerRef.current === controller) {
        setLoading(false);
        abortControllerRef.current = null;
      }
    }
  };

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return (
    <Box sx={{ height: "calc(100vh - 64px)", bgcolor: theme.background, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      {/* Fixed Header with Premium Glassmorphism */}
      <Box sx={{
        flexShrink: 0,
        bgcolor: alpha(theme.background, 0.8),
        backdropFilter: "blur(20px)",
        zIndex: 10,
        borderBottom: `1px solid ${alpha(theme.border, 0.5)}`,
      }}>
        <Container maxWidth="xl" sx={{ width: '100%', maxWidth: '1280px !important' }}>
          <Box sx={{ py: 2, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Stack direction="row" spacing={3} alignItems="center">
              <IconButton
                onClick={() => navigate(`/algorithms/${algorithmId}/factories/${factoryId}/models/${modelId}/versions`)}
                sx={{
                  bgcolor: theme.paper,
                  border: `1px solid ${theme.border}`,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                  '&:hover': {
                    bgcolor: theme.primaryLight,
                    borderColor: theme.primary,
                    transform: "translateX(-2px)"
                  },
                  transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
                }}
              >
                <ArrowBackIcon fontSize="small" sx={{ color: theme.textMain }} />
              </IconButton>
              <Box>
                <Typography variant="h4" fontWeight={900} sx={{
                  color: theme.textMain,
                  letterSpacing: "-0.04em",
                  background: `linear-gradient(135deg, ${theme.textMain} 0%, ${alpha(theme.textMain, 0.7)} 100%)`,
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent"
                }}>
                  Commit <Box component="span" sx={{ color: theme.primary, WebkitTextFillColor: "initial" }}>{t("versionCreate.titleHighlight")}</Box>
                </Typography>
                <Typography variant="body2" sx={{ color: theme.textMuted, fontWeight: 600, mt: 0.5 }}>
                  {t("versionCreate.subtitle")}
                </Typography>
              </Box>
            </Stack>
          </Box>
        </Container>
      </Box>

      {/* Scrollable Content Area */}
      <Box sx={{
        flex: 1,
        overflow: "hidden",
        display: 'flex',
        justifyContent: 'center',
        bgcolor: theme.background
      }}>
        {/* The Actual Scrollable Container, width-restricted to bring scrollbar near content */}
        <Box sx={{
          width: '100%',
          maxWidth: '1280px',
          overflowY: "auto",
          px: { xs: 2, sm: 4 },
          '&::-webkit-scrollbar': { width: '8px' },
          '&::-webkit-scrollbar-track': { bgcolor: 'transparent' },
          '&::-webkit-scrollbar-thumb': {
            bgcolor: alpha(theme.textMain, 0.12),
            borderRadius: '10px',
            border: '2px solid transparent',
            backgroundClip: 'padding-box',
            '&:hover': { bgcolor: alpha(theme.textMain, 0.2) }
          }
        }}>
          <Container maxWidth={false} sx={{ py: 4, px: 0 }}>

            <Stack spacing={4}>
              {/* BASE DATASET INHERITANCE */}
              <Card elevation={0} sx={{ borderRadius: "24px", border: `1px solid ${theme.border}`, boxShadow: "0px 4px 20px rgba(0,0,0,0.02)", bgcolor: theme.paper }}>
                <CardContent sx={{ p: 3 }}>
                  <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
                    <LayersIcon sx={{ color: theme.primary }} />
                    <Typography variant="h6" fontWeight={600} sx={{ color: theme.textMain }}>{t("versionCreate.baseInheritance")}</Typography>
                  </Stack>
                  <Typography variant="body2" sx={{ color: theme.textMuted, mb: 3 }}>
                    {t("versionCreate.baseInheritanceDesc")}
                  </Typography>

                  <FormControl fullWidth size="small">
                    <InputLabel id="base-version-select-label" sx={{ color: theme.textSecondary }}>
                      {t("versionCreate.selectBaseVersion")}
                    </InputLabel>
                    <Select
                      labelId="base-version-select-label"
                      value={baseVersionId}
                      label={t("versionCreate.selectBaseVersion")}
                      onChange={(e) => setBaseVersionId(e.target.value as number | "")}
                      sx={{
                        borderRadius: "12px",
                        color: theme.textMain,
                        bgcolor: theme.mode === 'dark' ? alpha(theme.background, 0.5) : theme.background,
                        '.MuiOutlinedInput-notchedOutline': { borderColor: theme.border },
                      }}
                    >
                      <MenuItem value="">
                        <em>{t("versionCreate.noneOption")}</em>
                      </MenuItem>
                      {baseVersions.map((bv) => (
                        <MenuItem key={bv.id} value={bv.id}>
                          v{bv.version_number} from Model "{bv.model_name}" at Factory "{bv.factory_name}" ({bv.accuracy ? `Acc: ${bv.accuracy}%` : 'No Acc'})
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </CardContent>
              </Card>
              <Card elevation={0} sx={{ borderRadius: "24px", border: `1px solid ${theme.border}`, boxShadow: "0px 4px 20px rgba(0,0,0,0.02)", bgcolor: theme.paper }}>
                <CardContent sx={{ p: 3 }}>
                  <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 3 }}>
                    <InventoryIcon sx={{ color: theme.primary }} />
                    <Typography variant="h6" fontWeight={600} sx={{ color: theme.textMain }}>{t("versionCreate.datasetArtifacts")}</Typography>
                  </Stack>

                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Button
                        sx={getButtonStyles(datasetFiles.length > 0, isDraggingDataset)}
                        onDragOver={(e) => { e.preventDefault(); setIsDraggingDataset(true); }}
                        onDragLeave={() => setIsDraggingDataset(false)}
                        onDrop={(e) => handleDrop(e, 'dataset')}
                        onClick={() => setDatasetDialogOpen(true)}
                      >
                        {datasetFiles.length > 0 ? (
                          <>
                            <CheckCircleIcon sx={{ fontSize: 32, mb: 1 }} />
                            <Typography variant="body1" fontWeight={600}>{t("versionCreate.imagesStagedCount", { count: datasetFiles.length })}</Typography>
                            <Typography variant="caption">{t("versionCreate.clickToUpdate")}</Typography>
                          </>
                        ) : (
                          <>
                            <FolderOpenIcon sx={{ fontSize: 32, mb: 1, color: isDraggingDataset ? theme.primary : 'inherit' }} />
                            <Typography variant="body1" fontWeight={600}>{t("versionCreate.datasetImages")}</Typography>
                            <Typography variant="caption">{t("versionCreate.stageFiles")}</Typography>
                          </>
                        )}
                      </Button>
                      <input
                        hidden
                        type="file"
                        ref={datasetInputRef}
                        multiple
                        {...({ webkitdirectory: "", directory: "" } as any)}
                        onChange={(e) => {
                          if (e.target.files) {
                            setDatasetFiles(Array.from(e.target.files));
                          }
                        }}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Button
                        sx={getButtonStyles(labelFiles.length > 0, isDraggingLabels)}
                        onDragOver={(e) => { e.preventDefault(); setIsDraggingLabels(true); }}
                        onDragLeave={() => setIsDraggingLabels(false)}
                        onDrop={(e) => handleDrop(e, 'labels')}
                        onClick={() => setLabelDialogOpen(true)}
                      >
                        {labelFiles.length > 0 ? (
                          <>
                            <CheckCircleIcon sx={{ fontSize: 32, mb: 1 }} />
                            <Typography variant="body1" fontWeight={600}>{t("versionCreate.labelsStagedCount", { count: labelFiles.length })}</Typography>
                            <Typography variant="caption">{t("versionCreate.clickToUpdate")}</Typography>
                          </>
                        ) : (
                          <>
                            <UploadFileIcon sx={{ fontSize: 32, mb: 1, color: isDraggingLabels ? theme.primary : 'inherit' }} />
                            <Typography variant="body1" fontWeight={600}>{t("versionCreate.localizationLabels")}</Typography>
                            <Typography variant="caption">{t("versionCreate.stageFiles")}</Typography>
                          </>
                        )}
                      </Button>
                      <input
                        hidden
                        type="file"
                        ref={labelInputRef}
                        multiple
                        {...({ webkitdirectory: "", directory: "" } as any)}
                        onChange={(e) => {
                          if (e.target.files) {
                            setLabelFiles(filterLabelFiles(Array.from(e.target.files)));
                          }
                        }}
                      />
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>

              <Card elevation={0} sx={{ borderRadius: "24px", border: `1px solid ${theme.border}`, boxShadow: "0px 4px 20px rgba(0,0,0,0.02)", bgcolor: theme.paper }}>
                <CardContent sx={{ p: 3 }}>
                  <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 3 }}>
                    <HistoryEduIcon sx={{ color: theme.primary }} />
                    <Typography variant="h6" fontWeight={600} sx={{ color: theme.textMain }}>
                      {t("versionCreate.modelWeights")}
                    </Typography>
                  </Stack>

                  <Stack spacing={2}>
                    {/* Existing model files */}
                    {modelFiles.map((file, idx) => (
                      <Paper
                        key={idx}
                        elevation={0}
                        sx={{
                          p: 2,
                          borderRadius: "14px",
                          border: `1px solid ${theme.border}`,
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          bgcolor: alpha(theme.success, 0.05),
                        }}
                      >
                        <Typography fontWeight={600} sx={{ color: theme.success, wordBreak: 'break-all' }}>
                          {file.name}
                        </Typography>

                        <Tooltip title="Remove model">
                          <IconButton color="error" onClick={() => removeModelFile(idx)}>
                            ✕
                          </IconButton>
                        </Tooltip>
                      </Paper>
                    ))}

                    {/* Add model button */}
                    <Button
                      component="label"
                      sx={getButtonStyles(modelFiles.length > 0)}
                      startIcon={<UploadFileIcon />}
                    >
                      {t("versionCreate.addModelFiles")}
                      <input
                        hidden
                        type="file"
                        multiple
                        onChange={(e) => {
                          if (e.target.files) addModelFiles(Array.from(e.target.files));
                        }}
                      />
                    </Button>

                    <Typography variant="caption" sx={{ color: theme.textMuted }}>
                      {t("versionCreate.modelVariantsHint")}
                    </Typography>
                  </Stack>
                </CardContent>
              </Card>

              <Card elevation={0} sx={{ borderRadius: "24px", border: `1px solid ${theme.border}`, boxShadow: "0px 4px 20px rgba(0,0,0,0.02)", bgcolor: theme.paper }}>
                <CardContent sx={{ p: 3 }}>
                  <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 3 }}>
                    <FolderOpenIcon sx={{ color: theme.primary }} />
                    <Typography variant="h6" fontWeight={600} sx={{ color: theme.textMain }}>
                      {t("versionCreate.trainingCode")}
                    </Typography>
                  </Stack>

                  <Stack spacing={2}>
                    {codeFiles.map((file, idx) => (
                      <Paper
                        key={idx}
                        elevation={0}
                        sx={{
                          p: 2,
                          borderRadius: "14px",
                          border: `1px solid ${theme.border}`,
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          bgcolor: alpha(theme.primary, 0.05),
                        }}
                      >
                        <Typography fontWeight={600} sx={{ color: theme.primary }}>
                          {file.name}
                        </Typography>

                        <Tooltip title="Remove file">
                          <IconButton color="error" onClick={() => removeCodeFile(idx)}>
                            ✕
                          </IconButton>
                        </Tooltip>
                      </Paper>
                    ))}

                    <Button
                      component="label"
                      onDragOver={(e) => { e.preventDefault(); setIsDraggingCode(true); }}
                      onDragLeave={() => setIsDraggingCode(false)}
                      onDrop={(e) => handleDrop(e, 'code')}
                      sx={getButtonStyles(codeFiles.length > 0)}
                      startIcon={<UploadFileIcon />}
                    >
                      {isDraggingCode ? t("versionCreate.dropCodeFiles") : t("versionCreate.addCodeFiles")}
                      <input
                        hidden
                        type="file"
                        multiple
                        onChange={(e) => {
                          if (e.target.files) addCodeFiles(Array.from(e.target.files));
                        }}
                      />
                    </Button>

                    <Typography variant="caption" sx={{ color: theme.textMuted }}>
                      {t("versionCreate.codeFilesHint")}
                    </Typography>
                  </Stack>
                </CardContent>
              </Card>


              {/* STEP 3: PERFORMANCE METRICS */}
              <Card elevation={0} sx={{ borderRadius: "24px", border: `1px solid ${theme.border}`, boxShadow: "0px 4px 20px rgba(0,0,0,0.02)", bgcolor: theme.paper }}>
                <CardContent sx={{ p: 4 }}>
                  <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 3 }}>
                    <AssessmentIcon sx={{ color: theme.primary }} />
                    <Typography variant="h6" fontWeight={600} sx={{ color: theme.textMain }}>{t("versionCreate.evaluationMetrics")}</Typography>
                  </Stack>

                  <PerformanceMetricsInput metrics={evalMetrics} onChange={setEvalMetrics} />
                </CardContent>
              </Card>

              {/* RESOURCE CONSUMPTION */}
              <Card elevation={0} sx={{ borderRadius: "24px", border: `1px solid ${theme.border}`, boxShadow: "0px 4px 20px rgba(0,0,0,0.02)", bgcolor: theme.paper }}>
                <CardContent sx={{ p: 4 }}>
                  <ResourceMetricsInput metrics={resourceMetrics} onChange={setResourceMetrics} />
                </CardContent>
              </Card>

              {/* PARAMETERS */}
              <Card elevation={0} sx={{ borderRadius: "24px", border: `1px solid ${theme.border}`, boxShadow: "0px 4px 20px rgba(0,0,0,0.02)", bgcolor: theme.paper }}>
                <CardContent sx={{ p: 4 }}>
                  <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 3 }}>
                    <SettingsIcon sx={{ color: theme.primary }} />
                    <Typography variant="h6" fontWeight={600} sx={{ color: theme.textMain }}>
                      {t("versionCreate.trainingParameters")}
                    </Typography>
                  </Stack>

                  <Grid container spacing={3}>
                    {Object.entries(parameters).map(([key, value]) => (
                      <Grid size={{ xs: 12, sm: 6 }} key={key}>
                        <Grid container spacing={1} alignItems="center">
                          <Grid size={{ xs: 11 }}>
                            <Typography
                              variant="caption"
                              fontWeight={600}
                              sx={{ color: theme.textMuted, textTransform: "uppercase" }}
                            >
                              {key.replace("_", " ")}
                            </Typography>

                            <TextField
                              fullWidth
                              placeholder="Enter value"
                              value={value}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (/^[0-9.]*$/.test(val)) {
                                  setParameters({ ...parameters, [key]: val });
                                }
                              }}
                              sx={{
                                "& .MuiOutlinedInput-root": {
                                  borderRadius: "12px",
                                  bgcolor: theme.background,
                                  color: theme.textMain,
                                },
                              }}
                            />
                          </Grid>
                          <Grid size={{ xs: 1 }}>
                            <IconButton
                              color="error"
                              onClick={() => {
                                const newParams = { ...parameters };
                                delete (newParams as any)[key];
                                setParameters(newParams);
                              }}
                              sx={{ mt: 2 }}
                            >
                              <DeleteIcon />
                            </IconButton>
                          </Grid>
                        </Grid>
                      </Grid>
                    ))}
                  </Grid>

                  <Box sx={{ mt: 4, pt: 3, borderTop: `1px dashed ${theme.border}` }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" fontWeight={700} sx={{ color: theme.textMain }}>{t("versionCreate.customParameters")}</Typography>
                      <Button
                        startIcon={<AddIcon />}
                        size="small"
                        onClick={() => setCustomParams([...customParams, { key: "", value: "" }])}
                        sx={{ borderRadius: "8px", textTransform: 'none', fontWeight: 700 }}
                      >
                        {t("versionCreate.addParameter")}
                      </Button>
                    </Stack>

                    <Stack spacing={2}>
                      {customParams.map((param, index) => (
                        <Grid container spacing={2} key={index} alignItems="center">
                          <Grid size={{ xs: 5 }}>
                            <TextField
                              fullWidth
                              size="small"
                              placeholder={t("versionCreate.keyPlaceholder")}
                              value={param.key}
                              onChange={(e) => {
                                const newParams = [...customParams];
                                newParams[index].key = e.target.value;
                                setCustomParams(newParams);
                              }}
                              sx={{ "& .MuiOutlinedInput-root": { borderRadius: "10px", bgcolor: theme.background, color: theme.textMain } }}
                            />
                          </Grid>
                          <Grid size={{ xs: 5 }}>
                            <TextField
                              fullWidth
                              size="small"
                              placeholder={t("versionCreate.valuePlaceholder")}
                              value={param.value}
                              onChange={(e) => {
                                const newParams = [...customParams];
                                newParams[index].value = e.target.value;
                                setCustomParams(newParams);
                              }}
                              sx={{ "& .MuiOutlinedInput-root": { borderRadius: "10px", bgcolor: theme.background, color: theme.textMain } }}
                            />
                          </Grid>
                          <Grid size={{ xs: 2 }}>
                            <IconButton
                              color="error"
                              onClick={() => setCustomParams(customParams.filter((_, i) => i !== index))}
                            >
                              <DeleteIcon />
                            </IconButton>
                          </Grid>
                        </Grid>
                      ))}
                      {customParams.length === 0 && (
                        <Typography variant="caption" sx={{ color: theme.textMuted, fontStyle: 'italic' }}>
                          {t("versionCreate.noCustomParams")}
                        </Typography>
                      )}
                    </Stack>
                  </Box>
                </CardContent>
              </Card>

              {/* FINAL NOTES */}
              <Card elevation={0} sx={{ borderRadius: "24px", border: `1px solid ${theme.border}`, boxShadow: "0px 4px 20px rgba(0,0,0,0.02)", bgcolor: theme.paper }}>
                <CardContent sx={{ p: 4 }}>
                  <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
                    <DescriptionIcon sx={{ color: theme.primary }} />
                    <Typography variant="h6" fontWeight={600} sx={{ color: theme.textMain }}>{t("versionCreate.versionSummary")}</Typography>
                  </Stack>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    placeholder={t("versionCreate.summaryPlaceholder")}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    sx={{ "& .MuiOutlinedInput-root": { borderRadius: "16px", bgcolor: theme.background, color: theme.textMain } }}
                  />
                </CardContent>
              </Card>
            </Stack>
          </Container>
        </Box>
      </Box>

      {/* Fixed Footer with Floating Dock Effect */}
      <Box sx={{
        flexShrink: 0,
        bgcolor: theme.background,
        zIndex: 10,
        py: 2,
        borderTop: `1px solid ${alpha(theme.border, 0.6)}`,
      }}>
        <Container maxWidth="xl" sx={{ width: '100%', maxWidth: '1280px !important' }}>
          {error && (
            <Paper elevation={0} sx={{ p: 2, mb: 2, bgcolor: alpha(theme.error || theme.danger, 0.05), border: `1px solid ${theme.error || theme.danger}`, borderRadius: "12px" }}>
              <Typography color="error" variant="body2" fontWeight={700}>{error}</Typography>
            </Paper>
          )}

          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Box>
              <Typography variant="caption" fontWeight={700} sx={{ color: theme.textMuted, textTransform: 'uppercase', letterSpacing: 1 }}>
                {t("versionCreate.readyToDeploy")}
              </Typography>
              <Typography variant="body2" sx={{ color: theme.textMain }}>
                {t("versionCreate.reviewArtifacts")}
              </Typography>
            </Box>

            <Box sx={{ display: "flex", gap: 2 }}>
              <Button
                variant="outlined"
                onClick={() => {
                  if (loading && abortControllerRef.current) {
                    abortControllerRef.current.abort();
                    setLoading(false);
                  } else {
                    navigate(-1);
                  }
                }}
                disabled={false} // Always enabled to allow cancelling
                sx={{
                  borderRadius: "14px",
                  px: 4,
                  py: 1,
                  textTransform: "none",
                  fontWeight: 800,
                  borderColor: theme.border,
                  color: theme.error || theme.textMain,
                  "&:hover": { borderColor: theme.error ? alpha(theme.error, 0.5) : theme.textMuted, bgcolor: alpha(theme.error || theme.textMain, 0.05) }
                }}
              >
                {loading ? t("versionCreate.abortUpload") : t("versionCreate.cancel")}
              </Button>
              <Button
                variant="contained"
                onClick={handleSubmit}
                disabled={loading || (!baseVersionId && datasetFiles.length === 0)}
                sx={{
                  borderRadius: "14px",
                  px: 4,
                  py: 1,
                  textTransform: "none",
                  fontWeight: 800,
                  bgcolor: theme.primary,
                  boxShadow: `0 8px 24px ${alpha(theme.primary, 0.3)}`,
                  "&:hover": { bgcolor: theme.primaryDark, boxShadow: `0 8px 24px ${alpha(theme.primary, 0.3)}`, transform: "none" },
                  "&.Mui-disabled": {
                    bgcolor: alpha(theme.primary, 0.4),
                    color: alpha(theme.paper, 0.5),
                    boxShadow: "none"
                  }
                }}
              >
                {loading ? <CircularProgress size={24} sx={{ color: '#FFFFFF' }} /> : t("versionCreate.commitVersion")}
              </Button>
            </Box>
          </Box>
        </Container>
      </Box>
      <FileUploadDialog
        open={datasetDialogOpen}
        onClose={() => setDatasetDialogOpen(false)}
        onUpload={(files) => setDatasetFiles(files)}
        title={t("versionCreate.stageDatasetTitle")}
      />

      <FileUploadDialog
        open={labelDialogOpen}
        onClose={() => setLabelDialogOpen(false)}
        onUpload={(files) => setLabelFiles(files)}
        title={t("versionCreate.stageLabelTitle")}
        allowedExtensions={ALLOWED_LABEL_EXTENSIONS}
      />
    </Box >
  );
}