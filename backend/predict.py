import os
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'

import sys
import json
import numpy as np
from PIL import Image, ImageOps
import tensorflow as tf

def crop_center_square(img):
    w, h = img.size
    side = min(w, h)
    left = (w - side) // 2
    top = (h - side) // 2
    return img.crop((left, top, left + side, top + side))

def prepare_view(square_img, zoom_ratio=1.0, flip=False):
    img = square_img
    if zoom_ratio < 1.0:
        side = img.size[0]
        new_side = int(side * zoom_ratio)
        offset = (side - new_side) // 2
        img = img.crop((offset, offset, offset + new_side, offset + new_side))
    if flip:
        img = ImageOps.mirror(img)
    img = img.resize((224, 224), Image.LANCZOS)
    arr = np.array(img, dtype=np.float32)
    return np.expand_dims(arr, axis=0)

def run_prediction(image_path, model_path, labels_path):
    with open(labels_path, 'r') as f:
        labels = [line.strip() for line in f if line.strip()]

    interpreter = tf.lite.Interpreter(model_path=model_path)
    interpreter.allocate_tensors()

    input_details = interpreter.get_input_details()
    output_details = interpreter.get_output_details()

    raw_img = Image.open(image_path)
    raw_img = ImageOps.exif_transpose(raw_img).convert('RGB')
    square_img = crop_center_square(raw_img)

    # 3 sudut pandang persegi simetris (100% view, 85% zoom, dan flip horizontal)
    views = [
        prepare_view(square_img, zoom_ratio=1.0, flip=False),
        prepare_view(square_img, zoom_ratio=0.85, flip=False),
        prepare_view(square_img, zoom_ratio=0.85, flip=True),
    ]
    weights = [0.45, 0.35, 0.20]

    probs = np.zeros(len(labels), dtype=np.float32)
    for view, w in zip(views, weights):
        interpreter.set_tensor(input_details[0]['index'], view)
        interpreter.invoke()
        probs += w * interpreter.get_tensor(output_details[0]['index'])[0]

    max_idx = int(np.argmax(probs))
    confidence = int(round(float(probs[max_idx]) * 100))
    slug = labels[max_idx] if max_idx < len(labels) else 'bukan_herbal'
    is_herbal = (slug != 'bukan_herbal') and (confidence >= 70)

    top_indices = np.argsort(probs)[::-1][:3]
    top_3 = [
        {
            "slug": labels[int(i)] if int(i) < len(labels) else "unknown",
            "confidence": int(round(float(probs[int(i)]) * 100))
        }
        for i in top_indices
    ]

    return {
        "slug": slug,
        "confidence": confidence,
        "is_herbal": is_herbal,
        "top_3": top_3
    }

if __name__ == "__main__":
    if len(sys.argv) < 4:
        print(json.dumps({"error": "Invalid arguments"}))
        sys.exit(1)

    result = run_prediction(sys.argv[1], sys.argv[2], sys.argv[3])
    print(json.dumps(result))
