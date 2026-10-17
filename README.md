# Next.js Framework Starter

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/cloudflare/templates/tree/main/next-starter-template)

<!-- dash-content-start -->

This is a [Next.js](https://nextjs.org/) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app). It's deployed on Cloudflare Workers as a [static website](https://developers.cloudflare.com/workers/static-assets/).

This template uses [OpenNext](https://opennext.js.org/) via the [OpenNext Cloudflare adapter](https://opennext.js.org/cloudflare), which works by taking the Next.js build output and transforming it, so that it can run in Cloudflare Workers.

<!-- dash-content-end -->

Outside of this repo, you can start a new project with this template using [C3](https://developers.cloudflare.com/pages/get-started/c3/) (the `create-cloudflare` CLI):

```bash
npm create cloudflare@latest -- --template=cloudflare/templates/next-starter-template
```

A live public deployment of this template is available at [https://next-starter-template.templates.workers.dev](https://next-starter-template.templates.workers.dev)

## Getting Started

First, run:

```bash
npm install
# or
yarn install
# or
pnpm install
# or
bun install
```

Then run the development server (using the package manager of your choice):

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/basic-features/font-optimization) to automatically optimize and load Inter, a custom Google Font.

## Deploying To Production

| Command                           | Action                                       |
| :-------------------------------- | :------------------------------------------- |
| `npm run build`                   | Build your production site                   |
| `npm run preview`                 | Preview your build locally, before deploying |
| `npm run build && npm run deploy` | Deploy your production site to Cloudflare    |
| `npm wrangler tail`               | View real-time logs for all Workers          |

## Feature Configuration: Loyalty Lookup (Tra cứu thành viên & tem)

The `LoyaltyLookup` component (`src/components/LoyaltyLookup.tsx`) supports an elegant **Coming Soon teaser mode** for production release pending finalized reward copy (`D-02` / `P-5`):

- **Coming Soon Mode (`comingSoon={true}` - current default):**
  - Renders a polished preview with an animated `✦ Sắp ra mắt` status pill, member perk highlights (Bronze/Silver/Gold tiers, 10-stamp rewards, instant lookup), and a softly-blurred, disabled search preview with an informative lock badge.
  - Ensures visitors understand the upcoming benefits without being frustrated by dead clicks or unfinalized mock rewards.
  - Layout is mobile-first and responsive down to 375px.

### How to Re-enable Interactive Loyalty Lookup

When the owner finalizes loyalty tiers and reward values, re-enabling full lookup is instantaneous:

1. **Via Component Prop (Recommended):**
   In `src/app/page.tsx`, change:
   ```tsx
   <LoyaltyLookup comingSoon={false} />
   ```
2. **Via Environment Variable:**
   Set `NEXT_PUBLIC_LOYALTY_COMING_SOON=false` in your environment or Cloudflare Worker vars.

3. **Backend Safeguard:**
   The BFF route `/api/loyalty/check` additionally respects `LOYALTY_ENABLED`:
   - If `LOYALTY_ENABLED="false"`, the endpoint safely returns HTTP 503 (`feature_disabled`).
   - If not set or `"true"`, it forwards safe lookups to `CDP_CORE`.

---

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js/) - your feedback and contributions are welcome!

