// components/share/SharedMarkdown.tsx
// Server-compatible markdown renderer for the public shared view.
// Uses react-markdown without any client-side state hooks.
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

export function SharedMarkdown({ content }: { content: string }) {
  return (
    <div className="prose prose-sm dark:prose-invert prose-p:leading-relaxed prose-p:mb-3 prose-p:last:mb-0 prose-headings:font-semibold prose-headings:text-foreground prose-code:rounded prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:text-[0.82em] prose-pre:rounded-xl prose-pre:bg-[#0d0d0d] prose-pre:p-4 prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-blockquote:border-primary/50 prose-blockquote:text-muted-foreground prose-th:text-muted-foreground prose-td:text-foreground max-w-none">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  )
}
