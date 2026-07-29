import os
import json
import sqlite3
import httpx
from dotenv import load_dotenv
from app.services.semcat_llm import SemcatChatModel
from langchain_core.messages import HumanMessage

load_dotenv()

_SEMCAT_OFFLINE = False

DB_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "llm_cache.db")

def init_db():
    try:
        conn = sqlite3.connect(DB_FILE)
        c = conn.cursor()
        c.execute('''CREATE TABLE IF NOT EXISTS cache
                     (prompt TEXT, temperature REAL, response TEXT, PRIMARY KEY (prompt, temperature))''')
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"[LLMService] Failed to init cache db: {e}")

init_db()

def get_cached_response(prompt: str, temperature: float) -> str:
    try:
        conn = sqlite3.connect(DB_FILE)
        c = conn.cursor()
        c.execute("SELECT response FROM cache WHERE prompt=? AND temperature=?", (prompt, temperature))
        row = c.fetchone()
        conn.close()
        if row:
            return row[0]
    except Exception as e:
        print(f"[LLMService] Failed to read from cache db: {e}")
    return None

def set_cached_response(prompt: str, temperature: float, response: str):
    try:
        conn = sqlite3.connect(DB_FILE)
        c = conn.cursor()
        c.execute("INSERT OR REPLACE INTO cache (prompt, temperature, response) VALUES (?, ?, ?)", 
                  (prompt, temperature, response))
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"[LLMService] Failed to write to cache db: {e}")

