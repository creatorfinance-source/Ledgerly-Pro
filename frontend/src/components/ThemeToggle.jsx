import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="w-9 h-9" />;

  const isDark = resolvedTheme === "dark";

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label="Toggle theme"
      className={[
        "relative w-9 h-9 rounded-full flex items-center justify-center",
        "transition-all duration-300 ease-out overflow-hidden",
        "border border-border",
        isDark
          ? "bg-secondary hover:bg-secondary/80 text-primary"
          : "bg-secondary hover:bg-secondary/80 text-primary",
        "hover:scale-110 active:scale-95 hover:shadow-md",
      ].join(" ")}
    >
      {/* Animated background glow */}
      <span
        className={[
          "absolute inset-0 rounded-full opacity-0 transition-opacity duration-300",
          isDark ? "bg-blue-400/10" : "bg-yellow-300/20",
          "hover:opacity-100",
        ].join(" ")}
      />

      {/* Sun icon */}
      <Sun
        className={[
          "absolute w-[1.1rem] h-[1.1rem] transition-all duration-500",
          isDark
            ? "opacity-0 rotate-90 scale-0"
            : "opacity-100 rotate-0 scale-100 text-amber-500",
        ].join(" ")}
        strokeWidth={2}
      />

      {/* Moon icon */}
      <Moon
        className={[
          "absolute w-[1.1rem] h-[1.1rem] transition-all duration-500",
          isDark
            ? "opacity-100 rotate-0 scale-100 text-blue-300"
            : "opacity-0 -rotate-90 scale-0",
        ].join(" ")}
        strokeWidth={2}
      />
    </button>
  );
}
