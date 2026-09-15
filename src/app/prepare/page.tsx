import { PreRoundCheckIn } from "@/components/prepare/pre-round-check-in";
import { parseCheckInParams, type RawSearchParams } from "@/lib/prepare/check-in-params";

type SearchParams = Promise<RawSearchParams>;

export default async function PreparePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const initialCheckIn = parseCheckInParams(params);

  return <PreRoundCheckIn initialCheckIn={initialCheckIn} />;
}
