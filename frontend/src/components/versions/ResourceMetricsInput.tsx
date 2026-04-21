import React, { useState } from "react";
import { Grid, TextField, Typography, Box, alpha, IconButton, Button, Stack, MenuItem, Menu, ListItemIcon, ListItemText } from "@mui/material";
import { useTheme } from "../../theme/ThemeContext";
import DeleteIcon from "@mui/icons-material/DeleteOutlined";
import AddIcon from "@mui/icons-material/AddCircleOutline";
import ElectricBoltIcon from '@mui/icons-material/ElectricBolt';

export interface MetricItem {
    key: string;
    value: string;
    unit: string;
}

interface ResourceMetricsInputProps {
    metrics: MetricItem[];
    onChange: (metrics: MetricItem[]) => void;
}

const SUGGESTED_KEYS = [
    { key: "cpu_utilization", label: "CPU Usage", units: ["%"] },
    { key: "gpu_utilization", label: "GPU Usage", units: ["%"] },
    { key: "inference_time", label: "Inference Time", units: ["ms", "s", "min"] },
    { key: "cpu_memory_usage", label: "CPU Memory", units: ["MB", "GB", "TB"] },
    { key: "gpu_memory_usage", label: "GPU Memory", units: ["MB", "GB", "TB"] },
    { key: "cameras_supported", label: "Cameras Supported", units: ["Count", "Streams"] },
];

