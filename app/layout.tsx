// app/layout.tsx
export const metadata = {
  title: "Amanaya",
  description: "Your path. Our guidance.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body style={{ margin: 0, background: "#f6f1e7", color: "#0a2a4a" }}>
        {children}
      </body>
    </html>
  );
}
