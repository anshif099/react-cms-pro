from dataclasses import asdict, dataclass


@dataclass
class RocketConfig:
    vocab_size: int
    max_seq_len: int = 8192
    dim: int = 768
    n_layers: int = 12
    n_heads: int = 12
    n_kv_heads: int = 4
    hidden_dim: int = 2048
    dropout: float = 0.0
    rope_base: float = 10000.0
    tie_embeddings: bool = True

    def __post_init__(self):
        if self.dim % self.n_heads:
            raise ValueError("dim must be divisible by n_heads")
        if self.n_heads % self.n_kv_heads:
            raise ValueError("n_heads must be divisible by n_kv_heads")

    def to_dict(self):
        return asdict(self)

    @classmethod
    def from_dict(cls, value):
        return cls(**value)


PRESETS = {
    "tiny": dict(dim=256, n_layers=6, n_heads=8, n_kv_heads=2, hidden_dim=704),
    "small": dict(dim=512, n_layers=8, n_heads=8, n_kv_heads=2, hidden_dim=1408),
    "base": dict(dim=768, n_layers=12, n_heads=12, n_kv_heads=4, hidden_dim=2048),
    "large": dict(dim=1024, n_layers=24, n_heads=16, n_kv_heads=4, hidden_dim=2816),
}


def config_from_preset(name, vocab_size, max_seq_len=8192):
    if name not in PRESETS:
        raise ValueError(f"Unknown Rocket AI preset: {name}")
    return RocketConfig(
        vocab_size=vocab_size,
        max_seq_len=max_seq_len,
        **PRESETS[name],
    )

