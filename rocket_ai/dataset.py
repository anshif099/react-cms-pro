import json
from pathlib import Path

import torch
from torch.utils.data import Dataset


DEFAULT_SYSTEM_PROMPT = (
    "You are Rocket AI, ReactCMS's autonomous front-end engineer, UI/UX designer, "
    "conversion copywriter, accessibility specialist, and CMS architect. Analyze the "
    "complete editable page model and return only an executable ReactCMS JSON plan."
)


def read_jsonl(path):
    with Path(path).open("r", encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, 1):
            line = line.strip()
            if not line:
                continue
            try:
                yield json.loads(line)
            except json.JSONDecodeError as error:
                raise ValueError(f"Invalid JSONL at line {line_number}: {error}") from error


def tokenizer_texts(path):
    for example in read_jsonl(path):
        yield example.get("system", DEFAULT_SYSTEM_PROMPT)
        yield json.dumps(example.get("input", {}), ensure_ascii=False, separators=(",", ":"))
        yield json.dumps(example.get("plan", {}), ensure_ascii=False, separators=(",", ":"))


class RocketPlanDataset(Dataset):
    def __init__(self, path, tokenizer, max_seq_len):
        self.examples = list(read_jsonl(path))
        self.tokenizer = tokenizer
        self.max_seq_len = max_seq_len
        if not self.examples:
            raise ValueError("Rocket AI training dataset is empty")

    def __len__(self):
        return len(self.examples)

    def __getitem__(self, index):
        example = self.examples[index]
        system = example.get("system", DEFAULT_SYSTEM_PROMPT)
        user = json.dumps(example.get("input", {}), ensure_ascii=False, separators=(",", ":"))
        assistant = json.dumps(example.get("plan", {}), ensure_ascii=False, separators=(",", ":"))
        ids, prompt_length = self.tokenizer.encode_chat(system, user, assistant)
        if len(ids) > self.max_seq_len:
            overflow = len(ids) - self.max_seq_len
            ids = ids[overflow:]
            prompt_length = max(0, prompt_length - overflow)
        labels = list(ids)
        labels[:prompt_length] = [-100] * prompt_length
        return {
            "input_ids": torch.tensor(ids, dtype=torch.long),
            "labels": torch.tensor(labels, dtype=torch.long),
        }


def collate_plans(batch, pad_id):
    max_length = max(item["input_ids"].numel() for item in batch)
    input_ids = torch.full((len(batch), max_length), pad_id, dtype=torch.long)
    labels = torch.full((len(batch), max_length), -100, dtype=torch.long)
    for index, item in enumerate(batch):
        length = item["input_ids"].numel()
        input_ids[index, :length] = item["input_ids"]
        labels[index, :length] = item["labels"]
    return {"input_ids": input_ids, "labels": labels}
