import argparse
import json
from pathlib import Path

import numpy as np
import torch
from PIL import Image
from torch.utils.data import DataLoader, Dataset

from .image_model import RocketDiffusion, RocketImageConfig
from .tokenizer import RocketTokenizer


class CaptionedImageDataset(Dataset):
    def __init__(self, manifest, tokenizer, image_size, max_text_tokens=256):
        self.root = Path(manifest).parent
        self.examples = [
            json.loads(line) for line in Path(manifest).read_text(encoding="utf-8").splitlines()
            if line.strip()
        ]
        self.tokenizer = tokenizer
        self.image_size = image_size
        self.max_text_tokens = max_text_tokens

    def __len__(self):
        return len(self.examples)

    def __getitem__(self, index):
        example = self.examples[index]
        image_path = Path(example["image"])
        if not image_path.is_absolute():
            image_path = self.root / image_path
        image = Image.open(image_path).convert("RGB").resize(
            (self.image_size, self.image_size),
            Image.Resampling.LANCZOS,
        )
        pixels = torch.from_numpy(np.asarray(image).copy()).permute(2, 0, 1).float()
        pixels = pixels / 127.5 - 1.0
        text = self.tokenizer.encode(example["caption"], bos=True, eos=True)
        text = text[:self.max_text_tokens]
        return pixels, torch.tensor(text, dtype=torch.long)


def collate(batch, pad_id):
    images = torch.stack([item[0] for item in batch])
    width = max(item[1].numel() for item in batch)
    text = torch.full((len(batch), width), pad_id, dtype=torch.long)
    for index, (_, tokens) in enumerate(batch):
        text[index, :tokens.numel()] = tokens
    return images, text


def main():
    parser = argparse.ArgumentParser(description="Train Rocket Image from random initialization")
    parser.add_argument("--manifest", required=True, help="JSONL with image and caption fields")
    parser.add_argument("--tokenizer", required=True)
    parser.add_argument("--output", default="rocket_ai/checkpoints/rocket-image.pt")
    parser.add_argument("--image-size", type=int, default=128)
    parser.add_argument("--batch-size", type=int, default=8)
    parser.add_argument("--epochs", type=int, default=20)
    parser.add_argument("--learning-rate", type=float, default=2e-4)
    args = parser.parse_args()
    tokenizer = RocketTokenizer.load(args.tokenizer)
    config = RocketImageConfig(tokenizer.vocab_size, image_size=args.image_size)
    dataset = CaptionedImageDataset(args.manifest, tokenizer, args.image_size)
    loader = DataLoader(
        dataset,
        batch_size=args.batch_size,
        shuffle=True,
        collate_fn=lambda batch: collate(batch, tokenizer.pad_id),
    )
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = RocketDiffusion(config).to(device)
    optimizer = torch.optim.AdamW(model.parameters(), lr=args.learning_rate)
    for epoch in range(args.epochs):
        model.train()
        losses = []
        for images, text in loader:
            optimizer.zero_grad(set_to_none=True)
            loss = model.training_loss(images.to(device), text.to(device), tokenizer.pad_id)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()
            losses.append(float(loss))
        print(f"epoch={epoch + 1} image_loss={sum(losses) / max(len(losses), 1):.5f}")
        Path(args.output).parent.mkdir(parents=True, exist_ok=True)
        torch.save({
            "format": "rocket-image-v1",
            "model": model.state_dict(),
            "config": config.to_dict(),
            "tokenizer": args.tokenizer,
            "epoch": epoch + 1,
        }, args.output)


if __name__ == "__main__":
    main()
