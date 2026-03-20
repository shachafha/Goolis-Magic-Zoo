import os
import google.generativeai as genai
from dotenv import load_dotenv
print("Start")
load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")
print(f"Key present: {bool(api_key)}")
genai.configure(api_key=api_key)
print("Configured")
try:
    models = genai.list_models()
    print("List models call initiated")
    for m in models:
        print(f"Model: {m.name}")
except Exception as e:
    print(f"Error: {e}")
print("End")
