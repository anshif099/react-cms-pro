import math
from dataclasses import asdict, dataclass

import torch
import torch.nn as nn
import torch.nn.functional as F


@dataclass
class RocketImageConfig:
    vocab_size: int
    image_size: int = 128
    base_channels: int = 96
    condition_dim: int = 256
    diffusion_steps: int = 1000

    def to_dict(self):
        return asdict(self)

    @classmethod
    def from_dict(cls, value):
        return cls(**value)


def timestep_embedding(timesteps, dim):
    half = dim // 2
    frequencies = torch.exp(
        -math.log(10000) * torch.arange(half, device=timesteps.device) / max(half - 1, 1)
    )
    angles = timesteps.float()[:, None] * frequencies[None]
    embedding = torch.cat([angles.sin(), angles.cos()], dim=-1)
    return F.pad(embedding, (0, dim - embedding.shape[-1]))


class ConditionedBlock(nn.Module):
    def __init__(self, input_channels, output_channels, condition_dim):
        super().__init__()
        self.norm1 = nn.GroupNorm(8, input_channels)
        self.conv1 = nn.Conv2d(input_channels, output_channels, 3, padding=1)
        self.condition = nn.Linear(condition_dim, output_channels * 2)
        self.norm2 = nn.GroupNorm(8, output_channels)
        self.conv2 = nn.Conv2d(output_channels, output_channels, 3, padding=1)
        self.skip = (
            nn.Conv2d(input_channels, output_channels, 1)
            if input_channels != output_channels else nn.Identity()
        )

    def forward(self, value, condition):
        hidden = self.conv1(F.silu(self.norm1(value)))
        scale, shift = self.condition(condition).chunk(2, dim=-1)
        hidden = self.norm2(hidden) * (1 + scale[:, :, None, None]) + shift[:, :, None, None]
        hidden = self.conv2(F.silu(hidden))
        return hidden + self.skip(value)


class RocketImageDenoiser(nn.Module):
    def __init__(self, config):
        super().__init__()
        channels = config.base_channels
        self.text_embedding = nn.Embedding(config.vocab_size, config.condition_dim)
        self.time_mlp = nn.Sequential(
            nn.Linear(config.condition_dim, config.condition_dim * 4),
            nn.SiLU(),
            nn.Linear(config.condition_dim * 4, config.condition_dim),
        )
        self.input = nn.Conv2d(3, channels, 3, padding=1)
        self.down1 = ConditionedBlock(channels, channels, config.condition_dim)
        self.down2 = ConditionedBlock(channels, channels * 2, config.condition_dim)
        self.middle = ConditionedBlock(channels * 2, channels * 2, config.condition_dim)
        self.up2 = ConditionedBlock(channels * 4, channels, config.condition_dim)
        self.up1 = ConditionedBlock(channels * 2, channels, config.condition_dim)
        self.output = nn.Sequential(
            nn.GroupNorm(8, channels),
            nn.SiLU(),
            nn.Conv2d(channels, 3, 3, padding=1),
        )

    def forward(self, noisy_image, timesteps, text_ids, pad_id=0):
        mask = (text_ids != pad_id).float().unsqueeze(-1)
        text = self.text_embedding(text_ids)
        text = (text * mask).sum(1) / mask.sum(1).clamp_min(1.0)
        condition = text + self.time_mlp(timestep_embedding(timesteps, text.shape[-1]))
        level1 = self.down1(self.input(noisy_image), condition)
        level2 = self.down2(F.avg_pool2d(level1, 2), condition)
        middle = self.middle(F.avg_pool2d(level2, 2), condition)
        up2 = F.interpolate(middle, size=level2.shape[-2:], mode="nearest")
        up2 = self.up2(torch.cat([up2, level2], dim=1), condition)
        up1 = F.interpolate(up2, size=level1.shape[-2:], mode="nearest")
        up1 = self.up1(torch.cat([up1, level1], dim=1), condition)
        return self.output(up1)


class RocketDiffusion(nn.Module):
    """A first-party conditional diffusion model trained from random weights."""

    def __init__(self, config):
        super().__init__()
        self.config = config
        self.denoiser = RocketImageDenoiser(config)
        betas = torch.linspace(1e-4, 0.02, config.diffusion_steps)
        alphas = 1.0 - betas
        self.register_buffer("alpha_bars", torch.cumprod(alphas, dim=0))

    def training_loss(self, images, text_ids, pad_id=0):
        timesteps = torch.randint(
            0,
            self.config.diffusion_steps,
            (images.shape[0],),
            device=images.device,
        )
        noise = torch.randn_like(images)
        alpha = self.alpha_bars[timesteps][:, None, None, None]
        noisy = alpha.sqrt() * images + (1.0 - alpha).sqrt() * noise
        predicted = self.denoiser(noisy, timesteps, text_ids, pad_id)
        return F.mse_loss(predicted, noise)

    @torch.inference_mode()
    def sample(self, text_ids, pad_id=0, steps=50, seed=None):
        self.eval()
        generator = torch.Generator(device=text_ids.device)
        if seed is not None:
            generator.manual_seed(seed)
        image = torch.randn(
            text_ids.shape[0],
            3,
            self.config.image_size,
            self.config.image_size,
            device=text_ids.device,
            generator=generator,
        )
        schedule = torch.linspace(
            self.config.diffusion_steps - 1,
            0,
            steps,
            device=text_ids.device,
        ).long()
        for index, timestep in enumerate(schedule):
            batch_timestep = timestep.repeat(text_ids.shape[0])
            predicted_noise = self.denoiser(image, batch_timestep, text_ids, pad_id)
            alpha = self.alpha_bars[timestep]
            clean = (image - (1.0 - alpha).sqrt() * predicted_noise) / alpha.sqrt()
            clean = clean.clamp(-1, 1)
            if index + 1 == len(schedule):
                image = clean
            else:
                next_alpha = self.alpha_bars[schedule[index + 1]]
                image = next_alpha.sqrt() * clean + (1.0 - next_alpha).sqrt() * predicted_noise
        return image.clamp(-1, 1)

