from typing import Dict, List

from fastapi import WebSocket
from starlette.websockets import WebSocketDisconnect


class EventManager:
    def __init__(self):
        self.connections: Dict[str, List[WebSocket]] = {}

    def add_connection(self, job_id: str, websocket: WebSocket):
        if job_id not in self.connections:
            self.connections[job_id] = []
        self.connections[job_id].append(websocket)

    def disconnect(self, job_id: str, websocket: WebSocket):
        self.connections[job_id].remove(websocket)

    async def send_message(self, job_id: str, message_type: str, message: str):
        if job_id in self.connections:
            dead_connections = []
            for websocket in self.connections[job_id]:
                try:
                    await websocket.send_json(message)
                    if message_type == "completion":
                        await websocket.close()
                except WebSocketDisconnect:
                    dead_connections.append(websocket)

            # Clean up dead connections
            for dead_connection in dead_connections:
                self.connections[job_id].remove(dead_connection)
