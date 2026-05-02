import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const components = {
  h1: ({ node, ...props }) => (
    <h1 className="text-3xl md:text-4xl font-bold mt-12 mb-4 text-gray-900 dark:text-white" {...props} />
  ),
  h2: ({ node, ...props }) => (
    <h2 className="text-2xl md:text-3xl font-bold mt-10 mb-3 text-gray-900 dark:text-white" {...props} />
  ),
  h3: ({ node, ...props }) => (
    <h3 className="text-xl md:text-2xl font-semibold mt-8 mb-3 text-gray-900 dark:text-white" {...props} />
  ),
  h4: ({ node, ...props }) => (
    <h4 className="text-lg font-semibold mt-6 mb-2 text-gray-900 dark:text-white" {...props} />
  ),
  p: ({ node, ...props }) => (
    <p className="text-base leading-relaxed text-gray-700 dark:text-neutral-300 mb-4" {...props} />
  ),
  ul: ({ node, ...props }) => (
    <ul className="list-disc pl-6 mb-4 space-y-2 text-gray-700 dark:text-neutral-300" {...props} />
  ),
  ol: ({ node, ...props }) => (
    <ol className="list-decimal pl-6 mb-4 space-y-2 text-gray-700 dark:text-neutral-300" {...props} />
  ),
  li: ({ node, ...props }) => <li className="leading-relaxed" {...props} />,
  a: ({ node, ...props }) => (
    <a
      className="text-primary-700 dark:text-primary-300 underline hover:no-underline"
      target={props.href?.startsWith('http') ? '_blank' : undefined}
      rel={props.href?.startsWith('http') ? 'noopener noreferrer' : undefined}
      {...props}
    />
  ),
  blockquote: ({ node, ...props }) => (
    <blockquote
      className="border-l-4 border-primary-300 dark:border-primary-700 pl-4 my-4 italic text-gray-600 dark:text-neutral-400"
      {...props}
    />
  ),
  code: ({ node, inline, ...props }) =>
    inline ? (
      <code
        className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-neutral-800 text-sm font-mono text-gray-900 dark:text-neutral-200"
        {...props}
      />
    ) : (
      <code
        className="block p-4 my-4 rounded-lg bg-gray-900 text-gray-100 text-sm font-mono overflow-x-auto"
        {...props}
      />
    ),
  table: ({ node, ...props }) => (
    <div className="overflow-x-auto my-4">
      <table className="min-w-full border-collapse" {...props} />
    </div>
  ),
  thead: ({ node, ...props }) => <thead className="bg-gray-50 dark:bg-neutral-800" {...props} />,
  th: ({ node, ...props }) => (
    <th className="border border-gray-200 dark:border-neutral-700 px-4 py-2 text-left font-semibold text-gray-900 dark:text-white" {...props} />
  ),
  td: ({ node, ...props }) => (
    <td className="border border-gray-200 dark:border-neutral-700 px-4 py-2 text-gray-700 dark:text-neutral-300" {...props} />
  ),
  hr: () => <hr className="my-8 border-gray-200 dark:border-neutral-700" />,
  strong: ({ node, ...props }) => (
    <strong className="font-semibold text-gray-900 dark:text-white" {...props} />
  ),
};

export default function Markdown({ content }) {
  if (!content) return null;
  return (
    <div className="kb-prose">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
