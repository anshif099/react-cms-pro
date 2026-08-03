import json
import re
from collections import Counter
from pathlib import Path


SPECIAL_TOKENS = [
    "<pad>",
    "<bos>",
    "<eos>",
    "<system>",
    "<user>",
    "<assistant>",
    "<end>",
]


class RocketTokenizer:
    """A byte-level subword tokenizer trained only on Rocket AI data."""

    def __init__(self, tokens=None, special_tokens=None):
        self.special_tokens = list(special_tokens or SPECIAL_TOKENS)
        base_tokens = [bytes([value]) for value in range(256)]
        learned = []
        seen = set(base_tokens)
        for token in tokens or []:
            if token in seen:
                continue
            seen.add(token)
            learned.append(token)
        self.byte_tokens = base_tokens + learned
        self.special_to_id = {
            token: index for index, token in enumerate(self.special_tokens)
        }
        offset = len(self.special_tokens)
        self.bytes_to_id = {
            token: offset + index for index, token in enumerate(self.byte_tokens)
        }
        self.id_to_bytes = {
            token_id: token for token, token_id in self.bytes_to_id.items()
        }
        self._trie = self._build_trie()

    @property
    def vocab_size(self):
        return len(self.special_tokens) + len(self.byte_tokens)

    @property
    def pad_id(self):
        return self.special_to_id["<pad>"]

    @property
    def bos_id(self):
        return self.special_to_id["<bos>"]

    @property
    def eos_id(self):
        return self.special_to_id["<eos>"]

    def token_id(self, token):
        return self.special_to_id[token]

    def _build_trie(self):
        root = {}
        for token, token_id in self.bytes_to_id.items():
            cursor = root
            for value in token:
                cursor = cursor.setdefault(value, {})
            cursor[None] = token_id
        return root

    def encode(self, text, bos=False, eos=False):
        raw = str(text).encode("utf-8")
        ids = [self.bos_id] if bos else []
        index = 0
        while index < len(raw):
            cursor = self._trie
            scan = index
            best_id = self.bytes_to_id[bytes([raw[index]])]
            best_end = index + 1
            while scan < len(raw) and raw[scan] in cursor:
                cursor = cursor[raw[scan]]
                scan += 1
                if None in cursor:
                    best_id = cursor[None]
                    best_end = scan
            ids.append(best_id)
            index = best_end
        if eos:
            ids.append(self.eos_id)
        return ids

    def encode_chat(self, system, user, assistant=None):
        ids = [self.bos_id, self.token_id("<system>")]
        ids.extend(self.encode(system))
        ids.append(self.token_id("<end>"))
        ids.append(self.token_id("<user>"))
        ids.extend(self.encode(user))
        ids.append(self.token_id("<end>"))
        ids.append(self.token_id("<assistant>"))
        prompt_length = len(ids)
        if assistant is not None:
            ids.extend(self.encode(assistant))
            ids.append(self.eos_id)
        return ids, prompt_length

    def decode(self, ids, skip_special=True):
        output = bytearray()
        for token_id in ids:
            token_id = int(token_id)
            if token_id in self.id_to_bytes:
                output.extend(self.id_to_bytes[token_id])
            elif not skip_special and 0 <= token_id < len(self.special_tokens):
                output.extend(self.special_tokens[token_id].encode("utf-8"))
        return output.decode("utf-8", errors="replace")

    def save(self, path):
        payload = {
            "version": 1,
            "special_tokens": self.special_tokens,
            "learned_tokens_hex": [
                token.hex() for token in self.byte_tokens if len(token) > 1
            ],
        }
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        Path(path).write_text(json.dumps(payload, indent=2), encoding="utf-8")

    @classmethod
    def load(cls, path):
        payload = json.loads(Path(path).read_text(encoding="utf-8"))
        if payload.get("version") != 1:
            raise ValueError("Unsupported Rocket tokenizer format")
        return cls(
            tokens=[bytes.fromhex(value) for value in payload["learned_tokens_hex"]],
            special_tokens=payload["special_tokens"],
        )

    @classmethod
    def train(cls, texts, vocab_size=8192, max_characters=25_000_000):
        if vocab_size < len(SPECIAL_TOKENS) + 256:
            raise ValueError("vocab_size is too small for byte-level tokenization")
        candidates = Counter()
        consumed = 0
        for text in texts:
            raw = str(text).encode("utf-8")
            if not raw:
                continue
            remaining = max_characters - consumed
            if remaining <= 0:
                break
            raw = raw[:remaining]
            consumed += len(raw)
            for match in re.finditer(rb"[A-Za-z0-9_.$:/@#-]+|[^\x00-\x20]", raw):
                piece = match.group(0)[:64]
                if len(piece) < 2:
                    continue
                candidates[piece] += 4
                maximum = min(12, len(piece))
                for length in range(2, maximum + 1):
                    candidates[piece[:length]] += 1
                    candidates[piece[-length:]] += 1
                for length in range(2, min(6, len(piece)) + 1):
                    for start in range(0, len(piece) - length + 1):
                        candidates[piece[start:start + length]] += 1
            if len(candidates) > 500_000:
                candidates = Counter(dict(candidates.most_common(250_000)))

        target = vocab_size - len(SPECIAL_TOKENS) - 256
        learned = [
            token for token, frequency in candidates.most_common()
            if frequency >= 2
        ][:target]
        return cls(tokens=learned)
