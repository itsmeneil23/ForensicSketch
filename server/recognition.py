import cv2
import dlib
import os
import numpy as np
import sys
import json
from skimage.feature import hog
from sklearn.metrics.pairwise import cosine_similarity

# -------- Paths --------
BASE = os.getcwd()

train_path = os.path.join(BASE, "client/public/project/module2_face_rec/train")
gallery_path = os.path.join(BASE, "client/public/project/module2_face_rec/gallery")

predictor_path = os.path.join(BASE, "server/shape_predictor_68_face_landmarks.dat")

# -------- Models --------
detector = dlib.get_frontal_face_detector()
predictor = dlib.shape_predictor(predictor_path)


# -------- Geometry helpers --------
def dist(p1, p2):
    return np.linalg.norm(np.array(p1) - np.array(p2))


def angle(p1, p2, p3):
    a = np.array(p1) - np.array(p2)
    b = np.array(p3) - np.array(p2)
    cosang = np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))
    return np.degrees(np.arccos(np.clip(cosang, -1, 1)))


def geometry_features(landmarks):
    le = np.mean([(landmarks.part(i).x, landmarks.part(i).y) for i in range(36, 42)], axis=0)
    re = np.mean([(landmarks.part(i).x, landmarks.part(i).y) for i in range(42, 48)], axis=0)
    nose = (landmarks.part(30).x, landmarks.part(30).y)
    mouth = (landmarks.part(62).x, landmarks.part(62).y)
    chin = (landmarks.part(8).x, landmarks.part(8).y)

    r1 = dist(le, re) / (dist(nose, mouth) + 1e-6)
    r2 = dist(nose, chin) / (dist(le, re) + 1e-6)
    a1 = angle(le, nose, re)
    a2 = angle(nose, mouth, chin)

    return np.array([r1, r2, a1, a2])


# -------- Feature extraction --------
def hog_feat(img):
    img = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    img = cv2.resize(img, (64, 64))
    return hog(img, orientations=9, pixels_per_cell=(8, 8),
               cells_per_block=(2, 2), block_norm='L2-Hys')


def extract_all(img):
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    faces = detector(gray)

    if len(faces) == 0:
        return None

    face = faces[0]
    lm = predictor(gray, face)

    def crop(ids):
        xs = [lm.part(i).x for i in ids]
        ys = [lm.part(i).y for i in ids]
        return img[min(ys):max(ys), min(xs):max(xs)]

    comps = [
        crop(range(36, 42)),
        crop(range(42, 48)),
        crop(range(27, 36)),
        crop(range(48, 68))
    ]

    geom = geometry_features(lm)

    return comps, geom


# -------- TRAINING PHASE --------
def learn_parameters():

    training_pairs = []

    for person in os.listdir(train_path):

        p_dir = os.path.join(train_path, person)

        sketch_path = os.path.join(p_dir, "sketch.png")

        if not os.path.exists(sketch_path):
            continue

        sketch = cv2.imread(sketch_path)

        s_res = extract_all(sketch)

        if s_res is None:
            continue

        s_comps, s_geom = s_res
        s_hog = [hog_feat(c) for c in s_comps]

        for file in os.listdir(p_dir):

            if "photo" not in file:
                continue

            img = cv2.imread(os.path.join(p_dir, file))

            r = extract_all(img)

            if r is None:
                continue

            g_comps, g_geom = r
            g_hog = [hog_feat(c) for c in g_comps]

            training_pairs.append((s_hog, s_geom, g_hog, g_geom, person))

    best_alpha = 0
    best_acc = 0

    for alpha in np.arange(0, 1.1, 0.1):

        beta = 1 - alpha

        correct = 0
        total = 0

        for sh, sg, gh, gg, label in training_pairs:

            app = np.mean([
                cosine_similarity([a], [b])[0][0]
                for a, b in zip(sh, gh)
            ])

            geom = 1 / (1 + np.linalg.norm(sg - gg))

            score = alpha * app + beta * geom

            if score > 0.5:
                correct += 1

            total += 1

        acc = correct / total if total > 0 else 0

        if acc > best_acc:
            best_acc = acc
            best_alpha = alpha

    geom_diffs = []

    for sh, sg, gh, gg, _ in training_pairs:
        geom_diffs.append(np.abs(sg - gg))

    geom_weights = 1 / (np.mean(geom_diffs, axis=0) + 1e-6)
    geom_weights /= np.sum(geom_weights)

    return best_alpha, geom_weights


# -------- IDENTIFICATION --------
def run_identification(test_path):

    best_alpha, geom_weights = learn_parameters()

    test_img = cv2.imread(test_path)

    s_res = extract_all(test_img)

    if s_res is None:
        return []

    s_comps, s_geom = s_res
    s_hog = [hog_feat(c) for c in s_comps]

    gallery = []

    for file in os.listdir(gallery_path):

        img = cv2.imread(os.path.join(gallery_path, file))

        r = extract_all(img)

        if r is None:
            continue

        comps, geom = r

        gallery.append((file, [hog_feat(c) for c in comps], geom))

    results = []

    for name, gh, gg in gallery:

        app = np.mean([
            cosine_similarity([a], [b])[0][0]
            for a, b in zip(s_hog, gh)
        ])

        geom_dist = np.sum(geom_weights * np.abs(s_geom - gg))

        geom = 1 / (1 + geom_dist)

        score = best_alpha * app + (1 - best_alpha) * geom

        results.append((name, score))

    results.sort(key=lambda x: x[1], reverse=True)

    top5 = []

    for name, score in results[:5]:

        top5.append({
            "name": os.path.splitext(name)[0],
            "imageUrl": "/project/module2_face_rec/gallery/" + name,
            "matchScore": round(score * 100, 2),
            "crime": "Cyber Espionage / Data Theft",
            "status": "WANTED",
            "age": 34,
            "id": "CR-" + str(abs(hash(name)) % 9999),
            "department": "Cyber Crimes Unit"
        })

    return top5


# -------- MAIN --------
if __name__ == "__main__":

    img_path = sys.argv[1]

    res = run_identification(img_path)

    print(json.dumps(res))