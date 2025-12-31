"use client";

import {
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Button,
} from "@mui/material";
import { useNavigate } from "react-router-dom";

interface Artifact {
  id: number;
  name: string;
  type: string;
  size: number;
}

export default function ArtifactsDashboard({
  artifacts,
}: {
  artifacts: Artifact[];
}) {
  const navigate = useNavigate();

  return (
    <Table>
      <TableHead>
        <TableRow>
          <TableCell>Artifact</TableCell>
          <TableCell>Type</TableCell>
          <TableCell>Size (KB)</TableCell>
          <TableCell>Action</TableCell>
        </TableRow>
      </TableHead>

      <TableBody>
        {artifacts.map((a) => (
          <TableRow key={a.id}>
            <TableCell>{a.name}</TableCell>
            <TableCell>{a.type}</TableCell>
            <TableCell>{(a.size / 1024).toFixed(2)}</TableCell>
            <TableCell>
              <Button
                size="small"
                onClick={() => navigate(`/artifacts/${a.id}`)}
              >
                View
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
