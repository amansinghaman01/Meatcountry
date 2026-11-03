# FreshCart Market

Responsive meat and grocery marketplace application with a Vercel serverless API, customer accounts, cart/checkout, admin operations and Razorpay integration.

## Project contents
- Storefront UI and product catalogue with category/search/cart interactions.
- Customer authentication, profile, saved addresses, wishlist, recently viewed items, order history and tracking.
- Order creation, server-side pricing, stock reservations, delivery zones/slots, coupons and loyalty/referrals.
- Admin APIs for products, orders, customers, inventory, delivery partners, refunds, reviews, coupons and analytics.
- Razorpay order creation, signature verification and webhook reconciliation. Test mode is the default.
- Browser push notification endpoints and downloadable order summaries.

## Run locally
1. Install Node.js 20 or newer.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local` and fill in values locally.
4. Run `npx vercel dev`.

## Required server-side environment variables
`MONGODB_URI`, `MONGODB_DATABASE`, `JWT_SECRET`, `RAZORPAY_MODE`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`. Optional push variables: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`. Never commit real credentials or `.env.local`.

## Admin bootstrap
Register your own customer account. Temporarily set a strong `ADMIN_BOOTSTRAP_SECRET`, call `POST /api/admin/bootstrap` with your account email and the `x-admin-bootstrap` header, then remove the temporary secret from Vercel immediately.

## Before real orders
The catalogue contains demo products/prices/images and sample stock. Configure MongoDB, create delivery zones/slots, initialize and replace stock/costs, configure Razorpay Test Mode keys/webhook and run full end-to-end tests. No live credentials or production database are included. SMS/email/WhatsApp provider and courier GPS integrations are not included. The generated PDF is an order summary, not a GST-compliant tax invoice. Dependency installation, full runtime/browser tests and live payment tests have not been completed in this package.