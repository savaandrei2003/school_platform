import type { ReactNode } from "react";
import { Navbar } from "./Navbar";

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        height: "98vh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        fontFamily: "system-ui",
      }}
    >
      <Navbar />
      <div
        style={{
          flex: 1,            
          minHeight: 0,       
          overflow: "hidden", 
        }}
      >
        {children}
      </div>
    </div>
  );
}
