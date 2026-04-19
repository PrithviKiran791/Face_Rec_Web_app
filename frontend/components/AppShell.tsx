"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { PropsWithChildren, useMemo, useState, useEffect, useRef } from "react";
import { useAuth, useUser, SignOutButton, UserButton } from "@clerk/nextjs";
import { useTheme } from "@/context/ThemeContext";
import { setApiToken } from "@/lib/api";
import PageTransition from "./PageTransition";

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
};

const navItems = [
  { 
    href: "/dashboard", 
    label: "Dashboard", 
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
    )
  },
  { 
    href: "/register", 
    label: "Face Register", 
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="23" y1="11" x2="17" y2="11"></line></svg>
    )
  },
  { 
    href: "/live", 
    label: "Live Monitor", 
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 7l-7 5 7 5V7z"></path><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>
    )
  },
  { 
    href: "/report", 
    label: "Attendance Report", 
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
    )
  }
];

function pageTitle(pathname: string) {
  const found = navItems.find((item) => item.href === pathname);
  if (found) return found.label;
  return "Face Attendance";
}

export default function AppShell({ children }: Readonly<PropsWithChildren>) {
  const { isLoaded, userId, signOut, getToken } = useAuth();
  const { user } = useUser();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const vantaRef = useRef<HTMLDivElement>(null);
  const vantaEffect = useRef<any>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // ── Keyboard Shortcut (Ctrl+B) ──────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "b") {
        e.preventDefault();
        setIsCollapsed((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // ── Sync Clerk Token with API utility ────────────────────────────────────
  useEffect(() => {
    const updateToken = async () => {
      if (userId) {
        const token = await getToken();
        setApiToken(token);
      } else {
        setApiToken(null);
      }
    };
    updateToken();
  }, [userId, getToken]);

  // Close sidebar on navigation
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  // ── Protection Logic is now handled by middleware.ts ──────────────────────

  // ── Vanta Background Logic ────────────────────────────────────────────────
  useEffect(() => {
    const isPublicPage = pathname === "/login" || pathname === "/" || pathname.startsWith("/sign-in") || pathname.startsWith("/sign-up");
    if (isPublicPage) return;

    let timer: NodeJS.Timeout;

    const initVanta = () => {
      if (vantaEffect.current) vantaEffect.current.destroy();
      
      const VANTA = (window as any).VANTA;
      const THREE = (window as any).THREE;

      // Ensure THREE is globally available for Vanta's internal logic
      if (THREE) (window as any).THREE = THREE;

      if (VANTA && VANTA.DOTS && THREE && THREE.PerspectiveCamera && vantaRef.current) {
        try {
          vantaEffect.current = VANTA.DOTS({
            el: vantaRef.current,
            mouseControls: true,
            touchControls: true,
            gyroControls: false,
            minHeight: 200.0,
            minWidth: 200.0,
            scale: 1.0,
            scaleMobile: 1.0,
            color: theme === "dark" ? 0x0ea5e9 : 0x0284c7,
            color2: theme === "dark" ? 0x2563eb : 0x0284c7,
            backgroundColor: theme === "dark" ? 0x030712 : 0xf8fafc,
            size: 2.5,
            spacing: 45.0,
            showLines: false
          });
        } catch (err) {
          console.error("Vanta initialization failed:", err);
        }
      } else {
        timer = setTimeout(initVanta, 500);
      }
    };

    initVanta();

    return () => {
      clearTimeout(timer);
      if (vantaEffect.current) {
        vantaEffect.current.destroy();
        vantaEffect.current = null;
      }
    };
  }, [pathname, theme]);

  const title = useMemo(() => pageTitle(pathname), [pathname]);

  const isPublicPage = pathname.startsWith("/login") || pathname === "/" || pathname.startsWith("/sign-in") || pathname.startsWith("/sign-up");
  if (isPublicPage) return <>{children}</>;

  if (!isLoaded || !userId) return null;

  return (
    <div className="dashboard-root">
      {/* Vanta Background Layer */}
      <div 
        ref={vantaRef} 
        style={{ 
          position: "fixed", 
          top: 0, left: 0, 
          width: "100%", height: "100%", 
          zIndex: -1,
          opacity: 0.8
        }} 
      />

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside className={`sidebar ${sidebarOpen ? "open" : ""} ${isCollapsed ? "collapsed" : ""}`}>
        <div className="sidebar-brand" onClick={() => router.push("/dashboard")} style={{ cursor: "pointer" }}>
          <div className="sidebar-brand-icon" style={{ background: "transparent", padding: 0 }}>
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M6 10V6H10" stroke="#0ea5e9" strokeWidth="2" strokeLinecap="round"/>
              <path d="M22 6H26V10" stroke="#0ea5e9" strokeWidth="2" strokeLinecap="round"/>
              <path d="M26 22V26H22" stroke="#0ea5e9" strokeWidth="2" strokeLinecap="round"/>
              <path d="M10 26H6V22" stroke="#0ea5e9" strokeWidth="2" strokeLinecap="round"/>
              <circle cx="16" cy="11" r="5" fill="white"/>
              <path d="M8 24C8 20 11 18 16 18C21 18 24 20 24 24" stroke="white" strokeWidth="2" strokeLinecap="round"/>
              <circle cx="23" cy="9" r="2.5" fill="#0ea5e9"/>
            </svg>
          </div>
          <div className="sidebar-brand-info">
            <div className="sidebar-brand-title">FaceAttend</div>
            <div className="sidebar-brand-sub">Control Center</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`sidebar-nav-item ${active ? "active" : ""}`}
                title={isCollapsed ? item.label : ""}
              >
                <span className="sidebar-nav-icon">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-user-avatar">
              <UserButton afterSignOutUrl="/sign-in" />
            </div>
            <div className="sidebar-user-info" style={{ transition: "opacity 0.2s" }}>
              <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-main)", whiteSpace: "nowrap" }}>
                {user?.fullName || user?.username || "Admin"}
              </div>
              <div style={{ fontSize: "11px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>Administrator</div>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main Content ────────────────────────────────────────────────── */}
      <div className={`dashboard-main ${isCollapsed ? "sidebar-collapsed" : ""}`}>
        <header className="topbar">
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <button 
              className="menu-toggle" 
              onClick={() => setSidebarOpen(!sidebarOpen)}
              style={{ 
                background: "transparent", 
                border: "none", 
                color: "var(--text-main)", 
                fontSize: "24px", 
                cursor: "pointer",
                display: "none" // Show on mobile via CSS
              }}
            >
              ☰
            </button>
            
            <button 
              className="sidebar-toggle-btn"
              onClick={() => setIsCollapsed(!isCollapsed)}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--text-muted)",
                cursor: "pointer",
                padding: "8px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "color 0.2s"
              }}
              title="Toggle Sidebar (Ctrl+B)"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><line x1="9" x2="9" y1="3" y2="21"/>
              </svg>
            </button>

            <div>
              <p className="topbar-label">Operations</p>
              <h1 className="topbar-title">{title}</h1>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button
              onClick={toggleTheme}
              className="theme-toggle"
              title={`Switch to ${theme === "dark" ? "Light" : "Dark"} Mode`}
            >
              {theme === "dark" ? "☀️" : "🌙"}
            </button>

            <SignOutButton>
              <button className="logout-btn">
                Logout
              </button>
            </SignOutButton>
          </div>
        </header>

        <div className="dashboard-content">
          <PageTransition>{children}</PageTransition>
        </div>
      </div>
    </div>
  );
}