export const ResourceMetricsInput: React.FC<ResourceMetricsInputProps> = ({
    metrics,
    onChange,
}) => {
    const { theme } = useTheme();
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const open = Boolean(anchorEl);

    const handleMenuClick = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleMenuClose = () => {
        setAnchorEl(null);
    };

    const handleAddMetric = (keyOption: typeof SUGGESTED_KEYS[0] | "custom") => {
        handleMenuClose();
        if (keyOption === "custom") {
            onChange([...metrics, { key: "", value: "", unit: "" }]);
        } else {
            // Prevent adding duplicate standard keys
            if (metrics.some(m => m.key === keyOption.key)) return;

            onChange([...metrics, {
                key: keyOption.key,
                value: "",
                unit: keyOption.units[0] || ""
            }]);
        }
    };

    const handleChange = (index: number, field: keyof MetricItem, newValue: string) => {
        const updated = [...metrics];
        updated[index] = { ...updated[index], [field]: newValue };
        onChange(updated);
    };

    const handleDelete = (index: number) => {
        const updated = metrics.filter((_, i) => i !== index);
        onChange(updated);
    };

    return (
        <Box>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
                <Box>
                    <Typography variant="subtitle1" fontWeight={800} sx={{ color: theme.textMain }}>Resource Consumption</Typography>
                    <Typography variant="caption" sx={{ color: theme.textMuted }}>Track hardware utilization and system requirements.</Typography>
                </Box>
                <Button
                    startIcon={<AddIcon />}
                    variant="contained"
                    size="small"
                    onClick={handleMenuClick}
                    sx={{
                        borderRadius: "12px",
                        textTransform: 'none',
                        fontWeight: 800,
                        bgcolor: theme.primary,
                        boxShadow: `0 8px 16px ${alpha(theme.primary, 0.2)}`
                    }}
                >
                    Add Metric
                </Button>
                <Menu
                    anchorEl={anchorEl}
                    open={open}
                    onClose={handleMenuClose}
                    PaperProps={{
                        sx: {
                            mt: 1,
                            borderRadius: "12px",
                            border: `1px solid ${theme.border}`,
                            bgcolor: theme.paper,
                            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                            minWidth: 200
                        }
                    }}
                >
                    {SUGGESTED_KEYS.map((option) => {
                        const isSelected = metrics.some(m => m.key === option.key);
                        return (
                            <MenuItem
                                key={option.key}
                                onClick={() => handleAddMetric(option)}
                                disabled={isSelected}
                                sx={{ py: 1.5 }}
                            >
                                <ListItemIcon>
                                    <ElectricBoltIcon fontSize="small" sx={{ color: isSelected ? theme.textMuted : theme.primary }} />
                                </ListItemIcon>
                                <ListItemText
                                    primary={option.label}
                                    primaryTypographyProps={{
                                        fontWeight: 600,
                                        fontSize: "0.9rem",
                                        color: isSelected ? theme.textMuted : theme.textMain
                                    }}
                                />
                            </MenuItem>
                        );
                    })}
                    <Box sx={{ my: 1, borderTop: `1px dashed ${theme.border}` }} />
                    <MenuItem onClick={() => handleAddMetric("custom")} sx={{ py: 1.5 }}>
                        <ListItemIcon>
                            <AddIcon fontSize="small" sx={{ color: theme.textMain }} />
                        </ListItemIcon>
                        <ListItemText
                            primary="Custom Metric"
                            primaryTypographyProps={{
                                fontWeight: 600,
                                fontSize: "0.9rem",
                                color: theme.textMain
                            }}
                        />
                    </MenuItem>
                </Menu>
            </Stack>

            <Grid container spacing={3}>
                {metrics.map((item, index) => {
                    const suggestion = SUGGESTED_KEYS.find(s => s.key === item.key);
                    const label = suggestion ? suggestion.label : "";
                    const availableUnits = suggestion ? suggestion.units : [];
                    const isCustomUnit = availableUnits.length === 0;
                    const isCustomKey = !suggestion;

                    return (
                        <Grid size={{ xs: 12, md: 6 }} key={index}>
                            <Box sx={{
                                p: 2,
                                border: `1px solid ${theme.border}`,
                                borderRadius: "16px",
                                bgcolor: alpha(theme.background, 0.3),
                                transition: "all 0.2s ease",
                                "&:hover": {
                                    borderColor: alpha(theme.primary, 0.5),
                                    bgcolor: alpha(theme.background, 0.8)
                                }
                            }}>
                                <Stack spacing={2}>
                                    {/* HEADER: Metric Name (Static or Input) + Delete */}
                                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                                        {isCustomKey ? (
                                            <TextField
                                                fullWidth
                                                placeholder="Metric Name (e.g. cache_size)"
                                                value={item.key}
                                                onChange={(e) => handleChange(index, "key", e.target.value)}
                                                variant="standard"
                                                InputProps={{
                                                    disableUnderline: true,
                                                    sx: {
                                                        "& input::placeholder": {
                                                            color: alpha(theme.textMain, 0.4),
                                                            opacity: 1
                                                        }
                                                    }
                                                }}
                                                sx={{
                                                    "& .MuiInputBase-input": {
                                                        fontWeight: 800,
                                                        fontSize: "0.95rem",
                                                        color: theme.textMain,
                                                        p: 0
                                                    }
                                                }}
                                            />
                                        ) : (
                                            <Typography
                                                variant="subtitle2"
                                                fontWeight={800}
                                                sx={{
                                                    color: theme.textMain,
                                                    textTransform: "uppercase",
                                                    letterSpacing: "0.05em",
                                                    fontSize: "0.75rem"
                                                }}
                                            >
                                                {label.toUpperCase()}
                                            </Typography>
                                        )}

                                        <IconButton
                                            size="small"
                                            onClick={() => handleDelete(index)}
                                            sx={{
                                                ml: 1,
                                                color: theme.textMuted,
                                                "&:hover": { color: theme.danger, bgcolor: alpha(theme.danger, 0.1) }
                                            }}
                                        >
                                            <DeleteIcon fontSize="small" />
                                        </IconButton>
                                    </Stack>

                                    {/* BODY: Value + Unit */}
                                    <Grid container spacing={1}>
                                        <Grid size={{ xs: 8 }}>
                                            <TextField
                                                fullWidth
                                                size="small"
                                                placeholder="Value"
                                                value={item.value}
                                                onChange={(e) => handleChange(index, "value", e.target.value)}
                                                sx={{
                                                    "& .MuiOutlinedInput-root": {
                                                        borderRadius: "10px",
                                                        bgcolor: theme.background,
                                                        color: theme.textMain,
                                                        border: `1px solid ${theme.border}`,
                                                        "&:hover": { borderColor: theme.primary },
                                                        "&.Mui-focused": { borderColor: theme.primary }
                                                    },
                                                    "& .MuiOutlinedInput-notchedOutline": { border: 'none' },
                                                    "& .MuiInputBase-input::placeholder": {
                                                        color: alpha(theme.textMain, 0.4),
                                                        opacity: 1
                                                    }
                                                }}
                                            />
                                        </Grid>
                                        <Grid size={{ xs: 4 }}>
                                            <TextField
                                                select={!isCustomUnit}
                                                fullWidth
                                                size="small"
                                                placeholder="Unit"
                                                value={item.unit}
                                                onChange={(e) => handleChange(index, "unit", e.target.value)}
                                                sx={{
                                                    "& .MuiOutlinedInput-root": {
                                                        borderRadius: "10px",
                                                        bgcolor: theme.background,
                                                        color: theme.textMain,
                                                        border: `1px solid ${theme.border}`,
                                                        "&:hover": { borderColor: theme.primary },
                                                        "&.Mui-focused": { borderColor: theme.primary }
                                                    },
                                                    "& .MuiOutlinedInput-notchedOutline": { border: 'none' }
                                                }}
                                            >
                                                {!isCustomUnit && availableUnits.map((u) => (
                                                    <MenuItem key={u} value={u} sx={{ fontWeight: 600, color: theme.textMain }}>
                                                        {u}
                                                    </MenuItem>
                                                ))}
                                            </TextField>
                                        </Grid>
                                    </Grid>
                                </Stack>
                            </Box>
                        </Grid>
                    );
                })}
            </Grid>

            {metrics.length === 0 && (
                <Box sx={{
                    p: 4,
                    textAlign: "center",
                    border: `1px dashed ${theme.border}`,
                    borderRadius: "16px",
                    bgcolor: alpha(theme.background, 0.3),
                    mt: 2
                }}>
                    <Typography variant="body2" sx={{ color: theme.textMuted, fontStyle: "italic" }}>
                        No resource metrics defined. Click "Add Metric" to track hardware requirements.
                    </Typography>
                </Box>
            )}
        </Box>
    );
};
