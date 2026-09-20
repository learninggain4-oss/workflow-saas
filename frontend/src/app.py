import reflex as rx
import httpx
import json
import base64
import asyncio
import websockets
from datetime import datetime, timedelta

# --- Constants ---
AVAILABLE_LABELS = [
    {"name": "Bug", "cls": "bg-red-100 text-red-700 border-red-200"},
    {"name": "Feature", "cls": "bg-blue-100 text-blue-700 border-blue-200"},
    {"name": "Design", "cls": "bg-purple-100 text-purple-700 border-purple-200"},
    {"name": "Backend", "cls": "bg-orange-100 text-orange-700 border-orange-200"},
    {"name": "Frontend", "cls": "bg-cyan-100 text-cyan-700 border-cyan-200"},
    {"name": "Urgent", "cls": "bg-yellow-100 text-yellow-800 border-yellow-200"},
]

def get_label_cls(name: str) -> str:
    for label in AVAILABLE_LABELS:
        if label["name"] == name:
            return label["cls"]
    return "bg-gray-100 text-gray-600 border-gray-200"

# --- State Management (React useState & useEffect equivalents) ---
class AppState(rx.State):
    # Local Storage
    token: str = rx.LocalStorage(name="token", default_value="")
    dark_mode: bool = rx.LocalStorage(name="darkMode", default_value=False)

    # Auth & User
    user_data: dict = {}
    email: str = ""
    password: str = ""
    name: str = ""
    is_register: bool = False

    # Tasks
    tasks_list: list[dict] = []
    title: str = ""
    search: str = ""
    filter_prio: str = "all"
    filter_label: str = "all"
    editing: dict = {}

    # Boards
    boards_list: list[dict] = []
    selected_board: str = ""
    new_board_name: str = ""
    invite_email: str = ""
    invite_role: str = "member"
    rename_value: str = ""

    # Details & Extra features
    task_comments: list[dict] = []
    subtasks_list: list[dict] = []
    new_subtask: str = ""
    new_comment: str = ""
    activities: list[dict] = []
    board_members: list[dict] = []
    uploading: bool = False
    notifications: list[dict] = []
    show_notif: bool = False
    view_mode: str = "board"
    cal_date_str: str = str(datetime.now().date())

    # --- Computed Properties (React useMemo equivalents) ---
    @rx.var
    def current_email(self) -> str:
        if not self.token: return ""
        try:
            payload = self.token.split('.')[1]
            padded = payload + "=" * ((4 - len(payload) % 4) % 4)
            return json.loads(base64.b64decode(padded)).get("sub", "")
        except: return ""

    @rx.var
    def my_role(self) -> str:
        if not self.selected_board or not self.board_members: return "member"
        for member in self.board_members:
            if member.get("email") == self.current_email:
                return member.get("role", "member")
        return "member"

    @rx.var
    def can_edit(self) -> bool:
        return self.my_role in ["admin", "member"]

    @rx.var
    def filtered_tasks(self) -> list[dict]:
        res = []
        for t in self.tasks_list:
            match_search = self.search.lower() in t.get("title", "").lower() or self.search.lower() in t.get("description", "").lower()
            match_prio = self.filter_prio == "all" or t.get("priority") == self.filter_prio
            match_label = self.filter_label == "all" or self.filter_label in (t.get("labels") or "").split(",")
            if match_search and match_prio and match_label:
                res.append(t)
        return res

    @rx.var
    def unread_notifs_count(self) -> int:
        return len([n for n in self.notifications if not n.get("is_read")])

    # --- API Handlers (React Functions) ---
    async def fetch_initial_data(self):
        if not self.token: return
        async with httpx.AsyncClient() as client:
            headers = {"Authorization": f"Bearer {self.token}"}
            try:
                # Mock endpoints mapping to your JS API
                u_res = await client.get("API_URL/me", headers=headers)
                self.user_data = u_res.json()
                b_res = await client.get("API_URL/boards", headers=headers)
                self.boards_list = b_res.json()
                if self.boards_list and not self.selected_board:
                    self.selected_board = str(self.boards_list[0]["id"])
                n_res = await client.get("API_URL/notifs", headers=headers)
                self.notifications = n_res.json()
            except: pass

    async def fetch_board_data(self):
        if not self.selected_board: return
        async with httpx.AsyncClient() as client:
            try:
                t_res = await client.get(f"API_URL/tasks/{self.selected_board}")
                self.tasks_list = t_res.json()
                a_res = await client.get(f"API_URL/boards/{self.selected_board}/activities")
                self.activities = a_res.json()
                m_res = await client.get(f"API_URL/boards/{self.selected_board}/members")
                self.board_members = m_res.json()
                
                for b in self.boards_list:
                    if str(b["id"]) == self.selected_board:
                        self.rename_value = b["name"]
            except: pass

    async def fetch_task_details(self, task_id: str):
        if not task_id: return
        async with httpx.AsyncClient() as client:
            try:
                c_res = await client.get(f"API_URL/comments/{task_id}")
                self.task_comments = c_res.json()
                s_res = await client.get(f"API_URL/subtasks/{task_id}")
                self.subtasks_list = s_res.json()
            except: pass

    # Lifecycle Hooks (React useEffect equivalents)
    def on_load(self):
        return AppState.fetch_initial_data

    @rx.background
    async def websocket_listener(self):
        # Maps to the useEffect WebSocket logic
        if not self.selected_board or not self.token: return
        try:
            async with websockets.connect(f"ws://localhost:8000/ws/{self.selected_board}") as ws:
                async for message in ws:
                    data = json.loads(message)
                    if data.get("type") == "update":
                        async with self:
                            await self.fetch_board_data()
                            # Re-fetch task details if modal is open
                            if self.editing:
                                await self.fetch_task_details(self.editing.get("id"))
        except: pass

    # Auth Actions
    async def handle_login(self):
        async with httpx.AsyncClient() as client:
            try:
                res = await client.post("API_URL/login", data={"username": self.email, "password": self.password})
                self.token = res.json()["access_token"]
                return AppState.fetch_initial_data
            except:
                return rx.window_alert("Login failed - check email/password")

    async def handle_register(self):
        async with httpx.AsyncClient() as client:
            try:
                await client.post("API_URL/register", json={"email": self.email, "password": self.password, "name": self.name})
                self.is_register = False
                return rx.window_alert("Registered! Now login")
            except:
                return rx.window_alert("Register failed")

    def toggle_mode(self):
        self.dark_mode = not self.dark_mode

    def logout(self):
        self.token = ""
        self.user_data = {}

    # Board Actions
    async def create_board(self):
        if not self.new_board_name.strip(): return
        # Mocking API post
        self.new_board_name = ""
        await self.fetch_initial_data()

    async def rename_board(self):
        if not self.rename_value.strip() or not self.selected_board or self.my_role != 'admin': return
        await self.fetch_initial_data()

    async def delete_board(self):
        if not self.selected_board or self.my_role != 'admin': return
        self.selected_board = ""
        await self.fetch_initial_data()

    # Task Actions
    async def add_task(self):
        if not self.can_edit: return rx.window_alert("Viewers cannot add tasks")
        if not self.title.strip() or not self.selected_board: return rx.window_alert("Select board and enter title")
        # Logic for auto-priority based on keywords
        prio = "high" if "urgent" in self.title.lower() or "bug" in self.title.lower() else "medium"
        self.title = ""
        await self.fetch_board_data()

    async def on_drag_end(self, task_id: str, new_status: str):
        if not self.can_edit: return
        for t in self.tasks_list:
            if str(t.get("id")) == str(task_id):
                t["status"] = new_status
        # Mock API Update
        await self.fetch_board_data()

    def open_edit_modal(self, task: dict):
        self.editing = task
        return AppState.fetch_task_details(task.get("id"))

    async def save_edit(self):
        if not self.can_edit: return rx.window_alert("Viewers cannot edit")
        self.editing = {}
        await self.fetch_board_data()

    async def del_task(self, task_id: str):
        if not self.can_edit: return
        self.editing = {}
        await self.fetch_board_data()

    # Subtasks & Comments
    async def add_subtask(self):
        if not self.can_edit or not self.new_subtask.strip() or not self.editing: return
        self.new_subtask = ""
        await self.fetch_task_details(self.editing.get("id"))

    async def toggle_subtask(self, subtask_id: str):
        if not self.can_edit: return
        await self.fetch_task_details(self.editing.get("id"))

    async def add_comment(self):
        if not self.new_comment.strip() or not self.editing: return
        self.new_comment = ""
        await self.fetch_task_details(self.editing.get("id"))

    async def handle_file_upload(self, files: list[rx.UploadFile]):
        if not self.can_edit: return
        self.uploading = True
        # Read file logic and push to S3/API
        self.uploading = False

    def toggle_label(self, label: str):
        if not self.can_edit or not self.editing: return
        curr_labels = (self.editing.get("labels", "") or "").split(",")
        curr_labels = [l for l in curr_labels if l]
        if label in curr_labels:
            curr_labels.remove(label)
        else:
            curr_labels.append(label)
        self.editing["labels"] = ",".join(curr_labels)

