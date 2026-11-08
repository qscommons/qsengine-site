import { Children, cloneElement, isValidElement } from "react";
import Link from "next/link";
import { CodeBlock, Output } from "./app/components/Code";

// How Markdown in the .mdx docs pages turns into the site's own elements.
// CodeBlock and Output are available in every page without an import; scripts/sync-docs.mjs
// turns ```output blocks in docs/ into <Output />.

// A fenced code block becomes a copyable CodeBlock. The trailing newline Markdown keeps is dropped.
function Pre({ children }) {
  const code = isValidElement(children) ? String(children.props.children).replace(/\n$/, "") : "";
  return <CodeBlock code={code} />;
}

// Links inside the site use client-side navigation; everything else is a plain link.
function A({ href = "", ...props }) {
  return href.startsWith("/") ? <Link href={href} {...props} /> : <a href={href} {...props} />;
}

// Markdown tables have no row headers. The first cell of each row names the row, so make it a <th scope="row">.
function Tbody({ children }) {
  const rows = Children.map(children, (tr) => {
    if (!isValidElement(tr)) return tr;
    let first = true;
    const cells = Children.map(tr.props.children, (td) => {
      if (!isValidElement(td) || !first) return td;
      first = false;
      return <th scope="row" {...td.props} />;
    });
    return cloneElement(tr, {}, cells);
  });
  return <tbody>{rows}</tbody>;
}

const components = {
  pre: Pre,
  a: A,
  table: (props) => <div className="table-wrap"><table {...props} /></div>,
  tbody: Tbody,
  CodeBlock,
  Output,
};

export function useMDXComponents(inherited) {
  return { ...inherited, ...components };
}
