"use client";

import {
  Box,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  AppBar,
  Typography,
  CssBaseline,
  Avatar,
  alpha,
} from "@mui/material";
import FactoryIcon from "@mui/icons-material/Factory";
import ScienceIcon from "@mui/icons-material/Science";
import LayersIcon from "@mui/icons-material/Layers";
import TimelineIcon from "@mui/icons-material/Timeline";
import StorageIcon from "@mui/icons-material/Storage";
import { useNavigate, useLocation, Outlet } from "react-router-dom";

const drawerWidth = 280;

export const themePalette = {
  primary: "#4F46E5",       // Indigo (Brand Color)
  primaryLight: "#EEF2FF",  // Soft Indigo Wash
  sidebarBg: "#0F172A",     // Deep Navy/Slate
  sidebarActive: "#1E293B", // Lighter Slate for active background
  textMuted: "#94A3B8",     // Slate Gray for inactive text
  background: "#F8FAFC",    // Page background
  border: "#E2E8F0",        // subtle borders
};

export default function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  // Updated paths to be unique so the color change is specific to the page
  const menuItems = [
    { label: "Factories", icon: <FactoryIcon />, path: "/factories" },
    { label: "Models", icon: <LayersIcon />, path: "/models" },
    { label: "Versions", icon: <TimelineIcon />, path: "/versions" },
    { label: "Experiments", icon: <ScienceIcon />, path: "/experiments" },
    { label: "Artifacts", icon: <StorageIcon />, path: "/artifacts" },
  ];

  return (
    <Box sx={{ display: "flex", bgcolor: themePalette.background, minHeight: "100vh" }}>
      <CssBaseline />

      <AppBar
        position="fixed"
        sx={{
          zIndex: (theme) => theme.zIndex.drawer + 1,
          backgroundColor: alpha("#ffffff", 0.9),
          backdropFilter: "blur(12px)",
          color: "#1E293B",
          borderBottom: `1px solid ${themePalette.border}`,
        }}
        elevation={0}
      >
        <Toolbar sx={{ justifyContent: "space-between", px: 4 }}>
          <Typography 
            variant="h4" 
            fontWeight={800} 
            sx={{ 
              letterSpacing: "-0.02em",
              background: `linear-gradient(45deg, ${themePalette.primary}, #818CF8)`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              cursor: "pointer"
            }}
            onClick={() => navigate("/")}
          >
            NexusForge
          </Typography>

          <Avatar 
            sx={{ 
              width: 36, height: 36, 
              bgcolor: themePalette.primary, 
              fontWeight: 600,
              boxShadow: `0 0 0 2px #fff, 0 0 0 4px ${alpha(themePalette.primary, 0.1)}`
            }}
          >
            RS
          </Avatar>
        </Toolbar>
      </AppBar>

      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          [`& .MuiDrawer-paper`]: {
            width: drawerWidth,
            boxSizing: "border-box",
            backgroundColor: themePalette.sidebarBg,
            color: "#fff",
            borderRight: "none",
          },
        }}
      >
        <Toolbar />
        <Box sx={{ px: 2, py: 4 }}>
          <List>
            {menuItems.map((item) => {
              // Strict active check: specific to the path
              const isActive = location.pathname.startsWith(item.path);

              return (
                <ListItemButton
                  key={item.label}
                  onClick={() => navigate(item.path)}
                   sx={{
                    mx: 1,
                    mb: 1,
                    borderRadius: "10px",
                    py:1.5,
                    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                    backgroundColor: isActive ? alpha(themePalette.primary, 0.15) : "transparent",
                    borderLeft: isActive ? `3px solid ${themePalette.primary}` : "3px solid transparent",
                    "&:hover": {
                      backgroundColor: alpha(themePalette.primary, 0.1),
                      transform: "translateX(4px)",
                    },
                  }}
                >
                  <ListItemIcon 
                    sx={{ 
                      minWidth: 40, 
                      // Icon color stays muted unless active
                      color: isActive ? themePalette.primary : themePalette.textMuted,
                      transform: isActive ? "scale(1.1)" : "scale(1)",
                      transition: "all 0.3s ease"
                    }}
                  >
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText 
                    primary={item.label} 
                    primaryTypographyProps={{ 
                      fontSize: "0.9rem", 
                      fontWeight: isActive ? 700 : 500,
                      // Text color turns white when active, otherwise muted
                      color: isActive ? "#FFFFFF" : themePalette.textMuted,
                      transition: "color 0.3s"
                    }} 
                  />
                </ListItemButton>
              );
            })}
          </List>
        </Box>
      </Drawer>

      <Box component="main" sx={{ flexGrow: 1, p: 5 }}>
        <Toolbar />
        <Box sx={{ maxWidth: "1400px", mx: "auto" }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}