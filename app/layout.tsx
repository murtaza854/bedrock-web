import "./globals.css";

export const metadata = { title: "Bedrock" };

// Runs before first paint so the saved theme never flashes. "system" (or nothing saved) follows the OS.
const themeInit = `try{var m=localStorage.getItem("theme");document.documentElement.dataset.theme=m==="light"||m==="dark"?m:matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeInit }} /></head>
      <body className="bg-bg font-sans text-ink antialiased">{children}</body>
    </html>
  );
}
