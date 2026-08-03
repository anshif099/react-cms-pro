import argparse
import base64
import hmac
import io
import json
import os
import threading
import time
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import torch

from .config import RocketConfig
from .model import GenerationConfig, RocketPlanLM
from .protocol import parse_and_validate_plan, validate_plan
from .tokenizer import RocketTokenizer


MAX_REQUEST_BYTES = 4 * 1024 * 1024


class RocketTextEngine:
    def __init__(self, checkpoint_path, tokenizer_path="", device=""):
        checkpoint = torch.load(checkpoint_path, map_location="cpu", weights_only=False)
        if checkpoint.get("format") != "rocket-plan-lm-v1":
            raise ValueError("Unsupported Rocket AI text checkpoint")
        self.config = RocketConfig.from_dict(checkpoint["config"])
        resolved_tokenizer = tokenizer_path or checkpoint.get("tokenizer")
        if not resolved_tokenizer:
            raise ValueError("Rocket AI tokenizer path is missing")
        tokenizer_file = Path(resolved_tokenizer)
        if not tokenizer_file.is_absolute() and not tokenizer_file.exists():
            tokenizer_file = Path(checkpoint_path).parent / tokenizer_file.name
        self.tokenizer = RocketTokenizer.load(tokenizer_file)
        self.device = torch.device(device or ("cuda" if torch.cuda.is_available() else "cpu"))
        self.model = RocketPlanLM(self.config)
        self.model.load_state_dict(checkpoint["model"])
        self.model.to(self.device).eval()
        self.lock = threading.Lock()
        self.name = os.getenv("ROCKET_AI_MODEL_NAME", "rocket-plan")

    def _prompt_ids(self, system, user, output_budget):
        maximum_input = max(256, self.config.max_seq_len - output_budget)
        ids, _ = self.tokenizer.encode_chat(system, user)
        if len(ids) <= maximum_input:
            return ids
        marker = self.tokenizer.encode("\n[ROCKET CONTEXT COMPACTED]\n")
        system_ids = self.tokenizer.encode(system)
        user_ids = self.tokenizer.encode(user)
        overhead = 6

        def compact(tokens, budget, leading_ratio):
            if len(tokens) <= budget:
                return tokens
            content_budget = max(0, budget - len(marker))
            leading = int(content_budget * leading_ratio)
            trailing = content_budget - leading
            return tokens[:leading] + marker + (tokens[-trailing:] if trailing else [])

        system_budget = min(
            len(system_ids),
            max(128, int((maximum_input - overhead) * 0.6)),
        )
        compact_system = compact(system_ids, system_budget, 0.3)
        user_budget = max(32, maximum_input - len(compact_system) - overhead)
        compact_user = compact(user_ids, user_budget, 0.4)
        ids = [self.tokenizer.bos_id, self.tokenizer.token_id("<system>")]
        ids.extend(compact_system)
        ids.append(self.tokenizer.token_id("<end>"))
        ids.append(self.tokenizer.token_id("<user>"))
        ids.extend(compact_user)
        ids.append(self.tokenizer.token_id("<end>"))
        ids.append(self.tokenizer.token_id("<assistant>"))
        return ids[:maximum_input]

    def plan(self, payload):
        instructions = str(payload.get("instructions") or "")
        schema = payload.get("schema") or {}
        system = (
            f"{instructions}\nReturn only JSON matching this schema:\n"
            f"{json.dumps(schema, separators=(',', ':'))}"
        )
        input_value = payload.get("input")
        user = input_value if isinstance(input_value, str) else json.dumps(
            input_value,
            ensure_ascii=False,
            separators=(",", ":"),
        )
        max_new_tokens = min(
            6000,
            self.config.max_seq_len // 2,
            max(256, int(payload.get("maxNewTokens", 4096))),
        )
        prompt_ids = self._prompt_ids(system, user, max_new_tokens)
        tensor = torch.tensor([prompt_ids], dtype=torch.long, device=self.device)
        started = time.perf_counter()
        last_error = None
        with self.lock:
            for attempt in range(2):
                generated = self.model.generate(
                    tensor,
                    self.tokenizer.eos_id,
                    GenerationConfig(
                        max_new_tokens=max_new_tokens,
                        temperature=0.12 if attempt == 0 else 0.0,
                        top_k=40,
                    ),
                )
                completion_ids = generated[0, tensor.shape[1]:].tolist()
                text = self.tokenizer.decode(completion_ids)
                try:
                    plan = parse_and_validate_plan(text)
                    elapsed = time.perf_counter() - started
                    return {
                        "plan": plan,
                        "model": self.name,
                        "requestId": f"rocket_{uuid.uuid4().hex}",
                        "usage": {
                            "input_tokens": len(prompt_ids),
                            "output_tokens": len(completion_ids),
                            "elapsed_seconds": round(elapsed, 3),
                        },
                    }
                except (ValueError, json.JSONDecodeError) as error:
                    last_error = error
        raise ValueError(f"Rocket AI could not produce a valid plan: {last_error}")


