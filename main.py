import os
import re
import base64
import io
import numpy as np
import cv2
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from collections import defaultdict
from dotenv import load_dotenv
from google import generativeai as genai
from ultralytics import YOLO

# ... (rest of imports remains same)

# Load environment variables
load_dotenv()

app = FastAPI()

# Configure Gemini
api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    print("Warning: GEMINI_API_KEY not found in environment")
else:
    genai.configure(api_key=api_key)

# Initialize YOLO (v8n is fast and light)
try:
    yolo_model = YOLO("yolov8n.pt")
    print("YOLO model loaded successfully!")
except Exception as e:
    print(f"Warning: Could not load YOLO model: {e}")
    yolo_model = None

# Store grouped sound files
animal_sounds_config = {}

class ImagePayload(BaseModel):
    base64_image: str

def group_animal_sounds():
    """
    Scans the /animal_sounds directory, groups .mp3 files by animal name
    (stripping digits), and updates the global config.
    """
    sounds_dir = "animal_sounds"
    grouped = defaultdict(list)
    
    if not os.path.exists(sounds_dir):
        os.makedirs(sounds_dir)
        return {}

    for filename in os.listdir(sounds_dir):
        if filename.lower().endswith(".mp3"):
            name_part = os.path.splitext(filename)[0]
            base_name = re.sub(r'\d+', '', name_part).strip().lower()
            file_url = f"/sounds/{filename}"
            grouped[base_name].append(file_url)
    
    return dict(grouped)

@app.on_event("startup")
async def startup_event():
    global animal_sounds_config
    animal_sounds_config = group_animal_sounds()

@app.get("/api/config")
async def get_config():
    return animal_sounds_config

@app.get("/api/images")
async def get_images():
    images_dir = "animal_images"
    if not os.path.exists(images_dir):
        return []
    
    animals = []
    for filename in os.listdir(images_dir):
        if filename.lower().endswith((".png", ".jpg", ".jpeg")):
            name_part = os.path.splitext(filename)[0].lower()
            animals.append(name_part)
    return sorted(list(set(animals)))

@app.post("/api/analyze")
async def analyze_image(payload: ImagePayload):
    """
    Identifies a toy animal using YOLO locally, with Gemini as a fallback.
    """
    try:
        # 1. Decode base64 image
        header, encoded = (payload.base64_image.split(",", 1) 
                          if "," in payload.base64_image 
                          else (None, payload.base64_image))
        image_bytes = base64.b64decode(encoded)

        # Convert bytes to cv2 image for YOLO
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        known_animals = list(animal_sounds_config.keys())
        if not known_animals:
             return {"animal": "unknown", "error": "No animals found!"}

        # 2. Try YOLO first (with robust fallback)
        if yolo_model:
            try:
                results = yolo_model(img, verbose=False)
                highest_conf = 0
                best_guess = None

                for result in results:
                    for box in result.boxes:
                        cls_id = int(box.cls[0])
                        label = yolo_model.names[cls_id].lower()
                        conf = float(box.conf[0])

                        # Look for matches in our sound roster
                        if label in known_animals and conf > highest_conf:
                            highest_conf = conf
                            best_guess = label
                
                # If we found a high-confidence match, return it
                if best_guess and highest_conf > 0.5:
                    print(f"YOLO identified: {best_guess} ({highest_conf:.2f} confidence)")
                    return {"animal": best_guess, "method": "yolo"}
            except Exception as ye:
                print(f"YOLO inference failed, falling back to Gemini: {ye}")

        # 3. Fallback to Gemini 2.5 Flash if YOLO fails or is unsure
        if not api_key:
            return {"animal": "unknown", "method": "none", "error": "YOLO failed and Gemini API Key not configured"}

        print("YOLO unsure. Falling back to Gemini...")
        animal_list_str = ", ".join(known_animals)
        prompt = (
            f"Identify the toy animal. Respond ONLY with a single word from: [{animal_list_str}]. "
            f"If none match, respond ONLY with: unknown."
        )

        model = genai.GenerativeModel("gemini-2.5-flash")
        response = model.generate_content([
            prompt,
            {"mime_type": "image/jpeg", "data": image_bytes}
        ])

        animal_result = response.text.strip().lower()
        print(f"Gemini (fallback) identified: {animal_result}")
        return {"animal": animal_result, "method": "gemini"}

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error analyzing image: {str(e)}")

# Mount animal sounds (served at /sounds)
app.mount("/sounds", StaticFiles(directory="animal_sounds"), name="sounds")

# Mount animal images (served at /animal_images)
app.mount("/animal_images", StaticFiles(directory="animal_images"), name="animal_images")

# Mount frontend assets (served at /)
app.mount("/", StaticFiles(directory="static", html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
