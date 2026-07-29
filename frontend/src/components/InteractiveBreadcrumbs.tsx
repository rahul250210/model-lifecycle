"use client";

import React, { useState, type MouseEvent } from 'react';
import { Breadcrumbs, Link, Typography, IconButton, Menu, MenuItem, Box, alpha, CircularProgress } from '@mui/material';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import { useNavigate } from 'react-router-dom';
import axios from '../api/axios';
import { useTheme } from '../theme/ThemeContext';

export interface BreadcrumbItem {
  label: string;
  link?: string;
  type?: 'root' | 'algorithm' | 'factory' | 'model';
  id?: number | string;
}

interface InteractiveBreadcrumbsProps {
  path: BreadcrumbItem[];
}

export default function InteractiveBreadcrumbs({ path }: InteractiveBreadcrumbsProps) {
  const navigate = useNavigate();
  const { theme } = useTheme();

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [activeItem, setActiveItem] = useState<BreadcrumbItem | null>(null);
  const [options, setOptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const handleOpenMenu = async (event: MouseEvent<HTMLElement>, item: BreadcrumbItem) => {
    if (!item.type) return;

    setAnchorEl(event.currentTarget);
    setActiveItem(item);
    setLoading(true);
    setOptions([]);

    try {
      let res;
      if (item.type === 'root') {
        res = await axios.get('/algorithms');
        setOptions(res.data.map((x: any) => ({ label: x.name, link: `/algorithms/${x.id}/factories` })));
      } else if (item.type === 'algorithm') {
        res = await axios.get(`/algorithms/${item.id}/factories`);
        setOptions(res.data.map((x: any) => ({ label: x.name, link: `/algorithms/${item.id}/factories/${x.id}/models` })));
      } else if (item.type === 'factory') {
        const algoItem = path.find(p => p.type === 'algorithm');
        if (algoItem) {
          res = await axios.get(`/algorithms/${algoItem.id}/factories/${item.id}/models`);
          setOptions(res.data.map((x: any) => ({ label: x.name, link: `/algorithms/${algoItem.id}/factories/${item.id}/models/${x.id}/versions` })));
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setAnchorEl(null);
    setActiveItem(null);
  };

  const handleSelect = (link: string) => {
    navigate(link);
    handleClose();
  };

  const renderSeparator = (item: BreadcrumbItem) => {
    // We don't render a separator if it's a leaf node (e.g. model or version) that doesn't have children
    if (!item.type || item.type === 'model') return null;
    
    return (
      <IconButton 
        size="small" 
        onClick={(e) => handleOpenMenu(e, item)}
        sx={{ 
          p: 0.5,
          mx: 0.5,
          color: theme.textMuted,
          '&:hover': {
            bgcolor: alpha(theme.primary, 0.1),
            color: theme.primary,
          }
        }}
      >
        <NavigateNextIcon fontSize="small" />
      </IconButton>
    );
  };

  return (
    <>
      <Breadcrumbs separator="" aria-label="breadcrumb" sx={{ display: 'flex', alignItems: 'center' }}>
        {path.map((item, index) => {
          const isLast = index === path.length - 1;

          return (
            <Box key={index} sx={{ display: 'flex', alignItems: 'center' }}>
              {isLast ? (
                <Typography fontWeight={800} sx={{ fontSize: '1.2rem', color: theme.textMain }}>
                  {item.label}
                </Typography>
              ) : (
                <Link
                  underline="hover"
                  color="inherit"
                  onClick={() => item.link && navigate(item.link)}
                  sx={{ cursor: 'pointer', display: 'flex', alignItems: 'center', fontWeight: 600, fontSize: '1.2rem', color: theme.textMuted }}
                >
                  {item.label}
                </Link>
              )}
              {renderSeparator(item)}
            </Box>
          );
        })}
      </Breadcrumbs>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        PaperProps={{
          sx: {
            mt: 1.5,
            borderRadius: '12px',
            minWidth: 180,
            boxShadow: `0 8px 32px ${alpha(theme.textMain, 0.1)}`,
            border: `1px solid ${theme.border}`,
            bgcolor: theme.paper,
            maxHeight: 300,
          }
        }}
        transformOrigin={{ horizontal: 'left', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'left', vertical: 'bottom' }}
      >
        {loading ? (
          <MenuItem disabled sx={{ justifyContent: 'center', py: 2 }}>
            <CircularProgress size={20} />
          </MenuItem>
        ) : options.length > 0 ? (
          options.map((opt, i) => (
            <MenuItem 
              key={i} 
              onClick={() => handleSelect(opt.link)}
              sx={{ 
                fontWeight: 600, 
                color: theme.textMain,
                '&:hover': { bgcolor: alpha(theme.primary, 0.1), color: theme.primary }
              }}
            >
              {opt.label}
            </MenuItem>
          ))
        ) : (
          <MenuItem disabled sx={{ color: theme.textMuted }}>
            No options found
          </MenuItem>
        )}
      </Menu>
    </>
  );
}
