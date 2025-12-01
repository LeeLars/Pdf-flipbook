# PDF Flipbook Mini-App

Een complete PDF flipbook applicatie met admin panel, ontworpen om te embedden via iframe op je WordPress/Bricks website.

## Features

- 📖 **Flipbook Viewer** - Interactieve PDF viewer met bladerfunctionaliteit
- 🖼️ **Lightbox Gallery** - Overzicht van alle eerdere edities met covers
- 🔐 **Admin Panel** - Subtiele beheerknop met login voor uploaden
- 📤 **Drag & Drop Upload** - Sleep PDF's direct in het uploadvenster
- 🎨 **Automatische Covers** - Eerste pagina wordt automatisch als thumbnail gebruikt
- 🚀 **Railway Ready** - Klaar voor deployment op Railway

## Architectuur

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (React/Vite)                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │  Flipbook   │  │   Gallery   │  │   Admin Panel   │  │
│  │   Viewer    │  │  (Lightbox) │  │  (Upload/CRUD)  │  │
│  └─────────────┘  └─────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                  Backend (Node/Express)                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │    Auth     │  │  Magazines  │  │   PDF Process   │  │
│  │   Routes    │  │   Routes    │  │   (Cover Gen)   │  │
│  └─────────────┘  └─────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────┘
                           │
              ┌────────────┴────────────┐
              ▼                         ▼
┌─────────────────────┐    ┌─────────────────────┐
│     PostgreSQL      │    │   S3/R2 Storage     │
│   (Railway DB)      │    │   (PDF + Covers)    │
└─────────────────────┘    └─────────────────────┘
```

## Installatie

### 1. Clone en installeer dependencies

```bash
# Clone repository
git clone <repo-url>
cd pdf-flipbook

# Installeer server dependencies
npm install

# Installeer client dependencies
cd client && npm install && cd ..
```

### 2. Configureer environment variables

```bash
# Kopieer example file
cp .env.example .env

# Bewerk .env met je eigen waarden
```

**Vereiste environment variables:**

| Variable | Beschrijving |
|----------|--------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Geheime sleutel voor JWT tokens |
| `S3_BUCKET` | Naam van je S3/R2 bucket |
| `S3_ENDPOINT` | S3 endpoint URL |
| `S3_ACCESS_KEY` | S3 access key |
| `S3_SECRET_KEY` | S3 secret key |
| `STORAGE_PUBLIC_URL` | Publieke URL voor opgeslagen bestanden |
| `ADMIN_EMAIL` | E-mail voor admin account |
| `ADMIN_PASSWORD` | Wachtwoord voor admin account |

### 3. Setup database

```bash
# Run migraties
npm run db:migrate

# Seed admin user
npm run db:seed
```

### 4. Start development server

```bash
npm run dev
```

Dit start:
- Backend op `http://localhost:3001`
- Frontend op `http://localhost:5173`

## Railway Deployment

### 1. Maak een Railway project

1. Ga naar [railway.app](https://railway.app)
2. Maak een nieuw project
3. Voeg een PostgreSQL database toe

### 2. Deploy de applicatie

```bash
# Via Railway CLI
railway login
railway link
railway up

# Of via GitHub integratie
# Connect je repo in Railway dashboard
```

### 3. Configureer environment variables

Voeg alle environment variables toe in Railway dashboard:
- `DATABASE_URL` (automatisch door Railway PostgreSQL)
- `JWT_SECRET`
- `S3_*` variabelen
- `ADMIN_EMAIL` en `ADMIN_PASSWORD`
- `NODE_ENV=production`

### 4. Run database migraties

```bash
railway run npm run db:migrate
railway run npm run db:seed
```

## Gebruik

### Embed in WordPress/Bricks

```html
<iframe 
  src="https://jouw-app.railway.app/vrije-tijd"
  width="100%" 
  height="800" 
  frameborder="0"
  scrolling="no"
></iframe>
```

### Admin toegang

1. Klik op het subtiele tandwiel-icoon rechtsonder
2. Log in met je admin credentials
3. Sleep een nieuwe PDF in het uploadvenster
4. Vul een titel in en klik "Uploaden"

De nieuwe editie verschijnt automatisch als hoofdflipbook, de vorige schuift naar de galerij.

## API Endpoints

### Publiek

| Method | Endpoint | Beschrijving |
|--------|----------|--------------|
| GET | `/api/magazines?client=slug` | Alle magazines voor een client |
| GET | `/api/magazines/latest?client=slug` | Meest recente magazine |
| GET | `/api/magazines/:id` | Specifiek magazine |

### Protected (JWT vereist)

| Method | Endpoint | Beschrijving |
|--------|----------|--------------|
| POST | `/api/magazines` | Upload nieuw magazine |
| PATCH | `/api/magazines/:id` | Update magazine |
| DELETE | `/api/magazines/:id` | Verwijder magazine |

### Auth

| Method | Endpoint | Beschrijving |
|--------|----------|--------------|
| POST | `/api/auth/login` | Inloggen |
| POST | `/api/auth/logout` | Uitloggen |
| GET | `/api/auth/me` | Huidige gebruiker |

## S3/R2 Storage Setup

### Cloudflare R2 (aanbevolen)

1. Maak een R2 bucket in Cloudflare dashboard
2. Maak API tokens met read/write toegang
3. Configureer public access of custom domain

```env
S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
S3_BUCKET=pdf-flipbook
S3_ACCESS_KEY=<access-key>
S3_SECRET_KEY=<secret-key>
STORAGE_PUBLIC_URL=https://pub-xxx.r2.dev
```

### AWS S3

```env
S3_ENDPOINT=https://s3.<region>.amazonaws.com
S3_REGION=eu-west-1
S3_BUCKET=pdf-flipbook
S3_ACCESS_KEY=<access-key>
S3_SECRET_KEY=<secret-key>
STORAGE_PUBLIC_URL=https://pdf-flipbook.s3.eu-west-1.amazonaws.com
```

## Technische Stack

- **Backend**: Node.js, Express
- **Frontend**: React, Vite, TailwindCSS
- **Database**: PostgreSQL
- **Storage**: S3-compatible (AWS S3, Cloudflare R2, Bunny)
- **PDF Processing**: pdf-lib, pdfjs-dist, sharp
- **Auth**: JWT, bcrypt
- **Deployment**: Railway

## Troubleshooting

### PDF upload faalt

- Check of de PDF kleiner is dan 100MB
- Controleer S3 credentials en bucket permissions
- Bekijk server logs voor specifieke errors

### Cover wordt niet gegenereerd

- De app probeert automatisch een cover te genereren
- Als dit faalt, wordt het magazine toch geüpload (zonder cover)
- Check server logs voor PDF processing errors

### Iframe wordt geblokkeerd

- Zorg dat `X-Frame-Options` niet op `DENY` staat
- Voeg je WordPress domain toe aan `ALLOWED_ORIGINS`

## Licentie

MIT
