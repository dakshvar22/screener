# Crypto Gap Fill Screener - Vercel Deployment Guide

## 📁 Project Structure

Create this folder structure:

```
crypto-screener/
├── api/
│   └── crypto-data.js          (Serverless function)
├── src/
│   ├── App.jsx                 (Main React component)
│   └── main.jsx                (Entry point)
├── public/
├── index.html                  (HTML template)
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
└── vercel.json                 (Vercel config)
```

## 🚀 Quick Setup (5 minutes)

### Step 1: Create Project Files

**1. Create `index.html` in root:**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Crypto Gap Fill Screener</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

**2. Create `src/main.jsx`:**

```jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

**3. Create `src/index.css`:**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}
```

**4. Create `src/App.jsx`:**
(Use the React component from the first artifact above)

**5. Create `api/crypto-data.js`:**
(Use the serverless function from the second artifact above)

**6. Create `vite.config.js`:**

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})
```

**7. Create `tailwind.config.js`:**

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

**8. Create `postcss.config.js`:**

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

**9. Create `vercel.json`:**

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "/api/$1"
    }
  ]
}
```

**10. Add `package.json`:**
(Use the package.json from the third artifact above)

---

## 🌐 Deploy to Vercel

### Method 1: Deploy from GitHub (Recommended)

1. **Create GitHub Repository:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin <your-repo-url>
   git push -u origin main
   ```

2. **Connect to Vercel:**
   - Go to [vercel.com](https://vercel.com)
   - Click "Add New Project"
   - Import your GitHub repository
   - Click "Deploy"
   - Done! ✅

### Method 2: Deploy with Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Navigate to project
cd crypto-screener

# Deploy
vercel

# Follow prompts, then your app is live!
```

---

## 🧪 Test Locally First

```bash
# Install dependencies
npm install

# Run dev server
npm run dev

# Open http://localhost:5173
```

The API routes will work locally through Vite's proxy!

---

## ⚙️ Configuration

### Add More Cryptos

Edit `api/crypto-data.js` and add to `CRYPTO_IDS` array:

```javascript
{ id: 'bitcoin-cash', name: 'Bitcoin Cash' },
{ id: 'ethereum-classic', name: 'Ethereum Classic' },
```

Find coin IDs at: https://coincap.io/

### Adjust Timeframes

Edit `TIMEFRAME_CONFIG` in `api/crypto-data.js`:

```javascript
'15m': { interval: 'm15', candles: 400 },
'2h': { interval: 'h1', candles: 400, aggregate: 2 },
```

---

## 🎉 That's It!

Your screener will be live at: `https://your-project.vercel.app`

**Features:**
- ✅ Zero server maintenance
- ✅ Auto-scales infinitely
- ✅ Free SSL certificate
- ✅ Global CDN
- ✅ Automatic deployments on git push

### Free Tier Limits:
- 100GB bandwidth/month
- 100 serverless function invocations/day
- More than enough for personal use!

---

## 🐛 Troubleshooting

**API not working?**
- Check Vercel logs: Dashboard → Your Project → Functions → Logs
- Verify `api/crypto-data.js` is in the correct folder

**Build fails?**
- Run `npm run build` locally to check for errors
- Make sure all dependencies are in package.json

**Empty data?**
- Check browser console for errors
- Try clicking "Show Debug Info" in the app

---

## 📝 Notes

- First load takes 10-20 seconds (fetching data for 20 coins)
- Data updates when you click "Refresh"
- All calculations happen client-side (fast!)
- CoinCap API has no rate limits for basic usage

Enjoy your serverless crypto screener! 🚀
