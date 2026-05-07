# IOGamesWeb Backend

Backend بسيط مبني بـ FastAPI لإدارة اللاعبين والمباريات عبر WebSocket. الحالة الحالية محفوظة في الذاكرة، لذلك تختفي المباريات عند إعادة تشغيل السيرفر.

## الإعداد

من جذر المشروع انسخ ملف البيئة:

```powershell
Copy-Item .env.example .env
```

يمكن أيضا إنشاء ملف `backend/.env` إذا أردت قيما خاصة بالـ backend فقط. قيم `backend/.env` تتغلب على قيم `.env` في جذر المشروع.

## التشغيل

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python run.py
```

## متغيرات البيئة

```env
BACKEND_HOST=127.0.0.1
BACKEND_PORT=8000
BACKEND_RELOAD=true
BACKEND_LOG_LEVEL=info
BACKEND_LOG_DIR=logs
BACKEND_CORS_ORIGINS=*
BACKEND_CORS_ALLOW_CREDENTIALS=false
BACKEND_APP_TITLE=Neon Aim Arena Backend
BACKEND_APP_VERSION=0.1.0
```

في الإنتاج يفضل ضبط CORS على رابط الواجهة فقط:

```env
BACKEND_HOST=0.0.0.0
BACKEND_RELOAD=false
BACKEND_CORS_ORIGINS=https://your-frontend-domain.com
```

إذا كان مزود الاستضافة يعطيك متغير `PORT`، فإن `backend/run.py` يستطيع استخدامه تلقائيا عند عدم ضبط `BACKEND_PORT`.

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

الانضمام إلى مباراة:

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

إرسال إطلاق:

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

- هذه نسخة أولية، والحالة in-memory فقط.
- يمكن لاحقا إضافة قاعدة بيانات أو Redis، نظام غرف دائم، مصادقة، وتحسين مزامنة الحركة بين اللاعبين.
