# 🚀 Complete Deployment Gids - PDF Flipbook

Deze gids leidt je stap voor stap door het deployen van je PDF Flipbook app op Railway.

---

## 📋 Overzicht

Je hebt 3 services nodig:
1. **Railway** - Hosting voor je Node.js app
2. **PostgreSQL** - Database (via Railway)
3. **Cloudflare R2** - Opslag voor PDF's en covers (gratis tier beschikbaar)

---

## Stap 1: Cloudflare R2 Storage Setup

### 1.1 Maak een Cloudflare account
1. Ga naar [cloudflare.com](https://cloudflare.com)
2. Maak een gratis account aan of log in

### 1.2 Activeer R2 Storage
1. In het Cloudflare dashboard, klik op **R2** in de linker sidebar
2. Klik op **Create bucket**
3. Geef je bucket een naam: `pdf-flipbook`
4. Kies een locatie dicht bij je gebruikers (bijv. Europe)
5. Klik **Create bucket**

### 1.3 Maak API Tokens
1. Ga naar **R2** → **Manage R2 API Tokens**
2. Klik **Create API Token**
3. Geef het een naam: `pdf-flipbook-token`
4. Permissions: **Object Read & Write**
5. Specify bucket: `pdf-flipbook`
6. Klik **Create API Token**
7. **BELANGRIJK**: Kopieer en bewaar deze gegevens veilig:
   - `Access Key ID`
   - `Secret Access Key`

### 1.4 Configureer Public Access
1. Ga naar je bucket `pdf-flipbook`
2. Klik op **Settings**
3. Onder **Public access**, klik **Allow Access**
4. Kopieer de **Public bucket URL** (ziet eruit als: `https://pub-xxx.r2.dev`)

### 1.5 Noteer je R2 gegevens
```
S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
S3_BUCKET=pdf-flipbook
S3_REGION=auto
S3_ACCESS_KEY=<jouw-access-key>
S3_SECRET_KEY=<jouw-secret-key>
STORAGE_PUBLIC_URL=https://pub-xxx.r2.dev
```

Je Account ID vind je in de Cloudflare dashboard URL of onder R2 overview.

---

## Stap 2: Railway Setup

### 2.1 Maak een Railway account
1. Ga naar [railway.app](https://railway.app)
2. Klik **Login** → **Login with GitHub**
3. Autoriseer Railway om je GitHub te gebruiken

### 2.2 Maak een nieuw project
1. Klik **New Project**
2. Kies **Deploy from GitHub repo**
3. Selecteer `LeeLars/Pdf-flipbook`
4. Railway begint automatisch te deployen (dit zal eerst falen - dat is normaal!)

### 2.3 Voeg PostgreSQL toe
1. In je Railway project, klik **+ New**
2. Kies **Database** → **Add PostgreSQL**
3. Wacht tot de database is aangemaakt
4. Railway maakt automatisch een `DATABASE_URL` variabele aan

### 2.4 Configureer Environment Variables
1. Klik op je **Pdf-flipbook** service (niet de database)
2. Ga naar **Variables** tab
3. Klik **+ New Variable** voor elk van deze:

| Variable | Waarde |
|----------|--------|
| `NODE_ENV` | `production` |
| `JWT_SECRET` | `<genereer-een-lange-random-string>` |
| `S3_ENDPOINT` | `https://<account-id>.r2.cloudflarestorage.com` |
| `S3_BUCKET` | `pdf-flipbook` |
| `S3_REGION` | `auto` |
| `S3_ACCESS_KEY` | `<jouw-cloudflare-access-key>` |
| `S3_SECRET_KEY` | `<jouw-cloudflare-secret-key>` |
| `STORAGE_PUBLIC_URL` | `https://pub-xxx.r2.dev` |
| `ADMIN_EMAIL` | `jouw@email.com` |
| `ADMIN_PASSWORD` | `<kies-een-sterk-wachtwoord>` |
| `ALLOWED_ORIGINS` | `*` |

**Tip voor JWT_SECRET**: Genereer een veilige string met:
```bash
openssl rand -base64 32
```
Of gebruik een online generator.

### 2.5 Trigger een nieuwe deployment
1. Na het toevoegen van alle variables, klik op **Deployments** tab
2. Klik op de meest recente deployment
3. Klik **Redeploy**

---

## Stap 3: Database Migratie

### 3.1 Open Railway Shell
1. In je Railway project, klik op de **Pdf-flipbook** service
2. Klik op **Settings** tab
3. Scroll naar **Railway Shell** of gebruik de CLI

### 3.2 Via Railway CLI (aanbevolen)
```bash
# Installeer Railway CLI (eenmalig)
npm install -g @railway/cli

# Login
railway login

# Link je project
railway link

# Run migraties
railway run npm run db:migrate

# Maak admin user aan
railway run npm run db:seed
```

### 3.3 Alternatief: Via Railway Dashboard
1. Ga naar je service → **Settings**
2. Onder **Deploy**, voeg toe bij **Start Command**:
   ```
   npm run db:migrate && npm run db:seed && npm run start
   ```
3. Redeploy
4. **Na eerste succesvolle deploy**, verander terug naar:
   ```
   npm run start
   ```

---

## Stap 4: Verkrijg je App URL

### 4.1 Genereer een publieke URL
1. Klik op je **Pdf-flipbook** service
2. Ga naar **Settings** tab
3. Scroll naar **Networking**
4. Klik **Generate Domain**
5. Je krijgt een URL zoals: `pdf-flipbook-production.up.railway.app`

### 4.2 (Optioneel) Custom Domain
1. Onder **Networking**, klik **+ Custom Domain**
2. Voer je domein in, bijv: `flip.grafix.studio`
3. Voeg de getoonde DNS records toe bij je domeinprovider
4. Wacht op verificatie (kan tot 24 uur duren)

---

## Stap 5: Test je App

### 5.1 Open de app
Ga naar: `https://jouw-app.up.railway.app/vrije-tijd`

Je zou moeten zien:
- Een lege pagina met "Nog geen magazines"
- Een subtiel tandwiel-icoon rechtsonder

### 5.2 Log in als admin
1. Klik op het tandwiel-icoon rechtsonder
2. Log in met:
   - Email: `<jouw ADMIN_EMAIL>`
   - Wachtwoord: `<jouw ADMIN_PASSWORD>`

### 5.3 Upload een test PDF
1. Na inloggen, sleep een PDF naar het uploadvenster
2. Vul een titel in, bijv: "Test Magazine December 2024"
3. Klik **Uploaden**
4. De PDF zou nu moeten verschijnen als flipbook!

---

## Stap 6: Embed in WordPress/Bricks

### 6.1 Kopieer de iframe code
```html
<iframe 
  src="https://web-production-e48a7.up.railway.app/vrije-tijd"
  width="100%" 
  height="1500" 
  frameborder="0"
  style="border: none; max-width: 100%;"
  loading="lazy"
></iframe>
```

### 6.2 In Bricks Builder
1. Open je pagina in Bricks
2. Voeg een **Code** element toe (of HTML element)
3. Plak de iframe code
4. Pas de hoogte aan indien nodig (800px is een goede start)
5. Publiceer de pagina

### 6.3 In WordPress Classic Editor
1. Schakel naar **Text** modus (niet Visual)
2. Plak de iframe code
3. Publiceer

### 6.4 In Elementor
1. Voeg een **HTML** widget toe
2. Plak de iframe code
3. Publiceer

---

## 🔧 Troubleshooting

### App laadt niet
- Check Railway logs: Service → **Deployments** → klik op deployment → **View Logs**
- Controleer of alle environment variables correct zijn ingesteld

### Database errors
- Zorg dat PostgreSQL service draait
- Check of `DATABASE_URL` automatisch is gekoppeld
- Run migraties opnieuw: `railway run npm run db:migrate`

### Upload faalt
- Controleer R2 credentials
- Check of bucket public access aan staat
- Bekijk server logs voor specifieke errors

### Iframe wordt geblokkeerd
- Voeg je WordPress domain toe aan `ALLOWED_ORIGINS`
- Voorbeeld: `ALLOWED_ORIGINS=https://jouwsite.nl,https://www.jouwsite.nl`

### Login werkt niet
- Run seed opnieuw: `railway run npm run db:seed`
- Check of `ADMIN_EMAIL` en `ADMIN_PASSWORD` correct zijn

---

## 📊 Kosten Overzicht

### Railway
- **Hobby Plan**: $5/maand (inclusief $5 credits)
- Voldoende voor kleine tot middelgrote traffic

### Cloudflare R2
- **Gratis tier**: 10GB opslag, 10 miljoen requests/maand
- Meer dan genoeg voor honderden PDF's

### Totaal: ~$5/maand

---

## 🔄 Updates Deployen

Wanneer je wijzigingen maakt:

```bash
# In je project folder
git add .
git commit -m "Beschrijving van wijziging"
git push

# Railway detecteert automatisch de push en redeployt
```

---

## 📁 Meerdere Klanten

Je kunt dezelfde app gebruiken voor meerdere klanten:

1. **Vrije Tijd Magazine**: `/vrije-tijd`
2. **Klant X**: `/klant-x`
3. **Bedrijf Y**: `/bedrijf-y`

Elke client_slug is een aparte "namespace" voor magazines.

Iframe voor Klant X:
```html
<iframe src="https://jouw-app.up.railway.app/klant-x" ...></iframe>
```

---

## ✅ Checklist

- [ ] Cloudflare account aangemaakt
- [ ] R2 bucket aangemaakt
- [ ] R2 API token aangemaakt
- [ ] R2 public access ingeschakeld
- [ ] Railway account aangemaakt
- [ ] GitHub repo gekoppeld aan Railway
- [ ] PostgreSQL database toegevoegd
- [ ] Alle environment variables ingesteld
- [ ] Database migraties uitgevoerd
- [ ] Admin user aangemaakt (seed)
- [ ] Publieke URL gegenereerd
- [ ] Test PDF geüpload
- [ ] Iframe getest op WordPress site

---

## 🆘 Hulp Nodig?

Als je vastloopt:
1. Check de Railway logs
2. Controleer alle environment variables
3. Zorg dat de database migraties zijn uitgevoerd

Veel succes! 🎉
