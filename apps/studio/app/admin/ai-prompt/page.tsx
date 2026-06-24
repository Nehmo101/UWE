import { redirect } from "next/navigation";

interface Props {
  searchParams: Promise<{
    world?: string;
    page?: string;
    title?: string;
  }>;
}

export default async function AdminAiPromptPage({ searchParams }: Props) {
  const { world, page, title } = await searchParams;
  const params = new URLSearchParams();
  if (world) params.set("world", world);
  if (page) params.set("page", page);
  if (title) params.set("title", title);
  const qs = params.toString();
  redirect(qs ? `/ai?${qs}` : "/ai");
}
