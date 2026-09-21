import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center p-6">
      <div className="surface w-full max-w-md p-8 text-center">
        <p className="eyebrow">404</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          Page not found
        </h1>
        <p className="muted mt-3">The page you requested does not exist.</p>
        <ButtonLink className="mt-6" href="/">
          Return home
        </ButtonLink>
      </div>
    </main>
  );
}
