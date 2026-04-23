# Meatcountry Premium Experience Blueprint

## 1) Brand Direction: “Butcher’s Atelier × Ocean Market”

A premium, food-forward identity that blends modern editorial layouts with rich ingredient photography.

### Brand attributes
- **Freshness-first:** Visual cues of cold-chain quality, same-day processing, traceability.
- **Trustworthy:** Clear sourcing badges, hygiene standards, transparent pricing/weights.
- **Appetizing but clean:** Deep reds and sea tones balanced by soft neutrals and generous whitespace.
- **Editorial modern:** Magazine-like section pacing, strong typography hierarchy, intentional asymmetry.

### Core visual metaphor
- **Land + Sea duality:** Warm tones for poultry/mutton; cool tones for seafood.
- **Crafted cuts:** Use macro textures and edge framing inspired by butcher boards and fish market trays.

---

## 2) Design Language System

## Color palette
Use semantic tokens so storefront and CRM remain cohesive.

### Primary palette
- **Crimson Reserve** `#8F1D2C` — premium meat cue, CTAs on storefront.
- **Coral Ember** `#E35D5B` — highlights, promo ribbons.
- **Ocean Teal** `#0E6B6F` — seafood category accents, trust signals.
- **Saffron Gold** `#D8A73C` — quality seals, premium badges.

### Neutral palette
- **Bone White** `#FAF7F2` — base background.
- **Ivory Mist** `#F2EEE7` — cards and section blocks.
- **Slate Ink** `#1F2328` — body copy.
- **Graphite** `#4A4F57` — secondary text.
- **Cool Gray** `#D9DEE5` — borders/dividers.

### Functional colors
- Success `#1F8A4C`
- Warning `#D9822B`
- Error `#C53A3A`
- Info `#2E6FD8`

## Typography
- **Display/Headlines:** *Playfair Display* (or Cormorant Garamond) for editorial impact.
- **Body/UI:** *Inter* (or Manrope) for modern readability.

### Type scale
- H1: 56/64, semibold
- H2: 40/48, semibold
- H3: 30/38, semibold
- H4: 24/32, medium
- Body L: 18/30
- Body M: 16/26
- Body S: 14/22
- Caption: 12/18

## Spacing and shape
- Base grid: **8px system**.
- Corner radius:
  - Hero cards: 24px
  - Product cards: 16px
  - Inputs/buttons: 12px
- Shadows: soft, low elevation (`0 8px 30px rgba(20,20,20,0.08)`).

## Imagery style
- Real ingredient-led photos (avoid generic stock lifestyle).
- 3 image categories:
  1. **Cut close-ups** (texture, marbling, freshness)
  2. **Prep context** (hands, knives, marinades)
  3. **Plated outcomes** (aspirational serving)
- Apply subtle film-grain and warm-white balance for appetizing consistency.

## Iconography
- Rounded-line icon set with filled accent states.
- Custom icons for:
  - “Freshly Cut Today”
  - “Temperature Controlled Delivery”
  - “No Preservatives”
  - “Traceable Source”

---

## 3) Storefront UX Architecture

## Global navigation
- Top bar: location, delivery ETA, search, profile, cart.
- Main nav categories with imagery chips:
  - Chicken
  - Mutton
  - Seafood
  - Eggs
  - Marinades
  - Ready to Cook
- Sticky nav on scroll with compact search and cart summary.

## Home / Landing page structure
1. **Hero block**
   - Full-bleed image/video loop of curated cuts and plated dishes.
   - Primary CTA: “Shop Fresh Cuts”
   - Secondary CTA: “Explore Seafood”
2. **Featured categories strip**
   - Image-first circular/rounded tiles.
3. **Bestsellers carousel**
   - Quick add buttons with weight selector.
4. **Freshness promise section**
   - 4 trust pillars + certifications.
5. **Chef’s edit / seasonal spotlight**
   - Editorial cards with recipes + linked SKUs.
6. **Testimonials + rating aggregate**
7. **App install and loyalty module**

## Product listing (PLP)
- Left rail filters (desktop) / bottom sheet (mobile):
  - Category, cut type, price range, dietary tags, preparation time.
- Sort options: popularity, price, newest, rating.
- Product cards include:
  - Product image
  - Freshness badge
  - Variant chips (500g, 1kg etc.)
  - Price + strikethrough MRP + savings
  - “Add” → transitions to quantity stepper

## Product detail page (PDP)
- Gallery: macro imagery + cut diagram.
- Key info block:
  - Product name
  - Cut/weight variant selector
  - Price and delivery slot eligibility
  - Add to cart CTA
- Tabs/accordions:
  - Description
  - Nutritional info
  - Storage & shelf life
  - Sourcing and traceability
  - Reviews
- Smart cross-sell:
  - Marinade pairings
  - Side dishes / ready-to-cook combos

## Cart and checkout flow
- **Cart drawer** for quick review + full cart page for details.
- Checkout steps:
  1. Login/register gate (if guest)
  2. Address select/add
  3. Delivery slot selection
  4. Payment and order summary
- Persistent mini summary panel on desktop.
- Clarity-first pricing:
  - Item total
  - Delivery fee
  - Coupon discount
  - Taxes
  - Final payable

## Customer account
- Overview dashboard: recent order, active subscription/offers.
- Orders history with status timeline.
- Saved addresses and preferences.
- Profile details + communication preferences.

