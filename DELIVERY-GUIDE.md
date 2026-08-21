# SMS Campaign System — Live & Ready

## Your Two Live Websites

| Panel | URL | Purpose |
|-------|-----|---------|
| **Admin Panel** | https://mms-sender-v01.netlify.app | Admin only (Netlify) |
| **User Panel** | https://mms-sender-v01.vercel.app | Users only (Vercel) |

Both are separate, have separate login pages, and separate themes.

---

## Admin Panel Login (3-Layer Security)

Go to: https://mms-sender-v01.netlify.app

You need ALL THREE to login:

| Field | Value |
|-------|-------|
| **Username** | `admin_7f8bbcf9` |
| **Password** | `kFMPNauew5d@%RhH` |
| **API Key** | `sk_5b7286cc8a7c51bba69276359bc25854f77a0300` |

**How to login:**
1. Open the admin URL
2. Enter username, password, and API key
3. Use the eye icons to show/hide password and API key
4. Click Login

**After login you can:**
- Change admin username
- Change admin password
- Regenerate API key (creates a new random key)
- View overview stats
- Set Gemini API key and SMS API key
- Manage MongoDB connections
- Create/suspend/activate/delete users
- Set user sending limits
- View all campaigns

---

## User Panel Login

Go to: https://mms-sender-v01.vercel.app

Users can:
- Self-register (email + password, minimum 6 characters)
- Login with email + password
- View their sending quota
- Send SMS campaigns
- View their campaign history

New users get role "user" (NOT admin) with a default limit of 100 messages.

---

## How To Update Configs Yourself (No AI Needed)

All config files are in the project root. Edit them and push to GitHub:

### 1. Gemini API Key
File: `config-gemini.js`
```js
export const GEMINI_CONFIG = {
  apiKey: 'YOUR_GEMINI_API_KEY_HERE',  // ← Change this
  model: 'gemini-1.5-flash',
  endpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
};
```

Or set it from the Admin Panel → API Keys tab (stored in MongoDB, no code change needed).

### 2. SMS Provider Config
File: `config-sending.js`
```js
export const SMS_CONFIG = {
  apiKey: 'YOUR_SMS_API_KEY_HERE',  // ← Change this
  provider: 'twilio',
  endpoint: 'https://api.twilio.com/2010-04-01/Accounts/',
};
```

Or set it from the Admin Panel → API Keys tab.

### 3. Database Config
File: `config-database.js`
```js
export const DB_CONFIG = {
  uri: 'mongodb://localhost:27017/sms_campaign_db',  // ← Change this
  options: { bufferCommands: false },
};
```

The real database is set via the `MONGODB_URI` environment variable on both Vercel and Netlify. You can also add multiple MongoDB connections from the Admin Panel → MongoDB tab.

### 4. Environment Variables

**Vercel (User Panel):**
- `NEXT_PUBLIC_PANEL_MODE` = `user`
- `MONGODB_URI` = your MongoDB connection string
- `JWT_SECRET` = your JWT secret

**Netlify (Admin Panel):**
- `NEXT_PUBLIC_PANEL_MODE` = `admin`
- `MONGODB_URI` = your MongoDB connection string
- `JWT_SECRET` = your JWT secret

---

## How To Push Updates From Your Phone (Termux)

```bash
cd Mms_senderV01
git add -A
git commit -m "your update message"
git push origin main
```

When you push to GitHub:
- Vercel auto-deploys the user panel
- Netlify auto-deploys the admin panel (if connected to GitHub)
- Or run: `netlify deploy --prod` from Termux

---

## File Structure

```
Mms_senderV01/
├── config-database.js     ← Edit MongoDB config here
├── config-gemini.js       ← Edit Gemini API key here
├── config-sending.js      ← Edit SMS provider config here
├── netlify.toml           ← Netlify config (admin panel mode)
├── vercel.json            ← Vercel config (user panel mode)
├── package.json           ← Dependencies and build script
├── init-configs.js        ← Generates config files from .env
├── src/
│   ├── app/
│   │   ├── page.js                    ← Routes to admin or user panel
│   │   ├── layout.js                  ← Root layout
│   │   ├── globals.css                ← Global styles
│   │   └── api/system/route.js        ← All API endpoints
│   ├── components/
│   │   ├── AdminPanel.jsx             ← Admin UI (Netlify only)
│   │   └── UserPanel.jsx              ← User UI (Vercel only)
│   └── lib/
│       └── core.js                    ← Database, auth, schemas
```

---

## Security Notes

- Admin login uses 3 layers: username + password + API key
- All passwords are hashed with bcrypt (12 salt rounds)
- JWT tokens are HttpOnly cookies (24 hour expiry)
- User panel has NO admin access
- Admin panel has NO user self-registration
- Config files contain only placeholders — real keys go in MongoDB via admin panel
