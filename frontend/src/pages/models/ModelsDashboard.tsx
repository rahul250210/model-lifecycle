"use client";

import { Grid, Card, CardContent, Typography, Chip, Button } from "@mui/material";
import { useNavigate } from "react-router-dom";

interface Model {
  id: number;
  name: string;
  versions_count: number;
  created_at: string;
}

export default function ModelsDashboard({ models, factoryId, algorithmId }: {
  models: Model[];
  factoryId: string;
  algorithmId: string;
}) {
  const navigate = useNavigate();

  return (
    <Grid container spacing={3}>
      {models.map((model) => (
        <Grid xs={12} md={4} key={model.id}>
          <Card elevation={2} sx={{ borderRadius: 3 }}>
            <CardContent>
              <Typography variant="h6" fontWeight={600}>
                {model.name}
              </Typography>

              <Chip
                label={`${model.versions_count} Versions`}
                sx={{ mt: 1 }}
              />

              <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                Created: {new Date(model.created_at).toLocaleDateString()}
              </Typography>

              <Button
                size="small"
                sx={{ mt: 2 }}
                onClick={() =>
                  navigate(
                    `/factories/${factoryId}/algorithms/${algorithmId}/models/${model.id}`
                  )
                }
              >
                Open Model
              </Button>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
}
