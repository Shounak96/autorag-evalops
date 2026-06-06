import { RagPlayground } from "@/components/playground/rag-playground";
import { apiGet } from "@/lib/api";
import type { PromptVersionListResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function PlaygroundPage() {
  const prompts = await apiGet<PromptVersionListResponse>(
    "/prompts",
    {
      prompts: [],
      count: 0,
    },
  );

  return (
    <RagPlayground prompts={prompts.prompts} />
  );
}