import { RoundSetup } from "@/components/play/round-setup";
import { parseCheckInParams, type RawSearchParams } from "@/lib/prepare/check-in-params";

type SearchParams = Promise<RawSearchParams>;

export default async function PlayPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const preRound = parseCheckInParams(params);

  return <RoundSetup preRound={preRound} />;
}
