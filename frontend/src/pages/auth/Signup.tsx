import { useState } from "react";
import {
  Box,
  Container,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
  Link as MuiLink,
  Paper,
  InputAdornment,
  IconButton,
  Grid,
} from "@mui/material";
import {
  Visibility,
  VisibilityOff,
  EmailOutlined,
  LockOutlined,
} from "@mui/icons-material";
import { useNavigate, Link } from "react-router-dom";
import { useAuthStore } from "../../app/authStore";

const Signup = () => {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { signup, isLoading } = useAuthStore();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters long");
      return;
    }

    try {
      await signup(
        formData.firstName,
        formData.lastName,
        formData.email,
        formData.password
      );
      navigate("/factories");
    } catch (err: any) {
      setError(err.response?.data?.detail || "Signup failed. Please try again.");
    }
  };

  const inputStyles = {
    "& .MuiOutlinedInput-root": {
      borderRadius: 2.5,
      backgroundColor: "#fcfcfd",
      transition: "all 0.2s",
      "&:hover": { backgroundColor: "#fff" },
      "&.Mui-focused": { 
        backgroundColor: "#fff", 
        boxShadow: "0 0 0 4px rgba(79, 70, 229, 0.1)" 
      },
    },
  };

  const labelStyles = {
    fontWeight: 700,
    color: "#475569",
    mb: 1,
    display: "block",
    ml: 0.5,
    fontSize: "0.75rem",
    letterSpacing: "0.05em",
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "radial-gradient(circle at 98% 10%, rgba(79, 70, 229, 0.05) 0%, transparent 20%), radial-gradient(circle at 5% 90%, rgba(79, 70, 229, 0.08) 0%, transparent 20%), #f8fafc",
        position: "relative",
        overflow: "hidden",
        py: 4,
      }}
    >
      {/* Decorative Blur Blobs */}
      <Box sx={{ position: "absolute", bottom: "10%", right: "10%", width: 400, height: 400, background: "linear-gradient(135deg, #6366f1 0%, #a855f7 100%)", filter: "blur(120px)", opacity: 0.08, zIndex: 0 }} />

      <Container maxWidth="sm" sx={{ zIndex: 1 }}>
        <Paper
          elevation={0}
          sx={{
            p: { xs: 3, md: 5 },
            borderRadius: 4,
            border: "1px solid rgba(226, 232, 240, 0.8)",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.08)",
            background: "rgba(255, 255, 255, 0.9)",
            backdropFilter: "blur(10px)",
          }}
        >
          <Box sx={{ mb: 4, textAlign: "center" }}>
            <Typography
              variant="h4"
              sx={{ fontWeight: 800, color: "#1e293b", letterSpacing: "-0.025em", mb: 1 }}
            >
              Create Account
            </Typography>
            <Typography variant="body2" sx={{ color: "#64748b", fontWeight: 500 }}>
              Join Model Lifecycle and start managing today
            </Typography>
          </Box>

          {error && (
            <Alert 
              severity="error" 
              variant="outlined"
              sx={{ mb: 3, borderRadius: 2, backgroundColor: "#fef2f2", border: "1px solid #fee2e2" }}
            >
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit}>
            <Grid container spacing={2}>
              <Grid size={{xs:12, sm:6}}>
                <Typography variant="caption" sx={labelStyles}>FIRST NAME</Typography>
                <TextField
                  fullWidth
                  placeholder="John"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  required
                  disabled={isLoading}
                  sx={inputStyles}
                />
              </Grid>
              <Grid size={{xs:12, sm:6}}>
                <Typography variant="caption" sx={labelStyles}>LAST NAME</Typography>
                <TextField
                  fullWidth
                  placeholder="Doe"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  required
                  disabled={isLoading}
                  sx={inputStyles}
                />
              </Grid>
            </Grid>

            <Box sx={{ mt: 2.5 }}>
              <Typography variant="caption" sx={labelStyles}>EMAIL ADDRESS</Typography>
              <TextField
                fullWidth
                placeholder="john@example.com"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                required
                disabled={isLoading}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <EmailOutlined sx={{ fontSize: 20, color: "#94a3b8" }} />
                    </InputAdornment>
                  ),
                }}
                sx={inputStyles}
              />
            </Box>

            <Box sx={{ mt: 2.5 }}>
              <Typography variant="caption" sx={labelStyles}>PASSWORD</Typography>
              <TextField
                fullWidth
                placeholder="••••••••"
                name="password"
                type={showPassword ? "text" : "password"}
                value={formData.password}
                onChange={handleChange}
                required
                disabled={isLoading}
                helperText="Must be at least 6 characters"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <LockOutlined sx={{ fontSize: 20, color: "#94a3b8" }} />
                    </InputAdornment>
                  ),
                }}
                sx={inputStyles}
              />
            </Box>

            <Box sx={{ mt: 2.5, mb: 4 }}>
              <Typography variant="caption" sx={labelStyles}>CONFIRM PASSWORD</Typography>
              <TextField
                fullWidth
                placeholder="••••••••"
                name="confirmPassword"
                type={showPassword ? "text" : "password"}
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                disabled={isLoading}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShowPassword(!showPassword)} edge="end">
                        {showPassword ? <VisibilityOff sx={{ fontSize: 20 }} /> : <Visibility sx={{ fontSize: 20 }} />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                sx={inputStyles}
              />
            </Box>

            <Button
              type="submit"
              fullWidth
              variant="contained"
              disabled={isLoading}
              sx={{
                py: 1.8,
                borderRadius: 2.5,
                backgroundColor: "#4F46E5",
                fontSize: "0.95rem",
                fontWeight: 600,
                textTransform: "none",
                transition: "all 0.2s",
                "&:hover": {
                  backgroundColor: "#4338CA",
                  boxShadow: "0 10px 15px -3px rgba(79, 70, 229, 0.3)",
                  transform: "translateY(-1px)",
                },
              }}
            >
              {isLoading ? <CircularProgress size={24} color="inherit" /> : "Create free account"}
            </Button>
          </form>

          <Box sx={{ textAlign: "center", mt: 4 }}>
            <Typography variant="body2" sx={{ color: "#64748b", fontWeight: 500 }}>
              Already have an account?{" "}
              <MuiLink
                component={Link}
                to="/login"
                sx={{
                  color: "#4F46E5",
                  textDecoration: "none",
                  fontWeight: 700,
                  "&:hover": { textDecoration: "underline" },
                }}
              >
                Sign in
              </MuiLink>
            </Typography>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
};

export default Signup;