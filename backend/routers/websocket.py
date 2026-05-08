# backend/routers/websocket.py
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
import numpy as np, cv2, base64, json, time, asyncio, traceback
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
    last_save = time.time()
    seen_in_session: set[str] = set()  # deduplicate log entries across batches

    # Pre-load face database; refresh periodically
    face_db = retrive_data("academy:register")
    last_db_refresh = time.time()

    try:
        while True:
            # Receive a base64-encoded JPEG frame from the browser
            data = await ws.receive_text()
            msg = json.loads(data)
            frame_b64 = msg.get("frame")
            if not frame_b64:
                await ws.send_text(json.dumps({"error": "No frame data received"}))
                continue

            img_b64 = frame_b64.split(",")[-1]  # strip "data:image/jpeg;base64,"
            img_bytes = base64.b64decode(img_b64)
            img_array = np.frombuffer(img_bytes, dtype=np.uint8)
            frame = cv2.imdecode(img_array, cv2.IMREAD_COLOR)

            if frame is None:
                await ws.send_text(json.dumps({"error": "Could not decode frame"}))
                continue

            # Refresh face database every 60 seconds to pick up new registrations
            if time.time() - last_db_refresh > 60:
                face_db = retrive_data("academy:register")
                last_db_refresh = time.time()

            # Run face recognition in a thread to avoid blocking the async event loop
            loop = asyncio.get_running_loop()
            result_frame, recognized_names = await loop.run_in_executor(
                None,
                lambda f=frame: predictor.face_prediction(
                    f, face_db, "facial_feature", ["Name", "Role"], thresh=0.5
                )
            )

            # Deduplicate: only add new names to predictor logs
            new_names = [n for n in recognized_names if n not in seen_in_session]
            for name in new_names:
                seen_in_session.add(name)

            # Save logs every 30 seconds
            if time.time() - last_save > 30:
                await loop.run_in_executor(None, predictor.save_logs_redis)
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
    except Exception as e:
        print(f"ERROR in /ws/recognize: {e}")
        traceback.print_exc()
        predictor.save_logs_redis()
        try:
            await ws.close(code=1011)
        except Exception:
            pass


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

            # Run in executor to avoid blocking the event loop
            loop = asyncio.get_running_loop()
            _, count = await loop.run_in_executor(
                None,
                lambda f=frame: reg.get_embedding(f, max_samples=sample_target)
            )
            # Store ref so /submit can access it
            from routers.register import form_store
            form_store[session_id] = reg
            await ws.send_text(json.dumps({"sample_count": count, "sample_target": sample_target}))
    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"ERROR in /ws/register: {e}")
        traceback.print_exc()
        try:
            await ws.close(code=1011)
        except Exception:
            pass