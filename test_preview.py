from fastapi.testclient import TestClient
from src.api import app

client = TestClient(app)
with open('data/Выгрузка по выданным субсидиям 2025 год (обезлич).xlsx', 'rb') as f:
    res = client.post('/api/upload/preview', files={'file': ('file.xlsx', f, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')})
    print("STATUS:", res.status_code)
    text = res.text
    print("RESPONSE:", text[:200] if len(text) > 200 else text)
