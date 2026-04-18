from pathlib import Path
import sys


# Allow running `uvicorn app.main:app --reload` from inside the `backend` folder
# by adding the project root to the import path.
PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.main import app  # noqa: E402
