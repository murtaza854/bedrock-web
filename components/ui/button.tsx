const base = "inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50";
const variants = {
  primary: "bg-ink text-bg hover:opacity-90",
  ghost: "bg-line/50 hover:bg-line",
};

export function Button({ variant = "primary", className = "", ...p }:
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof variants }) {
  return <button className={`${base} ${variants[variant]} ${className}`} {...p} />;
}
