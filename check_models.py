import os
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")
print(f"Key preview: {api_key[:10]}...")

genai.configure(api_key=api_key)
print("Listing all models:")
try:
    models = list(genai.list_models())
    print(f"Found {len(models)} models.")
    for m in models:
        print(f" - {m.name} ({m.display_name}) [{m.supported_generation_methods}]")
except Exception as e:
    print(f"Error listing models: {e}")

print("Testing 2.5-flash directly:")
try:
    model = genai.GenerativeModel("gemini-2.5-flash")
    print("Model object created successfully.")
except Exception as e:
    print(f"Error creating 2.5-flash model: {e}")