def call_llm(prompt: str, temperature: float = 0.0) -> str:
    """Invoke Semcat LLM first; if offline, fall back directly to Gemini API."""
    global _SEMCAT_OFFLINE
    
    # Check cache first for deterministic calls
    # cached_val = get_cached_response(prompt, temperature)
    # if cached_val is not None:
    #     print(f"[LLMService] Cache hit for identical prompt (prompt hash: {hash(prompt)})")
    #     return cached_val
        
    result = "__LLM_OFFLINE__"
    
    if not _SEMCAT_OFFLINE:
        try:
            # Snappy connection pre-check
            api_url = os.getenv("SEMCAT_API_URL", "").strip().rstrip("/")
            if api_url:
                if api_url.endswith("/semcat"):
                    api_url = f"{api_url}/get_answer"
                with httpx.Client(timeout=1.5) as client:
                    client.post(api_url, json={"mdl_name": "Professional", "messages": [], "temperature": 0.0, "max_tokens": 1})
            
            llm = SemcatChatModel(temperature=temperature)
            resp = llm._generate([HumanMessage(content=prompt)])
            content = resp.generations[0].message.content.strip()
            if content not in ("__LLM_OFFLINE__", "NO_SQL") and content:
                result = content
        except Exception as e:
            print(f"[MIRA] Semcat LLM is offline or timed out: {e}. Switching to Gemini fallback.")
            _SEMCAT_OFFLINE = True

    # Try Gemini/OpenRouter REST API fallback
    if result == "__LLM_OFFLINE__":
        api_key = os.getenv("GEMINI_API_KEY", "").strip()
        if api_key and api_key != "your_gemini_api_key_here":
            try:
                with httpx.Client(timeout=20.0) as client:
                    if api_key.startswith("sk-or-v1-"):
                        # OpenRouter API (Grok AI)
                        url = "https://openrouter.ai/api/v1/chat/completions"
                        headers = {
                            "Authorization": f"Bearer {api_key}",
                            "Content-Type": "application/json"
                        }
                        models_to_try = ["x-ai/grok-beta", "x-ai/grok-2-1212", "google/gemini-2.5-flash"]
                        for model_name in models_to_try:
                            payload = {
                                "model": model_name,
                                "messages": [{"role": "user", "content": prompt}],
                                "temperature": temperature,
                            }
                            try:
                                response = client.post(url, json=payload, headers=headers)
                                if response.status_code == 200:
                                    data = response.json()
                                    result = data["choices"][0]["message"]["content"].strip()
                                    break
                                elif response.status_code == 404:
                                    print(f"[MIRA] OpenRouter: model '{model_name}' not found (404). Retrying with next model...")
                                else:
                                    print(f"[MIRA] OpenRouter: model '{model_name}' failed with status {response.status_code}: {response.text}")
                            except Exception as inner_ex:
                                print(f"[MIRA] OpenRouter model '{model_name}' request failed: {inner_ex}")
                    elif api_key.startswith("csk-"):
                        # Cerebras AI API
                        url = "https://api.cerebras.ai/v1/chat/completions"
                        headers = {
                            "Authorization": f"Bearer {api_key}",
                            "Content-Type": "application/json"
                        }
                        models_to_try = ["gpt-oss-120b", "gemma-4-31b", "zai-glm-4.7"]
                        for model_name in models_to_try:
                            payload = {
                                "model": model_name,
                                "messages": [{"role": "user", "content": prompt}],
                                "temperature": temperature,
                            }
                            try:
                                response = client.post(url, json=payload, headers=headers)
                                if response.status_code == 200:
                                    data = response.json()
                                    result = data["choices"][0]["message"]["content"].strip()
                                    break
                                elif response.status_code == 404:
                                    print(f"[MIRA] Cerebras: model '{model_name}' not found (404). Retrying with next model...")
                                else:
                                    print(f"[MIRA] Cerebras: model '{model_name}' failed with status {response.status_code}: {response.text}")
                            except Exception as inner_ex:
                                print(f"[MIRA] Cerebras model '{model_name}' request failed: {inner_ex}")
                    else:
                        # Google Gemini API
                        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
                        payload = {
                            "contents": [{"parts": [{"text": prompt}]}],
                            "generationConfig": {
                                "temperature": temperature,
                                "maxOutputTokens": 2048,
                            }
                        }
                        response = client.post(url, json=payload)
                        if response.status_code == 200:
                            data = response.json()
                            result = data["candidates"][0]["content"]["parts"][0]["text"].strip()
                        elif response.status_code == 429:
                            print(f"[MIRA] Gemini rate limit exceeded (429): {response.text}")
                        else:
                            print(f"[MIRA] Gemini API returned status {response.status_code}: {response.text}")
            except Exception as ex:
                print(f"[MIRA] Fallback API failed: {ex}")
                
    # Cache result if it is valid
    # if result != "__LLM_OFFLINE__":
    #     set_cached_response(prompt, temperature, result)
        
    return result

def parse_json_from_llm(raw_response: str) -> dict:
    """Helper to parse JSON from LLM responses by cleaning markdown codeblocks."""
    if not raw_response or raw_response == "__LLM_OFFLINE__":
        return {}
    
    clean_resp = raw_response.strip()
    if clean_resp.startswith("```json"):
        clean_resp = clean_resp[7:]
    elif clean_resp.startswith("```"):
        clean_resp = clean_resp[3:]
        
    if clean_resp.endswith("```"):
        clean_resp = clean_resp[:-3]
        
    clean_resp = clean_resp.strip()
        
    try:
        return json.loads(clean_resp)
    except json.JSONDecodeError:
        start = clean_resp.find('{')
        end = clean_resp.rfind('}')
        if start != -1 and end != -1:
            try:
                return json.loads(clean_resp[start:end+1])
            except json.JSONDecodeError:
                pass
        print(f"[LLMService] Failed to parse JSON: {raw_response}")
        return {}

import asyncio
from typing import AsyncGenerator

