import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-4 text-center">
      <p className="text-sm font-medium">Not found</p>
      <p className="mt-2 text-sm text-muted-foreground">
        That item or category is not in the catalog.
      </p>
      <Button className="mt-4" render={<Link href="/" />}>
        Back to browse
      </Button>
    </div>
  );
}
