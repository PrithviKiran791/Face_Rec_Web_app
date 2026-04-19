# backend/routers/websocket.py
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
import numpy as np, cv2, base64, json, time
from face_rec import retrive_data, RealTimePred
from auth.auth_utils import decode_token

router = APIRouter()

@router.websocket("/recognize")
async def recognize(ws: WebSocket, token: str = Query(...)):
    # Validate the short-lived ws-token before accepting the connection
    payload = decode_token(token)
    if not payload:
        await ws.close(code=1008)  # 1008 = policy violation
        return
    await ws.accept()
    predictor = RealTimePred()
    face_db = retrive_data("academy:register")
    last_save = time.time()

    try:
        while True:
            # Receive a base64-encoded JPEG frame from the browser
            data = await ws.receive_text()
            msg = json.loads(data)
            img_b64 = msg["frame"].split(",")[-1]  # strip "data:image/jpeg;base64,"
            img_bytes = base64.b64decode(img_b64)
            img_array = np.frombuffer(img_bytes, dtype=np.uint8)
            frame = cv2.imdecode(img_array, cv2.IMREAD_COLOR)

            # Run face recognition (your existing logic)
            result_frame, recognized_names = predictor.face_prediction(
                frame, face_db, "facial_feature", ["Name","Role"], thresh=0.5
            )

            # Save logs every 30 seconds
            if time.time() - last_save > 30:
                predictor.save_logs_redis()
                last_save = time.time()

            # Encode result frame back to base64 and send
            _, buffer = cv2.imencode(".jpg", result_frame, [cv2.IMWRITE_JPEG_QUALITY, 70])
            result_b64 = base64.b64encode(buffer).decode()
            await ws.send_text(json.dumps({
                "frame": f"data:image/jpeg;base64,{result_b64}",
                "names": recognized_names
            }))

    except WebSocketDisconnect:
        predictor.save_logs_redis()

@router.websocket("/register")
async def register_ws(ws: WebSocket, token: str = Query(...)):
    # Validate the short-lived ws-token before accepting the connection
    payload = decode_token(token)
    if not payload:
        await ws.close(code=1008)
        return
    await ws.accept()
    from face_rec import RegistrationForm
    sample_target = 60
    sessions: dict[str, RegistrationForm] = {}
    try:
        while True:
            data = await ws.receive_text()
            msg = json.loads(data)
            session_id = msg.get("session_id")
            frame_data = msg.get("frame")
            if not session_id or not frame_data:
                await ws.send_text(json.dumps({"sample_count": 0, "error": "missing session_id or frame"}))
                continue
            if session_id not in sessions:
                sessions[session_id] = RegistrationForm()
            reg = sessions[session_id]
            img_b64 = frame_data.split(",")[-1]
            img_bytes = base64.b64decode(img_b64)
            img_array = np.frombuffer(img_bytes, np.uint8)
            frame = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
            if frame is None:
                await ws.send_text(json.dumps({"sample_count": reg.sample_count(), "error": "invalid frame"}))
                continue

            _, count = reg.get_embedding(frame, max_samples=sample_target)
            # Store ref so /submit can access it
            from routers.register import form_store
            form_store[session_id] = reg
            await ws.send_text(json.dumps({"sample_count": count, "sample_target": sample_target}))
    except WebSocketDisconnect:
        pass