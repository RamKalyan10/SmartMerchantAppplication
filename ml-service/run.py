import sys
import os
import uvicorn

# Ensure the app directory is on the python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    print(f"Starting Smart Merchant ML Service on http://127.0.0.1:{port}")
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=False)
