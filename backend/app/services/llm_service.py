import os
import requests as req
from dotenv import load_dotenv
from app.services.semcat_llm import SemcatChatModel
from langchain_core.messages import HumanMessage

load_dotenv()

_SEMCAT_OFFLINE = False

def call_llm(prompt: str, temperature: float = 0.0) -> str:
    """Invoke Semcat LLM first; if offline, fall back directly to Gemini API."""
    global _SEMCAT_OFFLINE
    if not _SEMCAT_OFFLINE:
        try:
            # Snappy connection pre-check
            api_url = os.getenv("SEMCAT_API_URL", "").strip().rstrip("/")
            if api_url:
                if api_url.endswith("/semcat"):
                    api_url = f"{api_url}/get_answer"
                req.post(api_url, json={"mdl_name": "Professional", "messages": [], "temperature": 0.0, "max_tokens": 1}, timeout=1.5)
            
            llm = SemcatChatModel(temperature=temperature)
            resp = llm._generate([HumanMessage(content=prompt)])
            content = resp.generations[0].message.content.strip()
            if content not in ("__LLM_OFFLINE__", "NO_SQL") and content:
                return content
            else:
                print(f"[MIRA] Semcat LLM returned offline/error content: '{content}'. Switching to Gemini fallback.")
                _SEMCAT_OFFLINE = True
        except Exception as e:
            print(f"[MIRA] Semcat LLM is offline or timed out: {e}. Switching to Gemini fallback.")
            _SEMCAT_OFFLINE = True

    # Try Gemini REST API fallback
    api_key = os.getenv("GEMINI_API_KEY", "")
    if api_key and api_key != "your_gemini_api_key_here":
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
            payload = {
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {
                    "temperature": temperature,
                    "maxOutputTokens": 2048,
                }
            }
            response = req.post(url, json=payload, timeout=20.0)
            response.raise_for_status()
            data = response.json()
            res_text = data["candidates"][0]["content"]["parts"][0]["text"].strip()
            return res_text
        except Exception as ex:
            print(f"[MIRA] Gemini fallback failed: {ex}")
            if 'response' in locals() and response is not None:
                print(f"[MIRA] Gemini error response text: {response.text}")
            
    return "__LLM_OFFLINE__"
