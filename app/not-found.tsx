import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
      <p className="font-mono text-sm text-muted-foreground">404</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Not in the catalog</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        That item or category doesn’t exist, or it was renamed.
      </p>
      <Button className="mt-6 rounded-full px-4" size="lg" nativeButton={false} render={<Link href="/" />}>
        Back to Discover
      </Button>
    </div>
  );
}
