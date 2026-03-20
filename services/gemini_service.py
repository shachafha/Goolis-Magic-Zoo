import os
from google import generativeai as genai
from dotenv import load_dotenv
from utils.logger import logger

load_dotenv()

class GeminiService:
    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY")
        if not self.api_key:
            logger.warning("GEMINI_API_KEY not found in environment")
        else:
            genai.configure(api_key=self.api_key)

    def is_ready(self):
        return self.api_key is not None

    def identify_animal(self, image_bytes, known_animals):
        if not self.api_key:
            return "unknown", "none", "Gemini API Key not configured"

        try:
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

            return response.text.strip().lower(), "gemini", None
        except Exception as e:
            logger.error(f"Gemini identification failed: {e}")
            return "unknown", "gemini", str(e)

# Global instance
gemini_service = GeminiService()