# --- UI Components (React JSX equivalents) ---
def login_screen() -> rx.Component:
    return rx.center(
        rx.box(
            rx.heading("WorkFlow SaaS 🚀", size="lg", class_name="font-bold mb-1"),
            rx.text("Team Task Management + Email", class_name="text-xs text-gray-500 mb-5"),
            rx.cond(AppState.is_register, 
                rx.input(placeholder="Name", on_change=AppState.set_name, class_name="border w-full p-2.5 mb-3 rounded-lg text-sm bg-white border-gray-300")
            ),
            rx.input(placeholder="Email", on_change=AppState.set_email, class_name="border w-full p-2.5 mb-3 rounded-lg text-sm bg-white border-gray-300"),
            rx.input(placeholder="Password", type="password", on_change=AppState.set_password, class_name="border w-full p-2.5 mb-4 rounded-lg text-sm bg-white border-gray-300"),
            rx.button(rx.cond(AppState.is_register, "Register", "Login"), on_click=rx.cond(AppState.is_register, AppState.handle_register, AppState.handle_login), class_name="bg-black text-white w-full p-2.5 rounded-lg text-sm font-bold"),
            rx.button(rx.cond(AppState.is_register, "Have account? Login", "New? Create account"), on_click=AppState.set_is_register(~AppState.is_register), class_name="bg-transparent text-sm text-gray-500 mt-4 w-full hover:text-black"),
            class_name="p-8 rounded-xl border w-full max-w-md shadow-lg bg-white"
        ),
        class_name="min-h-screen bg-[#f8fafc] text-gray-900"
    )

