import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Collapse,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Box,
  CircularProgress,
  Alert,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMoreOutlined";
import ExpandLessIcon from "@mui/icons-material/ExpandLessOutlined";
import FactoryIcon from "@mui/icons-material/FactoryOutlined";
import ScienceIcon from "@mui/icons-material/ScienceOutlined";
import LayersIcon from "@mui/icons-material/LayersOutlined";
import TimelineIcon from "@mui/icons-material/TimelineOutlined";
import { alpha } from "@mui/material";
import instance from "../api/axios";
import { useTheme } from "../theme/ThemeContext";

export interface NestedItem {
  id: number;
  name: string;
  type: "factory" | "algorithm" | "model" | "version";
  factoryId?: number;
  algorithmId?: number;
  modelId?: number;
}

interface NestedItemWithState extends NestedItem {
  children?: NestedItemWithState[];
}

interface NestedDropdownProps {
  level?: number;
  item: NestedItemWithState;
  onItemSelect?: (item: NestedItem) => void;
  parentFactoryId?: number;
  parentAlgorithmId?: number;
  collapsed?: boolean;
}

const getIcon = (type: string) => {
  switch (type) {
    case "factory":
      return <FactoryIcon fontSize="small" />;
    case "algorithm":
      return <ScienceIcon fontSize="small" />;
    case "model":
      return <LayersIcon fontSize="small" />;
    case "version":
      return <TimelineIcon fontSize="small" />;
    default:
      return null;
  }
};

