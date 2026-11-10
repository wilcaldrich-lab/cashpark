# ClaimDeadline

Free tracker of open US class action settlements, sorted by claim deadline. Next.js App Router, TypeScript, Tailwind. It builds and serves the seed list when `DATABASE_URL` is unset.

Filing is always free on the official settlement site. This project does not file claims and is not a settlement administrator.

## Scripts

```bash
npm run dev
npm run build
npm run db:migrate    # needs DATABASE_URL or POSTGRES_URL
npm run db:seed
npm run email:render  # writes emails/weekly.preview.html
```

Seed data lives in `data/settlements.json`. Amounts and deadlines were copied from official settlement sites or from notices that quote them. A blank payout means no per-person figure was published. Research date: 2026-11-10.

## Environment

See `.env.example`.

| Variable | Use |
| --- | --- |
| `DATABASE_URL` or `POSTGRES_URL` | Postgres (Neon). Missing URL falls back to the seed file for reads. |
| `ADMIN_TOKEN` | `Authorization: Bearer` for `/api/admin/*`. |
| `RESEND_API_KEY` | Audience signup and owner email. |
| `RESEND_AUDIENCE_ID` | Resend audience, or segment id if the audience API has moved. |
| `RESEND_FROM_EMAIL` | From address for the sponsor inquiry email. |
| `OWNER_EMAIL` | Recipient of sponsor inquiries. |
| `NEXT_PUBLIC_SITE_URL` | Canonical URL for metadata, sitemap, and email links. |

## Admin

- `GET /api/admin/queue`
- `POST /api/admin/approve` with a submission `id` and any fields you want to override (`deadline` is required if the submission has none)
- `GET /api/admin/stats`
- `GET /api/admin/searches`
- `GET /api/admin/sponsors` and `POST /api/admin/sponsors`

`/go/[slug]` logs a click, then redirects to the official claim site or the sponsor URL.