def sidebar() -> rx.Component:
    return rx.box(
        rx.hstack(
            rx.heading("WorkFlow 🚀", size="md", class_name="font-bold"),
            rx.button(rx.cond(AppState.dark_mode, "☀", "🌙"), on_click=AppState.toggle_mode, class_name="border px-3 py-1.5 rounded-lg text-sm bg-black text-white"),
            class_name="justify-between items-center mb-6 w-full"
        ),
        rx.text(f"Role: {AppState.my_role}", class_name="text-xs text-blue-500 font-bold mb-4 uppercase"),
        rx.heading("Your Boards", class_name="font-bold text-xs uppercase tracking-wider text-gray-500 mb-3"),
        rx.vstack(
            rx.foreach(
                AppState.boards_list,
                lambda b: rx.button(f"📋 {b['name']}", on_click=AppState.set_selected_board(b["id"]), class_name="w-full text-left p-2.5 rounded-lg text-sm border bg-white truncate")
            ),
            class_name="space-y-2 mb-4 w-full max-h-48 overflow-auto"
        ),
        rx.hstack(
            rx.input(placeholder="New board", value=AppState.new_board_name, on_change=AppState.set_new_board_name, class_name="border p-2 rounded-lg text-sm flex-1 bg-white"),
            rx.button("+", on_click=AppState.create_board, class_name="bg-black text-white px-3 rounded-lg text-sm font-bold"),
            class_name="gap-2 mb-6 w-full"
        ),
        rx.button("Logout", on_click=AppState.logout, class_name="mt-auto text-xs border p-2.5 rounded-lg font-bold hover:bg-red-50 hover:text-red-600 bg-white w-full"),
        class_name="w-64 min-w-[16rem] border-r p-5 flex flex-col h-screen sticky top-0 overflow-y-auto bg-white"
    )

def main_board_view() -> rx.Component:
    return rx.box(
        rx.cond(AppState.can_edit,
            rx.hstack(
                rx.input(placeholder="New task...", value=AppState.title, on_change=AppState.set_title, class_name="border px-4 py-2.5 w-full max-w-2xl rounded-lg text-sm bg-white"),
                rx.button("Add Task", on_click=AppState.add_task, class_name="bg-black text-white px-6 rounded-lg text-sm font-bold"),
                class_name="gap-3 mb-6 w-full"
            )
        ),
        # Kanban Columns mapping Droppable & Draggable
        rx.grid(
            rx.foreach(
                ["todo", "doing", "done"],
                lambda s: rx.box(
                    rx.heading(s, class_name="font-bold uppercase text-sm border-b pb-3 mb-3"),
                    rx.foreach(
                        AppState.filtered_tasks,
                        lambda t: rx.cond(t["status"] == s,
                            rx.box(
                                rx.text(t["title"], class_name="font-medium text-sm"),
                                class_name="p-3 rounded-xl mb-3 border cursor-pointer bg-[#f1f5f9]",
                                on_click=AppState.open_edit_modal(t)
                            )
                        )
                    ),
                    class_name="rounded-xl border p-4 min-h-[200px] shadow-sm bg-white"
                )
            ),
            class_name="grid-cols-1 md:grid-cols-3 gap-6"
        )
    )

