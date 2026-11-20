import { listPosts } from "@/lib/blog";

/**
 * The slugs of the guides that exist, as JSON.
 *
 * The proxy runs before a response is streamed and owns the real 404 for a slug
 * that is not here (see `src/proxy.ts`). The blog lives on disk, not in the
 * backend, so this is the one catalogue the proxy cannot read from the API. It
 * comes from `listPosts()` — the same helper the index, the post page and the
 * sitemap use — so a draft or a file missing its frontmatter is never listed.
 *
 * The slugs are already public: every one of them is a link on `/blog`.
 */
export async function GET() {
  const posts = await listPosts();
  return Response.json({ slugs: posts.map((post) => post.slug) });
}