class RocketImageEngine:
    def __init__(self, checkpoint_path, tokenizer_path="", device=""):
        from .image_model import RocketDiffusion, RocketImageConfig

        checkpoint = torch.load(checkpoint_path, map_location="cpu", weights_only=False)
        if checkpoint.get("format") != "rocket-image-v1":
            raise ValueError("Unsupported Rocket AI image checkpoint")
        tokenizer_file = tokenizer_path or checkpoint.get("tokenizer")
        self.tokenizer = RocketTokenizer.load(tokenizer_file)
        self.config = RocketImageConfig.from_dict(checkpoint["config"])
        self.device = torch.device(device or ("cuda" if torch.cuda.is_available() else "cpu"))
        self.model = RocketDiffusion(self.config)
        self.model.load_state_dict(checkpoint["model"])
        self.model.to(self.device).eval()
        self.lock = threading.Lock()

    def generate(self, payload):
        from PIL import Image

        prompt = str(payload.get("prompt") or "").strip()
        brand = payload.get("brandContext") or {}
        full_prompt = f"{prompt}\nBrand context: {json.dumps(brand, separators=(',', ':'))}"
        tokens = self.tokenizer.encode(full_prompt, bos=True, eos=True)[:256]
        text_ids = torch.tensor([tokens], dtype=torch.long, device=self.device)
        size = str(payload.get("size") or "1024x1024")
        try:
            width, height = [min(1536, max(256, int(value))) for value in size.split("x")]
        except (ValueError, TypeError):
            width, height = 1024, 1024
        with self.lock:
            image = self.model.sample(
                text_ids,
                self.tokenizer.pad_id,
                steps=75 if payload.get("quality") == "high" else 50,
                seed=payload.get("seed"),
            )[0]
        pixels = ((image.permute(1, 2, 0).cpu().numpy() + 1.0) * 127.5).clip(0, 255)
        rendered = Image.fromarray(pixels.astype("uint8"), "RGB").resize(
            (width, height),
            Image.Resampling.LANCZOS,
        )
        buffer = io.BytesIO()
        rendered.save(buffer, format="PNG", optimize=True)
        return {
            "imageBase64": base64.b64encode(buffer.getvalue()).decode("ascii"),
            "mimeType": "image/png",
            "model": os.getenv("ROCKET_IMAGE_MODEL_NAME", "rocket-image"),
        }


class RocketServer(ThreadingHTTPServer):
    def __init__(
        self,
        address,
        text_engine,
        image_engine=None,
        api_key="",
        feedback_path="",
    ):
        super().__init__(address, RocketHandler)
        self.text_engine = text_engine
        self.image_engine = image_engine
        self.api_key = api_key
        self.feedback_path = feedback_path
        self.feedback_lock = threading.Lock()

    def record_feedback(self, payload):
        plan = validate_plan(payload.get("plan"))
        record = {
            "input": payload.get("input") or {},
            "plan": plan,
            "outcome": payload.get("outcome") or {},
            "requester": payload.get("requester"),
        }
        if not self.feedback_path:
            return {"accepted": True, "captured": False}
        path = Path(self.feedback_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        with self.feedback_lock, path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(record, ensure_ascii=False) + "\n")
        return {"accepted": True, "captured": True}


class RocketHandler(BaseHTTPRequestHandler):
    server_version = "RocketAI/0.1"

    def _json(self, status, value):
        body = json.dumps(value, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(body)

    def _authorized(self):
        provided = self.headers.get("X-Rocket-Key", "")
        return not self.server.api_key or hmac.compare_digest(provided, self.server.api_key)

    def do_GET(self):
        if self.path == "/health":
            return self._json(200, {
                "status": "ready",
                "model": self.server.text_engine.name,
                "imageModel": bool(self.server.image_engine),
            })
        return self._json(404, {"error": "Not found"})

    def do_POST(self):
        if not self._authorized():
            return self._json(401, {"error": "Rocket AI gateway key is invalid"})
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > MAX_REQUEST_BYTES:
                return self._json(413, {"error": "Rocket AI request is too large"})
            payload = json.loads(self.rfile.read(length))
            if self.path == "/v1/plan":
                return self._json(200, self.server.text_engine.plan(payload))
            if self.path == "/v1/images/generate":
                if not self.server.image_engine:
                    return self._json(503, {
                        "error": "Rocket Image has not been trained or loaded yet"
                    })
                return self._json(200, self.server.image_engine.generate(payload))
            if self.path == "/v1/feedback":
                return self._json(200, self.server.record_feedback(payload))
            return self._json(404, {"error": "Not found"})
        except (ValueError, json.JSONDecodeError) as error:
            return self._json(422, {"error": str(error)})
        except Exception as error:
            print(f"Rocket AI request failed: {error}")
            return self._json(500, {"error": "Rocket AI inference failed"})

    def log_message(self, message, *args):
        print(f"[{self.log_date_time_string()}] {message % args}")


def main():
    parser = argparse.ArgumentParser(description="Serve the first-party Rocket AI model")
    parser.add_argument("--checkpoint", default=os.getenv("ROCKET_AI_CHECKPOINT", ""))
    parser.add_argument("--tokenizer", default=os.getenv("ROCKET_AI_TOKENIZER", ""))
    parser.add_argument("--image-checkpoint", default=os.getenv("ROCKET_IMAGE_CHECKPOINT", ""))
    parser.add_argument("--host", default=os.getenv("ROCKET_AI_HOST", "127.0.0.1"))
    parser.add_argument("--port", type=int, default=int(os.getenv("ROCKET_AI_PORT", "8787")))
    parser.add_argument("--device", default=os.getenv("ROCKET_AI_DEVICE", ""))
    args = parser.parse_args()
    if not args.checkpoint:
        parser.error("--checkpoint or ROCKET_AI_CHECKPOINT is required")
    text_engine = RocketTextEngine(args.checkpoint, args.tokenizer, args.device)
    image_engine = (
        RocketImageEngine(args.image_checkpoint, args.tokenizer, args.device)
        if args.image_checkpoint else None
    )
    server = RocketServer(
        (args.host, args.port),
        text_engine,
        image_engine,
        os.getenv("ROCKET_AI_GATEWAY_KEY", ""),
        os.getenv("ROCKET_AI_FEEDBACK_PATH", ""),
    )
    print(
        f"Rocket AI ready at http://{args.host}:{args.port} "
        f"with {text_engine.model.parameter_count():,} original parameters"
    )
    server.serve_forever()


if __name__ == "__main__":
    main()
