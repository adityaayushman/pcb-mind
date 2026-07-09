"""Merges three public PCB-defect datasets into one combined YOLO-format
training set.

Sources (already downloaded into ml/datasets/raw/, gitignored):
  - Roboflow (current): ml/datasets/yolov8-pcb-defects/ -- already YOLO
    format, copied through unchanged since this defines the canonical class
    order everything else gets mapped onto.
  - Kaggle akhatova/pcb-defects (PKU-Market-PCB): Pascal VOC XML
    annotations, one <object><name> per defect, already using canonical
    class names directly.
  - DeepPCB (tangsanli5201/DeepPCB): custom `x1 y1 x2 y2 type` txt
    annotations (space-separated despite the repo's README claiming
    commas -- confirmed against the actual files), type 1-6. Only the
    "_test" (defective) image of each template/test pair has annotations;
    the paired "_temp" (clean) image is used separately for demo golden
    PCBs, not for training.

Usage:
  python ml/build_combined_dataset.py
"""

import random
import re
import shutil
import xml.etree.ElementTree as ET
from pathlib import Path

from PIL import Image

ML_DIR = Path(__file__).resolve().parent
RAW_DIR = ML_DIR / "datasets" / "raw"
ROBOFLOW_DIR = ML_DIR / "datasets" / "yolov8-pcb-defects"
KAGGLE_DIR = RAW_DIR / "kaggle-pcb-defects" / "PCB_DATASET"
DEEPPCB_DIR = RAW_DIR / "deeppcb" / "PCBData"
OUT_DIR = ML_DIR / "datasets" / "combined-pcb-defects"

# Fixed canonical order = the current Roboflow dataset's own data.yaml order,
# so its images/labels can be copied through with zero remapping.
CANONICAL_CLASSES = ["copper", "mousebite", "open", "pin-hole", "short", "spur"]

KAGGLE_NAME_TO_CANONICAL = {
    "spurious_copper": "copper",
    "mouse_bite": "mousebite",
    "open_circuit": "open",
    "missing_hole": "pin-hole",
    "short": "short",
    "spur": "spur",
}

# DeepPCB README: 1-open, 2-short, 3-mousebite, 4-spur, 5-copper, 6-pin-hole
DEEPPCB_TYPE_TO_CANONICAL = {
    1: "open",
    2: "short",
    3: "mousebite",
    4: "spur",
    5: "copper",
    6: "pin-hole",
}

random.seed(42)


def _write_yolo_label(label_path: Path, boxes: list[tuple[int, float, float, float, float]]) -> None:
    label_path.parent.mkdir(parents=True, exist_ok=True)
    with open(label_path, "w") as f:
        for cls_idx, cx, cy, w, h in boxes:
            f.write(f"{cls_idx} {cx:.6f} {cy:.6f} {w:.6f} {h:.6f}\n")


def _split_assign(n: int) -> list[str]:
    """Deterministic 70/20/10 train/valid/test assignment."""
    splits = ["train"] * int(n * 0.7) + ["valid"] * int(n * 0.2)
    splits += ["test"] * (n - len(splits))
    random.shuffle(splits)
    return splits


_DEEPPCB_ID_RE = re.compile(r"^(\d+)_test")


def copy_roboflow() -> tuple[int, set[str]]:
    """Copies the current Roboflow export through unchanged, and returns the
    set of DeepPCB source-image IDs it contains (Roboflow filenames keep the
    original DeepPCB numeric prefix, e.g. "00041000_test_jpg.rf.<hash>.jpg"),
    so convert_deeppcb() can skip re-adding the same underlying images under
    a different filename -- confirmed by direct visual inspection that e.g.
    Roboflow's 00041000 and DeepPCB's 00041000 are pixel-identical. Without
    this, ~1000 of DeepPCB's 1500 images would silently duplicate images
    already in the Roboflow split, risking the same image landing in both
    a train and a test split across the two sources (leakage that inflates
    validation metrics without adding real diversity)."""
    count = 0
    seen_ids: set[str] = set()
    for split in ("train", "valid", "test"):
        src_images = ROBOFLOW_DIR / split / "images"
        src_labels = ROBOFLOW_DIR / split / "labels"
        if not src_images.is_dir():
            continue
        dst_images = OUT_DIR / split / "images"
        dst_labels = OUT_DIR / split / "labels"
        dst_images.mkdir(parents=True, exist_ok=True)
        dst_labels.mkdir(parents=True, exist_ok=True)
        for img_path in src_images.glob("*"):
            shutil.copy2(img_path, dst_images / f"rf_{img_path.name}")
            label_path = src_labels / f"{img_path.stem}.txt"
            if label_path.exists():
                shutil.copy2(label_path, dst_labels / f"rf_{img_path.stem}.txt")
            count += 1
            m = _DEEPPCB_ID_RE.match(img_path.name)
            if m:
                seen_ids.add(m.group(1))
    return count, seen_ids


