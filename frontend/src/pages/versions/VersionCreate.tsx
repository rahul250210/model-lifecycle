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
import SettingsIcon from "@mui/icons-material/Settings";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";

import axios from "../../api/axios";
import axiosBase from "axios";
import { useTheme } from "../../theme/ThemeContext";
import FileUploadDialog from "../../components/FileUploadDialog";
import { useBackgroundUploader } from "../../contexts/BackgroundUploaderContext";

const ALLOWED_MODEL_EXTENSIONS = [".pt", ".engine", ".pth", ".onnx", ".h5", ".ckpt"];
const ALLOWED_LABEL_EXTENSIONS = [".txt", ".json", ".xml"];
const ALLOWED_CODE_EXTENSIONS = [".py", ".cpp", ".c", ".h", ".hpp", ".cc", ".cxx", ".sh"];

export default function VersionCreate() {
  const { factoryId, algorithmId, modelId } = useParams();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { queueUpload } = useBackgroundUploader();

  const datasetInputRef = useRef<HTMLInputElement>(null);
  const labelInputRef = useRef<HTMLInputElement>(null);

  const [datasetFiles, setDatasetFiles] = useState<File[]>([]);
  const [labelFiles, setLabelFiles] = useState<File[]>([]);
  const [modelFiles, setModelFiles] = useState<File[]>([]);
  const [codeFiles, setCodeFiles] = useState<File[]>([]);

  const [metrics, setMetrics] = useState({
    accuracy: "",
    precision: "",
    recall: "",
    f1_score: "",
    tp: "",
    tn: "",
    fp: "",
    fn: "",
  });

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
    if (datasetFiles.length === 0) {
      setError("Dataset images are required");
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      setLoading(true);
      setError("");
      const formData = new FormData();
      // Submit metadata + simple files (Model/Code)
      // Dataset/Labels will be streamed in background
      // datasetFiles.forEach((f) => formData.append("dataset_files", f, f.name));
      // labelFiles.forEach((f) => formData.append("label_files", f, f.name));

      if (modelFiles.length > 0) {
        modelFiles.forEach((f) => formData.append("model_files", f, f.name));
      }

      if (codeFiles.length > 0) {
        codeFiles.forEach((f) => formData.append("code_files", f, f.name));
      }
      formData.append("note", note);
      Object.entries(metrics).forEach(([key, value]) => {
        if (value !== "") formData.append(key, value);
      });
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

      const response = await axios.post(`/factories/${factoryId}/algorithms/${algorithmId}/models/${modelId}/versions`, formData, {
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

      navigate(`/factories/${factoryId}/algorithms/${algorithmId}/models/${modelId}/versions`);
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
                onClick={() => navigate(-1)}
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
                  Commit <Box component="span" sx={{ color: theme.primary, WebkitTextFillColor: "initial" }}>New Version</Box>
                </Typography>
                <Typography variant="body2" sx={{ color: theme.textMuted, fontWeight: 600, mt: 0.5 }}>
                  Register a new iteration with optimized weights and updated datasets.
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
              <Card elevation={0} sx={{ borderRadius: "24px", border: `1px solid ${theme.border}`, boxShadow: "0px 4px 20px rgba(0,0,0,0.02)", bgcolor: theme.paper }}>
                <CardContent sx={{ p: 3 }}>
                  <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 3 }}>
                    <InventoryIcon sx={{ color: theme.primary }} />
                    <Typography variant="h6" fontWeight={600} sx={{ color: theme.textMain }}>Dataset Artifacts</Typography>
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
                            <Typography variant="body1" fontWeight={600}>{datasetFiles.length} Images Staged</Typography>
                            <Typography variant="caption">Click to update selection</Typography>
                          </>
                        ) : (
                          <>
                            <FolderOpenIcon sx={{ fontSize: 32, mb: 1, color: isDraggingDataset ? theme.primary : 'inherit' }} />
                            <Typography variant="body1" fontWeight={600}>Dataset Images</Typography>
                            <Typography variant="caption">Stage folder or files for upload</Typography>
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
                            <Typography variant="body1" fontWeight={600}>{labelFiles.length} Labels Staged</Typography>
                            <Typography variant="caption">Click to update selection</Typography>
                          </>
                        ) : (
                          <>
                            <UploadFileIcon sx={{ fontSize: 32, mb: 1, color: isDraggingLabels ? theme.primary : 'inherit' }} />
                            <Typography variant="body1" fontWeight={600}>Localization Labels</Typography>
                            <Typography variant="caption">Stage folder or files for upload</Typography>
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
                      Model Weights
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
                      Add Model Files (.pt, .onnx, .engine)
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
                      You can upload multiple model variants (fp32, fp16, ONNX, etc.)
                    </Typography>
                  </Stack>
                </CardContent>
              </Card>

              <Card elevation={0} sx={{ borderRadius: "24px", border: `1px solid ${theme.border}`, boxShadow: "0px 4px 20px rgba(0,0,0,0.02)", bgcolor: theme.paper }}>
                <CardContent sx={{ p: 3 }}>
                  <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 3 }}>
                    <FolderOpenIcon sx={{ color: theme.primary }} />
                    <Typography variant="h6" fontWeight={600} sx={{ color: theme.textMain }}>
                      Training Code
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
                      {isDraggingCode ? "Drop to Add Code Files" : "Add Code Files (.py, .cpp, .h)"}
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
                      Include all scripts, header files, and configuration files required for training.
                    </Typography>
                  </Stack>
                </CardContent>
              </Card>


              {/* STEP 3: PERFORMANCE METRICS */}
              <Card elevation={0} sx={{ borderRadius: "24px", border: `1px solid ${theme.border}`, boxShadow: "0px 4px 20px rgba(0,0,0,0.02)", bgcolor: theme.paper }}>
                <CardContent sx={{ p: 4 }}>
                  <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 3 }}>
                    <AssessmentIcon sx={{ color: theme.primary }} />
                    <Typography variant="h6" fontWeight={600} sx={{ color: theme.textMain }}>Evaluation Metrics</Typography>
                  </Stack>

                  <Grid container spacing={3}>
                    {Object.keys(metrics).map((k) => (
                      <Grid size={{ xs: 12, sm: 6 }} key={k}>
                        <Typography variant="caption" fontWeight={600} sx={{ color: theme.textMuted, mb: 1, display: 'block', textTransform: 'uppercase' }}>{k.replace('_', ' ')} {['tp', 'tn', 'fp', 'fn'].includes(k) ? '' : '(%)'}</Typography>
                        <TextField
                          fullWidth
                          placeholder={['tp', 'tn', 'fp', 'fn'].includes(k) ? "Integer value" : "0.00"}
                          value={(metrics as any)[k]}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (['tp', 'tn', 'fp', 'fn'].includes(k)) {
                              if (/^\d*$/.test(val)) {
                                setMetrics({ ...metrics, [k]: val });
                              }
                            } else {
                              if (/^[0-9.]*$/.test(val)) {
                                setMetrics({ ...metrics, [k]: val });
                              }
                            }
                          }}
                          sx={{ "& .MuiOutlinedInput-root": { borderRadius: "12px", bgcolor: theme.background, color: theme.textMain } }}
                        />
                      </Grid>
                    ))}
                  </Grid>
                </CardContent>
              </Card>

              {/* PARAMETERS */}
              <Card elevation={0} sx={{ borderRadius: "24px", border: `1px solid ${theme.border}`, boxShadow: "0px 4px 20px rgba(0,0,0,0.02)", bgcolor: theme.paper }}>
                <CardContent sx={{ p: 4 }}>
                  <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 3 }}>
                    <SettingsIcon sx={{ color: theme.primary }} />
                    <Typography variant="h6" fontWeight={600} sx={{ color: theme.textMain }}>
                      Training Parameters
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
                      <Typography variant="subtitle2" fontWeight={700} sx={{ color: theme.textMain }}>Custom Parameters</Typography>
                      <Button
                        startIcon={<AddIcon />}
                        size="small"
                        onClick={() => setCustomParams([...customParams, { key: "", value: "" }])}
                        sx={{ borderRadius: "8px", textTransform: 'none', fontWeight: 700 }}
                      >
                        Add Parameter
                      </Button>
                    </Stack>

                    <Stack spacing={2}>
                      {customParams.map((param, index) => (
                        <Grid container spacing={2} key={index} alignItems="center">
                          <Grid size={{ xs: 5 }}>
                            <TextField
                              fullWidth
                              size="small"
                              placeholder="Key (e.g. dropout)"
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
                              placeholder="Value"
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
                          No custom parameters added. Click "Add Parameter" to include more.
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
                    <Typography variant="h6" fontWeight={600} sx={{ color: theme.textMain }}>Version Summary</Typography>
                  </Stack>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    placeholder="What changes were made in this iteration? (e.g., Improved lighting augmentations)"
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
                Ready to Deploy?
              </Typography>
              <Typography variant="body2" sx={{ color: theme.textMain }}>
                Review your artifacts before committing.
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
                {loading ? "Abort Upload" : "Cancel"}
              </Button>
              <Button
                variant="contained"
                onClick={handleSubmit}
                disabled={loading}
                sx={{
                  borderRadius: "14px",
                  px: 4,
                  py: 1,
                  textTransform: "none",
                  fontWeight: 800,
                  bgcolor: theme.primary,
                  boxShadow: `0 8px 24px ${alpha(theme.primary, 0.3)}`,
                  "&:hover": { bgcolor: theme.primaryDark, boxShadow: `0 12px 32px ${alpha(theme.primary, 0.4)}` }
                }}
              >
                {loading ? <CircularProgress size={24} sx={{ color: '#FFFFFF' }} /> : "Commit Version"}
              </Button>
            </Box>
          </Box>
        </Container>
      </Box>
      <FileUploadDialog
        open={datasetDialogOpen}
        onClose={() => setDatasetDialogOpen(false)}
        onUpload={(files) => setDatasetFiles(files)}
        title="Stage Dataset Artifacts"
      />

      <FileUploadDialog
        open={labelDialogOpen}
        onClose={() => setLabelDialogOpen(false)}
        onUpload={(files) => setLabelFiles(files)}
        title="Stage Label Artifacts"
        allowedExtensions={ALLOWED_LABEL_EXTENSIONS}
      />
    </Box >
  );
}