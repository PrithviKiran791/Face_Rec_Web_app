"use client";

import React from "react";

export function RetroGrid() {
  return (
    <div 
      style={{ 
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        backgroundColor: "#030712",
        zIndex: -1,
        pointerEvents: "none"
      }}
    >
      {/* Keyframe animation */}
      <style>{`
        @keyframes retro-grid-scroll {
          0% { transform: translateY(0); }
          100% { transform: translateY(60px); }
        }
      `}</style>

      {/* Perspective Container */}
      <div 
        style={{ 
          position: "absolute",
          inset: 0,
          overflow: "hidden",
          perspective: "1000px", 
          perspectiveOrigin: "50% 50%",
          opacity: 0.25
        }}
      >
        <div 
          style={{ 
            position: "absolute",
            inset: 0,
            transform: "rotateX(60deg)",
            transformOrigin: "center top",
            width: "100%",
            height: "100%"
          }}
        >
          <div
            style={{
              backgroundImage: `
                linear-gradient(to right, rgba(14, 165, 233, 0.3) 1px, transparent 0),
                linear-gradient(to bottom, rgba(14, 165, 233, 0.3) 1px, transparent 0)
              `,
              backgroundSize: "60px 60px",
              height: "200%",
              width: "200%",
              marginLeft: "-50%",
              marginTop: "-50%",
              animation: "retro-grid-scroll 2s linear infinite",
            }}
          />
        </div>
      </div>

      {/* Horizon Mask */}
      <div style={{
        position: "absolute",
        inset: 0,
        background: "radial-gradient(circle at 50% 40%, transparent 0%, #030712 85%)",
        zIndex: 1
      }} />
    </div>
  );
}

export default RetroGrid;
