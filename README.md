# URAVAI website

Static, mobile-first site for URAVAI's two collections, **Stories** and **Prints**. The home page links to dedicated `stories.html` and `prints.html` feature pages. Customer enquiries open WhatsApp with product details prefilled. The enquiry form does not store submissions.

The supplied logo artwork is displayed exactly as provided. Its wordmark reads “Urava” and its small line reads “uravai.in”; other site copy uses the requested brand spelling “URAVAI”. The center footer credit links to [elloling](https://elloling-india.github.io/Website/).

## Content to confirm before public launch

- Confirmation of the final brand spelling for the supplied logo
- Current prices, sizes, page packages, paper and cover options
- Production and delivery estimates, locations, shipping charges
- Preview and revision process
- Approved customer photographs and actual testimonials
- Instagram, business email, Google Business Profile, and policy URLs
- URAVAI Wallet terms

The site uses the supplied magazine photos as visual references and two generated editorial images. It makes no customer or pricing claims from those images. The generated images were made with the built-in image-generation tool for this site using prompts for (1) a magazine and prints editorial hero and (2) Polaroid-style prints held above ivory linen.

Run locally with `python -m http.server 4173` from this folder.

## Hosting and search metadata

This repository publishes from the `main` branch root to [GitHub Pages](https://heyitsbright.github.io/uravai.in/). The three pages have canonical URLs, social sharing metadata, and JSON-LD; `sitemap.xml` lists the public pages. If a custom domain is connected later, update those absolute URLs and the sitemap to that domain. The site is not connected to Search Console yet.

The live pages use compressed JPEG images for faster loading; the original PNG assets remain in `assets/`.
