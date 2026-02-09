"use client";

import {
  Card,
  CardContent,
  Typography,
  Chip,
  Button,
  Stack,
  Box,
  alpha,
} from "@mui/material";

import ReplayIcon from "@mui/icons-material/Replay";
import VisibilityIcon from "@mui/icons-material/Visibility";
import DeleteIcon from "@mui/icons-material/Delete";

import { useNavigate } from "react-router-dom";
import { useTheme } from "../../theme/ThemeContext";

/* =======================
   Types
======================= */

interface Version {
  id: number;
  version_number: number;
  note?: string;
  is_active: boolean;
  created_at: string;
}

interface Props {
  versions: Version[];
  basePath: string;
  onRollback?: (versionId: number) => void;
  onDelete?: (versionId: number) => void;
}

/* =======================
   Component
======================= */

export default function VersionsDashboard({
  versions,
  basePath,
  onRollback,
  onDelete,
}: Props) {
  const navigate = useNavigate();
  const { theme } = useTheme();

  return (
    <Stack spacing={2}>
      {versions.map((v) => (
        <Card
          key={v.id}
          elevation={0}
          sx={{
            borderLeft: "6px solid",
            borderLeftColor: v.is_active ? theme.success : theme.border,
            bgcolor: v.is_active
              ? alpha(theme.success, 0.05)
              : theme.paper,
            border: `1px solid ${theme.border}`,
            borderLeftWidth: "6px",
            borderRadius: "12px",
          }}
        >
          <CardContent>
            {/* ================= Header ================= */}
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
              }}
            >
              <Box>
                <Typography fontWeight={600} sx={{ color: theme.textMain }}>
                  Version v{v.version_number}
                </Typography>

                {v.note && (
                  <Typography
                    variant="body2"
                    sx={{ mt: 0.5, color: theme.textMuted }}
                  >
                    {v.note}
                  </Typography>
                )}
              </Box>

              {v.is_active && (
                <Chip
                  label="ACTIVE"
                  size="small"
                  sx={{
                    bgcolor: alpha(theme.success, 0.1),
                    color: theme.success,
                    fontWeight: 800,
                  }}
                />
              )}
            </Box>

            {/* ================= Meta ================= */}
            <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
              <Chip
                size="small"
                label={new Date(v.created_at).toLocaleString()}
                sx={{
                  bgcolor: theme.background,
                  color: theme.textMuted,
                  fontWeight: 600,
                }}
              />
            </Stack>

            {/* ================= Actions ================= */}
            <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
              {/* Details */}
              <Button
                size="small"
                startIcon={<VisibilityIcon />}
                onClick={() => navigate(`${basePath}/${v.id}`)}
                sx={{ color: theme.primary }}
              >
                Details
              </Button>

              {/* Rollback */}
              {!v.is_active && onRollback && (
                <Button
                  size="small"
                  startIcon={<ReplayIcon />}
                  onClick={() => onRollback(v.id)}
                  sx={{ color: theme.warning }}
                >
                  Rollback
                </Button>
              )}

              {/* Delete */}
              {onDelete && (
                <Button
                  size="small"
                  startIcon={<DeleteIcon />}
                  disabled={v.is_active}
                  onClick={() => {
                    if (
                      confirm(
                        `Delete Version v${v.version_number}? This cannot be undone.`
                      )
                    ) {
                      onDelete(v.id);
                    }
                  }}
                  sx={{ color: theme.danger }}
                >
                  Delete
                </Button>
              )}
            </Stack>
          </CardContent>
        </Card>
      ))}
    </Stack>
  );
}
