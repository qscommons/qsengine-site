import { HOME } from "./content";

export const metadata = { title: "qsengine", alternates: { canonical: HOME } };

// qsengine's home page is its project page on qscommons.org; this site holds only the docs.
// Cloudflare answers / with a 301 first; this page covers the site served without it, JavaScript or not.
export default function Home() {
  return (
    <main className="missing">
      <meta httpEquiv="refresh" content={`0; url=${HOME}`} />
      <h1>qsengine</h1>
      <p>
        <a className="button" href={HOME}>Go to the qsengine home page</a>
      </p>
    </main>
  );
}
