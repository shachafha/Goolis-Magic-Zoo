import torch
from PIL import Image
from io import BytesIO
from transformers import CLIPProcessor, CLIPModel
from utils.logger import logger


class CLIPService:
    def __init__(self, model_name="openai/clip-vit-base-patch32"):
        try:
            logger.info(f"Loading CLIP model: {model_name}...")
            self.model = CLIPModel.from_pretrained(model_name)
            self.processor = CLIPProcessor.from_pretrained(model_name)
            self.model.eval()
            logger.info("CLIP model loaded successfully!")
        except Exception as e:
            logger.error(f"Could not load CLIP model: {e}")
            self.model = None
            self.processor = None

    def is_ready(self):
        return self.model is not None and self.processor is not None

    def detect_animal(self, image_bytes_or_cv2, known_animals):
        """
        Zero-shot classify an image against known animal names.
        Returns (best_animal, confidence) or (None, 0).
        
        image_bytes_or_cv2: either raw bytes or a cv2 (numpy) image
        known_animals: list of animal name strings, e.g. ["cow", "dog", "lion"]
        """
        if not self.is_ready():
            return None, 0

        try:
            # Convert input to PIL Image
            import numpy as np
            if isinstance(image_bytes_or_cv2, np.ndarray):
                # cv2 BGR → RGB → PIL
                import cv2
                rgb = cv2.cvtColor(image_bytes_or_cv2, cv2.COLOR_BGR2RGB)
                pil_image = Image.fromarray(rgb)
            elif isinstance(image_bytes_or_cv2, bytes):
                pil_image = Image.open(BytesIO(image_bytes_or_cv2)).convert("RGB")
            else:
                logger.error("CLIP: Unknown image format")
                return None, 0

            # Build text prompts — specialized for plush/toy animals
            text_labels = [f"a plush toy {animal}" for animal in known_animals]
            text_labels.append("something that is not an animal")  # negative class

            # Process inputs
            inputs = self.processor(
                text=text_labels,
                images=pil_image,
                return_tensors="pt",
                padding=True
            )

            # Run inference
            with torch.no_grad():
                outputs = self.model(**inputs)
                logits = outputs.logits_per_image[0]  # shape: [num_labels]
                probs = logits.softmax(dim=0)

            # Log all scores
            scores = {}
            for i, animal in enumerate(known_animals):
                scores[animal] = float(probs[i])
            not_animal_score = float(probs[-1])

            # Sort by confidence for logging
            sorted_scores = sorted(scores.items(), key=lambda x: x[1], reverse=True)
            top5 = sorted_scores[:5]
            logger.info(f"CLIP top 5: {[(a, f'{s:.3f}') for a, s in top5]}, not-animal: {not_animal_score:.3f}")

            # Pick best
            best_animal, best_conf = sorted_scores[0]

            # Only return if clearly an animal (beats the "not animal" class)
            if best_conf > not_animal_score and best_conf > 0.05:
                return best_animal, best_conf
            else:
                logger.info("CLIP: 'not an animal' class won or confidence too low")
                return None, 0

        except Exception as e:
            logger.error(f"CLIP inference failed: {e}", exc_info=True)
            return None, 0


# Global instance
clip_service = CLIPService()
