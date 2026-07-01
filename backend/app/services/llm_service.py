import os
import requests as req
from dotenv import load_dotenv
from app.services.semcat_llm import SemcatChatModel
from langchain_core.messages import HumanMessage

load_dotenv()

_SEMCAT_OFFLINE = False

_LLM_CACHE = {}

def call_llm(prompt: str, temperature: float = 0.0) -> str:
    """Invoke Semcat LLM first; if offline, fall back directly to Gemini API."""
    global _SEMCAT_OFFLINE
    
    # Check cache first for deterministic calls
    cache_key = (prompt, temperature)
    if cache_key in _LLM_CACHE:
        print(f"[LLMService] Cache hit for identical prompt (prompt hash: {hash(prompt)})")
        return _LLM_CACHE[cache_key]
        
    result = "__LLM_OFFLINE__"
    
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
                result = content
        except Exception as e:
            print(f"[MIRA] Semcat LLM is offline or timed out: {e}. Switching to Gemini fallback.")
            _SEMCAT_OFFLINE = True

    # Try Gemini REST API fallback
    if result == "__LLM_OFFLINE__":
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
                if response.status_code == 200:
                    data = response.json()
                    res_text = data["candidates"][0]["content"]["parts"][0]["text"].strip()
                    result = res_text
                elif response.status_code == 429:
                    print(f"[MIRA] Gemini rate limit exceeded (429): {response.text}")
                else:
                    print(f"[MIRA] Gemini API returned status {response.status_code}: {response.text}")
            except Exception as ex:
                print(f"[MIRA] Gemini fallback failed: {ex}")
                
    # Cache result if it is valid
    if result != "__LLM_OFFLINE__":
        _LLM_CACHE[cache_key] = result
        
    return result
