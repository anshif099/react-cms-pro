import argparse
import glob
from pathlib import Path

import numpy as np

from .tokenizer import RocketTokenizer


def main():
    parser = argparse.ArgumentParser(description="Tokenize a private corpus for Rocket AI pretraining")
    parser.add_argument("--tokenizer", required=True)
    parser.add_argument("--inputs", nargs="+", required=True, help="Files or glob patterns")
    parser.add_argument("--output", default="rocket_ai/data/pretrain.bin")
    args = parser.parse_args()
    tokenizer = RocketTokenizer.load(args.tokenizer)
    paths = []
    for pattern in args.inputs:
        matches = glob.glob(pattern, recursive=True)
        paths.extend(matches or [pattern])
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    token_count = 0
    with output.open("wb") as handle:
        for raw_path in sorted(set(paths)):
            path = Path(raw_path)
            if not path.is_file():
                continue
            try:
                text = path.read_text(encoding="utf-8")
            except UnicodeDecodeError:
                continue
            ids = tokenizer.encode(text, bos=True, eos=True)
            np.asarray(ids, dtype=np.uint32).tofile(handle)
            token_count += len(ids)
    print(f"Prepared {token_count:,} original Rocket AI corpus tokens at {output}")


if __name__ == "__main__":
    main()