export const NestedDropdown = ({
  level = 0,
  item,
  onItemSelect,
  parentFactoryId,
  parentAlgorithmId,
  collapsed = false,
}: NestedDropdownProps) => {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState<NestedItemWithState[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchChildren = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError(null);

    try {
      let response;

      if (item.type === "factory") {
        // Fetch algorithms for this factory
        response = await instance.get(`/factories/${item.id}/algorithms`);
        setChildren(
          response.data.map((algo: any) => ({
            id: algo.id,
            name: algo.name,
            type: "algorithm",
            factoryId: item.id,
          }))
        );
      } else if (item.type === "algorithm") {
        // Fetch models for this algorithm
        response = await instance.get(
          `/factories/${parentFactoryId}/algorithms/${item.id}/models`
        );
        setChildren(
          response.data.map((model: any) => ({
            id: model.id,
            name: model.name,
            type: "model",
            factoryId: parentFactoryId,
            algorithmId: item.id,
          }))
        );
      } else if (item.type === "model") {
        // Fetch versions for this model
        response = await instance.get(
          `/factories/${parentFactoryId}/algorithms/${parentAlgorithmId}/models/${item.id}/versions`
        );
        setChildren(
          response.data.map((version: any) => ({
            id: version.id,
            name: `v${version.version_number}`,
            type: "version",
            factoryId: parentFactoryId,
            algorithmId: parentAlgorithmId,
            modelId: item.id,
          }))
        );
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to load data");
      console.error("Error fetching children:", err);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  // Auto-refresh when expanded
  useEffect(() => {
    if (!expanded || collapsed) return;

    // Fetch immediately when expanded (show loading)
    fetchChildren(true);

    // Set up polling interval to refresh every 10 seconds while expanded (no loading spinner)
    const pollInterval = setInterval(() => {
      fetchChildren(false);
    }, 10000);

    // Cleanup interval when component unmounts or expanded changes to false
    return () => clearInterval(pollInterval);
  }, [expanded, item.id, parentFactoryId, parentAlgorithmId]);

  const handleToggle = () => {
    setExpanded(!expanded);
  };

  const handleItemClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (onItemSelect) {
      onItemSelect(item);
    }

    // Navigate based on item type
    switch (item.type) {
      case "factory":
        navigate(`/factories/${item.id}/algorithms`);
        break;
      case "algorithm":
        navigate(`/factories/${parentFactoryId}/algorithms/${item.id}/models`);
        break;
      case "model":
        navigate(`/factories/${parentFactoryId}/algorithms/${parentAlgorithmId}/models/${item.id}/versions`);
        break;
      case "version":
        navigate(`/factories/${parentFactoryId}/algorithms/${parentAlgorithmId}/models/${item.modelId}/versions/${item.id}`);
        break;
    }
  };

  const hasLoadableChildren =
    item.type === "factory" ||
    item.type === "algorithm" ||
    item.type === "model";

  return (
    <>
      <ListItemButton
        onClick={(e) => {
          handleItemClick(e);
        }}
        sx={{
          pl: collapsed ? 2.5 : `${level * 16 + 12}px`, // Adjusted padding calculation
          justifyContent: collapsed ? "center" : "initial",
          pr: collapsed ? 2.5 : 2,
          py: 0.8,
          my: 0.5,
          mx: 1,
          borderRadius: "8px",
          backgroundColor: alpha(theme.primary, level > 0 ? 0.03 : 0),
          borderLeft: `3px solid ${expanded ? theme.primary : "transparent"}`,
          "&:hover": {
            backgroundColor: alpha(theme.primary, 0.08),
            "& .MuiListItemIcon-root": { color: theme.primary },
          },
          transition: "all 0.2s ease",
          cursor: "pointer",
        }}
      >
        <ListItemIcon
          sx={{
            minWidth: 28,
            color: expanded ? theme.primary : theme.textMuted,
            display: "flex",
            alignItems: "center",
            gap: 1,
            transition: "color 0.2s"
          }}
        >
          {loading ? (
            <CircularProgress size={16} />
          ) : (
            <>
              {hasLoadableChildren && !collapsed && (
                <Box
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggle();
                  }}
                  sx={{
                    display: "flex",
                    width: 24,
                    height: 24,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '4px',
                    "&:hover": { bgcolor: alpha(theme.primary, 0.1) }
                  }}
                >
                  {expanded ? (
                    <ExpandLessIcon fontSize="small" />
                  ) : (
                    <ExpandMoreIcon fontSize="small" />
                  )}
                </Box>
              )}
              {getIcon(item.type)}
            </>
          )}
        </ListItemIcon>
        <ListItemText
          primary={item.name}
          primaryTypographyProps={{
            fontSize: "0.85rem",
            fontWeight: 500,
            color: theme.textMain,
            sx: {
              transition: "color 0.2s",
              "&:hover": {
                color: theme.primary,
              },
            },
          }}
        />
      </ListItemButton>

      {error && (
        <Alert
          severity="error"
          sx={{
            ml: `${level * 20 + 32}px`,
            mt: 0.5,
            py: 0.5,
            fontSize: "0.75rem",
          }}
        >
          {error}
        </Alert>
      )}

      <Collapse in={expanded} timeout="auto" unmountOnExit>
        <List component="ul" disablePadding>
          {loading ? (
            <Box
              sx={{
                display: "flex",
                justifyContent: "center",
                py: 2,
                pl: `${level * 20 + 32}px`,
              }}
            >
              <CircularProgress size={20} />
            </Box>
          ) : children.length === 0 ? (
            <ListItemButton
              disabled
              sx={{
                pl: `${(level + 1) * 20}px`,
                py: 0.75,
                opacity: 0.5,
              }}
            >
              <ListItemText
                primary="No items"
                primaryTypographyProps={{
                  fontSize: "0.8rem",
                  color: theme.textMuted,
                }}
              />
            </ListItemButton>
          ) : (
            children.map((child) => (
              <Box
                key={`${child.type}-${child.id}`}
                component="li"
                sx={{ listStyle: "none" }}
              >
                <NestedDropdown
                  level={level + 1}
                  item={child}
                  onItemSelect={onItemSelect}
                  parentFactoryId={
                    child.factoryId || parentFactoryId
                  }
                  parentAlgorithmId={
                    child.algorithmId || parentAlgorithmId
                  }
                />
              </Box>
            ))
          )}
        </List>
      </Collapse>
    </>
  );
};

interface FactoriesDropdownProps {
  onItemSelect?: (item: NestedItem) => void;
  collapsed?: boolean;
}

