#!/usr/bin/env agent-python
"""Watch a layout settle in the running desktop, slowed down.

Usage: settle-probe.py OUT_DIR [--settle MS] [--for MS] [--frames N] COMMAND...

Sets the shell's settle time with `domicile send-shell settle-ms`, sends
COMMAND (such as `maximize`) with `domicile send-shell`, and screenshots the
desktop as fast as `domicile screenshot` allows for --for milliseconds. Then
puts the settle back to 220 ms.

Prints JSON on stdout: each frame's time and its change from the frame before
(mean absolute difference, 0-255, on a small grayscale copy), the span where
the picture changed, and the contact sheet: --frames frames picked evenly
across that span, labelled with their milliseconds. Needs DOMICILE_SOCK.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
from dataclasses import asdict, dataclass
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageStat

SMALL = (320, 180)
SHEET_WIDTH = 640
CHANGED = 0.5


@dataclass(frozen=True, slots=True)
class Frame:
    ms: int
    path: str
    change: float


def shell(*words: str) -> None:
    # The 2.2.0 SDK cannot answer a command, so send-shell reports a timeout
    # after the shell ran it; its exit status says nothing.
    subprocess.run(["domicile", "send-shell", *words], capture_output=True, check=False)


def record(out: Path, length_ms: int) -> list[tuple[int, Path]]:
    shots: list[tuple[int, Path]] = []
    start = time.monotonic()
    while (elapsed := round((time.monotonic() - start) * 1000)) < length_ms:
        path = out / f"{elapsed:05d}.png"
        subprocess.run(
            ["domicile", "screenshot", str(path)], capture_output=True, check=True
        )
        shots.append((elapsed, path))
    return shots


def changes(shots: list[tuple[int, Path]]) -> list[Frame]:
    frames: list[Frame] = []
    before: Image.Image | None = None
    for ms, path in shots:
        small = Image.open(path).convert("L").resize(SMALL)
        change = (
            0.0
            if before is None
            else ImageStat.Stat(ImageChops.difference(small, before)).mean[0]
        )
        frames.append(Frame(ms=ms, path=str(path), change=round(change, 2)))
        before = small
    return frames


def sheet(frames: list[Frame], out: Path, columns: int = 4) -> None:
    first = Image.open(frames[0].path)
    height = round(first.height * SHEET_WIDTH / first.width)
    rows = (len(frames) + columns - 1) // columns
    canvas = Image.new("RGB", (columns * SHEET_WIDTH, rows * height), "white")
    draw = ImageDraw.Draw(canvas)
    for index, frame in enumerate(frames):
        x, y = (index % columns) * SHEET_WIDTH, (index // columns) * height
        canvas.paste(
            Image.open(frame.path).convert("RGB").resize((SHEET_WIDTH, height)), (x, y)
        )
        draw.rectangle((x, y, x + 80, y + 18), fill="black")
        draw.text((x + 4, y + 3), f"{frame.ms} ms", fill="yellow")
    canvas.save(out)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("out", type=Path)
    parser.add_argument("--settle", type=int, default=3000)
    parser.add_argument("--for", dest="length", type=int, default=4500)
    parser.add_argument("--frames", type=int, default=12)
    parser.add_argument("command", nargs="+")
    args = parser.parse_args()

    args.out.mkdir(parents=True, exist_ok=True)
    shell("settle-ms", str(args.settle))
    try:
        subprocess.Popen(
            ["domicile", "send-shell", *args.command],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        frames = changes(record(args.out, args.length))
    finally:
        shell("settle-ms", "220")

    changed = [frame for frame in frames if frame.change > CHANGED]
    picked: list[Frame] = []
    if changed:
        span = [
            frame
            for frame in frames
            if changed[0].ms - 100 <= frame.ms <= changed[-1].ms + 100
        ]
        step = max(1, len(span) // args.frames)
        picked = span[::step][: args.frames]
        sheet(picked, args.out / "sheet.png")
    json.dump(
        {
            "frames": len(frames),
            "changed_from_ms": changed[0].ms if changed else None,
            "changed_to_ms": changed[-1].ms if changed else None,
            "sheet": str(args.out / "sheet.png") if picked else None,
            "picked": [asdict(frame) for frame in picked],
            "changes": [
                (frame.ms, frame.change) for frame in frames if frame.change > CHANGED
            ],
        },
        sys.stdout,
        indent=1,
    )
    print()


if __name__ == "__main__":
    main()
