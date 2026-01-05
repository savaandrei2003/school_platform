import type { ReactNode } from "react";
import { Navbar } from "./Navbar";

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        height: "98vh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden", // nu lăsa nimic să creeze scroll global
        fontFamily: "system-ui",
      }}
    >
      <Navbar />
      <div
        style={{
          flex: 1,            // ia tot ce rămâne după navbar
          minHeight: 0,       // CRUCIAL pentru scroll intern
          overflow: "hidden", // scroll doar în copii
        }}
      >
        {children}
      </div>
    </div>
  );
}
