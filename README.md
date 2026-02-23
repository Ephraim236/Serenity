# Booking System Backend

A Node.js/Express backend with MongoDB integration and Google OAuth authentication.

## Prerequisites

- Node.js (v14 or higher)
- MongoDB (local or Atlas cloud)

## Setup Instructions

### Step 1: Install Dependencies

```bash
cd Backend
npm install
```

### Step 2: Set Up MongoDB

#### Option A: MongoDB Atlas (Cloud - Recommended)

1. Go to [mongodb.com/atlas](https://www.mongodb.com/atlas)
2. Create a free account and a free cluster
3. Create a database user (remember username and password)
4. In Network Access, add IP: `0.0.0.0/0` (allows all IPs)
5. Click "Connect" → "Connect your application"
6. Copy the connection string

#### Option B: MongoDB Local

1. Download MongoDB Community Server from [mongodb.com](https://www.mongodb.com/try/download/community)
2. Install and start the MongoDB service
3. Connection string: `mongodb://localhost:27017/booking`

### Step 3: Set Up Google OAuth (Firebase)

1. Go to [console.firebase.google.com](https://console.firebase.google.com/)
2. Create a new project
3. Go to Authentication → Sign-in method
4. Enable "Google" sign-in
5. Go to Project Settings → Your apps → Web app
6. Copy the Client ID and Client Secret

### Step 4: Configure Environment Variables

Edit the `Backend/.env` file:

```env
# MongoDB Connection
MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/booking?retryWrites=true&w=majority

# Google OAuth (from Firebase)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:3000/api/auth/google/callback

# JWT Secret (use a random string)
JWT_SECRET=your-secret-key-here

# Frontend URL
FRONTEND_URL=http://localhost:5173

# Server Port
PORT=3000
```

### Step 5: Add Authorized Domains in Firebase

1. In Firebase Console, go to Authentication → Settings
2. Add `localhost` to "Authorized domains"

### Step 6: Start the Backend

```bash
npm start
```

The server will start on http://localhost:3000

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login with email/password
- `GET /api/auth/google` - Google OAuth login
- `GET /api/auth/google/callback` - Google OAuth callback
- `GET /api/auth/me` - Get current user

### Dashboard
- `GET /api/dashboard/stats` - Get dashboard statistics
- `GET /api/dashboard/revenue` - Get revenue data
- `GET /api/dashboard/staff` - Get staff utilization
- `GET /api/dashboard/appointments/today` - Get today's appointments
- `PATCH /api/dashboard/appointments/:id` - Update appointment status
- `GET /api/dashboard/services` - Get all services

### Health Check
- `GET /api/health` - Server health status

## Running Without MongoDB

The backend can run in demo mode without MongoDB. The dashboard will show sample data for demonstration purposes.

## Project Structure

```
Backend/
├── src/
│   ├── index.js          # Main server file
│   ├── config/
│   │   ├── db.js         # MongoDB connection
│   │   └── passport.js   # Google OAuth config
│   ├── models/
│   │   ├── User.js      # User model
│   │   ├── Appointment.js # Appointment model
│   │   └── Service.js   # Service model
│   └── routes/
│       ├── auth.js      # Authentication routes
│       └── dashboard.js # Dashboard API routes
├── .env                 # Environment variables
├── package.json
└── README.md
```

## Frontend Setup

The frontend is in the `Frontend/` folder. To start it:

```bash
cd Frontend
npm install
npm run dev
```

The frontend runs on http://localhost:5173

## Troubleshooting

### MongoDB Connection Error
- Make sure MongoDB is running or your Atlas cluster is active
- Check that the connection string in .env is correct

### Google OAuth Not Working
- Ensure Client ID and Secret are correct in .env
- Check that callback URL matches Firebase settings
- Make sure "Google" sign-in is enabled in Firebase Console

### CORS Errors
- Ensure FRONTEND_URL is set correctly in .env
