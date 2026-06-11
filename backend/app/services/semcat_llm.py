import os
import httpx
import requests
from typing import Any, List, Optional
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import BaseMessage, AIMessage, HumanMessage, SystemMessage
from langchain_core.outputs import ChatResult, ChatGeneration
from langchain_core.callbacks.manager import CallbackManagerForLLMRun
from dotenv import load_dotenv

load_dotenv()

class SemcatChatModel(BaseChatModel):
    """
    A custom Langchain ChatModel wrapper for the proprietary 'Semcat' LLM.
    If SEMCAT_API_URL is not set, it gracefully falls back to the configured
    Google Gemini API key via ChatGoogleGenerativeAI.
    """
    
    model_name: str = "Professional"
    api_url: Optional[str] = None
    api_key: Optional[str] = None
    temperature: float = 0.2
    max_tokens: int = 4096
    
    def __init__(self, **kwargs: Any):
        super().__init__(**kwargs)
        self.api_url = os.getenv("SEMCAT_API_URL", "")
        self.api_key = os.getenv("SEMCAT_API_KEY", "")
        
    @property
    def _llm_type(self) -> str:
        return "semcat-chat"
        
    def _generate(
        self,
        messages: List[BaseMessage],
        stop: Optional[List[str]] = None,
        run_manager: Optional[CallbackManagerForLLMRun] = None,
        **kwargs: Any,
    ) -> ChatResult:
        # Check if Semcat URL is configured.
        if not self.api_url or not self.api_url.strip():
            raise ValueError("SEMCAT_API_URL is not configured in backend/.env.")
            
        # If SEMCAT is configured, we make the HTTP API call
        # 1. Convert LangChain messages to standard JSON message payload
        payload_messages = []
        for msg in messages:
            if isinstance(msg, SystemMessage):
                role = "system"
            elif isinstance(msg, AIMessage):
                role = "assistant"
            else:
                role = "user"
            payload_messages.append({"role": role, "content": msg.content})
            
        headers = {
            "Content-Type": "application/json"
        }
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
            
        payload = {
            "mdl_name": self.model_name,
            "messages": payload_messages,
            "temperature": kwargs.get("temperature", self.temperature),
            "max_tokens": kwargs.get("max_tokens", self.max_tokens)
        }
        if stop:
            payload["stop"] = stop
        
        try:
            content = ""
            # Clean URL and auto-append /get_answer if URL ends with /semcat
            api_url = self.api_url.strip().rstrip("/")
            if api_url.endswith("/semcat"):
                api_url = f"{api_url}/get_answer"

            #print(f"DEBUG SEMCAT CALL: Method=POST, URL='{api_url}'")
            #print(f"DEBUG SEMCAT HEADERS: {headers}")
            #print(f"DEBUG SEMCAT PAYLOAD: {payload}")

            response = requests.post(api_url, json=payload, headers=headers, timeout=60.0)

            # Approach 2: Self-healing redirect retry
            # If a 405 was caused by Nginx redirecting POST→GET, retry directly to the final URL
            if response.status_code == 405 and response.history:
                final_url = response.url
                print(f"DEBUG SEMCAT: Redirect detected. Retrying POST directly to final URL: '{final_url}'")
                response = requests.post(final_url, json=payload, headers=headers, timeout=60.0)

            # Approach 3: Trailing slash retry
            # If still 405, try appending a trailing slash (some FastAPI routers require it)
            if response.status_code == 405 and not api_url.endswith("/"):
                retry_url = api_url + "/"
                print(f"DEBUG SEMCAT: Got 405. Retrying POST with trailing slash: '{retry_url}'")
                response = requests.post(retry_url, json=payload, headers=headers, timeout=60.0)

            response.raise_for_status()
            
            # Robust response parsing
            resp_text = response.text.strip()
            try:
                # Check if response is JSON
                resp_json = response.json()
                if isinstance(resp_json, dict):
                    if "result" in resp_json:
                        content = str(resp_json["result"])
                    elif "answer" in resp_json:
                        content = str(resp_json["answer"])
                    elif "response" in resp_json:
                        content = str(resp_json["response"])
                    else:
                        content = resp_text
                else:
                    content = resp_text
            except Exception:
                # If not JSON, use raw text (might be SSE stream or plain text)
                if "data:" in resp_text:
                    lines = resp_text.splitlines()
                    parsed_lines = []
                    for line in lines:
                        line = line.strip()
                        if line.startswith("data:"):
                            parsed_lines.append(line[5:].strip())
                        elif line:
                            parsed_lines.append(line)
                    content = "".join(parsed_lines)
                else:
                    content = resp_text
            
            # Local truncation fallback for stop sequences (in case the API ignores the parameter)
            if stop:
                for s in stop:
                    idx = content.find(s)
                    if idx != -1:
                        content = content[:idx]
                            
            # If we received nothing, fall back to safe error warning
            if not content.strip():
                raise ValueError("Received empty response from Semcat API.")
                
            # Check for error keywords in the generated content (e.g. "something went wrong in llm server")
            content_lower = content.lower()
            error_keywords = ["something went wrong", "llm server", "please try again", "error in llm", "internal server error"]
            if any(kw in content_lower for kw in error_keywords):
                print(f"Warning: Semcat API returned error content: '{content}'. Intercepting for offline mode.")
                is_sql_prompt = any("SELECT" in str(msg.content) or "SCHEMA" in str(msg.content) for msg in messages)
                content = "NO_SQL" if is_sql_prompt else "__LLM_OFFLINE__"
                
            ai_msg = AIMessage(content=content)
            return ChatResult(generations=[ChatGeneration(message=ai_msg)])
            
        except Exception as e:
            print(f"Warning: Semcat LLM call failed with error: {e}. Returning offline fallback.")
            is_sql_prompt = any("SELECT" in str(msg.content) or "SCHEMA" in str(msg.content) for msg in messages)
            content = "NO_SQL" if is_sql_prompt else "__LLM_OFFLINE__"
            ai_msg = AIMessage(content=content)
            return ChatResult(generations=[ChatGeneration(message=ai_msg)])
