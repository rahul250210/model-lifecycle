import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
import { themePalette } from "../theme/themePalette";

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
}: NestedDropdownProps) => {
  const navigate = useNavigate();
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
    if (!expanded) return;

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
        navigate(`/factories`);
        break;
      case "algorithm":
        navigate(`/factories/${parentFactoryId}/algorithms`);
        break;
      case "model":
        navigate(`/factories/${parentFactoryId}/algorithms/${parentAlgorithmId}/models`);
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
          if (hasLoadableChildren) {
            handleToggle();
          } else {
            handleItemClick(e);
          }
        }}
        sx={{
          pl: `${level * 20}px`,
          pr: 2,
          py: 0.75,
          borderRadius: "4px",
          backgroundColor: alpha(themePalette.primary, level > 0 ? 0.03 : 0),
          "&:hover": {
            backgroundColor: alpha(themePalette.primary, 0.1),
          },
          transition: "all 0.2s ease",
          opacity: 1,
          cursor: "pointer",
        }}
      >
        <ListItemIcon
          sx={{
            minWidth: 32,
            color: themePalette.primary,
            display: "flex",
            alignItems: "center",
            gap: 0.5,
          }}
        >
          {loading ? (
            <CircularProgress size={16} />
          ) : (
            <>
              {hasLoadableChildren && (
                <Box sx={{ display: "flex", width: 20 }}>
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
          onClick={(e) => {
            e.stopPropagation();
            handleItemClick(e as any);
          }}
          primaryTypographyProps={{
            fontSize: "0.85rem",
            fontWeight: 500,
            color: "#FFFFFF",
            sx: {
              cursor: "pointer",
              "&:hover": {
                textDecoration: "underline",
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
        <List component="div" disablePadding>
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
                  color: "#94A3B8",
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
}

export const FactoriesDropdown = ({ onItemSelect }: FactoriesDropdownProps) => {
  const [expanded, setExpanded] = useState(false);
  const [factories, setFactories] = useState<NestedItemWithState[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const handleToggle = () => {
    setExpanded(!expanded);
  };

  return (
    <>
      <ListItemButton
        onClick={handleToggle}
        sx={{
          px: 2,
          py: 1.5,
          borderRadius: "8px",
          backgroundColor: expanded
            ? alpha(themePalette.primary, 0.15)
            : "transparent",
          borderLeft: expanded
            ? `3px solid ${themePalette.primary}`
            : "3px solid transparent",
          transition: "all 0.3s ease",
          mx: 1,
          mb: 1,
          "&:hover": {
            backgroundColor: alpha(themePalette.primary, 0.1),
          },
        }}
      >
        <ListItemIcon
          sx={{
            minWidth: 40,
            color: expanded ? themePalette.primary : themePalette.textMuted,
            display: "flex",
            alignItems: "center",
            gap: 0.5,
          }}
        >
          {loading && <CircularProgress size={20} />}
          {!loading && (
            <>
              {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
              <FactoryIcon fontSize="small" />
            </>
          )}
        </ListItemIcon>
        <ListItemText
          primary="Factories"
          primaryTypographyProps={{
            fontSize: "0.9rem",
            fontWeight: expanded ? 700 : 500,
            color: expanded ? "#FFFFFF" : themePalette.textMuted,
            sx: {
                  transition: "color 0.3s",
                }, 
          }}
        />
      </ListItemButton>

      {error && (
        <Alert
          severity="error"
          sx={{ mx: 1, mt: 1, py: 0.75, fontSize: "0.75rem" }}
        >
          {error}
        </Alert>
      )}

      <Collapse in={expanded} timeout="auto" unmountOnExit>
        <List
          component="div"
          disablePadding
          sx={{
            backgroundColor: "rgba(0, 0, 0, 0.2)",
            borderRadius: "6px",
            mx: 1,
            mt: 1,
            p: 1,
          }}
        >
          {factories.length === 0 && !loading ? (
            <ListItemButton disabled sx={{ py: 2, justifyContent: "center" }}>
              <ListItemText
                primary="No factories created yet"
                primaryTypographyProps={{
                  fontSize: "0.8rem",
                  color: themePalette.textMuted,
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
                />
              </Box>
            ))
          )}
        </List>
      </Collapse>
    </>
  );
};
