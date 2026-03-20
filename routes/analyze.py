import base64
import numpy as np
import cv2
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services.clip_service import clip_service
from services.gemini_service import gemini_service
from utils.sound_loader import group_animal_sounds
from utils.logger import logger

router = APIRouter()

class ImagePayload(BaseModel):
    base64_image: str

@router.post("/api/analyze")
async def analyze_image(payload: ImagePayload):
    """
    Identifies a toy animal using CLIP locally, with Gemini as a fallback.
    """
    try:
        # 1. Decode base64 image
        header, encoded = (payload.base64_image.split(",", 1) 
                          if "," in payload.base64_image 
                          else (None, payload.base64_image))
        image_bytes = base64.b64decode(encoded)

        # Convert bytes to cv2 image for logging
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img is None:
            logger.error("Failed to decode image from buffer.")
            return {"success": False, "data": None, "error": "Invalid image data"}

        # Check brightness
        brightness = np.mean(img)
        logger.info(f"Image captured. Brightness: {brightness:.2f}")
        
        if brightness < 10:
            logger.warning("Captured image is very dark. Recognition may fail.")

        # Get all known animals from both sounds and images folders
        animal_sounds_config = group_animal_sounds()
        sound_animals = [a.lower() for a in animal_sounds_config.keys()]
        
        # Also get animals from images folder (for CLIP to identify even without sounds)
        import os
        image_animals = []
        images_dir = "animal_images"
        if os.path.exists(images_dir):
            for f in os.listdir(images_dir):
                if f.lower().endswith((".png", ".jpg", ".jpeg")):
                    image_animals.append(os.path.splitext(f)[0].lower())
        
        # CLIP should know ALL animals (images + sounds combined)
        all_animals = sorted(list(set(sound_animals + image_animals)))
        
        logger.info(f"Analyze: {len(all_animals)} animals for CLIP: {all_animals}")
        logger.info(f"  Sound animals: {sound_animals}")
        
        if not all_animals:
             logger.warning("No animals found.")
             return {"success": True, "data": {"animal": "unknown", "method": "none"}, "error": "No animals found!"}


        # 2. Try CLIP first
        best_guess, confidence = clip_service.detect_animal(img, all_animals)
        logger.info(f"CLIP result: {best_guess} ({confidence:.3f} confidence)")
        
        if best_guess and confidence > 0.15:
            logger.info(f"CLIP MATCH SUCCESS: {best_guess}")
            return {"success": True, "data": {"animal": best_guess, "method": "clip"}, "error": None}

        # 3. Fallback to Gemini
        logger.info("CLIP unsure. Falling back to Gemini...")
        animal_result, method, error = gemini_service.identify_animal(image_bytes, all_animals)
        logger.info(f"Gemini fallback result: {animal_result} (error: {error})")
        
        if error and animal_result == "unknown":
            logger.error(f"Identification total failure: {error}")
            return {"success": False, "data": {"animal": "unknown", "method": "none"}, "error": error}

        # Ensure result is in lowercase
        animal_result = animal_result.lower() if animal_result else "unknown"
        if animal_result in all_animals:
             logger.info(f"Gemini MATCH SUCCESS: {animal_result}")
             return {"success": True, "data": {"animal": animal_result, "method": "gemini"}, "error": None}
        else:
             logger.warning(f"Gemini identified '{animal_result}' but it's not in all_animals: {all_animals}")
             return {"success": True, "data": {"animal": "unknown", "method": "gemini"}, "error": None}


    except Exception as e:
        logger.error(f"Critical error in analyze_image: {e}", exc_info=True)
        return {"success": False, "data": None, "error": str(e)}


@router.post("/api/analyze-clip")
async def analyze_image_clip_only(payload: ImagePayload):
    """
    CLIP-only endpoint for testing — no Gemini fallback.
    """
    try:
        header, encoded = (payload.base64_image.split(",", 1)
                          if "," in payload.base64_image
                          else (None, payload.base64_image))
        image_bytes = base64.b64decode(encoded)

        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img is None:
            return {"success": False, "data": None, "error": "Invalid image data"}

        animal_sounds_config = group_animal_sounds()
        known_animals = [a.lower() for a in animal_sounds_config.keys()]

        best_guess, confidence = clip_service.detect_animal(img, known_animals)
        logger.info(f"[CLIP-ONLY TEST] Result: {best_guess} ({confidence:.3f})")

        if best_guess:
            return {"success": True, "data": {"animal": best_guess, "method": "clip", "confidence": round(confidence, 3)}, "error": None}
        else:
            return {"success": True, "data": {"animal": "unknown", "method": "clip", "confidence": 0}, "error": None}

    except Exception as e:
        logger.error(f"CLIP-only test error: {e}", exc_info=True)
        return {"success": False, "data": None, "error": str(e)}


