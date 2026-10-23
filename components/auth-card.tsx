import { Contours } from "./contours";

// Shared shell for login, forgot and reset: contour backdrop + centred card.
export function AuthCard({ children, onSubmit }: { children: React.ReactNode; onSubmit?: React.FormEventHandler<HTMLFormElement> }) {
  const cls = "grid w-full max-w-sm gap-3 rounded-xl border border-line bg-surface/90 p-8 shadow-sm backdrop-blur";
  return (
    <main className="grid min-h-screen place-items-center px-4">
      <Contours />
      {onSubmit ? <form onSubmit={onSubmit} noValidate className={cls}>{children}</form> : <div className={cls}>{children}</div>}
    </main>
  );
}
