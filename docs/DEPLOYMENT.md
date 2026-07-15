# Static deployment on GitHub Pages

filmtechXAI runs as a static Astro site. GitHub Actions fetches RSS, optionally
fetches YouTube with its API free quota, generates Markdown posts, builds the
site, and deploys the result to GitHub Pages. The default production path does
not need OpenAI, Supabase, or runtime server credentials.

## One-time GitHub setup

> This repository is currently private. For a zero-cost GitHub Pages deployment
> on GitHub Free, change it to public only if making the source code public is
> acceptable. The workflows are ready, but they cannot make that visibility
> decision for you.

1. Keep the repository public when using GitHub Free.
2. In **Settings → Pages**, choose **GitHub Actions** as the build and
   deployment source.
3. After the first successful deployment, configure the custom domain
   `warehousevn.cloud` in the same screen and set the required DNS records at
   the domain registrar. A `CNAME` file is not used by a custom GitHub Actions
   workflow.
4. Run the **Fetch RSS** workflow manually once to seed the generated posts and
   deploy the static site.

No repository secret is required for RSS-only operation. To include YouTube,
store the existing key only as the `YOUTUBE_API_KEY` GitHub Actions secret; the
workflow injects it into the fetch step alone. If the key is absent or its
quota is unavailable, YouTube is skipped and the static site still deploys.
Never add API keys to source files, workflow logs, or `.env.example`.

## Workflows

- **Fetch RSS** runs daily at 06:17 Asia/Ho_Chi_Minh, fetches only configured
  sources, keeps the previous static content if a feed is temporarily down, and
  deploys the completed static build.
- **Deploy static site** deploys normal pushes to `main` and can also be run
  manually.

The RSS script limits new items to three per source and truncates source
excerpts before writing Markdown. Review and curate `src/config/sources.ts`
before adding a new source. Generated content is committed under
`src/content/posts/_auto`; choose an explicit archive policy before deleting
older posts.

## Optional future services

The Supabase and AI worker code remains in the repository as a deferred,
unwired option. It is not part of the GitHub Pages build or scheduled workflow.
If it is enabled in the future, use separate secrets and keep a non-AI RSS
fallback.
