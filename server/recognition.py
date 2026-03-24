import cv2
import dlib
import os
import numpy as np
import sys
import json
from skimage.feature import hog
from sklearn.metrics.pairwise import cosine_similarity

# -------- Paths --------
BASE = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

train_path = os.path.join(BASE, "client/public/project/module2_face_rec/train")
gallery_path = os.path.join(BASE, "client/public/project/module2_face_rec/gallery")

predictor_path = os.path.join(BASE, "server/shape_predictor_68_face_landmarks.dat")
DEFAULT_ALPHA = 0.5
DEFAULT_GEOM_WEIGHTS = np.array([0.25, 0.25, 0.25, 0.25])
TRAIN_BOOST_FACTOR = 0.15

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
    if img is None or img.size == 0:
        return None

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


def combined_similarity(s_hog, s_geom, g_hog, g_geom, alpha, geom_weights):
    app = np.mean([
        cosine_similarity([a], [b])[0][0]
        for a, b in zip(s_hog, g_hog)
    ])

    geom_dist = np.sum(geom_weights * np.abs(s_geom - g_geom))
    geom = 1 / (1 + geom_dist)

    return alpha * app + (1 - alpha) * geom


def build_gallery_features():
    gallery = []

    if not os.path.isdir(gallery_path):
        return gallery

    for file in os.listdir(gallery_path):
        img = cv2.imread(os.path.join(gallery_path, file))
        r = extract_all(img)

        if r is None:
            continue

        comps, geom = r
        gallery.append((file, [hog_feat(c) for c in comps], geom))

    return gallery


def build_train_identity_mapping(gallery, alpha, geom_weights):
    identity_refs = []

    if not os.path.isdir(train_path):
        return identity_refs

    for person in os.listdir(train_path):
        p_dir = os.path.join(train_path, person)
        sketch_img = cv2.imread(os.path.join(p_dir, "sketch.png"))
        sketch_res = extract_all(sketch_img)

        if sketch_res is None:
            continue

        s_comps, s_geom = sketch_res
        s_hog = [hog_feat(c) for c in s_comps]

        photo_feats = []
        for file in os.listdir(p_dir):
            if "photo" not in file:
                continue

            img = cv2.imread(os.path.join(p_dir, file))
            photo_res = extract_all(img)

            if photo_res is None:
                continue

            p_comps, p_geom = photo_res
            photo_feats.append(([hog_feat(c) for c in p_comps], p_geom))

        if len(photo_feats) == 0:
            continue

        best_gallery_name = None
        best_gallery_score = -1

        for g_name, g_hog, g_geom in gallery:
            local_best = max(
                combined_similarity(ph, pg, g_hog, g_geom, alpha, geom_weights)
                for ph, pg in photo_feats
            )

            if local_best > best_gallery_score:
                best_gallery_score = local_best
                best_gallery_name = g_name

        if best_gallery_name is not None:
            identity_refs.append((person, s_hog, s_geom, best_gallery_name))

    return identity_refs


# -------- TRAINING PHASE --------
def learn_parameters():

    if not os.path.isdir(train_path):
        return DEFAULT_ALPHA, DEFAULT_GEOM_WEIGHTS

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

    if len(training_pairs) == 0:
        return DEFAULT_ALPHA, DEFAULT_GEOM_WEIGHTS

    best_alpha = DEFAULT_ALPHA
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

    if len(geom_diffs) == 0:
        return best_alpha, DEFAULT_GEOM_WEIGHTS

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

    gallery = build_gallery_features()

    if len(gallery) == 0:
        return []

    train_identity_refs = build_train_identity_mapping(gallery, best_alpha, geom_weights)

    nearest_identity = None
    nearest_identity_sim = 0

    for person, t_hog, t_geom, mapped_gallery in train_identity_refs:
        sim = combined_similarity(s_hog, s_geom, t_hog, t_geom, 0.7, geom_weights)
        if sim > nearest_identity_sim:
            nearest_identity_sim = sim
            nearest_identity = (person, mapped_gallery)

    results = []

    for name, gh, gg in gallery:

        score = combined_similarity(s_hog, s_geom, gh, gg, best_alpha, geom_weights)

        if nearest_identity is not None and nearest_identity[1] == name:
            score += TRAIN_BOOST_FACTOR * nearest_identity_sim

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