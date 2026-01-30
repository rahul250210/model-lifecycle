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
  Menu,
  MenuItem,
} from "@mui/material";

import StorageIcon from "@mui/icons-material/Storage";
import LogoutIcon from "@mui/icons-material/Logout";
import { useNavigate, useLocation, Outlet } from "react-router-dom";
import { useState } from "react";
import { useAuthStore } from "../app/authStore";
import { FactoriesDropdown } from "../components/NestedDropdownComponent";
import { themePalette } from "../theme/themePalette";

const drawerWidth = 280;


export default function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  // Updated paths to be unique so the color change is specific to the page
  const menuItems = [
    // Factories will be handled separately with FactoriesDropdown
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

          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Typography variant="body2" color="textSecondary">
              {user?.first_name} {user?.last_name}
            </Typography>
            <Avatar 
              onClick={handleMenuOpen}
              sx={{ 
                width: 36, height: 36, 
                bgcolor: themePalette.primary, 
                fontWeight: 600,
                boxShadow: `0 0 0 2px #fff, 0 0 0 4px ${alpha(themePalette.primary, 0.1)}`,
                cursor: "pointer",
                transition: "transform 0.2s",
                "&:hover": {
                  transform: "scale(1.05)",
                }
              }}
            >
              {user?.first_name?.charAt(0)}{user?.last_name?.charAt(0)}
            </Avatar>
            <Menu
              anchorEl={anchorEl}
              open={open}
              onClose={handleMenuClose}
              anchorOrigin={{
                vertical: "bottom",
                horizontal: "right",
              }}
              transformOrigin={{
                vertical: "top",
                horizontal: "right",
              }}
            >
              <MenuItem onClick={handleLogout}>
                <LogoutIcon sx={{ mr: 1 }} fontSize="small" />
                Logout
              </MenuItem>
            </Menu>
          </Box>
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
          
            <FactoriesDropdown />
            
            {/* Other Menu Items */}
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
                       sx: {
                            transition: "color 0.3s",
                          },
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