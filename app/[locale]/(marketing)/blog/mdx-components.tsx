import type { MDXComponents } from "mdx/types";

// Editorial prose styling for blog ("Field notes") MDX bodies. No
// @tailwindcss/typography in the project — each element is styled by hand to
// match the marketing surfaces (font-display headings, calm foreground/80 body,
// generous rhythm, borders over shadows). Server components; no client JS.
export const blogMdxComponents: MDXComponents = {
  h2: ({ children }) => (
    <h2 className="mt-14 font-display text-2xl tracking-tight text-foreground sm:text-3xl">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-10 font-display text-xl tracking-tight text-foreground">
      {children}
    </h3>
  ),
  p: ({ children }) => (
    <p className="mt-6 text-lg leading-relaxed text-foreground/80">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="mt-6 space-y-2 pl-5 text-lg leading-relaxed text-foreground/80 [&>li]:list-disc [&>li]:marker:text-primary">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="mt-6 space-y-2 pl-5 text-lg leading-relaxed text-foreground/80 [&>li]:list-decimal [&>li]:marker:text-foreground/40">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="pl-1">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="mt-8 border-l-2 border-primary pl-6 font-display text-xl leading-snug tracking-tight text-foreground">
      {children}
    </blockquote>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  a: ({ children, href }) => (
    <a
      href={href}
      className="underline decoration-primary/40 underline-offset-4 transition-colors hover:decoration-primary"
    >
      {children}
    </a>
  ),
  hr: () => <hr className="mt-12 border-foreground/15" />,
};
