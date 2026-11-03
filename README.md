# FreshCart Market

Responsive meat and grocery marketplace with a Vercel serverless API.

## Included
- Storefront, catalogue search, product details, cart and checkout.
- Customer accounts, saved addresses, wishlist, orders and tracking.
- Razorpay Standard Checkout integration (Test Mode first) and Cash on Delivery.
- Admin APIs for products, orders, customers, inventory, delivery, coupons, refunds and reviews.
- Loyalty, referrals, recommendations, recently viewed products and push infrastructure.

## Setup
Use Node.js 20 or newer, run `npm install`, copy `.env.example` to `.env.local`, and configure real environment variables in Vercel. Configure MongoDB Atlas and Razorpay Test Mode before end-to-end payment tests. Never commit credentials. Full Preview tests are required before production launch.
