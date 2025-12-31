"use client";

import {
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Chip,
} from "@mui/material";
import { useNavigate } from "react-router-dom";

interface Experiment {
  id: number;
  name: string;
  runs_count: number;
  created_at: string;
}

export default function ExperimentsDashboard({
  experiments,
  basePath,
}: {
  experiments: Experiment[];
  basePath: string;
}) {
  const navigate = useNavigate();

  return (
    <Table>
      <TableHead>
        <TableRow>
          <TableCell>Experiment</TableCell>
          <TableCell>Runs</TableCell>
          <TableCell>Created</TableCell>
        </TableRow>
      </TableHead>

      <TableBody>
        {experiments.map((exp) => (
          <TableRow
            key={exp.id}
            hover
            sx={{ cursor: "pointer" }}
            onClick={() => navigate(`${basePath}/${exp.id}`)}
          >
            <TableCell>{exp.name}</TableCell>
            <TableCell>
              <Chip label={`${exp.runs_count} runs`} />
            </TableCell>
            <TableCell>
              {new Date(exp.created_at).toLocaleDateString()}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
