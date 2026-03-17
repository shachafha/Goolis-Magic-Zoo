# Gooli's Magic Zoo Architectural Rules

## Stack
- **Backend**: Python (FastAPI)
- **Frontend**: Vanilla HTML/CSS/JS (No React or heavy frameworks)

## Core Logic Flow
1. **Webcam Capture**: Frontend captures an image from the user's webcam.
2. **Identification**: Image is sent to the FastAPI backend.
3. **Gemini 2.5 Flash**: Backend uses Gemini 2.5 Flash to identify the toy animal in the image.
4. **Animal Name**: Backend returns the identified animal name (e.g., "pig", "dinosaur").
5. **Feedback**:
   - Frontend plays a random sound for that animal from the `/animal_sounds` folder.
   - Frontend flashes the screen color to engage the toddler.

## Directory Structure
- `/`: Project root
- `main.py`: FastAPI backend
- `requirements.txt`: Python dependencies
- `.env`: API keys and environment variables
- `Dockerfile`: Container configuration
- `project_context.md`: Contextual documentation
- `agents.md`: This file
- `/static/`: Frontend assets (index.html, styles.css, app.js, logo.png)
- `/animal_sounds/`: MP3 sound files
