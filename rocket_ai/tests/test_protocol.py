import json
import unittest

from rocket_ai.protocol import extract_json_object, parse_and_validate_plan


def valid_plan():
    return {
        "title": "Improve hero",
        "summary": "Coordinate the page changes.",
        "assistantMessage": "Ready for approval.",
        "risk": "low",
        "estimatedEdits": 1,
        "requiresApproval": False,
        "affectedAreas": ["Hero"],
        "preserved": ["Header", "Footer"],
        "validationChecks": ["Contrast"],
        "operations": [{
            "id": "hero-copy",
            "type": "update_component",
            "summary": "Clarify the heading",
            "reason": "Improve hierarchy.",
            "targetId": "hero-1",
            "destinationId": None,
            "position": None,
            "componentType": None,
            "patches": [{
                "path": "props.locales.en.title",
                "valueJson": '"Clear value proposition"',
            }],
        }],
    }


class RocketProtocolTests(unittest.TestCase):
    def test_extracts_and_validates_a_plan(self):
        source = f"draft output\n{json.dumps(valid_plan())}\nend"
        plan = parse_and_validate_plan(source)
        self.assertTrue(plan["requiresApproval"])
        self.assertEqual(plan["operations"][0]["targetId"], "hero-1")

    def test_json_scanner_handles_braces_inside_strings(self):
        source = 'before {"message":"value with } brace"} after'
        self.assertEqual(
            json.loads(extract_json_object(source))["message"],
            "value with } brace",
        )

    def test_rejects_unsafe_patch_paths(self):
        plan = valid_plan()
        plan["operations"][0]["patches"][0]["path"] = "props.__proto__.polluted"
        with self.assertRaisesRegex(ValueError, "unsafe"):
            parse_and_validate_plan(json.dumps(plan))


if __name__ == "__main__":
    unittest.main()
