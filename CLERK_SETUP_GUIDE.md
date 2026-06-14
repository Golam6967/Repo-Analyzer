# Clerk Authentication Setup Guide

## ✅ What's Been Configured

### Backend (`/backend`)

- ✅ `@clerk/express` and `@clerk/backend` installed
- ✅ Clerk middleware added to `app.js`
- ✅ Webhook handler in `auth.controller.js` (handles user.created & session.created events)
- ✅ Auth routes setup with webhook endpoint at `/api/auth`
- ✅ Protected route example at `/api/protected`
- ✅ CORS configured to accept frontend requests

### Frontend (`/frontend`)

- ✅ `@clerk/react` and `react-router-dom` installed
- ✅ `ClerkProvider` wrapper added to `main.jsx`
- ✅ Navbar component with `SignInButton`, `SignUpButton`, and `UserButton` ready
- ✅ VITE_CLERK_PUBLISHABLE_KEY set in `.env`

---

## 🔑 Next Steps: Get Clerk API Keys

### 1. Get Your Clerk Keys

Go to [Clerk Dashboard](https://dashboard.clerk.com)

1. Select your application
2. Navigate to **API Keys** section
3. Copy these values:
   - **Publishable Key** (starts with `pk_test_...`)
   - **Secret Key** (starts with `sk_test_...`)

### 2. Add Keys to Backend `.env`

Create a `.env` file in `/backend` based on `.env.example`:

```env
NODE_ENV=development
PORT=5000

# Database
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=dev_db
DB_PORT=3306

# Clerk Authentication
CLERK_SECRET_KEY=sk_test_YOUR_SECRET_KEY_HERE
SIGNING_SECRET=your_webhook_secret_here
CLERK_WEBHOOK_SECRET=your_webhook_secret_here
```

### 3. Setup Webhook in Clerk Dashboard

To sync user data from Clerk to your database:

1. Go to Clerk Dashboard → **Webhooks** (left sidebar)
2. Click **Create Endpoint**
3. **Endpoint URL**: `http://localhost:5000/api/auth`
4. **Events to listen to**:
   - ✅ `user.created`
   - ✅ `session.created` (optional: for session tracking)
5. Copy the **Signing Secret** and add to your backend `.env` as `SIGNING_SECRET`

### 4. Database Setup (Optional but Recommended)

If you want to store user data in your database:

1. Ensure Prisma is installed: `npm install @prisma/client`
2. The webhook will automatically create users in your database when they sign up

---

## 🚀 Testing the Setup

### Start Both Servers

```bash
# Terminal 1: Backend
cd backend
npm run dev

# Terminal 2: Frontend
cd frontend
npm run dev
```

### Test Authentication Flow

1. Open `http://localhost:5173`
2. Click **Sign In** or **Sign Up** in the navbar
3. Complete Clerk's authentication flow
4. After signing in, you should see:
   - ✅ Sign in/up buttons disappear
   - ✅ Your user avatar/profile button appears
   - ✅ User data synced to database (if webhook is working)

---

## 📝 Key Files Modified

| File                                 | Changes                                          |
| ------------------------------------ | ------------------------------------------------ |
| `backend/src/app.js`                 | Added Clerk middleware & protected route example |
| `backend/src/routes/auth.routes.js`  | Fixed controller import path                     |
| `backend/.env.example`               | Added Clerk keys template                        |
| `frontend/src/main.jsx`              | Added ClerkProvider wrapper                      |
| `frontend/src/components/Navbar.jsx` | Already has Clerk components integrated          |

---

## 🔐 Available Endpoints

### Public

- `GET /api/health` - Server health check

### Protected (requires authentication)

- `GET /api/protected` - Returns `{ message, userId }`

### Webhooks

- `POST /api/auth` - Clerk webhook for user events

---

## 📚 Environment Variables Reference

### Frontend

- `VITE_CLERK_PUBLISHABLE_KEY` - Public key (already set)

### Backend

- `CLERK_SECRET_KEY` - Secret key from Clerk
- `SIGNING_SECRET` - Webhook signing secret
- `CLERK_WEBHOOK_SECRET` - Alternative webhook secret

---

## 🐛 Troubleshooting

### "Clerk is not configured"

→ Make sure `VITE_CLERK_PUBLISHABLE_KEY` is set and frontend server restarted

### Webhook not working

→ Verify endpoint URL is `http://localhost:5000/api/auth` in Clerk dashboard
→ Check SIGNING_SECRET matches webhook signing secret

### CORS errors

→ Ensure backend CORS includes your frontend URL (`http://localhost:5173`)

### Users not syncing to database

→ Check backend console for webhook errors
→ Verify webhook endpoint URL is correct
→ Make sure Prisma is configured properly

---

## ✨ Your Navbar is Ready!

The Navbar component already includes:

- **SignInButton** - Clerk's pre-built sign-in UI
- **SignUpButton** - Clerk's pre-built sign-up UI
- **UserButton** - Shows user profile & logout

No additional config needed for the navbar!
