import argparse
import json
import math
import random
from functools import partial
from pathlib import Path

import torch
from torch.utils.data import DataLoader, Subset

from .config import config_from_preset
from .dataset import RocketPlanDataset, collate_plans, tokenizer_texts
from .model import RocketPlanLM
from .tokenizer import RocketTokenizer


def arguments():
    parser = argparse.ArgumentParser(description="Train Rocket AI from random initialization")
    parser.add_argument("--data", required=True, help="ReactCMS plan JSONL dataset")
    parser.add_argument("--output", default="rocket_ai/checkpoints/rocket-plan")
    parser.add_argument("--preset", choices=["tiny", "small", "base", "large"], default="small")
    parser.add_argument("--vocab-size", type=int, default=8192)
    parser.add_argument("--max-seq-len", type=int, default=8192)
    parser.add_argument("--epochs", type=int, default=3)
    parser.add_argument("--batch-size", type=int, default=1)
    parser.add_argument("--grad-accumulation", type=int, default=16)
    parser.add_argument("--learning-rate", type=float, default=3e-4)
    parser.add_argument("--weight-decay", type=float, default=0.1)
    parser.add_argument("--warmup-ratio", type=float, default=0.03)
    parser.add_argument("--validation-ratio", type=float, default=0.02)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--save-every", type=int, default=500)
    parser.add_argument("--tokenizer", default="")
    parser.add_argument("--resume", default="")
    parser.add_argument("--continue-state", action="store_true", help="Also restore optimizer, epoch, and step")
    return parser.parse_args()


def save_checkpoint(path, model, optimizer, config, step, epoch, tokenizer_path):
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    torch.save({
        "format": "rocket-plan-lm-v1",
        "model": model.state_dict(),
        "optimizer": optimizer.state_dict(),
        "config": config.to_dict(),
        "step": step,
        "epoch": epoch,
        "tokenizer": str(tokenizer_path),
    }, path)


@torch.inference_mode()
def evaluate(model, loader, device, max_batches=25):
    if not loader:
        return None
    model.eval()
    losses = []
    for index, batch in enumerate(loader):
        if index >= max_batches:
            break
        inputs = batch["input_ids"].to(device)
        labels = batch["labels"].to(device)
        with torch.autocast(
            device_type=device.type,
            dtype=torch.bfloat16,
            enabled=device.type == "cuda",
        ):
            _, loss = model(inputs, labels)
        losses.append(float(loss))
    model.train()
    return sum(losses) / len(losses) if losses else None


def main():
    args = arguments()
    random.seed(args.seed)
    torch.manual_seed(args.seed)
    output = Path(args.output)
    output.mkdir(parents=True, exist_ok=True)
    tokenizer_path = Path(args.tokenizer) if args.tokenizer else output / "tokenizer.json"
    if tokenizer_path.exists():
        tokenizer = RocketTokenizer.load(tokenizer_path)
    else:
        print("Training Rocket tokenizer from the ReactCMS dataset...")
        tokenizer = RocketTokenizer.train(
            tokenizer_texts(args.data),
            vocab_size=args.vocab_size,
        )
        tokenizer.save(tokenizer_path)

    config = config_from_preset(
        args.preset,
        tokenizer.vocab_size,
        args.max_seq_len,
    )
    (output / "config.json").write_text(
        json.dumps(config.to_dict(), indent=2),
        encoding="utf-8",
    )
    dataset = RocketPlanDataset(args.data, tokenizer, config.max_seq_len)
    indices = list(range(len(dataset)))
    random.shuffle(indices)
    validation_size = max(1, int(len(indices) * args.validation_ratio)) if len(indices) > 20 else 0
    validation_indices = indices[:validation_size]
    training_indices = indices[validation_size:]
    collate = partial(collate_plans, pad_id=tokenizer.pad_id)
    training_loader = DataLoader(
        Subset(dataset, training_indices),
        batch_size=args.batch_size,
        shuffle=True,
        collate_fn=collate,
        pin_memory=torch.cuda.is_available(),
    )
    validation_loader = DataLoader(
        Subset(dataset, validation_indices),
        batch_size=args.batch_size,
        collate_fn=collate,
    ) if validation_indices else None

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = RocketPlanLM(config).to(device)
    optimizer = torch.optim.AdamW(
        model.parameters(),
        lr=args.learning_rate,
        betas=(0.9, 0.95),
        weight_decay=args.weight_decay,
    )
    start_epoch = 0
    global_step = 0
    if args.resume:
        checkpoint = torch.load(args.resume, map_location="cpu", weights_only=False)
        model.load_state_dict(checkpoint["model"])
        if args.continue_state:
            optimizer.load_state_dict(checkpoint["optimizer"])
            start_epoch = int(checkpoint.get("epoch", 0))
            global_step = int(checkpoint.get("step", 0))

    optimizer_steps = max(
        1,
        math.ceil(len(training_loader) / args.grad_accumulation) * args.epochs,
    )
    warmup_steps = max(1, int(optimizer_steps * args.warmup_ratio))

    def learning_rate(step):
        if step < warmup_steps:
            return max(step, 1) / warmup_steps
        progress = min(1.0, (step - warmup_steps) / max(1, optimizer_steps - warmup_steps))
        return 0.1 + 0.9 * 0.5 * (1.0 + math.cos(math.pi * progress))

    scheduler = torch.optim.lr_scheduler.LambdaLR(optimizer, learning_rate)
    print(
        f"Rocket AI parameters: {model.parameter_count():,}; "
        f"examples: {len(training_indices):,}; device: {device}"
    )
    optimizer.zero_grad(set_to_none=True)
    for epoch in range(start_epoch, args.epochs):
        model.train()
        for batch_index, batch in enumerate(training_loader):
            inputs = batch["input_ids"].to(device)
            labels = batch["labels"].to(device)
            with torch.autocast(
                device_type=device.type,
                dtype=torch.bfloat16,
                enabled=device.type == "cuda",
            ):
                _, loss = model(inputs, labels)
                scaled_loss = loss / args.grad_accumulation
            scaled_loss.backward()
            should_step = (
                (batch_index + 1) % args.grad_accumulation == 0
                or batch_index + 1 == len(training_loader)
            )
            if not should_step:
                continue
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()
            scheduler.step()
            optimizer.zero_grad(set_to_none=True)
            global_step += 1
            if global_step % 10 == 0:
                print(
                    f"epoch={epoch + 1} step={global_step} "
                    f"loss={float(loss):.4f} lr={scheduler.get_last_lr()[0]:.2e}"
                )
            if global_step % args.save_every == 0:
                save_checkpoint(
                    output / f"step-{global_step}.pt",
                    model,
                    optimizer,
                    config,
                    global_step,
                    epoch,
                    tokenizer_path,
                )
        validation_loss = evaluate(model, validation_loader, device)
        if validation_loss is not None:
            print(f"epoch={epoch + 1} validation_loss={validation_loss:.4f}")
        save_checkpoint(
            output / "latest.pt",
            model,
            optimizer,
            config,
            global_step,
            epoch + 1,
            tokenizer_path,
        )


if __name__ == "__main__":
    main()
