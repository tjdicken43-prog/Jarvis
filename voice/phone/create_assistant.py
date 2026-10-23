#!/usr/bin/env python3
"""Create or update the phone Jarvis assistant on Vapi.

Needs VAPI_API_KEY (Vapi private key) in the environment, never in a note.
Set VAPI_ASSISTANT_ID too and it updates that assistant instead of making a new one.
"""
import json
import os
import sys
import urllib.request

from build_phone_prompt import build

ASSISTANT = {
    "name": "Jarvis",
    "firstMessage": "Jarvis here, boss. What do you need?",
    "model": {
        "provider": "anthropic",
        "model": "claude-haiku-5-5",  # fast enough for a phone line, cheapest Claude
        "temperature": 0.5,
        "messages": [{"role": "system", "content": build()}],
    },
    "voice": {"provider": "vapi", "voiceId": "Dan"},  # Vapi's British male voice
    "transcriber": {"provider": "deepgram", "model": "nova-3", "language": "en"},
    "maxDurationSeconds": 1200,  # 20 minute cap keeps a forgotten call from eating credit
    "endCallPhrases": ["goodbye jarvis", "bye jarvis", "that's all jarvis"],
}


def main() -> None:
    key = os.environ.get("VAPI_API_KEY")
    if not key:
        sys.exit("VAPI_API_KEY is not set.")
    aid = os.environ.get("VAPI_ASSISTANT_ID")
    url = "https://api.vapi.ai/assistant" + (f"/{aid}" if aid else "")
    req = urllib.request.Request(url, data=json.dumps(ASSISTANT).encode(), method="PATCH" if aid else "POST",
                                 headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"})
    with urllib.request.urlopen(req) as res:
        body = json.load(res)
    print(f"{'Updated' if aid else 'Created'} assistant {body['id']} ({body['name']})")


if __name__ == "__main__":
    main()
