import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatDate,
  formatDistanceMeters,
  formatDurationSeconds,
  formatPaceSecondsPerKm,
} from "@/lib/utils";
import type { ActivityRow } from "@/components/dashboard/types";

type RecentActivitiesTableProps = {
  activities: ActivityRow[];
};

export function RecentActivitiesTable({
  activities,
}: RecentActivitiesTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activities</CardTitle>
        <CardDescription>Last 7 activities synced from Garmin.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Activity</TableHead>
              <TableHead className="text-right">Distance</TableHead>
              <TableHead className="text-right">Duration</TableHead>
              <TableHead className="text-right">Pace</TableHead>
              <TableHead className="text-right">Avg HR</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {activities.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                  No activity data yet. Connect Garmin and run a sync.
                </TableCell>
              </TableRow>
            )}

            {activities.map((activity) => (
              <TableRow key={activity.id}>
                <TableCell>{formatDate(activity.activityDate)}</TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium text-foreground">
                      {activity.activityName ?? "Untitled activity"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {activity.activityType ?? "Unknown type"}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  {formatDistanceMeters(activity.distanceMeters)}
                </TableCell>
                <TableCell className="text-right">
                  {formatDurationSeconds(activity.durationSeconds)}
                </TableCell>
                <TableCell className="text-right">
                  {formatPaceSecondsPerKm(activity.averagePaceSecondsPerKm)}
                </TableCell>
                <TableCell className="text-right">
                  {activity.averageHrBpm ? `${activity.averageHrBpm} bpm` : "-"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
