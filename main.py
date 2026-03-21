import time
from fastapi import FastAPI
from starlette.middleware.base import BaseHTTPMiddleware
from fastapi.staticfiles import StaticFiles
from routes.config import router as config_router
from routes.analyze import router as analyze_router
from routes.health import router as health_router
from utils.logger import logger

app = FastAPI()
app.start_time = time.time()


class NoCacheStaticMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        path = request.url.path
        if path == "/" or path.endswith((".html", ".js", ".css")):
            response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
            response.headers["Pragma"] = "no-cache"
            response.headers["Expires"] = "0"
        return response


app.add_middleware(NoCacheStaticMiddleware)

# Global Exception Handler
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    logger.error(f"Unhandled exception: {exc}")
    return {"success": False, "data": None, "error": "Internal Server Error"}

# Include Routers
app.include_router(config_router)
app.include_router(analyze_router)
app.include_router(health_router)

# Mount animal sounds (served at /sounds)
app.mount("/sounds", StaticFiles(directory="animal_sounds"), name="sounds")

# Mount animal images (served at /animal_images)
app.mount("/animal_images", StaticFiles(directory="animal_images"), name="animal_images")

# Mount frontend assets (served at /)
app.mount("/", StaticFiles(directory="static", html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    logger.info("Starting Gooli's Magic Zoo Backend...")
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
