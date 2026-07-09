"""Image registration.

Aligns the golden reference image into the *captured* image's coordinate
frame, purely so the golden's own baseline defect boxes (see
`_suppress_golden_artifacts` in `ai_inference.py`) can be compared apples-
to-apples against what was just detected. It never warps the captured
image or the detections run on it — feeding YOLO an artificially warped
image (complete with black border artifacts from the perspective warp)
would be a distribution the model has never seen and was never trained
on. Only the golden's already-known boxes need to move into the other
image's frame, so that's the only thing that gets transformed.

ORB is used over SIFT for its far lower CPU/memory cost, which matters on
the same fractional-vCPU host this whole inference path already has to
respect (see ai_inference.py's thread-count caps).
"""

from dataclasses import dataclass

import cv2
import numpy as np

_MIN_GOOD_MATCHES = 15
_RATIO_TEST_THRESHOLD = 0.75
_RANSAC_REPROJ_THRESHOLD = 5.0


@dataclass
class RegistrationResult:
    status: str  # "registered" | "insufficient_features"
    homography: np.ndarray | None = None  # maps golden image coords -> captured image coords


def register_images(golden_img: np.ndarray, captured_img: np.ndarray) -> RegistrationResult:
    orb = cv2.ORB_create(nfeatures=1000)
    kp1, des1 = orb.detectAndCompute(golden_img, None)
    kp2, des2 = orb.detectAndCompute(captured_img, None)

    if des1 is None or des2 is None or len(kp1) < _MIN_GOOD_MATCHES or len(kp2) < _MIN_GOOD_MATCHES:
        return RegistrationResult(status="insufficient_features")

    bf = cv2.BFMatcher(cv2.NORM_HAMMING)
    raw_matches = bf.knnMatch(des1, des2, k=2)

    good = []
    for pair in raw_matches:
        if len(pair) != 2:
            continue
        m, n = pair
        if m.distance < _RATIO_TEST_THRESHOLD * n.distance:
            good.append(m)

    if len(good) < _MIN_GOOD_MATCHES:
        return RegistrationResult(status="insufficient_features")

    src_pts = np.float32([kp1[m.queryIdx].pt for m in good]).reshape(-1, 1, 2)
    dst_pts = np.float32([kp2[m.trainIdx].pt for m in good]).reshape(-1, 1, 2)

    homography, _mask = cv2.findHomography(src_pts, dst_pts, cv2.RANSAC, _RANSAC_REPROJ_THRESHOLD)
    if homography is None:
        return RegistrationResult(status="insufficient_features")

    return RegistrationResult(status="registered", homography=homography)


def transform_bbox_normalized(bbox: dict, homography: np.ndarray, img_size: int) -> dict:
    """Transforms a normalized (0-1) bbox through the homography, returning
    the axis-aligned enclosing rect of the transformed corners — a
    homography can rotate/skew, so the transformed quadrilateral isn't
    itself axis-aligned in general."""
    x, y = bbox["x"] * img_size, bbox["y"] * img_size
    w, h = bbox["width"] * img_size, bbox["height"] * img_size
    corners = np.float32([[x, y], [x + w, y], [x + w, y + h], [x, y + h]]).reshape(-1, 1, 2)
    transformed = cv2.perspectiveTransform(corners, homography).reshape(-1, 2)
    x1, y1 = transformed.min(axis=0)
    x2, y2 = transformed.max(axis=0)
    return {
        "x": max(x1, 0) / img_size,
        "y": max(y1, 0) / img_size,
        "width": min(x2 - x1, img_size) / img_size,
        "height": min(y2 - y1, img_size) / img_size,
    }


def bbox_iou(a: dict, b: dict) -> float:
    """IoU between two normalized (0-1) bboxes."""
    ax1, ay1, ax2, ay2 = a["x"], a["y"], a["x"] + a["width"], a["y"] + a["height"]
    bx1, by1, bx2, by2 = b["x"], b["y"], b["x"] + b["width"], b["y"] + b["height"]

    ix1, iy1 = max(ax1, bx1), max(ay1, by1)
    ix2, iy2 = min(ax2, bx2), min(ay2, by2)
    if ix2 <= ix1 or iy2 <= iy1:
        return 0.0

    inter = (ix2 - ix1) * (iy2 - iy1)
    area_a = a["width"] * a["height"]
    area_b = b["width"] * b["height"]
    union = area_a + area_b - inter
    return inter / union if union > 0 else 0.0
