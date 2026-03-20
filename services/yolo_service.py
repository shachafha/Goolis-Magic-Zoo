from ultralytics import YOLO
from utils.logger import logger

class YOLOService:
    def __init__(self, model_path="yolov8n.pt"):
        try:
            self.model = YOLO(model_path)
            logger.info("YOLO model loaded successfully!")
        except Exception as e:
            logger.error(f"Could not load YOLO model: {e}")
            self.model = None

    def is_ready(self):
        return self.model is not None

    def detect_animal(self, image, known_animals):
        if not self.model:
            return None, 0

        # Mapping of COCO classes to our Zoo animals
        # COCO has: bird, cat, dog, horse, sheep, cow, elephant, bear, zebra, giraffe, teddy bear
        # NOTE: YOLO detects almost ALL plush toys as "teddy bear" regardless of species.
        # So teddy bear is mapped to None (skip) — it's not useful for identification.
        COCO_MAPPING = {
            "cat": "cat",
            "dog": "dog",
            "horse": "horse",
            "sheep": "sheep",
            "cow": "cow",
            "elephant": "elephant",
            "bear": "bear",
            "zebra": "zebra",
            "giraffe": "giraffe",
            "bird": "duck",        # Map bird to duck (closest match)
            "teddy bear": None,    # Too generic — YOLO calls all plush toys this
        }

        try:
            results = self.model(image, verbose=False)
            highest_conf = 0
            best_guess = None

            all_detections = []

            for result in results:
                for box in result.boxes:
                    cls_id = int(box.cls[0])
                    label = self.model.names[cls_id].lower()
                    conf = float(box.conf[0])
                    
                    all_detections.append(f"{label}({conf:.2f})")

                    # check if the label itself is a zoo animal
                    if label in known_animals and conf > highest_conf:
                        highest_conf = conf
                        best_guess = label
                        continue

                    # otherwise, check if it maps to a zoo animal
                    mapped_name = COCO_MAPPING.get(label)
                    if mapped_name and mapped_name in known_animals and conf > highest_conf:
                        highest_conf = conf
                        best_guess = mapped_name
            
            logger.info(f"YOLO all detections: {all_detections if all_detections else 'NONE'}")
            if best_guess:
                logger.info(f"YOLO picked best match: {best_guess} ({highest_conf:.2f})")
            
            return best_guess, highest_conf
        except Exception as e:
            logger.error(f"YOLO inference failed: {e}")
            return None, 0


# Global instance
yolo_service = YOLOService()
