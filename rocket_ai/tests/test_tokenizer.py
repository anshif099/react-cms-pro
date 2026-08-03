import tempfile
import unittest
from pathlib import Path

from rocket_ai.tokenizer import RocketTokenizer


class RocketTokenizerTests(unittest.TestCase):
    def test_unicode_round_trip_and_chat_boundaries(self):
        tokenizer = RocketTokenizer.train(
            ["Rocket AI builds pages 🚀", "ReactCMS page plan JSON"],
            vocab_size=290,
        )
        source = "Premium café page 🚀"
        encoded = tokenizer.encode(source, bos=True, eos=True)
        self.assertEqual(tokenizer.decode(encoded), source)
        chat, prompt_length = tokenizer.encode_chat("system", "user", '{"plan":true}')
        self.assertGreater(prompt_length, 0)
        self.assertEqual(chat[0], tokenizer.bos_id)
        self.assertEqual(chat[-1], tokenizer.eos_id)

    def test_saved_vocabulary_is_reproducible(self):
        tokenizer = RocketTokenizer.train(["component component component"], vocab_size=280)
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "tokenizer.json"
            tokenizer.save(path)
            restored = RocketTokenizer.load(path)
            self.assertEqual(restored.vocab_size, tokenizer.vocab_size)
            self.assertEqual(restored.encode("component"), tokenizer.encode("component"))


if __name__ == "__main__":
    unittest.main()

