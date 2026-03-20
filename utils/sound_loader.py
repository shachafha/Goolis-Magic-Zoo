import os
import re
from collections import defaultdict

def group_animal_sounds():
    """
    Scans the /animal_sounds directory, groups .mp3 files by animal name
    (stripping digits).
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
