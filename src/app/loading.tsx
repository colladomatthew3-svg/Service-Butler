import { Skeleton } from "@/components/ui/skeleton";

export default function AppLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 px-4 py-8 sm:px-6">
      <Skeleton className="h-12 w-64" />
      <Skeleton className="h-40 w-full" />
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-52 w-full" />
        <Skeleton className="h-52 w-full" />
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
