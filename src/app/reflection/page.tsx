import { ReflectionForm } from "@/components/reflection/reflection-form";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

/** /reflection?id=<roundId> — the round itself is loaded from storage on the client. */
export default async function ReflectionPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const rawId = Array.isArray(params.id) ? params.id[0] : params.id;
  const roundId = typeof rawId === "string" && rawId ? rawId : null;

  return <ReflectionForm roundId={roundId} />;
}
