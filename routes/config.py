from fastapi import APIRouter
from utils.sound_loader import group_animal_sounds
from utils.logger import logger

router = APIRouter()

# We might need a way to share the current sounds config across modules
# Or just re-scan if needed. For now let's keep the logic consistent.

# Simple in-memory cache
_config_cache = None
_images_cache = None

@router.get("/api/config")
async def get_config():
    """
    Returns the mapping of animal names to their corresponding sound file URLs.
    Cached after first load.
    """
    global _config_cache
    try:
        if _config_cache is None:
            logger.info("Config cache miss. Loading animal sounds...")
            _config_cache = group_animal_sounds()
        return {"success": True, "data": _config_cache, "error": None}
    except Exception as e:
        logger.error(f"Failed to load sound config: {e}")
        return {"success": False, "data": None, "error": str(e)}

@router.get("/api/images")
async def get_images():
    """
    Returns a list of animal names found in the animal_images folder.
    Cached after first load.
    """
    global _images_cache
    try:
        if _images_cache is None:
            logger.info("Images cache miss. Loading animal images list...")
            import os
            images_dir = "animal_images"
            if not os.path.exists(images_dir):
                _images_cache = []
            else:
                animals = []
                for filename in os.listdir(images_dir):
                    if filename.lower().endswith((".png", ".jpg", ".jpeg")):
                        name_part = os.path.splitext(filename)[0].lower()
                        animals.append(name_part)
                _images_cache = sorted(list(set(animals)))
        return {"success": True, "data": _images_cache, "error": None}
    except Exception as e:
        logger.error(f"Failed to load animal images: {e}")
        return {"success": False, "data": None, "error": str(e)}
