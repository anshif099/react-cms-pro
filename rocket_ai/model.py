import math
from dataclasses import dataclass

import torch
import torch.nn as nn
import torch.nn.functional as F

from .config import RocketConfig


class RMSNorm(nn.Module):
    def __init__(self, dim, epsilon=1e-6):
        super().__init__()
        self.weight = nn.Parameter(torch.ones(dim))
        self.epsilon = epsilon

    def forward(self, value):
        normalized = value.float() * torch.rsqrt(
            value.float().pow(2).mean(-1, keepdim=True) + self.epsilon
        )
        return normalized.type_as(value) * self.weight


def precompute_rope(head_dim, max_seq_len, base, device=None):
    frequencies = 1.0 / (
        base ** (torch.arange(0, head_dim, 2, device=device).float() / head_dim)
    )
    positions = torch.arange(max_seq_len, device=device).float()
    angles = torch.outer(positions, frequencies)
    return torch.polar(torch.ones_like(angles), angles)


def apply_rope(value, frequencies, start_position=0):
    batch, sequence, heads, head_dim = value.shape
    pairs = torch.view_as_complex(value.float().reshape(
        batch, sequence, heads, head_dim // 2, 2
    ))
    position_frequencies = frequencies[
        start_position:start_position + sequence
    ]
    rotated = pairs * position_frequencies.view(1, sequence, 1, -1)
    return torch.view_as_real(rotated).flatten(3).type_as(value)


class CausalAttention(nn.Module):
    def __init__(self, config):
        super().__init__()
        self.n_heads = config.n_heads
        self.n_kv_heads = config.n_kv_heads
        self.head_dim = config.dim // config.n_heads
        self.q_proj = nn.Linear(config.dim, config.n_heads * self.head_dim, bias=False)
        self.k_proj = nn.Linear(config.dim, config.n_kv_heads * self.head_dim, bias=False)
        self.v_proj = nn.Linear(config.dim, config.n_kv_heads * self.head_dim, bias=False)
        self.out_proj = nn.Linear(config.n_heads * self.head_dim, config.dim, bias=False)
        self.dropout = config.dropout

    def forward(self, value, rope, cache=None, start_position=0):
        batch, sequence, _ = value.shape
        query = self.q_proj(value).view(batch, sequence, self.n_heads, self.head_dim)
        key = self.k_proj(value).view(batch, sequence, self.n_kv_heads, self.head_dim)
        val = self.v_proj(value).view(batch, sequence, self.n_kv_heads, self.head_dim)
        query = apply_rope(query, rope, start_position)
        key = apply_rope(key, rope, start_position)
        if cache is not None:
            key = torch.cat([cache[0], key], dim=1)
            val = torch.cat([cache[1], val], dim=1)
        next_cache = (key, val)
        repeats = self.n_heads // self.n_kv_heads
        if repeats > 1:
            key = key.repeat_interleave(repeats, dim=2)
            val = val.repeat_interleave(repeats, dim=2)
        query = query.transpose(1, 2)
        key = key.transpose(1, 2)
        val = val.transpose(1, 2)
        attended = F.scaled_dot_product_attention(
            query,
            key,
            val,
            dropout_p=self.dropout if self.training else 0.0,
            is_causal=cache is None,
        )
        output = self.out_proj(attended.transpose(1, 2).reshape(batch, sequence, -1))
        return output, next_cache


class SwiGLU(nn.Module):
    def __init__(self, config):
        super().__init__()
        self.gate = nn.Linear(config.dim, config.hidden_dim, bias=False)
        self.up = nn.Linear(config.dim, config.hidden_dim, bias=False)
        self.down = nn.Linear(config.hidden_dim, config.dim, bias=False)

    def forward(self, value):
        return self.down(F.silu(self.gate(value)) * self.up(value))


