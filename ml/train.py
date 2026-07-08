"""Download a Roboflow PCB-defect dataset and train a YOLOv8n baseline on CPU.

Usage:
  python ml/train.py --download-only
      # fetches the dataset and prints its real class list, no training

  python ml/train.py --epochs 1 --max-images 150 --imgsz 416
      # timing smoke run: measure actual per-epoch CPU time before committing
      # to a longer run

  python ml/train.py --epochs 12 --imgsz 512 --batch 16
      # real baseline run over the full dataset, weights copied to
      # backend/app/services/weights/pcb_defect_yolo.pt

Requires a free Roboflow API key: app.roboflow.com -> Settings -> API Keys.
Pass it via --api-key or the ROBOFLOW_API_KEY env var.
"""

import argparse
import os
import shutil
import sys
from pathlib import Path

import yaml

ML_DIR = Path(__file__).resolve().parent
DEFAULT_OUT = ML_DIR.parent / "backend" / "app" / "services" / "weights" / "pcb_defect_yolo.pt"


def download_dataset(api_key: str, workspace: str, project: str, version: int, dest: Path) -> Path:
    from roboflow import Roboflow

    rf = Roboflow(api_key=api_key)
    ds = rf.workspace(workspace).project(project).version(version).download("yolov8", location=str(dest))
    return Path(ds.location)


# Roboflow's YOLOv8 export names the validation key "val" in data.yaml but
# the on-disk folder "valid" — and its relative paths (e.g. "../train/images")
# assume a nesting level this download doesn't actually have. Resolve splits
# against the real directory layout instead of trusting the yaml's paths.
_SPLIT_DIR_CANDIDATES = {"train": ["train"], "val": ["valid", "val"], "test": ["test"]}


def _resolve_splits(data_dir: Path, cfg: dict) -> dict:
    resolved = {}
    for split, candidates in _SPLIT_DIR_CANDIDATES.items():
        if split not in cfg:
            continue
        for folder in candidates:
            if (data_dir / folder / "images").is_dir():
                resolved[split] = folder
                break
    return resolved


def normalize_data_yaml(data_dir: Path) -> dict:
    """Rewrites data.yaml's split paths to match the real on-disk layout and
    pins an explicit `path`, so ultralytics doesn't have to guess."""
    yaml_path = data_dir / "data.yaml"
    with open(yaml_path) as f:
        cfg = yaml.safe_load(f)

    for split, folder in _resolve_splits(data_dir, cfg).items():
        cfg[split] = f"{folder}/images"
    cfg["path"] = str(data_dir)

    with open(yaml_path, "w") as f:
        yaml.safe_dump(cfg, f)
    return cfg


def make_subset(data_dir: Path, cfg: dict, max_images: int) -> Path:
    """Copies a capped number of images/labels per split into a sibling
    `-subsetN` dir with its own data.yaml, leaving the full download untouched
    so a later full run doesn't need to re-download anything."""
    subset_dir = data_dir.parent / f"{data_dir.name}-subset{max_images}"
    if subset_dir.exists():
        return subset_dir

    subset_cfg = dict(cfg)
    for split, folder in _resolve_splits(data_dir, cfg).items():
        src_images = data_dir / folder / "images"
        src_labels = data_dir / folder / "labels"
        dst_images = subset_dir / folder / "images"
        dst_labels = subset_dir / folder / "labels"
        dst_images.mkdir(parents=True, exist_ok=True)
        dst_labels.mkdir(parents=True, exist_ok=True)

        cap = max_images if split == "train" else max(1, max_images // 5)
        for img_path in sorted(src_images.glob("*"))[:cap]:
            shutil.copy2(img_path, dst_images / img_path.name)
            label_path = src_labels / f"{img_path.stem}.txt"
            if label_path.exists():
                shutil.copy2(label_path, dst_labels / label_path.name)
        subset_cfg[split] = f"{folder}/images"

    subset_cfg["path"] = str(subset_dir)
    with open(subset_dir / "data.yaml", "w") as f:
        yaml.safe_dump(subset_cfg, f)

    return subset_dir


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--api-key", default=os.environ.get("ROBOFLOW_API_KEY"))
    parser.add_argument("--workspace", default="thesis-laxy4")
    parser.add_argument("--project", default="yolov8-pcb-defects")
    parser.add_argument("--version", type=int, default=2)
    parser.add_argument("--download-only", action="store_true")
    parser.add_argument("--epochs", type=int, default=15)
    parser.add_argument("--imgsz", type=int, default=512)
    parser.add_argument("--batch", type=int, default=16)
    parser.add_argument("--max-images", type=int, default=None, help="cap train images for a bounded smoke run")
    parser.add_argument("--device", default="cpu")
    parser.add_argument("--out", default=str(DEFAULT_OUT))
    args = parser.parse_args()

    if not args.api_key:
        sys.exit(
            "ROBOFLOW_API_KEY not set. Get a free key at app.roboflow.com -> "
            "Settings -> API Keys, then pass --api-key or set the env var."
        )

    dest = ML_DIR / "datasets" / args.project
    print(f"Downloading {args.workspace}/{args.project} v{args.version} -> {dest} ...")
    data_dir = download_dataset(args.api_key, args.workspace, args.project, args.version, dest)

    cfg = normalize_data_yaml(data_dir)
    print("Classes in dataset:", cfg.get("names"))

    if args.download_only:
        return

    train_dir = make_subset(data_dir, cfg, args.max_images) if args.max_images else data_dir

    from ultralytics import YOLO

    model = YOLO("yolov8n.pt")
    results = model.train(
        data=str(train_dir / "data.yaml"),
        epochs=args.epochs,
        imgsz=args.imgsz,
        batch=args.batch,
        device=args.device,
        project=str(ML_DIR / "runs"),
        name="pcb-defect",
        exist_ok=True,
    )

    best = Path(results.save_dir) / "weights" / "best.pt"
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(best, out_path)
    print(f"Saved trained weights -> {out_path} ({out_path.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
