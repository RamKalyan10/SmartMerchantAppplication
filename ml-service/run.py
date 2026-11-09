"""
Entry point to run the Smart Merchant Machine Learning Service on Port 8000.
"""

import os
import sys
import uvicorn

if __name__ == "__main__":
    port = int(os.environ.get("PORT", os.environ.get("ML_PORT", 8000)))
    print(f"[*] Starting Smart Merchant ML Service on port {port}...")
    
    # Ensure ml-service root is on sys.path
    cur_dir = os.path.dirname(os.path.abspath(__file__))
    if cur_dir not in sys.path:
        sys.path.insert(0, cur_dir)
    uvicorn.run("api.main:app", host="0.0.0.0", port=port, reload=True)