class TransformerBlock(nn.Module):
    def __init__(self, config):
        super().__init__()
        self.attention_norm = RMSNorm(config.dim)
        self.attention = CausalAttention(config)
        self.ffn_norm = RMSNorm(config.dim)
        self.feed_forward = SwiGLU(config)

    def forward(self, value, rope, cache=None, start_position=0):
        attended, next_cache = self.attention(
            self.attention_norm(value),
            rope,
            cache,
            start_position,
        )
        value = value + attended
        return value + self.feed_forward(self.ffn_norm(value)), next_cache


@dataclass
class GenerationConfig:
    max_new_tokens: int = 4096
    temperature: float = 0.15
    top_k: int = 40


class RocketPlanLM(nn.Module):
    """Decoder-only transformer initialized and trained entirely by ReactCMS."""

    def __init__(self, config: RocketConfig):
        super().__init__()
        self.config = config
        self.token_embedding = nn.Embedding(config.vocab_size, config.dim)
        self.layers = nn.ModuleList([
            TransformerBlock(config) for _ in range(config.n_layers)
        ])
        self.norm = RMSNorm(config.dim)
        self.output = nn.Linear(config.dim, config.vocab_size, bias=False)
        if config.tie_embeddings:
            self.output.weight = self.token_embedding.weight
        self.register_buffer(
            "rope",
            precompute_rope(
                config.dim // config.n_heads,
                config.max_seq_len,
                config.rope_base,
            ),
            persistent=False,
        )
        self.apply(self._initialize)

    def _initialize(self, module):
        if isinstance(module, (nn.Linear, nn.Embedding)):
            nn.init.normal_(module.weight, mean=0.0, std=0.02)

    def forward(
        self,
        input_ids,
        labels=None,
        caches=None,
        start_position=0,
        use_cache=False,
    ):
        if start_position + input_ids.shape[1] > self.config.max_seq_len:
            raise ValueError("Rocket AI input exceeds its trained context length")
        hidden = self.token_embedding(input_ids)
        next_caches = []
        for index, layer in enumerate(self.layers):
            layer_cache = caches[index] if caches is not None else None
            hidden, next_cache = layer(
                hidden,
                self.rope,
                layer_cache,
                start_position,
            )
            if use_cache:
                next_caches.append(next_cache)
        logits = self.output(self.norm(hidden))
        loss = None
        if labels is not None:
            loss = F.cross_entropy(
                logits[:, :-1].contiguous().view(-1, logits.size(-1)),
                labels[:, 1:].contiguous().view(-1),
                ignore_index=-100,
            )
        if use_cache:
            return logits, loss, next_caches
        return logits, loss

    @torch.inference_mode()
    def generate(self, input_ids, eos_id, generation=None):
        generation = generation or GenerationConfig()
        self.eval()
        output = input_ids[:, -self.config.max_seq_len:]
        prompt_length = output.shape[1]
        maximum_new = min(
            generation.max_new_tokens,
            self.config.max_seq_len - output.shape[1],
        )
        logits, _, caches = self(output, use_cache=True)
        for step in range(maximum_new):
            next_logits = logits[:, -1]
            if generation.temperature <= 0:
                next_token = torch.argmax(next_logits, dim=-1, keepdim=True)
            else:
                next_logits = next_logits / generation.temperature
                if generation.top_k > 0:
                    threshold = torch.topk(
                        next_logits,
                        min(generation.top_k, next_logits.shape[-1]),
                    ).values[:, -1:]
                    next_logits = next_logits.masked_fill(next_logits < threshold, -math.inf)
                next_token = torch.multinomial(F.softmax(next_logits, dim=-1), 1)
            output = torch.cat([output, next_token], dim=1)
            if torch.all(next_token == eos_id):
                break
            logits, _, caches = self(
                next_token,
                caches=caches,
                start_position=prompt_length + step,
                use_cache=True,
            )
        return output

    def parameter_count(self):
        return sum(parameter.numel() for parameter in self.parameters())
