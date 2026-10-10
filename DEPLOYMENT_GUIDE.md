# OneVishwam Ecosystem — Production Deployment Reference Guide

This document contains the authoritative deployment commands, paths, hosting targets, and CI/CD pipelines for all applications in the OneVishwam ecosystem.

---

## ⚡ Quick Deploy All (Backend + Portals)

Run this one-liner to build and deploy the Backend Cloud Functions, Admin Portal, and Lister Portal sequentially:

```bash
# 1. Deploy Backend API Functions
cd "/Users/tejas/Desktop/untitled folder/React JS/Vishwam-Backend" && npm run deploy

# 2. Build & Deploy Admin Portal
cd "/Users/tejas/Desktop/untitled folder/React JS/Listing-Admin/Vishwam-Admin" && npm run build && npx firebase deploy --only hosting:admin

# 3. Build & Deploy Lister Portal
cd "/Users/tejas/Desktop/untitled folder/React JS/Listing-Admin/Vishwam-Listings" && npm run build && npx firebase deploy --only hosting:listings
```

---

## 📦 Individual Project Breakdown

### 1. Vishwam-Backend (Express API on Firebase Cloud Functions v2)
- **Path:** `/Users/tejas/Desktop/untitled folder/React JS/Vishwam-Backend`
- **Runtime:** Firebase Cloud Functions (Gen 2, Node.js 20, region `asia-south1`)
- **Database:** MongoDB Atlas M0 Cluster (`onevishwam`)
- **Function Entry:** `index.js` -> `exports.api` & `exports.cleanupDeletedUser`

#### CLI Command:
```bash
cd "/Users/tejas/Desktop/untitled folder/React JS/Vishwam-Backend"
npm run deploy
# Runs: firebase deploy --only functions
```

#### Secrets Configuration (Google Cloud Secret Manager):
To update secrets bound to Cloud Functions (e.g. database credentials, JWT keys):
```bash
firebase functions:secrets:set MONGODB_URI
firebase functions:secrets:set JWT_SECRET
```

#### Automated GitHub CI/CD:
- Merge or push changes to branch `main`.
- Triggers `.github/workflows/deploy-firebase.yml` automatically via GitHub Actions.

---

### 2. Vishwam-Admin (Admin Portal)
- **Path:** `/Users/tejas/Desktop/untitled folder/React JS/Listing-Admin/Vishwam-Admin`
- **Hosting Target:** `admin` -> `onevishwam-admin`
- **Framework:** Vite + React

#### Build & Deploy Command:
```bash
cd "/Users/tejas/Desktop/untitled folder/React JS/Listing-Admin/Vishwam-Admin"
npm run build
npx firebase deploy --only hosting:admin
```

---

### 3. Vishwam-Listings (Lister / Channel Partner Portal)
- **Path:** `/Users/tejas/Desktop/untitled folder/React JS/Listing-Admin/Vishwam-Listings`
- **Hosting Target:** `listings` -> `onevishwam-listings`
- **Framework:** Vite + React

#### Build & Deploy Command:
```bash
cd "/Users/tejas/Desktop/untitled folder/React JS/Listing-Admin/Vishwam-Listings"
npm run build
npx firebase deploy --only hosting:listings
```

---

### 4. Vishwam-Frontend (Consumer Web Marketplace)
- **Path:** `/Users/tejas/Desktop/untitled folder/React JS/Vishwam-Frontend`
- **Framework:** Vite + React

#### Build & Deploy Command:
```bash
cd "/Users/tejas/Desktop/untitled folder/React JS/Vishwam-Frontend"
npm run build
# Deploy to Firebase default hosting site:
npx firebase deploy --only hosting --project onevishwam
```

---

## 🛠️ Local Development & Testing Ports

| Service | Local Command | Local URL | Port |
| :--- | :--- | :--- | :--- |
| **Backend API** | `npm start` / `npm run dev` | `http://localhost:5001/api` | `5001` |
| **Admin Portal** | `npm run dev` | `http://localhost:5174` | `5174` |
| **Listings Portal** | `npm run dev` | `http://localhost:5173` | `5173` |
| **Customer Frontend** | `npm run dev` | `http://localhost:3000` / `http://localhost:5175` | Configurable |

---

## 🔐 Pre-Deployment Checklist
1. **Secrets:** Verify that `MONGODB_URI` is set in Google Cloud Secret Manager or Firebase functions config.
2. **IP Whitelisting:** Ensure MongoDB Atlas Network Access has `0.0.0.0/0` whitelisted for serverless Cloud Function IPs.
3. **CORS:** Origins `https://onevishwam.com`, `https://www.onevishwam.com`, `https://onevishwam-admin.web.app`, and `https://onevishwam-listings.web.app` are pre-configured.
4. **Build Output:** Always run `npm run build` before deploying frontend/portal hosting to ensure the `dist/` bundle is current.
