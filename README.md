# African Nations League 2026 - Tournament Management System

A comprehensive web application for managing football tournaments, teams, matches, and live simulations for the African Nations League 2026.

## What is this app?

The African Nations League 2026 app is a full-stack tournament management system that allows users to:

- **Create and manage tournaments** with automatic bracket generation
- **Register teams** with detailed squad information
- **View live match simulations** with AI-powered commentary
- **Track fixtures and results** across multiple tournaments
- **Browse team profiles** and statistics
- **Follow tournament progression** from quarter-finals to finals

The app simulates realistic football matches with dynamic commentary, penalty shootouts, and automatic bracket progression based on match results.

## Tech Stack

### Frontend

- **React 19.2.0** - Modern UI framework with hooks
- **React Router** - Client-side routing and navigation
- **Tailwind CSS** - Utility-first CSS framework for styling
- **Canvas Confetti** - Celebration animations for match wins
- **Framer Motion** - Smooth animations and transitions
- **Lucide React** - Beautiful icon library

### Backend & Database

- **Firebase Firestore** - NoSQL cloud database for real-time data
- **Firebase Authentication** - User authentication and authorization
- **Firebase Analytics** - User behavior tracking

### AI & Simulation

- **Google Generative AI (Gemini)** - AI-powered match commentary generation
- **Custom Match Engine** - Realistic football match simulation with events
- **Dynamic Commentary System** - Real-time match narration

### Development Tools

- **Create React App** - Project scaffolding and build tools
- **ESLint** - Code linting and quality checks
- **Jest & React Testing Library** - Unit and integration testing

## Project Structure

```
src/
├── components/
│   └── navbar.js          # Navigation component
├── config/
│   └── firebase.js        # Firebase configuration
├── pages/
│   ├── allTournaments.js  # Tournament listing and creation
│   ├── fixtures.js        # Match fixtures and results
│   ├── login.js           # User authentication
│   ├── main.js            # Dashboard/home page
│   ├── matchPage.js       # Live match simulation
│   ├── myTeam.js          # User's team management
│   ├── register.js        # User registration
│   ├── register-team.js   # Team registration
│   ├── teamPage.js        # Individual team profiles
│   ├── teams.js           # Teams listing
│   └── tournament-page.js # Tournament management
└── utils/
    └── geminiAI.js        # AI commentary generation
```

## Prerequisites

Before running the app, make sure you have:

- **Node.js** (version 16 or higher)
- **npm** (comes with Node.js)

## Getting Started

### 1. Clone the Repository

```bash
git clone <repository-url>
cd INF4001N_CMPCAM001_ANLeague_2026
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Setup

Create a `.env` file in the root directory with your API keys:

```env
REACT_APP_GEMINI_API_KEY=your_gemini_api_key_here
```

### 4. Firebase Configuration

Update `src/config/firebase.js` with your Firebase project credentials:

```javascript
const firebaseConfig = {
  apiKey: "your-api-key",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.firebasestorage.app",
  messagingSenderId: "your-sender-id",
  appId: "your-app-id",
};
```

### 5. Run the Application

#### Development Mode

```bash
npm start
```

Opens the app at [http://localhost:3000](http://localhost:3000) with hot reload.

#### Production Build

```bash
npm run build
```

Creates an optimized build in the `build/` folder ready for deployment.

#### Run Tests

```bash
npm test
```

Launches the test runner in interactive watch mode.

## How to Use

### For Tournament Organizers

1. **Register** an account and **log in**
2. **Create tournaments** and set up bracket structures
3. **Register teams** with squad details
4. **Start matches** and watch live simulations
5. **Track progression** through knockout rounds

### For Viewers

1. **Browse tournaments** and view brackets
2. **Check fixtures** for upcoming and completed matches
3. **Watch live matches** with AI commentary
4. **Explore team profiles** and statistics
5. **Follow results** across multiple tournaments

## Key Features

### Live Match Simulation

- Real-time match events with AI-generated commentary
- Dynamic scoreline updates and penalty shootouts
- Celebration animations for goals and wins
- Detailed match analysis and key moments

### Tournament Management

- Automatic bracket generation (QF → SF → F)
- Winner progression and next-round creation
- Duplicate match prevention
- Tournament status tracking

### Team & Player Management

- Comprehensive team profiles
- Squad management with player details
- Team statistics and performance tracking
- Federation ID-based identification

### Modern UI/UX

- Responsive design for all devices
- Smooth animations and transitions
- Intuitive navigation and user flows
- Real-time data updates

## 📝 Database Collections

The app uses Firebase Firestore with these main collections:

- **tournaments** - Tournament data and brackets
- **teams** - Team information and squads
- **matches** - Match results and commentary
- **players** - Individual player statistics
- **users** - User accounts and preferences
