# Rocket AI

Rocket AI is ReactCMS Pro's own trainable website-planning model. Its tokenizer, transformer architecture, training loop, checkpoint format, page-edit curriculum, plan validator, image diffusion architecture, and inference server live in this repository.

It does not download or call a pretrained language model. Every model parameter starts randomly and is learned from data you control.

## What “from scratch” means

- `tokenizer.py` learns a byte-level subword vocabulary from your ReactCMS dataset.
- `model.py` defines RocketPlanLM, a decoder-only transformer with RMSNorm, rotary position embeddings, grouped-query causal attention, and SwiGLU layers.
- `train.py` initializes every weight randomly and performs supervised next-token training.
- `protocol.py` validates the generated ReactCMS operation plan before it reaches the editor.
- `image_model.py` defines Rocket Image, a conditional diffusion model with no pretrained weights.
- `server.py` serves your checkpoints directly. It has no external inference-provider integration.

PyTorch is used only as the tensor/autograd runtime, in the same way React uses the browser runtime. It supplies no model intelligence or weights.

## Reality check

The code is a complete original model stack, but an untrained checkpoint has no useful intelligence. A Loveable-class model requires a large, carefully reviewed dataset and substantial GPU training. The included synthetic curriculum is for bootstrapping and integration testing, not production-level design judgment.

For a useful domain model, collect real examples containing:

- the complete editable ReactCMS context;
- the user's design request;
- the approved multi-operation plan;
- execution results and corrections;
- accessibility, responsive, SEO, and conversion review outcomes.

Keep rejected or failed plans as negative/evaluation examples rather than copying them into the supervised target set.

## Install the training runtime

From the repository root:

```powershell
python -m venv .rocket-venv
.\.rocket-venv\Scripts\Activate.ps1
python -m pip install -r rocket_ai\requirements.txt
```

For serious training, install the CUDA build of PyTorch appropriate for the GPU machine instead of relying on the generic command above.

## Build the initial curriculum

```powershell
python -m rocket_ai.bootstrap_dataset --examples 10000 --output rocket_ai/data/bootstrap.jsonl
```

Each JSONL record has an `input` object containing the user request and complete editable context, plus an approved `plan` object matching the ReactCMS operation contract.

## Train RocketPlanLM

Train the vocabulary on your source, copy, design documentation, and approved plans:

```powershell
python -m rocket_ai.train_tokenizer `
  --inputs "apps/dashboard/src/**/*.jsx" "rocket_ai/data/*.jsonl" `
  --output rocket_ai/checkpoints/tokenizer.json `
  --vocab-size 8192
```

Prepare a raw corpus and pretrain language/design/code behavior from random weights:

```powershell
python -m rocket_ai.prepare_corpus `
  --tokenizer rocket_ai/checkpoints/tokenizer.json `
  --inputs "apps/dashboard/src/**/*.*" "rocket_ai/data/*.jsonl" `
  --output rocket_ai/data/pretrain.bin

python -m rocket_ai.pretrain `
  --corpus rocket_ai/data/pretrain.bin `
  --tokenizer rocket_ai/checkpoints/tokenizer.json `
  --output rocket_ai/checkpoints/rocket-pretrain `
  --preset small
```

Then fine-tune the pretrained weights on executable ReactCMS plans:

```powershell
python -m rocket_ai.train `
  --data rocket_ai/data/bootstrap.jsonl `
  --output rocket_ai/checkpoints/rocket-plan-small `
  --preset small `
  --tokenizer rocket_ai/checkpoints/tokenizer.json `
  --resume rocket_ai/checkpoints/rocket-pretrain/latest.pt `
  --max-seq-len 8192 `
  --epochs 3
```

The `tiny` preset is useful for CPU smoke tests. `base` and `large` require significantly more GPU memory, data, and training time. Checkpoints and datasets are ignored by Git because they can be very large and may contain private website content.

## Start your model server

```powershell
$env:ROCKET_AI_CHECKPOINT="rocket_ai/checkpoints/rocket-plan-small/latest.pt"
$env:ROCKET_AI_GATEWAY_KEY="replace-with-a-long-random-secret"
$env:ROCKET_AI_FEEDBACK_PATH="rocket_ai/data/approved-feedback.jsonl"
python -m rocket_ai.server
```

Health check:

```powershell
Invoke-RestMethod http://127.0.0.1:8787/health
```

Configure the ReactCMS server/Vercel environment:

```text
ROCKET_AI_URL=https://your-private-rocket-gpu-server.example
ROCKET_AI_MODEL=rocket-plan
ROCKET_AI_GATEWAY_KEY=the-same-long-random-secret
```

The browser never receives the gateway key. The authenticated ReactCMS server function forwards page-planning requests to the Rocket server.

When `ROCKET_AI_FEEDBACK_PATH` is configured, each plan that a user approves and successfully applies is appended to that private JSONL curriculum with its context and execution outcome. Review this file before mixing it into the next training run.

Vercel cannot run a large GPU checkpoint inside a normal serverless function. Host `rocket_ai.server` on hardware you control and make it reachable only through TLS and the shared gateway key.

## Train Rocket Image

Prepare a JSONL manifest next to images you own or are licensed to train on:

```json
{"image":"images/hero-001.png","caption":"premium abstract coral technology hero with negative space"}
```

Then train:

```powershell
python -m rocket_ai.train_images `
  --manifest rocket_ai/data/images.jsonl `
  --tokenizer rocket_ai/checkpoints/rocket-plan-small/tokenizer.json `
  --output rocket_ai/checkpoints/rocket-image.pt
```

Load it alongside the text checkpoint:

```powershell
$env:ROCKET_IMAGE_CHECKPOINT="rocket_ai/checkpoints/rocket-image.pt"
python -m rocket_ai.server
```

Until an image checkpoint is trained and loaded, Rocket AI returns an explicit `503` for image generation rather than silently using an external provider.

## API

- `GET /health`
- `POST /v1/plan`
- `POST /v1/images/generate`
- `POST /v1/feedback`

When `ROCKET_AI_GATEWAY_KEY` is configured, POST requests require the matching `X-Rocket-Key` header.
