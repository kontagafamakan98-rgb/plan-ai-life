# SimAI - Life Simulator Game

## Overview
A Sims-like mobile game with AI-controlled autonomous characters that live realistic lives in a sandbox environment inspired by real-world locations.

## Core Features

### 1. AI-Controlled Characters (3 Characters)
- **Sophie Laurent** - Fashion Designer from Paris
- **Kenji Tanaka** - Software Engineer from Tokyo  
- **Marcus Johnson** - Marketing Director from New York

### 2. Character Needs System
- Hunger (food consumption)
- Energy (sleep/rest)
- Social (interaction with others)
- Hygiene (cleanliness)
- Fun (entertainment)
- Bladder (bathroom needs)
- Comfort (relaxation)

### 3. Real-World Locations
- Paris Cafe (Le Petit Parisien)
- Tokyo Apartment (Shibuya)
- NYC Office (Manhattan Tech Hub)
- London Park (Hyde Park)
- Barcelona Gym (FitLife)
- Rome Restaurant (Trattoria Da Nonna)
- Berlin Club (Berghain Underground)
- Sydney Beach (Bondi Beach)

### 4. AI Decision Engine
- Uses OpenAI GPT-4o for realistic decision making
- Characters evaluate needs, personality, and environment
- Generate human-like thoughts and actions

### 5. Player Interactions
- Observe characters living autonomously
- Command characters to travel to locations
- Pause/Resume simulation
- Auto-simulate mode
- Reset game

## Technical Stack
- **Frontend**: Expo/React Native with Zustand
- **Backend**: FastAPI + MongoDB
- **AI**: OpenAI GPT-4o via Emergent Integration

## API Endpoints
- GET /api/characters - List all characters
- GET /api/locations - List all locations
- GET /api/logs - Get activity logs
- POST /api/simulate - Run simulation tick
- POST /api/command - Send player command
- POST /api/characters/{id}/move - Move character
- POST /api/reset - Reset game state
