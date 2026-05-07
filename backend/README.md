# Neon Aim Arena Backend

Backend FastAPI بسيط للـ deathmatch. يدير اللاعبين والمباريات في الذاكرة ويستخدم WebSocket لبث حالة اللاعبين بين المتصلين.

تم ضبط CORS على allow all:

```python
allow_origins=["*"]
```

## التشغيل

```powershell
cd "C:\Users\AES\Desktop\New folder\backend"
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

## الروابط

```text
GET http://127.0.0.1:8000/health
GET http://127.0.0.1:8000/matches
WS  ws://127.0.0.1:8000/ws?player_name=Player
```

## رسائل WebSocket

إنشاء مباراة:

```json
{
  "type": "create_match",
  "settings": {
    "mode": "deathmatch",
    "map": "aim_arena",
    "max_players": 12
  }
}
```

الانضمام لمباراة:

```json
{
  "type": "join_match",
  "match_id": "match_xxxxxxxxxx"
}
```

تحديث حالة اللاعب:

```json
{
  "type": "player_update",
  "state": {
    "position": [0, 0, 0],
    "rotation": [0, 0],
    "velocity": [0, 0, 0],
    "grounded": true,
    "bhopChain": 0
  }
}
```

إطلاق/أكشن:

```json
{
  "type": "shoot",
  "payload": {
    "origin": [0, 1.7, 0],
    "direction": [0, 0, -1],
    "weapon": "rifle",
    "client_time": 123.45
  }
}
```

رسائل أخرى:

```json
{ "type": "list_matches" }
{ "type": "leave_match" }
{ "type": "set_ready", "ready": true }
{ "type": "start_match" }
{ "type": "ping" }
```

## ملاحظات

- هذه نسخة prototype: الحالة in-memory فقط وتختفي عند إعادة تشغيل السيرفر.
- لاحقًا يمكن إضافة Redis أو قاعدة بيانات، نظام rooms دائم، auth، وserver reconciliation للحركة.
