"use client";

import type React from "react";
import type { ReactNode } from "react";

// Zero-dependency class merging utility
function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(" ");
}

interface AuroraBackgroundProps extends React.HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  showRadialGradient?: boolean;
  animationSpeed?: number;
}

export const AuroraBackground = ({
  className,
  children,
  animationSpeed = 15,
  ...props
}: AuroraBackgroundProps) => {
  return (
    <main style={{ 
      backgroundColor: "#030712", 
      minHeight: "100vh", 
      width: "100%",
      position: "relative",
      overflow: "hidden",
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }}>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes gradient-move {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .animated-mesh {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            -45deg, 
            #030712, 
            #075985, 
            #0284c7, 
            #030712
          );
          background-size: 400% 400%;
          animation: gradient-move ${animationSpeed}s ease infinite;
          opacity: 0.8;
          z-index: 0;
        }
        .mesh-glow {
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: radial-gradient(circle at center, rgba(14, 165, 233, 0.15) 0%, transparent 50%);
          animation: gradient-move ${animationSpeed * 1.5}s linear infinite;
          z-index: 1;
        }
      `}} />
      
      {/* Background Layers */}
      <div className="animated-mesh" />
      <div className="mesh-glow" />
      
      {/* Content Layer */}
      <div className={cn("relative z-10 w-full flex items-center justify-center", className)} {...(props as any)}>
        {children}
      </div>
    </main>
  );
};

export default AuroraBackground;