def convert_kaggle() -> int:
    xml_paths = sorted(KAGGLE_DIR.glob("Annotations/*/*.xml"))
    splits = _split_assign(len(xml_paths))
    count = 0
    for xml_path, split in zip(xml_paths, splits):
        cls_folder = xml_path.parent.name  # e.g. "Missing_hole"
        img_path = KAGGLE_DIR / "images" / cls_folder / f"{xml_path.stem}.jpg"
        if not img_path.exists():
            continue

        tree = ET.parse(xml_path)
        root = tree.getroot()
        size = root.find("size")
        img_w = float(size.find("width").text)
        img_h = float(size.find("height").text)

        boxes = []
        for obj in root.findall("object"):
            raw_name = obj.find("name").text.strip().lower()
            canonical = KAGGLE_NAME_TO_CANONICAL.get(raw_name)
            if canonical is None:
                continue
            cls_idx = CANONICAL_CLASSES.index(canonical)
            bnd = obj.find("bndbox")
            xmin, ymin = float(bnd.find("xmin").text), float(bnd.find("ymin").text)
            xmax, ymax = float(bnd.find("xmax").text), float(bnd.find("ymax").text)
            cx, cy = (xmin + xmax) / 2 / img_w, (ymin + ymax) / 2 / img_h
            w, h = (xmax - xmin) / img_w, (ymax - ymin) / img_h
            boxes.append((cls_idx, cx, cy, w, h))
        if not boxes:
            continue

        dst_images = OUT_DIR / split / "images"
        dst_labels = OUT_DIR / split / "labels"
        dst_images.mkdir(parents=True, exist_ok=True)
        name = f"kaggle_{xml_path.stem}"
        shutil.copy2(img_path, dst_images / f"{name}.jpg")
        _write_yolo_label(dst_labels / f"{name}.txt", boxes)
        count += 1
    return count


def convert_deeppcb(roboflow_ids: set[str]) -> int:
    test_images = sorted(DEEPPCB_DIR.glob("group*/*/*_test.jpg"))
    splits = _split_assign(len(test_images))
    count = 0
    skipped_dupes = 0
    for img_path, split in zip(test_images, splits):
        m = _DEEPPCB_ID_RE.match(img_path.name)
        if m and m.group(1) in roboflow_ids:
            skipped_dupes += 1
            continue

        group_dir = img_path.parent.parent  # group00041
        subdir_name = img_path.parent.name  # 00041
        label_path = group_dir / f"{subdir_name}_not" / f"{img_path.stem.replace('_test', '')}.txt"
        if not label_path.exists():
            continue

        with Image.open(img_path) as im:
            img_w, img_h = im.size

        boxes = []
        for line in label_path.read_text().splitlines():
            line = line.strip()
            if not line:
                continue
            x1, y1, x2, y2, type_id = line.split()
            canonical = DEEPPCB_TYPE_TO_CANONICAL.get(int(type_id))
            if canonical is None:
                continue
            cls_idx = CANONICAL_CLASSES.index(canonical)
            x1, y1, x2, y2 = float(x1), float(y1), float(x2), float(y2)
            cx, cy = (x1 + x2) / 2 / img_w, (y1 + y2) / 2 / img_h
            w, h = (x2 - x1) / img_w, (y2 - y1) / img_h
            boxes.append((cls_idx, cx, cy, w, h))
        if not boxes:
            continue

        dst_images = OUT_DIR / split / "images"
        dst_labels = OUT_DIR / split / "labels"
        dst_images.mkdir(parents=True, exist_ok=True)
        name = f"deeppcb_{subdir_name}_{img_path.stem}"
        shutil.copy2(img_path, dst_images / f"{name}.jpg")
        _write_yolo_label(dst_labels / f"{name}.txt", boxes)
        count += 1
    print(f"DeepPCB: skipped {skipped_dupes} images already present in the Roboflow export")
    return count


def write_data_yaml() -> None:
    lines = [
        f"path: {OUT_DIR}",
        "train: train/images",
        "val: valid/images",
        "test: test/images",
        "nc: 6",
        f"names: {CANONICAL_CLASSES}",
    ]
    (OUT_DIR / "data.yaml").write_text("\n".join(lines) + "\n")


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    rf_count, roboflow_ids = copy_roboflow()
    print(f"Roboflow: {rf_count} images copied")
    kaggle_count = convert_kaggle()
    print(f"Kaggle: {kaggle_count} images converted")
    deeppcb_count = convert_deeppcb(roboflow_ids)
    print(f"DeepPCB: {deeppcb_count} images converted")
    write_data_yaml()

    for split in ("train", "valid", "test"):
        n = len(list((OUT_DIR / split / "images").glob("*")))
        print(f"{split}: {n} images")
    print(f"Total: {rf_count + kaggle_count + deeppcb_count} images -> {OUT_DIR}")


if __name__ == "__main__":
    main()
