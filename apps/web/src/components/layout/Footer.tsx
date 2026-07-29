/**
 * Portal footer with brief attribution.
 * Server component.
 */
export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer
      className="mt-auto border-t border-slate-200 bg-white px-4 py-4 text-center text-xs text-slate-500 md:px-6"
      role="contentinfo"
    >
      <p>
        &copy; {year} Property Multi-App Portal &mdash; Next.js + FastAPI +
        Spring Boot + ML Container
      </p>
    </footer>
  );
}
