import argparse
import json
import math
from pathlib import Path

import numpy as np
import torch
from torch.utils.data import DataLoader, Dataset

from .config import config_from_preset
from .model import RocketPlanLM
from .tokenizer import RocketTokenizer


class TokenBlockDataset(Dataset):
    def __init__(self, path, sequence_length):
        self.tokens = np.memmap(path, dtype=np.uint32, mode="r")
        self.sequence_length = sequence_length
        self.blocks = max(0, len(self.tokens) // sequence_length)
        if not self.blocks:
            raise ValueError("The pretraining corpus is smaller than one sequence")

    def __len__(self):
        return self.blocks

    def __getitem__(self, index):
        start = index * self.sequence_length
        values = np.asarray(
            self.tokens[start:start + self.sequence_length],
            dtype=np.int64,
        ).copy()
        input_ids = torch.from_numpy(values)
        labels = input_ids.clone()
        return input_ids, labels


def main():
    parser = argparse.ArgumentParser(description="Pretrain RocketPlanLM from random initialization")
    parser.add_argument("--corpus", required=True)
    parser.add_argument("--tokenizer", required=True)
    parser.add_argument("--output", default="rocket_ai/checkpoints/rocket-pretrain")
    parser.add_argument("--preset", choices=["tiny", "small", "base", "large"], default="small")
    parser.add_argument("--max-seq-len", type=int, default=8192)
    parser.add_argument("--sequence-length", type=int, default=2048)
    parser.add_argument("--batch-size", type=int, default=1)
    parser.add_argument("--grad-accumulation", type=int, default=16)
    parser.add_argument("--epochs", type=int, default=1)
    parser.add_argument("--learning-rate", type=float, default=3e-4)
    parser.add_argument("--save-every", type=int, default=1000)
    args = parser.parse_args()
    if args.sequence_length > args.max_seq_len:
        parser.error("--sequence-length cannot exceed --max-seq-len")
    tokenizer = RocketTokenizer.load(args.tokenizer)
    config = config_from_preset(args.preset, tokenizer.vocab_size, args.max_seq_len)
    dataset = TokenBlockDataset(args.corpus, args.sequence_length)
    loader = DataLoader(dataset, batch_size=args.batch_size, shuffle=True)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = RocketPlanLM(config).to(device)
    optimizer = torch.optim.AdamW(
        model.parameters(),
        lr=args.learning_rate,
        betas=(0.9, 0.95),
        weight_decay=0.1,
    )
    total_steps = max(1, math.ceil(len(loader) / args.grad_accumulation) * args.epochs)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(
        optimizer,
        T_max=total_steps,
        eta_min=args.learning_rate * 0.1,
    )
    output = Path(args.output)
    output.mkdir(parents=True, exist_ok=True)
    (output / "config.json").write_text(json.dumps(config.to_dict(), indent=2), encoding="utf-8")
    global_step = 0
    optimizer.zero_grad(set_to_none=True)

    def save(name, epoch):
        torch.save({
            "format": "rocket-plan-lm-v1",
            "model": model.state_dict(),
            "optimizer": optimizer.state_dict(),
            "config": config.to_dict(),
            "step": global_step,
            "epoch": epoch,
            "tokenizer": str(Path(args.tokenizer).resolve()),
        }, output / name)

    print(f"Pretraining {model.parameter_count():,} Rocket AI parameters on {len(dataset):,} blocks")
    for epoch in range(args.epochs):
        model.train()
        for batch_index, (inputs, labels) in enumerate(loader):
            inputs, labels = inputs.to(device), labels.to(device)
            with torch.autocast(
                device_type=device.type,
                dtype=torch.bfloat16,
                enabled=device.type == "cuda",
            ):
                _, loss = model(inputs, labels)
                loss = loss / args.grad_accumulation
            loss.backward()
            if (batch_index + 1) % args.grad_accumulation and batch_index + 1 < len(loader):
                continue
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()
            scheduler.step()
            optimizer.zero_grad(set_to_none=True)
            global_step += 1
            if global_step % 10 == 0:
                print(f"step={global_step} pretrain_loss={float(loss) * args.grad_accumulation:.4f}")
            if global_step % args.save_every == 0:
                save(f"step-{global_step}.pt", epoch)
        save("latest.pt", epoch + 1)


if __name__ == "__main__":
    main()
