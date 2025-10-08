# Amanaya – Asylberatung (MVP)

**Ziel:** Kostenlose Basisinfos + bezahlte, individuelle PDF-Auswertung (48h).

## Stand / Phasen
- [x] Domain: `amanaya.org` (Hetzner Level 4)
- [ ] GitHub-Repo verbunden mit Vercel
- [ ] Welle 1: Gratis-Inhalte online (Asylverfahren, Dublin, GEAS, FAQ)
- [ ] Welle 2: Fragenflow (ohne Zahlung)
- [ ] Welle 3: Zahlung (PayPal) → KI-Auswertung → PDF
- [ ] Welle 4: Admin-Freigabe & Versand

## Tech-Stack
- Frontend/Backend: **Next.js** (React)
- Hosting: **Vercel** (App), **Hetzner** (Domain/E-Mail)
- Optional (später): Supabase (EU) für DB/Storage, Mailjet/Sendgrid für Versand

## Deploy (kurz)
1. Repo in Vercel importieren → baut automatisch.
2. Domain `amanaya.org` in Vercel hinzufügen.
3. Bei Hetzner DNS setzen:  
   - `A @ 76.76.21.21`  
   - `CNAME www cname.vercel-dns.com`

## Environment Variables (später für Welle 3)
- `OPENAI_API_KEY=`  
- `PAYPAL_CLIENT_ID=`  
- `PAYPAL_SECRET=`  
- `MAIL_API_KEY=`  
- `APP_BASE_URL=https://amanaya.org`  
- `PDF_SIGNING_SECRET=`  
- `DATABASE_URL=` (optional, EU-Cloud)

## Ordnerstruktur (geplant)
app/ # Seiten + API
page.tsx # Start
asyl/ # Gratis-Inhalte
dublin/
faq/
news/
api/ # session, answers, pay, generate, approve, download
lib/ # rules, prompts, pdf, mail
content/ # MDX-Texte (Gratis-Inhalte)
templates/ # PDF- und E-Mail-Bausteine
public/ # Logo/Icons

graphql
Code kopieren

## Kontakt
info@amanaya.org
