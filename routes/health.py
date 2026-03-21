import time
from fastapi import APIRouter, Request
from services.clip_service import clip_service
from services.gemini_service import gemini_service
from utils.sound_loader import group_animal_sounds

router = APIRouter()

@router.get("/api/health")
async def health_check(request: Request):
    """
    Returns system status, including model readiness and uptime.
    """
    # Calculate uptime
    current_time = time.time()
    start_time = getattr(request.app, "start_time", current_time)
    uptime_seconds = int(current_time - start_time)
    
    # Count loaded animals
    animal_sounds = group_animal_sounds()
    animal_count = len(animal_sounds)
    
    return {
        "success": True,
        "data": {
            "uptime_seconds": uptime_seconds,
            "clip_ready": clip_service.is_ready(),
            "yolo_ready": False,
            "gemini_ready": gemini_service.is_ready(),
            "loaded_animals": animal_count,
            "system": "Gooli's Magic Zoo"
        },
        "error": None
    }


@router.post("/api/warmup")
async def warm_up_models():
    clip_loaded = clip_service.warm_up()
    return {
        "success": clip_loaded,
        "data": {
            "clip_ready": clip_service.is_ready(),
            "gemini_ready": gemini_service.is_ready(),
        },
        "error": None if clip_loaded else "CLIP warmup not ready yet"
    }