export const FactoriesDropdown = ({ onItemSelect, collapsed = false }: FactoriesDropdownProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [factories, setFactories] = useState<NestedItemWithState[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isActive = location.pathname.startsWith("/factories");

  const fetchFactories = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError(null);

    try {
      const response = await instance.get("/factories");
      const factoriesData = response.data.map((factory: any) => ({
        id: factory.id,
        name: factory.name,
        type: "factory",
      }));
      setFactories(factoriesData);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to load factories");
      console.error("Error fetching factories:", err);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  // Auto-refresh when expanded
  useEffect(() => {
    if (!expanded) return;

    // Fetch immediately when expanded (show loading)
    fetchFactories(true);

    // Set up polling interval to refresh every 10 seconds while expanded (no loading spinner)
    const pollInterval = setInterval(() => {
      fetchFactories(false);
    }, 10000);

    // Cleanup interval when component unmounts or expanded changes to false
    return () => clearInterval(pollInterval);
  }, [expanded]);

  const handleClick = () => {
    navigate("/factories");
  };

  return (
    <>
      <ListItemButton
        onClick={handleClick}
        sx={{
          px: 1.5,
          py: 1.5,
          borderRadius: "14px",
          backgroundColor: isActive
            ? alpha(theme.primary, 0.15)
            : "transparent",
          borderLeft: isActive
            ? `3px solid ${theme.primary}`
            : "3px solid transparent",
          transition: "all 0.3s ease",
          mx: 1,
          mb: 1,
          "&:hover": {
            backgroundColor: alpha(theme.primary, 0.1),
          },
        }}
      >
        <ListItemIcon
          sx={{
            minWidth: 36,
            color: isActive ? theme.primary : theme.textMuted,
            display: "flex",
            alignItems: "center",
            gap: 0.5,
          }}
        >
          {loading && <CircularProgress size={20} />}
          {!loading && <FactoryIcon fontSize="small" />}
        </ListItemIcon>
        <ListItemText
          primary="Factories"
          primaryTypographyProps={{
            fontSize: "0.95rem",
            fontWeight: isActive ? 800 : 600,
            color: isActive ? theme.primary : theme.textMain,
            sx: {
              transition: "color 0.3s",
              letterSpacing: isActive ? "-0.01em" : "normal"
            },
          }}
          sx={{ opacity: collapsed ? 0 : 1, display: collapsed ? "none" : "block", flexGrow: 1 }}
        />
        {!collapsed && !loading && (
          <Box
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            sx={{
              color: theme.textMuted,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              width: 32,
              height: 32,
              borderRadius: '8px',
              "&:hover": { bgcolor: alpha(theme.primary, 0.1), color: theme.primary },
              transition: "all 0.2s"
            }}
          >
            {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
          </Box>
        )}
      </ListItemButton>

      {error && (
        <Alert
          severity="error"
          sx={{ mx: 1, mt: 1, py: 0.75, fontSize: "0.75rem" }}
        >
          {error}
        </Alert>
      )}

      <Collapse in={expanded && !collapsed} timeout="auto" unmountOnExit>
        <List
          component="ul"
          disablePadding
          sx={{
            backgroundColor: alpha(theme.background, 0.5),
            borderRadius: "12px",
            mx: 1.5,
            mt: 0.5,
            p: 1,
            borderLeft: `1px solid ${alpha(theme.border, 0.5)}`
          }}
        >
          {factories.length === 0 && !loading ? (
            <ListItemButton disabled sx={{ py: 2, justifyContent: "center" }}>
              <ListItemText
                primary="No factories created yet"
                primaryTypographyProps={{
                  fontSize: "0.8rem",
                  color: theme.textMuted,
                  textAlign: "center",
                }}
              />
            </ListItemButton>
          ) : (
            factories.map((factory) => (
              <Box
                key={`factory-${factory.id}`}
                component="li"
                sx={{ listStyle: "none" }}
              >
                <NestedDropdown
                  level={0}
                  item={factory}
                  onItemSelect={onItemSelect}
                  collapsed={collapsed}
                />
              </Box>
            ))
          )}
        </List>
      </Collapse>
    </>
  );
};
