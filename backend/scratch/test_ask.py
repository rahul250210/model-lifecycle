import requests
import json
import sys

def ask(msg):
    print(f"\nAsking: {msg}")
    try:
        r = requests.post("http://127.0.0.1:8000/chatbot/ask", json={
            "message": msg,
            "context": []
        }, timeout=15)
        print(f"Status code: {r.status_code}")
        print("Response:")
        print(json.dumps(r.json(), indent=2))
    except Exception as e:
        print("Error:", e)

def main():
    # Comparison query (version vs version for R2+1D)
    ask("Compare version 1 and version 2 of R2+1D")

if __name__ == "__main__":
    main()
