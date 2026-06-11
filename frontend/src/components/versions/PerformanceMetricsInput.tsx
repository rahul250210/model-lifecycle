import React from "react";
import { Grid, TextField, Typography, Box, alpha } from "@mui/material";
import { useTheme } from "../../theme/ThemeContext";

interface Metrics {
    accuracy: string;
    precision: string;
    recall: string;
    f1_score: string;
    frame_tp: string;
    frame_tn: string;
    frame_fp: string;
    frame_fn: string;
    alert_tp: string;
    alert_tn: string;
    alert_fp: string;
    alert_fn: string;
    [key: string]: string;
}

interface PerformanceMetricsInputProps {
    metrics: Metrics;
    onChange: (metrics: Metrics) => void;
}

export const PerformanceMetricsInput: React.FC<PerformanceMetricsInputProps> = ({ metrics, onChange }) => {
    const { theme } = useTheme();

    const performanceFields = [
        { key: "accuracy", label: "Accuracy", unit: "%" },
        { key: "precision", label: "Precision", unit: "%" },
        { key: "recall", label: "Recall", unit: "%" },
        { key: "f1_score", label: "F1 Score", unit: "%" },
    ];

    const frameMatrixFields = [
        { key: "frame_tp", label: "True Positives (TP)", unit: "" },
        { key: "frame_tn", label: "True Negatives (TN)", unit: "" },
        { key: "frame_fp", label: "False Positives (FP)", unit: "" },
        { key: "frame_fn", label: "False Negatives (FN)", unit: "" },
    ];

    const alertMatrixFields = [
        { key: "alert_tp", label: "True Positives (TP)", unit: "" },
        { key: "alert_tn", label: "True Negatives (TN)", unit: "" },
        { key: "alert_fp", label: "False Positives (FP)", unit: "" },
        { key: "alert_fn", label: "False Negatives (FN)", unit: "" },
    ];

    const handleChange = (key: string, value: string) => {
        // Validate number input
        if (value === "" || /^[0-9]*\.?[0-9]*$/.test(value)) {
            // specific validation for percentages
            if (['accuracy', 'precision', 'recall', 'f1_score'].includes(key)) {
                const num = parseFloat(value);
                if (!isNaN(num) && num > 100) return;
            }
            onChange({ ...metrics, [key]: value });
        }
    };

    return (
        <Box>
            <Typography variant="subtitle2" fontWeight={800} sx={{ color: theme.textSecondary, mb: 2, textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '0.75rem' }}>
                Core Metrics
            </Typography>
            <Grid container spacing={3} sx={{ mb: 4 }}>
                {performanceFields.map((field) => (
                    <Grid size={{ xs: 12, sm: 6, md: 3 }} key={field.key}>
                        <Typography variant="caption" fontWeight={800} sx={{ mb: 1, display: 'block', color: theme.textMuted, textTransform: 'uppercase', letterSpacing: "0.5px" }}>
                            {field.label}
                        </Typography>
                        <TextField
                            fullWidth
                            placeholder="0.00"
                            value={metrics[field.key] || ""}
                            onChange={(e) => handleChange(field.key, e.target.value)}
                            InputProps={{
                                endAdornment: <Typography variant="caption" color={theme.textMuted} fontWeight={700}>{field.unit}</Typography>,
                                sx: {
                                    "& input::placeholder": {
                                        color: alpha(theme.textMain, 0.4),
                                        opacity: 1
                                    }
                                }
                            }}
                            sx={{
                                "& .MuiOutlinedInput-root": {
                                    borderRadius: "12px",
                                    bgcolor: alpha(theme.background, 0.5),
                                    color: theme.textMain,
                                    border: `1px solid ${theme.border}`,
                                    "&:hover": { borderColor: theme.primary },
                                    "&.Mui-focused": { borderColor: theme.primary, boxShadow: `0 0 0 4px ${alpha(theme.primary, 0.1)}` }
                                },
                                "& .MuiOutlinedInput-notchedOutline": { border: 'none' }
                            }}
                        />
                    </Grid>
                ))}
            </Grid>

            <Typography variant="subtitle2" fontWeight={800} sx={{ color: theme.textSecondary, mb: 2, textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '0.75rem' }}>
                Confusion Matrix (Frame-Wise)
            </Typography>
            <Grid container spacing={3} sx={{ mb: 4 }}>
                {frameMatrixFields.map((field) => (
                    <Grid size={{ xs: 6, sm: 6, md: 3 }} key={field.key}>
                        <Typography variant="caption" fontWeight={800} sx={{ mb: 1, display: 'block', color: theme.textMuted, textTransform: 'uppercase', letterSpacing: "0.5px" }}>
                            {field.label}
                        </Typography>
                        <TextField
                            fullWidth
                            placeholder="0"
                            value={metrics[field.key] || ""}
                            onChange={(e) => handleChange(field.key, e.target.value)}
                            InputProps={{
                                sx: {
                                    "& input::placeholder": {
                                        color: alpha(theme.textMain, 0.4),
                                        opacity: 1
                                    }
                                }
                            }}
                            sx={{
                                "& .MuiOutlinedInput-root": {
                                    borderRadius: "12px",
                                    bgcolor: alpha(theme.background, 0.5),
                                    color: theme.textMain,
                                    border: `1px solid ${theme.border}`,
                                    "&:hover": { borderColor: theme.primary },
                                    "&.Mui-focused": { borderColor: theme.primary, boxShadow: `0 0 0 4px ${alpha(theme.primary, 0.1)}` }
                                },
                                "& .MuiOutlinedInput-notchedOutline": { border: 'none' }
                            }}
                        />
                    </Grid>
                ))}
            </Grid>

            <Typography variant="subtitle2" fontWeight={800} sx={{ color: theme.textSecondary, mb: 2, textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '0.75rem' }}>
                Confusion Matrix (Alert-Wise)
            </Typography>
            <Grid container spacing={3}>
                {alertMatrixFields.map((field) => (
                    <Grid size={{ xs: 6, sm: 6, md: 3 }} key={field.key}>
                        <Typography variant="caption" fontWeight={800} sx={{ mb: 1, display: 'block', color: theme.textMuted, textTransform: 'uppercase', letterSpacing: "0.5px" }}>
                            {field.label}
                        </Typography>
                        <TextField
                            fullWidth
                            placeholder="0"
                            value={metrics[field.key] || ""}
                            onChange={(e) => handleChange(field.key, e.target.value)}
                            InputProps={{
                                sx: {
                                    "& input::placeholder": {
                                        color: alpha(theme.textMain, 0.4),
                                        opacity: 1
                                    }
                                }
                            }}
                            sx={{
                                "& .MuiOutlinedInput-root": {
                                    borderRadius: "12px",
                                    bgcolor: alpha(theme.background, 0.5),
                                    color: theme.textMain,
                                    border: `1px solid ${theme.border}`,
                                    "&:hover": { borderColor: theme.primary },
                                    "&.Mui-focused": { borderColor: theme.primary, boxShadow: `0 0 0 4px ${alpha(theme.primary, 0.1)}` }
                                },
                                "& .MuiOutlinedInput-notchedOutline": { border: 'none' }
                            }}
                        />
                    </Grid>
                ))}
            </Grid>
        </Box>
    );
};
