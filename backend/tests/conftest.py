import os
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))

os.environ["DATABASE_URL"] = "sqlite+pysqlite:///:memory:"
os.environ["CI_GATE_TOKEN"] = "test-ci-gate-token"
os.environ["GEMINI_API_KEY"] = "test-api-key"