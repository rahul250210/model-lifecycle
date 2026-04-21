import { IconButton, Box, Stack, alpha } from "@mui/material";
import { DarkMode, LightMode } from "@mui/icons-material";
import { useTheme } from "../theme/ThemeContext";

interface ThemeToggleProps {
    variant?: 'icon' | 'sidebar';
    collapsed?: boolean;
}

export default function ThemeToggle({ variant = 'icon', collapsed = false }: ThemeToggleProps) {
    const { mode, toggleTheme, theme } = useTheme();

    if (variant === 'sidebar') {
        // If collapsed, just show a simple icon button (but styled nicely)
        if (collapsed) {
            return (
                <IconButton
                    onClick={toggleTheme}
                    sx={{
                        color: theme.textMuted,
                        transition: "all 0.2s",
                        "&:hover": {
                            color: theme.primary,
                            bgcolor: alpha(theme.primary, 0.1),
                            transform: "scale(1.1)"
                        }
                    }}
                >
                    {mode === 'light' ? <DarkMode fontSize="small" /> : <LightMode fontSize="small" />}
                </IconButton>
            );
        }

        // Expanded: Premium Sliding Switch
        return (
            <Box
                onClick={toggleTheme}
                sx={{
                    width: "100%",
                    height: 44,
                    bgcolor: alpha(theme.textMain, 0.05),
                    borderRadius: "22px",
                    border: `1px solid ${alpha(theme.border, 0.5)}`,
                    position: "relative",
                    cursor: "pointer",
                    overflow: "hidden",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    px: 0.5,
                    transition: "all 0.3s ease",
                    "&:hover": {
                        bgcolor: alpha(theme.textMain, 0.08),
                        borderColor: alpha(theme.border, 0.8)
                    }
                }}
            >
                {/* Sliding Thumb */}
                <Box
                    sx={{
                        position: "absolute",
                        left: 4,
                        width: "calc(50% - 4px)",
                        height: 36,
                        bgcolor: theme.paper,
                        borderRadius: "18px",
                        boxShadow: `0 2px 8px ${alpha(theme.textMain, 0.15)}`,
                        transition: "transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)", // Bouncy spring effect
                        transform: mode === 'dark' ? "translateX(100%)" : "translateX(0%)",
                        zIndex: 1,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center"
                    }}
                >
                    {/* Icon inside the thumb for extra flair */}
                    {mode === 'light' ?
                        <LightMode sx={{ fontSize: 20, color: "#F59E0B" }} /> :
                        <DarkMode sx={{ fontSize: 20, color: "#3B82F6" }} />
                    }
                </Box>

                {/* Background Icons (inactive state visuals) */}
                <Stack
                    direction="row"
                    justifyContent="center"
                    alignItems="center"
                    sx={{
                        width: "50%",
                        zIndex: 0,
                        opacity: mode === 'light' ? 0 : 0.5,
                        transition: "opacity 0.3s",
                        transform: mode === 'light' ? "scale(0.8)" : "scale(1)"
                    }}
                >
                    <LightMode sx={{ fontSize: 20, color: theme.textMuted }} />
                </Stack>

                <Stack
                    direction="row"
                    justifyContent="center"
                    alignItems="center"
                    sx={{
                        width: "50%",
                        zIndex: 0,
                        opacity: mode === 'dark' ? 0 : 0.5,
                        transition: "opacity 0.3s",
                        transform: mode === 'dark' ? "scale(0.8)" : "scale(1)"
                    }}
                >
                    <DarkMode sx={{ fontSize: 20, color: theme.textMuted }} />
                </Stack>
            </Box>
        );
    }

    // Header styling: Premium Sliding Pill Toggle
    return (
        <Box
            onClick={toggleTheme}
            sx={{
                width: 72,
                height: 38,
                bgcolor: alpha(theme.textMain, 0.05),
                borderRadius: "20px",
                border: `1px solid ${alpha(theme.border, 0.6)}`,
                position: "relative",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                backdropFilter: "blur(8px)",
                "&:hover": {
                    bgcolor: alpha(theme.textMain, 0.08),
                    borderColor: alpha(theme.primary, 0.4),
                }
            }}
        >
            {/* Track Icons */}
            <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                sx={{ width: '100%', px: 1.25, zIndex: 0 }}
            >
                <DarkMode sx={{ fontSize: 16, color: mode === 'light' ? theme.textMuted : alpha(theme.textMuted, 0.2) }} />
                <LightMode sx={{ fontSize: 16, color: mode === 'dark' ? theme.textMuted : alpha(theme.textMuted, 0.2) }} />
            </Stack>

            {/* Sliding Thumb */}
            <Box
                sx={{
                    position: "absolute",
                    left: mode === 'light' ? 4 : 36, // Slide position
                    width: 30,
                    height: 30,
                    bgcolor: theme.paper,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: `0 2px 8px ${alpha(theme.textMain, 0.1)}`,
                    transition: "all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
                    zIndex: 1,
                    border: `1px solid ${alpha(theme.border, 0.3)}`
                }}
            >
                {mode === 'light' ?
                    <LightMode sx={{ fontSize: 18, color: "#F59E0B" }} /> :
                    <DarkMode sx={{ fontSize: 18, color: "#6366F1" }} />
                }
            </Box>
        </Box>
    );
}