async def acall_llm_stream(prompt: str, temperature: float = 0.0) -> AsyncGenerator[str, None]:
    result = "__LLM_OFFLINE__"
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    
    if api_key and api_key != "your_gemini_api_key_here":
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                if api_key.startswith("sk-or-v1-"):
                    url = "https://openrouter.ai/api/v1/chat/completions"
                    headers = {
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json"
                    }
                    payload = {
                        "model": "google/gemini-2.5-flash",
                        "messages": [{"role": "user", "content": prompt}],
                        "temperature": temperature,
                        "stream": True
                    }
                    
                    async with client.stream("POST", url, json=payload, headers=headers) as response:
                        if response.status_code == 200:
                            async for chunk in response.aiter_lines():
                                if chunk.startswith("data: "):
                                    data_str = chunk[6:].strip()
                                    if data_str == "[DONE]":
                                        break
                                    if not data_str:
                                        continue
                                    try:
                                        data = json.loads(data_str)
                                        token = data["choices"][0].get("delta", {}).get("content", "")
                                        if token:
                                            yield token
                                    except json.JSONDecodeError:
                                        pass
                        else:
                            yield f"Error: {response.status_code}"
                            
                else:
                    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse&key={api_key}"
                    payload = {
                        "contents": [{"parts": [{"text": prompt}]}],
                        "generationConfig": {
                            "temperature": temperature,
                            "maxOutputTokens": 2048,
                        }
                    }
                    
                    async with client.stream("POST", url, json=payload) as response:
                        if response.status_code == 200:
                            async for chunk in response.aiter_lines():
                                if chunk.startswith("data: "):
                                    data_str = chunk[6:].strip()
                                    if not data_str:
                                        continue
                                    try:
                                        data = json.loads(data_str)
                                        token = data["candidates"][0]["content"]["parts"][0]["text"]
                                        if token:
                                            yield token
                                    except (json.JSONDecodeError, KeyError, IndexError):
                                        pass
                        else:
                            yield f"Error: {response.status_code}"
        except Exception as ex:
            yield f"Stream failed: {ex}"
    else:
        yield "API key not found. Running in offline mode."

async def acall_llm(prompt: str, temperature: float = 0.0) -> str:
    full_text = ""
    async for token in acall_llm_stream(prompt, temperature):
        full_text += token
    return full_text

def call_llm_stream(prompt: str, temperature: float = 0.0):
    result = "__LLM_OFFLINE__"
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    
    if api_key and api_key != "your_gemini_api_key_here":
        try:
            import requests
            if api_key.startswith("sk-or-v1-"):
                url = "https://openrouter.ai/api/v1/chat/completions"
                headers = {
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                }
                payload = {
                    "model": "google/gemini-2.5-flash",
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": temperature,
                    "stream": True
                }
                
                with requests.post(url, json=payload, headers=headers, stream=True, timeout=30.0) as response:
                    if response.status_code == 200:
                        for chunk in response.iter_lines():
                            if chunk:
                                data_str = chunk.decode('utf-8')
                                if data_str.startswith("data: "):
                                    data_str = data_str[6:].strip()
                                    if data_str == "[DONE]":
                                        break
                                    if not data_str:
                                        continue
                                    try:
                                        import json
                                        data = json.loads(data_str)
                                        token = data["choices"][0].get("delta", {}).get("content", "")
                                        if token:
                                            yield token
                                    except json.JSONDecodeError:
                                        pass
            else:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse&key={api_key}"
                payload = {
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {
                        "temperature": temperature,
                        "maxOutputTokens": 2048,
                    }
                }
                
                with requests.post(url, json=payload, stream=True, timeout=30.0) as response:
                    if response.status_code == 200:
                        for chunk in response.iter_lines():
                            if chunk:
                                data_str = chunk.decode('utf-8')
                                if data_str.startswith("data: "):
                                    data_str = data_str[6:].strip()
                                    if not data_str:
                                        continue
                                    try:
                                        import json
                                        data = json.loads(data_str)
                                        token = data["candidates"][0]["content"]["parts"][0]["text"]
                                        if token:
                                            yield token
                                    except (json.JSONDecodeError, KeyError, IndexError):
                                        pass
        except Exception as ex:
            yield f"Stream failed: {ex}"
    else:
        yield "API key not found. Running in offline mode."
