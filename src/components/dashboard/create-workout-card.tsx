import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function CreateWorkoutCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Workout</CardTitle>
        <CardDescription>
          Build your next session with AI guidance once workout generation is enabled.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild>
          <Link href="/workout">Open Workout Builder</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
