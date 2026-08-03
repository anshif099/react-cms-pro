import argparse
import glob
from pathlib import Path

from .tokenizer import RocketTokenizer


def input_texts(patterns):
    for pattern in patterns:
        matches = glob.glob(pattern, recursive=True)
        for raw_path in matches or [pattern]:
            path = Path(raw_path)
            if not path.is_file():
                continue
            try:
                yield path.read_text(encoding="utf-8")
            except UnicodeDecodeError:
                continue


def main():
    parser = argparse.ArgumentParser(description="Train Rocket AI's tokenizer from private data")
    parser.add_argument("--inputs", nargs="+", required=True)
    parser.add_argument("--output", default="rocket_ai/checkpoints/tokenizer.json")
    parser.add_argument("--vocab-size", type=int, default=8192)
    parser.add_argument("--max-characters", type=int, default=25_000_000)
    args = parser.parse_args()
    tokenizer = RocketTokenizer.train(
        input_texts(args.inputs),
        vocab_size=args.vocab_size,
        max_characters=args.max_characters,
    )
    tokenizer.save(args.output)
    print(f"Saved {tokenizer.vocab_size:,}-token Rocket vocabulary to {args.output}")


if __name__ == "__main__":
    main()
