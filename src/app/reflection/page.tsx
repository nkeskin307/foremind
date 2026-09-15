import { ReflectionForm } from "@/components/reflection/reflection-form";
import { parseRoundData } from "@/lib/play/round-data";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function ReflectionPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const raw = Array.isArray(params.data) ? params.data[0] : params.data;
  const roundData = parseRoundData(raw);
  const rawId = Array.isArray(params.id) ? params.id[0] : params.id;
  const roundId = typeof rawId === "string" && rawId ? rawId : null;

  return <ReflectionForm roundData={roundData} roundId={roundId} />;
}
