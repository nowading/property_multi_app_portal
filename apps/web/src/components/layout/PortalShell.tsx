import { Footer } from "./Footer";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";

/**
 * Portal shell: header on top, sidebar + main content, footer at bottom.
 *
 * Composition:
 *   <Header />
 *   <div flex>
 *     <Sidebar />   (client — uses usePathname)
 *     <main>{children}</main>
 *   </div>
 *   <Footer />
 *
 * This is a Server Component. The Sidebar child is a Client Component,
 * which is allowed: RSC can render client components as children.
 */
export function PortalShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-900">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <Header />
      <div className="flex flex-1 flex-col md:flex-row">
        <Sidebar />
        <main
          id="main-content"
          className="flex-1 overflow-x-hidden px-4 py-6 md:px-8 md:py-8"
          tabIndex={-1}
        >
          {children}
        </main>
      </div>
      <Footer />
    </div>
  );
}