## Order status tracking
- Timeline stages:
  - Confirmed
  - Processing
  - Packed
  - Out for delivery
  - Delivered
- Include “cold-chain maintained” indicator and support CTA.

## Search experience
- Predictive search with category and SKU suggestions.
- Smart ranking by repeat purchase, availability, and location.
- Empty state with curated quick links and recipe content.

---

## 4) Admin CRM Dashboard UX (Operational + Insightful)

## Admin visual tone
- More utilitarian than storefront but still brand-aligned.
- Use neutrals + teal for data clarity; reserve crimson for destructive actions/urgent flags.

## CRM information architecture
- **Sidebar modules**
  - Overview
  - Orders
  - Customers
  - Products
  - Inventory (optional extension)
  - Analytics
  - Campaigns (optional)
  - Settings

## Overview dashboard
- KPI row:
  - Revenue (today / week / month)
  - Orders count
  - Avg order value
  - Repeat customer rate
- Charts:
  - Revenue trend line
  - Category split donut
  - Top products table
- Operational widgets:
  - Pending dispatch
  - Delayed orders
  - Low-stock alerts

## Orders management
- Dense table with sticky headers and quick actions.
- Columns:
  - Order ID
  - Customer
  - Items count
  - Amount
  - Slot
  - Payment status
  - Fulfillment status
- Bulk actions:
  - Mark packed / dispatch / resolve issue
- Drawer detail:
  - Customer details
  - Item breakdown
  - Internal notes
  - Timeline + audit logs

## Customers list
- Segments:
  - New
  - Repeat
  - High-value
  - At-risk/churn likelihood
- Customer 360 view:
  - Lifetime value
  - Last order
  - Preferred categories
  - Address cluster
  - Support interactions

## Products CRUD
- Product form sections:
  - Basic info
  - Category and taxonomy
  - Variant weights/cuts
  - Pricing + offer windows
  - Inventory
  - Media
  - Compliance tags
- Inline preview card to verify storefront appearance.

## Analytics overview
- Time filters: daily/weekly/monthly/custom.
- Drilldowns:
  - Category performance
  - Cohort retention
  - Coupon efficiency
  - Slot-wise fulfillment performance
- Export CSV/PDF for operations and leadership.

## Admin UX patterns
- Keyboard-first tables.
- Save states and unsaved-change prompts.
- Role-based permissions for manager/executive/ops picker.

---

## 5) Component-Level Guidance

## Shared components
- Buttons: Primary (crimson), Secondary (outline), Tertiary (text).
- Chips: category, dietary, freshness, delivery tags.
- Cards: product, editorial, metric.
- Inputs: floating labels + helper text.
- Badges: “Best Seller”, “Fresh Today”, “Limited Catch”.

## Storefront-specific components
- Category image chips.
- Variant selector pills.
- Delivery slot picker cards.
- Trust pillar strip.
- Recipe-story promo cards.

## CRM-specific components
- Data tables with column visibility toggles.
- KPI tiles with trend delta.
- Status pill system (processing, packed, delayed, delivered).
- Chart wrappers with unified legends and date controls.

---

## 6) Motion & Microinteractions

- Hover raise on product cards (4px lift).
- Add-to-cart animation: SKU image flies into cart icon.
- Slot selection: subtle pulse on chosen slot.
- Status updates: step progress animation with timestamp reveal.
- Keep transitions fast (160ms–240ms) for responsive feel.

---

## 7) Accessibility & Trust Requirements

- Contrast ratios at WCAG AA minimum.
- Font size floor 14px on UI elements.
- Keyboard navigation for checkout and CRM tables.
- Alt text for all product imagery.
- Trust labels should be textual, not icon-only.

---

## 8) Content Voice

- Tone: confident, culinary, transparent.
- Examples:
  - “Cut fresh this morning.”
  - “From dock to doorstep under temperature control.”
  - “No hidden preservatives. Ever.”

For CRM copy:
- Action-oriented and concise:
  - “12 orders awaiting packing”
  - “Top SKU this week: Classic Chicken Curry Cut 500g”

---

## 9) Suggested Tech Implementation Notes (Hybrid Fullstack)

- **Frontend storefront:** Next.js + Tailwind + headless UI primitives.
- **Admin CRM:** Same design system, separate route group with role guards.
- **Backend:** Node/Nest or Django with modular domain services.
- **Data model essentials:**
  - Product, ProductVariant, Category
  - Customer, Address
  - Cart, CartItem
  - Order, OrderItem, OrderStatusEvent
  - InventoryLot
  - Coupon/Promotion
- **Search:** Meilisearch/Elastic for fast predictive lookup.
- **Analytics:** Event tracking on browse/add-to-cart/checkout/admin actions.

---

## 10) Launch-Ready Screen Checklist

### Customer storefront
- Home
- Category listing
- Search results
- Product detail
- Cart
- Checkout (address/slot/payment)
- Login/Register
- Profile + orders + addresses
- Order tracking

### Admin CRM
- Dashboard overview
- Orders list + order detail drawer
- Customers list + profile view
- Products list + create/edit form
- Analytics reports

This blueprint delivers a distinctive premium experience while preserving conversion-focused ecommerce flows and operationally efficient CRM management.
