import { RoutineView } from "@/components/routine/routine-view";
import { parseCheckInParams, type RawSearchParams } from "@/lib/prepare/check-in-params";

type SearchParams = Promise<RawSearchParams>;

export default async function RoutinePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  return <RoutineView checkIn={parseCheckInParams(params)} />;
}