def main_content() -> rx.Component:
    return rx.box(
        rx.hstack(
            rx.heading("Select board", class_name="text-2xl font-bold truncate"),
            rx.hstack(
                rx.foreach(["dashboard", "board", "timeline", "calendar"],
                    lambda m: rx.button(m, on_click=AppState.set_view_mode(m), class_name="px-3 py-1.5 rounded-md text-sm font-bold capitalize")
                ),
                rx.button(f"🔔 {AppState.unread_notifs_count}", on_click=AppState.set_show_notif(~AppState.show_notif), class_name="border px-4 py-2.5 rounded-lg text-sm font-bold bg-white"),
                class_name="gap-2 items-center"
            ),
            class_name="justify-between items-center mb-6 w-full"
        ),
        rx.cond(AppState.view_mode == "board", main_board_view()),
        class_name="flex-1 p-6 lg:p-8 overflow-auto w-full"
    )

def edit_task_modal() -> rx.Component:
    return rx.cond(
        AppState.editing != {},
        rx.box(
            rx.box(
                rx.hstack(
                    rx.heading("Edit Task", class_name="font-bold text-lg"),
                    rx.button("✕", on_click=AppState.set_editing({}), class_name="w-8 h-8 rounded-full border"),
                    class_name="justify-between items-center mb-4"
                ),
                rx.grid(
                    rx.box(
                        rx.input(value=AppState.editing["title"], on_change=lambda val: AppState.set_editing(AppState.editing | {"title": val}), class_name="border w-full p-2.5 mb-3 rounded-xl text-sm"),
                        rx.text_area(value=AppState.editing["description"], on_change=lambda val: AppState.set_editing(AppState.editing | {"description": val}), class_name="border w-full p-2.5 mb-3 rounded-xl h-24 text-sm"),
                        rx.box(
                            rx.heading("Checklist", class_name="text-xs font-bold uppercase mb-2"),
                            rx.input(placeholder="Add item", value=AppState.new_subtask, on_change=AppState.set_new_subtask, class_name="border p-2 rounded-lg text-sm w-full mt-2"),
                            rx.button("Add Subtask", on_click=AppState.add_subtask, class_name="mt-2 text-xs bg-gray-200 p-2 rounded"),
                            class_name="border rounded-xl p-3 mb-3 bg-gray-50"
                        ),
                    ),
                    rx.box(
                        rx.select(["todo", "doing", "done"], value=AppState.editing["status"], on_change=lambda val: AppState.set_editing(AppState.editing | {"status": val}), class_name="border w-full p-2.5 rounded-xl text-sm mb-3"),
                        # Labels
                        rx.hstack(
                            rx.foreach(AVAILABLE_LABELS, lambda l: rx.button(l["name"], on_click=lambda: AppState.toggle_label(l["name"]), class_name="text-xs px-3 py-1.5 rounded-full border bg-gray-100")),
                            class_name="flex-wrap gap-2 mb-3"
                        )
                    ),
                    class_name="grid-cols-1 md:grid-cols-2 gap-6"
                ),
                rx.hstack(
                    rx.button("Save", on_click=AppState.save_edit, class_name="bg-black text-white flex-1 p-3 rounded-xl text-sm font-bold"),
                    rx.button("Delete", on_click=AppState.del_task(AppState.editing["id"]), class_name="bg-red-50 text-red-600 flex-1 p-3 rounded-xl border font-bold"),
                    class_name="gap-3 mt-4 border-t pt-4 w-full"
                ),
                class_name="rounded-2xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl border bg-white"
            ),
            class_name="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 w-full"
        )
    )

def index() -> rx.Component:
    return rx.cond(
        AppState.token == "",
        login_screen(),
        rx.hstack(
            sidebar(),
            main_content(),
            edit_task_modal(),
            class_name="min-h-screen bg-[#f8fafc] text-gray-900 flex w-full"
        )
    )

app = rx.App()
app.add_page(index, on_load=AppState.on_load)