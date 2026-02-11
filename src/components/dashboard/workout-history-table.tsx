import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, formatDateTime } from "@/lib/utils";
import { WorkoutDetailDialog } from "@/components/dashboard/workout-detail-dialog";
import type { WorkoutRow } from "@/components/dashboard/types";

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  const normalized = status.toLowerCase();
  if (normalized === "accepted" || normalized === "uploaded") {
    return "default";
  }
  if (normalized === "rejected") {
    return "destructive";
  }
  if (normalized === "generated") {
    return "secondary";
  }

  return "outline";
}

type WorkoutHistoryTableProps = {
  workouts: WorkoutRow[];
};

export function WorkoutHistoryTable({ workouts }: WorkoutHistoryTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Workout History</CardTitle>
        <CardDescription>Latest generated workouts and status.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Created</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Scheduled</TableHead>
              <TableHead className="text-right">Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {workouts.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                  No workouts yet. Use the workout page to generate one.
                </TableCell>
              </TableRow>
            )}

            {workouts.map((workout) => (
              <TableRow key={workout.id}>
                <TableCell>{formatDateTime(workout.createdAt)}</TableCell>
                <TableCell className="font-medium text-foreground">{workout.title}</TableCell>
                <TableCell className="capitalize">{workout.workoutType}</TableCell>
                <TableCell>
                  <Badge variant={statusVariant(workout.status)}>
                    {workout.status}
                  </Badge>
                </TableCell>
                <TableCell>{formatDate(workout.scheduledDate)}</TableCell>
                <TableCell className="text-right">
                  <WorkoutDetailDialog
                    workout={{
                      id: workout.id,
                      title: workout.title,
                      workoutType: workout.workoutType,
                      status: workout.status,
                      createdAt: workout.createdAt.toISOString(),
                      scheduledDate: workout.scheduledDate
                        ? workout.scheduledDate.toISOString()
                        : null,
                      aiDescription: workout.aiDescription,
                      workoutJson: workout.workoutJson,
                    }}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
