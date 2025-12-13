import io
import math
import os
import random
import tkinter as tk
from tkinter import font as tkfont

import requests
from PIL import Image

import webbrowser

from config import BOT_TOKEN, BOT_USERNAME, ADMIN_CHAT_ID

WIN_LINES: tuple[tuple[int, int, int], ...] = (
    (0, 1, 2),
    (3, 4, 5),
    (6, 7, 8),
    (0, 3, 6),
    (1, 4, 7),
    (2, 5, 8),
    (0, 4, 8),
    (2, 4, 6),
)


def send_telegram_message(text: str, chat_id: str | None = None) -> None:
    """Отправляет сообщение в Telegram."""
    token = BOT_TOKEN
    target_chat = chat_id or ADMIN_CHAT_ID
    
    if not token or not target_chat:
        print("[warn] Telegram token or chat_id not configured")
        return

    try:
        requests.post(
            f"https://api.telegram.org/bot{token}/sendMessage",
            json={"chat_id": target_chat, "text": text, "parse_mode": "HTML"},
            timeout=5,
        ).raise_for_status()
    except Exception as exc:
        print(f"[warn] Telegram send failed: {exc}")


def get_deep_link(username: str) -> str:
    """Генерирует deep link для подключения к боту."""
    return f"https://t.me/{BOT_USERNAME}?start={username}"


def check_user_subscribed(username: str) -> int | None:
    """
    Проверяет, подписался ли пользователь на бота.
    Возвращает chat_id если подписался, иначе None.
    """
    token = BOT_TOKEN
    if not token:
        return None
    
    try:
        # Получаем последние обновления
        response = requests.get(
            f"https://api.telegram.org/bot{token}/getUpdates",
            params={"timeout": 1, "allowed_updates": ["message"]},
            timeout=5,
        )
        response.raise_for_status()
        data = response.json()
        
        if not data.get("ok"):
            return None
        
        # Ищем сообщение /start с нужным username в payload
        for update in reversed(data.get("result", [])):
            message = update.get("message", {})
            text = message.get("text", "")
            
            # Проверяем /start с payload
            if text.startswith("/start"):
                parts = text.split()
                if len(parts) > 1 and parts[1].lower() == username.lower():
                    chat_id = message.get("chat", {}).get("id")
                    if chat_id:
                        # Подтверждаем получение обновления
                        update_id = update.get("update_id")
                        requests.get(
                            f"https://api.telegram.org/bot{token}/getUpdates",
                            params={"offset": update_id + 1},
                            timeout=2,
                        )
                        return chat_id
        
        return None
    except Exception as exc:
        print(f"[warn] Check subscription failed: {exc}")
        return None


def check_winner(board: list[str]) -> str | None:
    for a, b, c in WIN_LINES:
        if board[a] and board[a] == board[b] == board[c]:
            return board[a]
    if all(board):
        return "draw"
    return None


def get_winning_line(board: list[str]) -> tuple[int, int, int] | None:
    for line in WIN_LINES:
        a, b, c = line
        if board[a] and board[a] == board[b] == board[c]:
            return line
    return None


def best_move_for_o(board: list[str]) -> int:
    empties = [i for i in range(9) if not board[i]]
    if not empties:
        return 0
    if random.random() < 0.30:
        return random.choice(empties)
    for i in empties:
        board[i] = "O"
        if check_winner(board) == "O":
            board[i] = ""
            if random.random() < 0.40:
                other = [j for j in empties if j != i]
                if other:
                    return random.choice(other)
            return i
        board[i] = ""
    for i in empties:
        board[i] = "X"
        if check_winner(board) == "X":
            board[i] = ""
            if random.random() < 0.50:
                other = [j for j in empties if j != i]
                if other:
                    return random.choice(other)
            return i
        board[i] = ""
    return random.choice(empties)


def lerp_color(c1: str, c2: str, t: float) -> str:
    t = max(0.0, min(1.0, t))
    r1, g1, b1 = int(c1[1:3], 16), int(c1[3:5], 16), int(c1[5:7], 16)
    r2, g2, b2 = int(c2[1:3], 16), int(c2[3:5], 16), int(c2[5:7], 16)
    r = int(r1 + (r2 - r1) * t)
    g = int(g1 + (g2 - g1) * t)
    b = int(b1 + (b2 - b1) * t)
    return f"#{r:02x}{g:02x}{b:02x}"


def darken_color(c: str, factor: float) -> str:
    r, g, b = int(c[1:3], 16), int(c[3:5], 16), int(c[5:7], 16)
    r = int(r * factor)
    g = int(g * factor)
    b = int(b * factor)
    return f"#{max(0, min(255, r)):02x}{max(0, min(255, g)):02x}{max(0, min(255, b)):02x}"


class TicTacToeApp:
    CUBE_SIZE = 300
    CELL_SIZE = 100
    LINE_WIDTH = 5
    SYMBOL_PADDING = 22
    ANIM_STEPS = 16
    ANIM_DELAY = 12
    FLIP_STEPS = 30
    FLIP_DELAY = 16

    def __init__(self, root: tk.Tk) -> None:
        self.root = root
        self.root.title("Крестики-нолики")
        
        win_width = 520
        win_height = 820
        
        screen_width = root.winfo_screenwidth()
        screen_height = root.winfo_screenheight()
        x = (screen_width - win_width) // 2
        y = (screen_height - win_height) // 2
        
        self.root.geometry(f"{win_width}x{win_height}+{x}+{y}")
        self.root.minsize(win_width, win_height)
        self.root.resizable(True, True)

        # ══════════════════════════════════════════════════════════════════
        # КОСМИЧЕСКАЯ ПАЛИТРА — звёздное небо
        # ══════════════════════════════════════════════════════════════════
        
        self.bg_main = "#0B0E17"            # Глубокий космос
        self.bg_gradient_top = "#0F1423"    # Верхняя часть градиента
        self.bg_gradient_bottom = "#1A1E2E" # Нижняя часть градиента
        
        # Грани куба — полупрозрачные стеклянные
        self.cube_top = "#1E2438"          # Верхняя грань (игровое поле)
        self.cube_right = "#151929"         # Правая грань (тень)
        self.cube_left = "#1A1F32"          # Левая грань (полутень)
        
        self.bg_cell = "#232940"
        self.bg_cell_hover = "#2E3650"
        self.grid_line = "#3D4565"
        self.border_accent = "#6B7AAA"
        
        # Символы — неоновые космические
        self.x_color = "#FF6B9D"            # Розовый неон
        self.x_glow = "#FF8FB3"
        self.o_color = "#00D4FF"            # Голубой неон
        self.o_glow = "#66E5FF"
        
        # Текст — светлый на тёмном
        self.text_primary = "#E8ECF5"
        self.text_secondary = "#B8C0D8"
        self.text_muted = "#7A85A8"
        self.text_light = "#5A6488"
        
        # Статусы
        self.win_color = "#00E5A0"          # Зелёный неон
        self.win_glow = "#66F5C8"
        self.win_bg = "#0D1A18"
        self.loss_color = "#FF6B6B"
        self.loss_bg = "#1A0F0F"
        self.draw_color = "#FFD166"
        self.draw_bg = "#1A1708"
        
        # Кнопки
        self.accent = "#7B68EE"             # Фиолетовый
        self.accent_hover = "#9580FF"
        self.accent_light = "#A899FF"
        self.btn_secondary = "#2A3150"
        self.btn_secondary_hover = "#363E5E"
        self.btn_text = "#E0E4F0"
        self.border_light = "#3A4268"
        
        # Фоновое изображение
        self._bg_original: Image.Image | None = None
        self._bg_photo: tk.PhotoImage | None = None

        self.root.configure(bg=self.bg_main)

        self.board: list[str] = [""] * 9
        self.game_over = False
        self._telegram_sent = False
        self._promo_code: str | None = None
        self._hover_cell: int | None = None
        self._animation_ids: list[str] = []
        
        # 3D параметры
        self._flip_angle = 0.0
        self._is_flipping = False
        self._flip_direction = 1  # 1 = вперёд, -1 = назад
        self._game_number = 0
        
        # Параметры тряски при победе
        self._shake_offset_x = 0.0
        self._shake_offset_y = 0.0
        self._is_shaking = False
        
        # Ник пользователя в телеграмме
        self._telegram_username: str = ""
        self._telegram_chat_id: int | None = None  # Chat ID для отправки сообщений
        self._username_entered = False
        self._game_blocked = True  # Блокируем игру пока не введён ник
        self._dialog_visible = False  # Флаг видимости диалога
        self._checking_subscription = False  # Флаг проверки подписки

        self._build_ui()
        self._load_background()
        self.root.after(50, self._draw_background)
        self.reset(animate=False)
        
        # Показываем окно ввода ника после инициализации UI
        self.root.after(100, self._show_username_dialog)

    def _build_ui(self) -> None:
        # ══════════════════════════════════════════════════════════════════
        # Фоновый canvas на всё окно (звёздное небо + куб)
        # ══════════════════════════════════════════════════════════════════
        self.bg_canvas = tk.Canvas(
            self.root,
            bg=self.bg_main,
            highlightthickness=0,
        )
        self.bg_canvas.pack(fill="both", expand=True)
        
        # Привязка событий для куба на bg_canvas
        self.bg_canvas.bind("<Motion>", self._on_mouse_move)
        self.bg_canvas.bind("<Leave>", self._on_mouse_leave)
        self.bg_canvas.bind("<Button-1>", self._on_click)
        self.bg_canvas.bind("<Configure>", self._on_resize)

        # ══════════════════════════════════════════════════════════════════
        # Заголовок (рисуем прямо на canvas для прозрачного фона)
        # ══════════════════════════════════════════════════════════════════
        try:
            self.title_font = tkfont.Font(family="Palatino", size=26, weight="normal")
        except Exception:
            try:
                self.title_font = tkfont.Font(family="Georgia", size=26, weight="normal")
            except Exception:
                self.title_font = tkfont.Font(family="Times New Roman", size=26, weight="normal")

        try:
            self.subtitle_font = tkfont.Font(family="Palatino", size=26, slant="italic")
        except Exception:
            try:
                self.subtitle_font = tkfont.Font(family="Georgia", size=26, slant="italic")
            except Exception:
                self.subtitle_font = tkfont.Font(family="Times New Roman", size=26, slant="italic")

        # ══════════════════════════════════════════════════════════════════
        # Куб рисуется на bg_canvas (позиция настраивается в _draw_cube)
        # ══════════════════════════════════════════════════════════════════
        self._cube_center_x = 260
        self._cube_center_y = 310

        # ══════════════════════════════════════════════════════════════════
        # Кнопка "Начать заново" — рисуем на canvas для корректного цвета
        # ══════════════════════════════════════════════════════════════════
        self.moon_pink = "#D080C0"  # Розово-фиолетовый как луна на фоне
        self.moon_pink_hover = "#E098D0"
        
        try:
            self.btn_font = tkfont.Font(family="Palatino", size=16, weight="bold")
        except Exception:
            try:
                self.btn_font = tkfont.Font(family="Georgia", size=16, weight="bold")
            except Exception:
                self.btn_font = tkfont.Font(family="Times New Roman", size=16, weight="bold")

        # Параметры кнопки
        self._btn_text = "Начать заново"
        self._btn_color = self.moon_pink
        self._btn_command = self.reset
        self._btn_x = 260
        self._btn_y = 560
        self._btn_hovered = False

    # ══════════════════════════════════════════════════════════════════════
    # ФОНОВОЕ ИЗОБРАЖЕНИЕ
    # ══════════════════════════════════════════════════════════════════════

    def _load_background(self) -> None:
        """Загружает фоновое изображение."""
        try:
            script_dir = os.path.dirname(os.path.abspath(__file__))
            bg_path = os.path.join(script_dir, "background.png")
            if not os.path.exists(bg_path):
                bg_path = os.path.join(script_dir, "background.jpg")
            
            if os.path.exists(bg_path):
                self._bg_original = Image.open(bg_path)
            else:
                print(f"[warn] Background image not found at {bg_path}")
                self._bg_original = None
        except Exception as e:
            print(f"[warn] Could not load background: {e}")
            self._bg_original = None

    def _draw_background(self) -> None:
        """Отрисовывает фоновое изображение на canvas."""
        self._draw_background_only()
        
        # Рисуем заголовки на фоне
        self._draw_titles()
        
        # Поднимаем UI-элементы над фоном
        self.bg_canvas.tag_raise("cube")
        self.bg_canvas.tag_raise("titles")
        self.bg_canvas.tag_raise("button")

    def _draw_background_only(self) -> None:
        """Отрисовывает только фоновое изображение (без заголовков и UI)."""
        self.bg_canvas.delete("background")
        
        if self._bg_original is None:
            return
        
        # Получаем размеры canvas
        width = self.bg_canvas.winfo_width()
        height = self.bg_canvas.winfo_height()
        
        if width <= 1 or height <= 1:
            width = 520
            height = 820
        
        # Масштабируем изображение чтобы покрыть весь canvas (cover)
        img_ratio = self._bg_original.width / self._bg_original.height
        canvas_ratio = width / height
        
        if canvas_ratio > img_ratio:
            new_width = width
            new_height = int(width / img_ratio)
        else:
            new_height = height
            new_width = int(height * img_ratio)
        
        resized = self._bg_original.resize((new_width, new_height), Image.Resampling.LANCZOS)
        
        # Центрируем и обрезаем
        left = (new_width - width) // 2
        top = (new_height - height) // 2
        cropped = resized.crop((left, top, left + width, top + height))
        
        # Конвертируем в PNG через BytesIO для совместимости с tk.PhotoImage
        buffer = io.BytesIO()
        cropped.save(buffer, format="PNG")
        buffer.seek(0)
        
        self._bg_photo = tk.PhotoImage(data=buffer.getvalue())
        self.bg_canvas.create_image(0, 0, image=self._bg_photo, anchor="nw", tags="background")
        self.bg_canvas.tag_lower("background")

    def _draw_titles(self) -> None:
        """Рисует заголовки прямо на canvas (прозрачный фон)."""
        # Не рисуем заголовки, если открыт диалог регистрации
        if self._dialog_visible:
            return
        
        self.bg_canvas.delete("titles")
        
        cx = self._cube_center_x
        
        # Измеряем текст для размера фона
        text1 = "Выиграй в крестики-нолики"
        text2 = "и получи промокод"
        text1_width = self.title_font.measure(text1)
        text2_width = self.title_font.measure(text2)
        text_height = self.title_font.metrics("linespace")
        
        max_width = max(text1_width, text2_width)
        pad_x = 12
        pad_y = 12
        
        # Фон под текст (такой же как кнопка)
        bg_width = max_width + pad_x * 2
        bg_height = text_height * 2 + pad_y * 2 + 15  # 15 — расстояние между строками
        bg_y = 47  # Центр фона
        
        r = 8  # радиус скругления
        x1, y1 = cx - bg_width // 2, bg_y - bg_height // 2
        x2, y2 = cx + bg_width // 2, bg_y + bg_height // 2
        
        # Скруглённый прямоугольник
        self.bg_canvas.create_rectangle(x1 + r, y1, x2 - r, y2, fill=self.moon_pink, outline="", tags="titles")
        self.bg_canvas.create_rectangle(x1, y1 + r, x2, y2 - r, fill=self.moon_pink, outline="", tags="titles")
        self.bg_canvas.create_oval(x1, y1, x1 + r*2, y1 + r*2, fill=self.moon_pink, outline="", tags="titles")
        self.bg_canvas.create_oval(x2 - r*2, y1, x2, y1 + r*2, fill=self.moon_pink, outline="", tags="titles")
        self.bg_canvas.create_oval(x1, y2 - r*2, x1 + r*2, y2, fill=self.moon_pink, outline="", tags="titles")
        self.bg_canvas.create_oval(x2 - r*2, y2 - r*2, x2, y2, fill=self.moon_pink, outline="", tags="titles")
        
        # Первая строка
        self.bg_canvas.create_text(
            cx, 30,
            text=text1,
            fill="#1A1E2E",  # Тёмный текст как на кнопке
            font=self.title_font,
            anchor="center",
            tags="titles"
        )
        
        # Вторая строка
        self.bg_canvas.create_text(
            cx, 65,
            text=text2,
            fill="#1A1E2E",  # Тёмный текст как на кнопке
            font=self.title_font,
            anchor="center",
            tags="titles"
        )
        
        # Кнопка
        self._draw_button()

    def _show_username_dialog(self) -> None:
        """Показывает красивое модальное окно для ввода ника в телеграмме."""
        self.bg_canvas.delete("username_dialog")
        self.bg_canvas.delete("username_overlay")
        
        # Скрываем игровые элементы — показываем только фон
        self.bg_canvas.delete("cube")
        self.bg_canvas.delete("titles")
        self.bg_canvas.delete("button")
        
        # Перерисовываем фон чтобы он точно был виден
        self._draw_background_only()
        
        # Получаем размеры canvas
        canvas_width = self.bg_canvas.winfo_width()
        canvas_height = self.bg_canvas.winfo_height()
        
        if canvas_width <= 1:
            canvas_width = 520
        if canvas_height <= 1:
            canvas_height = 820
        
        cx = canvas_width // 2
        cy = canvas_height // 2
        
        # Размеры диалога
        dialog_width = 420
        dialog_height = 280
        
        x1 = cx - dialog_width // 2
        y1 = cy - dialog_height // 2
        x2 = cx + dialog_width // 2
        y2 = cy + dialog_height // 2
        
        # Тень
        shadow_offset = 8
        r = 20
        self._draw_rounded_rect(
            x1 + shadow_offset, y1 + shadow_offset,
            x2 + shadow_offset, y2 + shadow_offset,
            r, "#000000", "username_dialog"
        )
        
        # Основной фон диалога
        self._draw_rounded_rect(x1, y1, x2, y2, r, "#1A1E2E", "username_dialog")
        
        # Неоновая рамка
        self._draw_rounded_rect_outline(
            x1 + 3, y1 + 3, x2 - 3, y2 - 3,
            r - 2, self.moon_pink, 2, "username_dialog"
        )
        
        # Шрифты
        try:
            header_font = tkfont.Font(family="Palatino", size=22, weight="bold")
            text_font = tkfont.Font(family="Palatino", size=14)
            btn_font = tkfont.Font(family="Palatino", size=16, weight="bold")
        except Exception:
            header_font = tkfont.Font(family="Arial", size=22, weight="bold")
            text_font = tkfont.Font(family="Arial", size=14)
            btn_font = tkfont.Font(family="Arial", size=16, weight="bold")
        
        # Заголовок
        self.bg_canvas.create_text(
            cx, y1 + 45,
            text="Добро пожаловать!",
            fill=self.moon_pink,
            font=header_font,
            anchor="center",
            tags="username_dialog"
        )
        
        # Описание
        self.bg_canvas.create_text(
            cx, y1 + 85,
            text="Введите ваш ник в Telegram",
            fill=self.text_secondary,
            font=text_font,
            anchor="center",
            tags="username_dialog"
        )
        
        # Поле ввода (Entry widget поверх canvas)
        self._username_entry = tk.Entry(
            self.bg_canvas,
            font=("Palatino", 16),
            bg="#232940",
            fg=self.text_primary,
            insertbackground=self.moon_pink,
            relief="flat",
            justify="center",
            width=25,
            highlightthickness=0,
            bd=0,
        )
        self._username_entry.insert(0, "@")
        
        # Размещаем поле ввода
        self.bg_canvas.create_window(
            cx, y1 + 135,
            window=self._username_entry,
            tags="username_dialog"
        )
        
        # Рамка для поля ввода (внешняя)
        entry_width = 280
        self._draw_rounded_rect_outline(
            cx - entry_width // 2, y1 + 115,
            cx + entry_width // 2, y1 + 155,
            8, self.border_accent, 2, "username_dialog"
        )
        
        # Кнопка "Подключиться к боту"
        btn_y = y1 + 220
        btn_width = 280
        btn_height = 50
        
        self._draw_rounded_rect(
            cx - btn_width // 2, btn_y - btn_height // 2,
            cx + btn_width // 2, btn_y + btn_height // 2,
            12, self.moon_pink, "username_dialog"
        )
        
        self.bg_canvas.create_text(
            cx, btn_y,
            text="Начать игру",
            fill="#1A1E2E",
            font=btn_font,
            anchor="center",
            tags=("username_dialog", "connect_btn")
        )
        
        # Привязываем обработчики
        self.bg_canvas.tag_bind("connect_btn", "<Button-1>", self._on_connect_bot_click)
        self._username_entry.bind("<Return>", lambda e: self._on_connect_bot_click(None))
        self._username_entry.focus_set()
        
        # Устанавливаем флаг видимости
        self._dialog_visible = True
        
        # Поднимаем диалог наверх
        self.bg_canvas.tag_raise("username_dialog")

    def _on_connect_bot_click(self, event) -> None:
        """Открывает deep link и показывает второй шаг диалога."""
        username = self._username_entry.get().strip()
        
        # Убираем @ если есть
        if username.startswith("@"):
            username = username[1:]
        
        if not username or len(username) < 2:
            # Подсветим поле красным
            self._username_entry.configure(bg="#3A2020")
            self.root.after(500, lambda: self._username_entry.configure(bg="#232940"))
            return
        
        self._telegram_username = username
        
        # Открываем deep link в браузере
        deep_link = get_deep_link(username)
        webbrowser.open(deep_link)
        
        # Показываем второй шаг диалога
        self._show_step2_dialog()

    def _show_step2_dialog(self) -> None:
        """Показывает второй шаг — ожидание подписки на бота."""
        self.bg_canvas.delete("username_dialog")
        
        # Удаляем поле ввода
        if hasattr(self, '_username_entry') and self._username_entry.winfo_exists():
            self._username_entry.destroy()
        
        # Получаем размеры canvas
        canvas_width = self.bg_canvas.winfo_width()
        canvas_height = self.bg_canvas.winfo_height()
        
        if canvas_width <= 1:
            canvas_width = 520
        if canvas_height <= 1:
            canvas_height = 820
        
        cx = canvas_width // 2
        cy = canvas_height // 2
        
        # Размеры диалога
        dialog_width = 420
        dialog_height = 220
        
        x1 = cx - dialog_width // 2
        y1 = cy - dialog_height // 2
        x2 = cx + dialog_width // 2
        y2 = cy + dialog_height // 2
        
        # Тень
        r = 20
        self._draw_rounded_rect(
            x1 + 8, y1 + 8, x2 + 8, y2 + 8,
            r, "#000000", "username_dialog"
        )
        
        # Основной фон
        self._draw_rounded_rect(x1, y1, x2, y2, r, "#1A1E2E", "username_dialog")
        
        # Неоновая рамка
        self._draw_rounded_rect_outline(
            x1 + 3, y1 + 3, x2 - 3, y2 - 3,
            r - 2, self.o_color, 2, "username_dialog"
        )
        
        # Шрифты
        try:
            header_font = tkfont.Font(family="Palatino", size=20, weight="bold")
            text_font = tkfont.Font(family="Palatino", size=14)
        except Exception:
            header_font = tkfont.Font(family="Arial", size=20, weight="bold")
            text_font = tkfont.Font(family="Arial", size=14)
        
        # Заголовок с анимацией
        self.bg_canvas.create_text(
            cx, y1 + 55,
            text="⏳ Ожидание подключения...",
            fill=self.o_color,
            font=header_font,
            anchor="center",
            tags="username_dialog"
        )
        
        # Инструкция
        self.bg_canvas.create_text(
            cx, y1 + 105,
            text="Нажмите START в Telegram-боте",
            fill=self.text_secondary,
            font=text_font,
            anchor="center",
            tags="username_dialog"
        )
        
        self.bg_canvas.create_text(
            cx, y1 + 130,
            text="Игра начнётся автоматически",
            fill=self.text_muted,
            font=text_font,
            anchor="center",
            tags="username_dialog"
        )
        
        # Индикатор загрузки (точки)
        self._loading_dots = 0
        self.bg_canvas.create_text(
            cx, y1 + 175,
            text="●○○",
            fill=self.o_color,
            font=header_font,
            anchor="center",
            tags=("username_dialog", "loading_dots")
        )
        
        # Поднимаем диалог
        self.bg_canvas.tag_raise("username_dialog")
        
        # Начинаем проверку подписки
        self._checking_subscription = True
        self._check_subscription_loop()

    def _check_subscription_loop(self) -> None:
        """Периодически проверяет, подписался ли пользователь."""
        if not self._checking_subscription:
            return
        
        # Анимация точек загрузки
        self._loading_dots = (self._loading_dots + 1) % 3
        dots = ["●○○", "○●○", "○○●"][self._loading_dots]
        self.bg_canvas.delete("loading_dots")
        
        # Получаем позицию для точек
        canvas_width = self.bg_canvas.winfo_width()
        canvas_height = self.bg_canvas.winfo_height()
        if canvas_width <= 1:
            canvas_width = 520
        if canvas_height <= 1:
            canvas_height = 820
        cx = canvas_width // 2
        cy = canvas_height // 2
        dialog_height = 220
        y1 = cy - dialog_height // 2
        
        try:
            header_font = tkfont.Font(family="Palatino", size=20, weight="bold")
        except Exception:
            header_font = tkfont.Font(family="Arial", size=20, weight="bold")
        
        self.bg_canvas.create_text(
            cx, y1 + 175,
            text=dots,
            fill=self.o_color,
            font=header_font,
            anchor="center",
            tags=("username_dialog", "loading_dots")
        )
        
        # Проверяем подписку
        chat_id = check_user_subscribed(self._telegram_username)
        
        if chat_id:
            # Пользователь подписался — сразу начинаем игру!
            self._telegram_chat_id = chat_id
            self._checking_subscription = False
            
            # Сразу запускаем игру
            self._username_entered = True
            self._game_blocked = False
            self._dialog_visible = False
            self.bg_canvas.delete("username_dialog")
            self.bg_canvas.delete("username_overlay")
            
            # Восстанавливаем UI игры
            self._draw_background()
            self._draw_cube()
            self._draw_button()
        else:
            # Проверяем снова через 2 секунды
            self.root.after(2000, self._check_subscription_loop)

    def _draw_button(self) -> None:
        """Рисует кнопку на canvas."""
        # Не рисуем кнопку, если открыт диалог регистрации
        if self._dialog_visible:
            return
        
        self.bg_canvas.delete("button")
        
        cx = self._btn_x
        cy = self._btn_y
        
        # Измеряем текст для размера кнопки
        text_width = self.btn_font.measure(self._btn_text)
        text_height = self.btn_font.metrics("linespace")
        
        pad_x = 35
        pad_y = 15
        width = text_width + pad_x * 2
        height = text_height + pad_y * 2
        
        # Цвет кнопки
        color = self.moon_pink_hover if self._btn_hovered else self._btn_color
        
        # Скруглённый прямоугольник (через овалы и прямоугольники)
        r = 8  # радиус скругления
        x1, y1 = cx - width // 2, cy - height // 2
        x2, y2 = cx + width // 2, cy + height // 2
        
        # Основной прямоугольник
        self.bg_canvas.create_rectangle(
            x1 + r, y1, x2 - r, y2,
            fill=color, outline="", tags="button"
        )
        self.bg_canvas.create_rectangle(
            x1, y1 + r, x2, y2 - r,
            fill=color, outline="", tags="button"
        )
        # Углы
        self.bg_canvas.create_oval(x1, y1, x1 + r*2, y1 + r*2, fill=color, outline="", tags="button")
        self.bg_canvas.create_oval(x2 - r*2, y1, x2, y1 + r*2, fill=color, outline="", tags="button")
        self.bg_canvas.create_oval(x1, y2 - r*2, x1 + r*2, y2, fill=color, outline="", tags="button")
        self.bg_canvas.create_oval(x2 - r*2, y2 - r*2, x2, y2, fill=color, outline="", tags="button")
        
        # Текст кнопки
        self.bg_canvas.create_text(
            cx, cy,
            text=self._btn_text,
            fill="#1A1E2E",
            font=self.btn_font,
            anchor="center",
            tags="button"
        )
        
        # Сохраняем границы для проверки клика
        self._btn_bounds = (x1, y1, x2, y2)

    def _draw_promo_overlay(self) -> None:
        """Рисует полупрозрачный оверлей с промокодом по центру."""
        self.bg_canvas.delete("promo_overlay")
        
        if not self._promo_code:
            return
        
        # Получаем размеры canvas
        canvas_width = self.bg_canvas.winfo_width()
        canvas_height = self.bg_canvas.winfo_height()
        
        if canvas_width <= 1:
            canvas_width = 520
        if canvas_height <= 1:
            canvas_height = 820
        
        cx = canvas_width // 2
        cy = canvas_height // 2
        
        # Текст оверлея
        line1 = "Ваш промокод"
        line2 = self._promo_code
        line3 = "отправлен в телеграм"
        
        # Шрифты
        try:
            promo_font = tkfont.Font(family="Palatino", size=20, weight="bold")
            code_font = tkfont.Font(family="Palatino", size=36, weight="bold")
        except Exception:
            promo_font = tkfont.Font(family="Arial", size=20, weight="bold")
            code_font = tkfont.Font(family="Arial", size=36, weight="bold")
        
        # Размеры текста
        line1_width = promo_font.measure(line1)
        line2_width = code_font.measure(line2)
        line3_width = promo_font.measure(line3)
        line_height = promo_font.metrics("linespace")
        code_height = code_font.metrics("linespace")
        
        max_width = max(line1_width, line2_width, line3_width)
        total_height = line_height + code_height + line_height + 30
        
        pad_x = 40
        pad_y = 30
        box_width = max_width + pad_x * 2
        box_height = total_height + pad_y * 2
        
        x1, y1 = cx - box_width // 2, cy - box_height // 2
        x2, y2 = cx + box_width // 2, cy + box_height // 2
        
        # Внешняя тень
        shadow_offset = 6
        r = 16
        self._draw_rounded_rect(
            x1 + shadow_offset, y1 + shadow_offset, 
            x2 + shadow_offset, y2 + shadow_offset, 
            r, "#000000", "promo_overlay"
        )
        
        # Основной фон (тёмный)
        self._draw_rounded_rect(x1, y1, x2, y2, r, "#1A1E2E", "promo_overlay")
        
        # Внутренняя рамка (свечение)
        self._draw_rounded_rect_outline(x1 + 3, y1 + 3, x2 - 3, y2 - 3, r - 2, self.win_color, 2, "promo_overlay")
        
        # Текст
        text_y = y1 + pad_y + line_height // 2
        
        self.bg_canvas.create_text(
            cx, text_y,
            text=line1,
            fill=self.text_secondary,
            font=promo_font,
            anchor="center",
            tags="promo_overlay"
        )
        
        text_y += line_height // 2 + 15 + code_height // 2
        
        # Промокод (большой, яркий)
        self.bg_canvas.create_text(
            cx, text_y,
            text=line2,
            fill=self.win_color,
            font=code_font,
            anchor="center",
            tags="promo_overlay"
        )
        
        text_y += code_height // 2 + 15 + line_height // 2
        
        self.bg_canvas.create_text(
            cx, text_y,
            text=line3,
            fill=self.text_secondary,
            font=promo_font,
            anchor="center",
            tags="promo_overlay"
        )
        
        # Поднимаем оверлей наверх
        self.bg_canvas.tag_raise("promo_overlay")

    def _draw_rounded_rect(self, x1: float, y1: float, x2: float, y2: float, 
                           r: float, color: str, tag: str) -> None:
        """Рисует скруглённый прямоугольник."""
        self.bg_canvas.create_rectangle(x1 + r, y1, x2 - r, y2, fill=color, outline="", tags=tag)
        self.bg_canvas.create_rectangle(x1, y1 + r, x2, y2 - r, fill=color, outline="", tags=tag)
        self.bg_canvas.create_oval(x1, y1, x1 + r*2, y1 + r*2, fill=color, outline="", tags=tag)
        self.bg_canvas.create_oval(x2 - r*2, y1, x2, y1 + r*2, fill=color, outline="", tags=tag)
        self.bg_canvas.create_oval(x1, y2 - r*2, x1 + r*2, y2, fill=color, outline="", tags=tag)
        self.bg_canvas.create_oval(x2 - r*2, y2 - r*2, x2, y2, fill=color, outline="", tags=tag)

    def _draw_rounded_rect_outline(self, x1: float, y1: float, x2: float, y2: float,
                                    r: float, color: str, width: int, tag: str) -> None:
        """Рисует обводку скруглённого прямоугольника."""
        self.bg_canvas.create_line(x1 + r, y1, x2 - r, y1, fill=color, width=width, tags=tag)
        self.bg_canvas.create_line(x1 + r, y2, x2 - r, y2, fill=color, width=width, tags=tag)
        self.bg_canvas.create_line(x1, y1 + r, x1, y2 - r, fill=color, width=width, tags=tag)
        self.bg_canvas.create_line(x2, y1 + r, x2, y2 - r, fill=color, width=width, tags=tag)
        self.bg_canvas.create_arc(x1, y1, x1 + r*2, y1 + r*2, start=90, extent=90, 
                                   style="arc", outline=color, width=width, tags=tag)
        self.bg_canvas.create_arc(x2 - r*2, y1, x2, y1 + r*2, start=0, extent=90,
                                   style="arc", outline=color, width=width, tags=tag)
        self.bg_canvas.create_arc(x1, y2 - r*2, x1 + r*2, y2, start=180, extent=90,
                                   style="arc", outline=color, width=width, tags=tag)
        self.bg_canvas.create_arc(x2 - r*2, y2 - r*2, x2, y2, start=270, extent=90,
                                   style="arc", outline=color, width=width, tags=tag)

    def _hide_promo_overlay(self) -> None:
        """Скрывает оверлей с промокодом."""
        self.bg_canvas.delete("promo_overlay")

    def _on_resize(self, event: tk.Event) -> None:
        """Обработка изменения размера окна."""
        # Центрируем элементы по горизонтали
        cx = event.width // 2
        self._cube_center_x = cx
        self._btn_x = cx
        
        # Перерисовываем фон (методы сами проверяют _dialog_visible)
        if self._dialog_visible:
            self._draw_background_only()
            # Перерисовываем диалог по центру
            self._redraw_current_dialog()
        else:
            self._draw_background()
            self._draw_cube()
    
    def _redraw_current_dialog(self) -> None:
        """Перерисовывает текущий диалог по центру окна."""
        if not self._dialog_visible:
            return
        
        # Сохраняем текст из поля ввода если оно есть
        saved_text = ""
        if hasattr(self, '_username_entry') and self._username_entry.winfo_exists():
            saved_text = self._username_entry.get()
        
        if self._checking_subscription:
            # Второй шаг — ожидание подписки
            self._show_step2_dialog()
        else:
            # Первый шаг — ввод ника
            self._show_username_dialog()
            # Восстанавливаем текст
            if saved_text and hasattr(self, '_username_entry'):
                self._username_entry.delete(0, tk.END)
                self._username_entry.insert(0, saved_text)


    # ══════════════════════════════════════════════════════════════════════
    # 3D КУБА
    # ══════════════════════════════════════════════════════════════════════

    def _get_cube_transform(self, angle: float = 0.0) -> dict:
        """Возвращает параметры трансформации куба."""
        cx = self._cube_center_x + self._shake_offset_x
        cy = self._cube_center_y + self._shake_offset_y
        size = self.CUBE_SIZE
        
        flip_rad = math.radians(angle)
        
        # Угол наклона куба для показа передней грани
        tilt_x = math.radians(15)  # Небольшой наклон назад
        tilt_y = math.radians(-20)  # Поворот влево для объёма
        
        return {
            "cx": cx,
            "cy": cy,
            "size": size,
            "tilt_x": tilt_x,
            "tilt_y": tilt_y,
            "flip_angle": flip_rad,
        }

    def _project_point(self, x: float, y: float, z: float, transform: dict) -> tuple[float, float]:
        """Проецирует 3D точку в 2D."""
        cx = transform["cx"]
        cy = transform["cy"]
        tilt_x = transform["tilt_x"]
        tilt_y = transform["tilt_y"]
        flip = transform["flip_angle"]
        
        # Поворот вокруг оси Y (переворот куба при новой игре)
        x_rot = x * math.cos(flip) + z * math.sin(flip)
        z_rot = -x * math.sin(flip) + z * math.cos(flip)
        x, z = x_rot, z_rot
        
        # Наклон вокруг оси Y (для объёма)
        x_rot = x * math.cos(tilt_y) + z * math.sin(tilt_y)
        z_rot = -x * math.sin(tilt_y) + z * math.cos(tilt_y)
        x, z = x_rot, z_rot
        
        # Наклон вокруг оси X (назад)
        y_rot = y * math.cos(tilt_x) - z * math.sin(tilt_x)
        z_rot = y * math.sin(tilt_x) + z * math.cos(tilt_x)
        y, z = y_rot, z_rot
        
        # Простая проекция (без перспективы для чёткости)
        scale = 0.9
        px = cx + x * scale
        py = cy - y * scale  # Y инвертирован в экранных координатах
        
        return px, py

    def _transform_normal(self, nx: float, ny: float, nz: float, transform: dict) -> tuple[float, float, float]:
        """Трансформирует нормаль грани согласно вращениям куба."""
        tilt_x = transform["tilt_x"]
        tilt_y = transform["tilt_y"]
        flip = transform["flip_angle"]
        
        # Поворот вокруг оси Y (переворот куба)
        nx_rot = nx * math.cos(flip) + nz * math.sin(flip)
        nz_rot = -nx * math.sin(flip) + nz * math.cos(flip)
        nx, nz = nx_rot, nz_rot
        
        # Наклон вокруг оси Y
        nx_rot = nx * math.cos(tilt_y) + nz * math.sin(tilt_y)
        nz_rot = -nx * math.sin(tilt_y) + nz * math.cos(tilt_y)
        nx, nz = nx_rot, nz_rot
        
        # Наклон вокруг оси X
        ny_rot = ny * math.cos(tilt_x) - nz * math.sin(tilt_x)
        nz_rot = ny * math.sin(tilt_x) + nz * math.cos(tilt_x)
        ny, nz = ny_rot, nz_rot
        
        return nx, ny, nz

    def _get_face_depth(self, cx: float, cy: float, cz: float, transform: dict) -> float:
        """Вычисляет глубину центра грани после трансформации."""
        tilt_x = transform["tilt_x"]
        tilt_y = transform["tilt_y"]
        flip = transform["flip_angle"]
        
        # Поворот вокруг оси Y (переворот куба)
        x_rot = cx * math.cos(flip) + cz * math.sin(flip)
        z_rot = -cx * math.sin(flip) + cz * math.cos(flip)
        cx, cz = x_rot, z_rot
        
        # Наклон вокруг оси Y
        x_rot = cx * math.cos(tilt_y) + cz * math.sin(tilt_y)
        z_rot = -cx * math.sin(tilt_y) + cz * math.cos(tilt_y)
        cx, cz = x_rot, z_rot
        
        # Наклон вокруг оси X
        y_rot = cy * math.cos(tilt_x) - cz * math.sin(tilt_x)
        z_rot = cy * math.sin(tilt_x) + cz * math.cos(tilt_x)
        cy, cz = y_rot, z_rot
        
        return cz

    def _draw_cube(self) -> None:
        """Отрисовка 3D-куба с игровым полем на передней грани."""
        # Не рисуем куб, если открыт диалог регистрации
        if self._dialog_visible:
            return
        
        self.bg_canvas.delete("cube")
        
        transform = self._get_cube_transform(self._flip_angle)
        size = transform["size"]
        half = size / 2
        
        # Вершины куба
        # Передняя грань (z = half): 0-3
        # Задняя грань (z = -half): 4-7
        vertices_3d = [
            (-half, half, half),    # 0: перед-верх-лево
            (half, half, half),     # 1: перед-верх-право
            (half, -half, half),    # 2: перед-низ-право
            (-half, -half, half),   # 3: перед-низ-лево
            (-half, half, -half),   # 4: зад-верх-лево
            (half, half, -half),    # 5: зад-верх-право
            (half, -half, -half),   # 6: зад-низ-право
            (-half, -half, -half),  # 7: зад-низ-лево
        ]
        
        # Проецируем вершины
        vertices_2d = [self._project_point(x, y, z, transform) for x, y, z in vertices_3d]
        
        # Определяем грани куба: (индексы вершин, нормаль, центр, тип)
        faces = [
            # Передняя грань (z+)
            {
                "indices": [0, 1, 2, 3],
                "normal": (0, 0, 1),
                "center": (0, 0, half),
                "type": "front",
            },
            # Задняя грань (z-)
            {
                "indices": [5, 4, 7, 6],
                "normal": (0, 0, -1),
                "center": (0, 0, -half),
                "type": "back",
            },
            # Верхняя грань (y+)
            {
                "indices": [0, 1, 5, 4],
                "normal": (0, 1, 0),
                "center": (0, half, 0),
                "type": "top",
            },
            # Нижняя грань (y-)
            {
                "indices": [3, 2, 6, 7],
                "normal": (0, -1, 0),
                "center": (0, -half, 0),
                "type": "bottom",
            },
            # Правая грань (x+)
            {
                "indices": [1, 2, 6, 5],
                "normal": (1, 0, 0),
                "center": (half, 0, 0),
                "type": "right",
            },
            # Левая грань (x-)
            {
                "indices": [0, 3, 7, 4],
                "normal": (-1, 0, 0),
                "center": (-half, 0, 0),
                "type": "left",
            },
        ]
        
        # Определяем видимость и глубину каждой грани
        visible_faces = []
        for face in faces:
            # Трансформируем нормаль
            nx, ny, nz = self._transform_normal(*face["normal"], transform)
            
            # Грань видна, если её нормаль направлена к камере (z > 0 после трансформации)
            if nz > -0.01:  # Небольшой допуск для граничных случаев
                # Вычисляем глубину центра грани
                depth = self._get_face_depth(*face["center"], transform)
                visible_faces.append((face, depth))
        
        # Сортируем грани по глубине (от дальних к ближним)
        visible_faces.sort(key=lambda x: x[1])
        
        # Рисуем грани в правильном порядке
        for face, depth in visible_faces:
            face_type = face["type"]
            face_2d = [vertices_2d[i] for i in face["indices"]]
            points = [coord for pt in face_2d for coord in pt]
            
            if face_type == "front":
                # Передняя грань — игровое поле
                self.bg_canvas.create_polygon(
                    points,
                    fill=self.cube_top,
                    outline="", tags="cube",
                )
                # Рисуем игровое поле на передней грани
                self._draw_board_on_face(transform)
                
            elif face_type == "back":
                # Задняя грань
                self.bg_canvas.create_polygon(
                    points,
                    fill=self.cube_top,
                    outline=darken_color(self.cube_top, 0.9),
                    width=2, tags="cube",
                )
                
            elif face_type == "top":
                # Верхняя грань с сеткой
                self.bg_canvas.create_polygon(
                    points,
                    fill="#1A1F35",
                    outline="#2A3555",
                    width=1, tags="cube",
                )
                # Сетка на верхней грани
                top_grid_color = "#3A4575"
                for i in range(1, 3):
                    t = i / 3
                    p1 = self._project_point(-half + t * size, half, half, transform)
                    p2 = self._project_point(-half + t * size, half, -half, transform)
                    self.bg_canvas.create_line(p1[0], p1[1], p2[0], p2[1], fill=top_grid_color, width=1, tags="cube")
                    p1 = self._project_point(-half, half, half - t * size, transform)
                    p2 = self._project_point(half, half, half - t * size, transform)
                    self.bg_canvas.create_line(p1[0], p1[1], p2[0], p2[1], fill=top_grid_color, width=1, tags="cube")
                    
            elif face_type == "bottom":
                # Нижняя грань
                self.bg_canvas.create_polygon(
                    points,
                    fill="#121728",
                    outline="#222740",
                    width=1, tags="cube",
                )
                # Сетка на нижней грани
                bottom_grid_color = "#2A3050"
                for i in range(1, 3):
                    t = i / 3
                    p1 = self._project_point(-half + t * size, -half, half, transform)
                    p2 = self._project_point(-half + t * size, -half, -half, transform)
                    self.bg_canvas.create_line(p1[0], p1[1], p2[0], p2[1], fill=bottom_grid_color, width=1, tags="cube")
                    p1 = self._project_point(-half, -half, half - t * size, transform)
                    p2 = self._project_point(half, -half, half - t * size, transform)
                    self.bg_canvas.create_line(p1[0], p1[1], p2[0], p2[1], fill=bottom_grid_color, width=1, tags="cube")
                    
            elif face_type == "right":
                # Правая грань с сеткой
                self.bg_canvas.create_polygon(
                    points,
                    fill="#151A2A",
                    outline="#252A45",
                    width=1, tags="cube",
                )
                # Сетка на правой грани
                right_grid_color = "#2A3055"
                for i in range(1, 3):
                    t = i / 3
                    p1 = self._project_point(half, half - t * size, half, transform)
                    p2 = self._project_point(half, half - t * size, -half, transform)
                    self.bg_canvas.create_line(p1[0], p1[1], p2[0], p2[1], fill=right_grid_color, width=1, tags="cube")
                    p1 = self._project_point(half, half, half - t * size, transform)
                    p2 = self._project_point(half, -half, half - t * size, transform)
                    self.bg_canvas.create_line(p1[0], p1[1], p2[0], p2[1], fill=right_grid_color, width=1, tags="cube")
                    
            elif face_type == "left":
                # Левая грань с сеткой
                self.bg_canvas.create_polygon(
                    points,
                    fill="#181D30",
                    outline="#282D48",
                    width=1, tags="cube",
                )
                # Сетка на левой грани
                left_grid_color = "#303560"
                for i in range(1, 3):
                    t = i / 3
                    p1 = self._project_point(-half, half - t * size, half, transform)
                    p2 = self._project_point(-half, half - t * size, -half, transform)
                    self.bg_canvas.create_line(p1[0], p1[1], p2[0], p2[1], fill=left_grid_color, width=1, tags="cube")
                    p1 = self._project_point(-half, half, half - t * size, transform)
                    p2 = self._project_point(-half, -half, half - t * size, transform)
                    self.bg_canvas.create_line(p1[0], p1[1], p2[0], p2[1], fill=left_grid_color, width=1, tags="cube")
        
        # Если диалог открыт, поднимаем его наверх
        if self._dialog_visible:
            self.bg_canvas.tag_raise("username_dialog")

    def _draw_board_on_face(self, transform: dict) -> None:
        """Рисует игровое поле на передней грани куба."""
        size = transform["size"]
        half = size / 2
        cell = size / 3
        z_front = half  # Передняя грань
        
        # Сетка (на передней грани: X — горизонталь, Y — вертикаль)
        for i in range(1, 3):
            # Вертикальные линии (по X)
            x_offset = -half + i * cell
            p1 = self._project_point(x_offset, half, z_front, transform)
            p2 = self._project_point(x_offset, -half, z_front, transform)
            self.bg_canvas.create_line(
                p1[0], p1[1], p2[0], p2[1],
                fill=self.grid_line, width=2, tags="cube",
            )
            
            # Горизонтальные линии (по Y)
            y_offset = -half + i * cell
            p1 = self._project_point(-half, y_offset, z_front, transform)
            p2 = self._project_point(half, y_offset, z_front, transform)
            self.bg_canvas.create_line(
                p1[0], p1[1], p2[0], p2[1],
                fill=self.grid_line, width=2, tags="cube",
            )
        
        # Символы на поле
        for idx, symbol in enumerate(self.board):
            row, col = divmod(idx, 3)
            
            # Центр ячейки в 3D (на передней грани)
            # row 0 = верх, row 2 = низ → Y от half до -half
            cx_3d = -half + col * cell + cell / 2
            cy_3d = half - row * cell - cell / 2  # Инвертируем Y
            cz_3d = z_front
            
            # Hover подсветка
            if self._hover_cell == idx and not symbol and not self.game_over and not self._is_flipping:
                self._draw_cell_highlight(cx_3d, cy_3d, cz_3d, cell, transform)
            
            if symbol:
                if symbol == "X":
                    self._draw_x_3d(cx_3d, cy_3d, cz_3d, cell * 0.32, transform)
                else:
                    self._draw_o_3d(cx_3d, cy_3d, cz_3d, cell * 0.32, transform)
        
        # Выигрышная линия
        if self.game_over:
            winning = get_winning_line(self.board)
            if winning:
                self._draw_winning_line_3d(winning, transform)

    def _draw_cell_highlight(self, cx: float, cy: float, cz: float, cell: float, transform: dict) -> None:
        """Подсветка ячейки при наведении — космическое свечение."""
        half_cell = cell / 2 * 0.88
        # На передней грани: X — горизонталь, Y — вертикаль
        corners = [
            (cx - half_cell, cy + half_cell, cz),  # верх-лево
            (cx + half_cell, cy + half_cell, cz),  # верх-право
            (cx + half_cell, cy - half_cell, cz),  # низ-право
            (cx - half_cell, cy - half_cell, cz),  # низ-лево
        ]
        points = []
        for x, y, z in corners:
            px, py = self._project_point(x, y, z, transform)
            points.extend([px, py])
        
        # Неоновое свечение
        self.bg_canvas.create_polygon(
            points,
            fill="#2A3555",
            outline="#7B68EE",
            width=2, tags="cube",
        )
        
        # Внутреннее мягкое свечение
        inner_points = []
        half_inner = cell / 2 * 0.75
        inner_corners = [
            (cx - half_inner, cy + half_inner, cz),
            (cx + half_inner, cy + half_inner, cz),
            (cx + half_inner, cy - half_inner, cz),
            (cx - half_inner, cy - half_inner, cz),
        ]
        for x, y, z in inner_corners:
            px, py = self._project_point(x, y, z, transform)
            inner_points.extend([px, py])
        
        self.bg_canvas.create_polygon(
            inner_points,
            fill="",
            outline="#5A4AAA",
            width=1, tags="cube",
        )

    def _draw_x_3d(self, cx: float, cy: float, cz: float, size: float, transform: dict) -> None:
        """Рисует X в 3D на передней грани."""
        # Свечение
        for offset in range(3, 0, -1):
            alpha = 0.15 - offset * 0.04
            glow_color = lerp_color(self.cube_top, self.x_glow, alpha * 2)
            s = size * (1 + offset * 0.1)
            
            # Диагональ \ (верх-лево → низ-право)
            p1 = self._project_point(cx - s, cy + s, cz, transform)
            p2 = self._project_point(cx + s, cy - s, cz, transform)
            self.bg_canvas.create_line(
                p1[0], p1[1], p2[0], p2[1],
                fill=glow_color, width=self.LINE_WIDTH + offset * 2, capstyle="round", tags="cube",
            )
            
            # Диагональ / (верх-право → низ-лево)
            p3 = self._project_point(cx + s, cy + s, cz, transform)
            p4 = self._project_point(cx - s, cy - s, cz, transform)
            self.bg_canvas.create_line(
                p3[0], p3[1], p4[0], p4[1],
                fill=glow_color, width=self.LINE_WIDTH + offset * 2, capstyle="round", tags="cube",
            )
        
        # Основные линии
        p1 = self._project_point(cx - size, cy + size, cz, transform)
        p2 = self._project_point(cx + size, cy - size, cz, transform)
        self.bg_canvas.create_line(
            p1[0], p1[1], p2[0], p2[1],
            fill=self.x_color, width=self.LINE_WIDTH, capstyle="round", tags="cube",
        )
        
        p3 = self._project_point(cx + size, cy + size, cz, transform)
        p4 = self._project_point(cx - size, cy - size, cz, transform)
        self.bg_canvas.create_line(
            p3[0], p3[1], p4[0], p4[1],
            fill=self.x_color, width=self.LINE_WIDTH, capstyle="round", tags="cube",
        )

    def _draw_o_3d(self, cx: float, cy: float, cz: float, radius: float, transform: dict) -> None:
        """Рисует O в 3D (эллипс на наклонной плоскости)."""
        # Свечение
        for offset in range(3, 0, -1):
            alpha = 0.12 - offset * 0.03
            glow_color = lerp_color(self.cube_top, self.o_glow, alpha * 2)
            r = radius * (1 + offset * 0.1)
            self._draw_ellipse_3d(cx, cy, cz, r, transform, glow_color, self.LINE_WIDTH + offset * 2)
        
        # Основной круг
        self._draw_ellipse_3d(cx, cy, cz, radius, transform, self.o_color, self.LINE_WIDTH)

    def _draw_ellipse_3d(self, cx: float, cy: float, cz: float, radius: float, 
                         transform: dict, color: str, width: int) -> None:
        """Рисует эллипс в 3D через аппроксимацию точками."""
        points = []
        segments = 24
        for i in range(segments):
            angle = 2 * math.pi * i / segments
            x = cx + radius * math.cos(angle)
            y = cy + radius * math.sin(angle)
            px, py = self._project_point(x, y, cz, transform)
            points.extend([px, py])
        
        points.extend(points[:2])  # Замыкаем
        self.bg_canvas.create_line(points, fill=color, width=width, smooth=True, tags="cube")

    def _draw_winning_line_3d(self, line: tuple[int, int, int], transform: dict) -> None:
        """Рисует линию победы в 3D на передней грани."""
        size = transform["size"]
        half = size / 2
        cell = size / 3
        z_front = half
        
        def cell_center_3d(idx: int) -> tuple[float, float, float]:
            row, col = divmod(idx, 3)
            cx = -half + col * cell + cell / 2
            cy = half - row * cell - cell / 2  # Инвертируем Y
            return cx, cy, z_front
        
        start = cell_center_3d(line[0])
        end = cell_center_3d(line[2])
        
        # Свечение
        for offset in range(5, 0, -1):
            alpha = 0.25 - offset * 0.04
            glow_color = lerp_color(self.cube_top, self.win_glow, alpha * 2)
            
            p1 = self._project_point(*start, transform)
            p2 = self._project_point(*end, transform)
            self.bg_canvas.create_line(
                p1[0], p1[1], p2[0], p2[1],
                fill=glow_color, width=self.LINE_WIDTH + offset * 3, capstyle="round", tags="cube",
            )
        
        # Основная линия
        p1 = self._project_point(*start, transform)
        p2 = self._project_point(*end, transform)
        self.bg_canvas.create_line(
            p1[0], p1[1], p2[0], p2[1],
            fill=self.win_color, width=self.LINE_WIDTH + 2, capstyle="round", tags="cube",
        )

    # ══════════════════════════════════════════════════════════════════════
    # АНИМАЦИЯ ПЕРЕВОРОТА
    # ══════════════════════════════════════════════════════════════════════

    def _animate_flip(self, step: int = 0) -> None:
        """Анимация переворота куба."""
        if step > self.FLIP_STEPS:
            self._is_flipping = False
            self._flip_angle = 0.0
            self._draw_cube()
            return
        
        # Easing функция для плавности
        t = step / self.FLIP_STEPS
        eased = 1 - math.pow(1 - t, 3)  # ease-out cubic
        
        self._flip_angle = eased * 360 * self._flip_direction
        self._draw_cube()
        
        anim_id = self.root.after(self.FLIP_DELAY, lambda: self._animate_flip(step + 1))
        self._animation_ids.append(anim_id)

    def _animate_shake(self, step: int = 0, total_steps: int = 20) -> None:
        """Анимация тряски куба при победе."""
        if step >= total_steps:
            self._is_shaking = False
            self._shake_offset_x = 0.0
            self._shake_offset_y = 0.0
            self._draw_cube()
            return
        
        self._is_shaking = True
        
        # Уменьшающаяся амплитуда тряски
        decay = 1 - (step / total_steps)
        amplitude = 12 * decay
        
        # Случайное смещение
        self._shake_offset_x = random.uniform(-amplitude, amplitude)
        self._shake_offset_y = random.uniform(-amplitude, amplitude)
        
        self._draw_cube()
        
        anim_id = self.root.after(30, lambda: self._animate_shake(step + 1, total_steps))
        self._animation_ids.append(anim_id)

    def _animate_symbol(self, idx: int, symbol: str, step: int = 0) -> None:
        """Анимация появления символа."""
        if step > self.ANIM_STEPS:
            self._draw_cube()
            return
        
        self._draw_cube()
        
        anim_id = self.root.after(self.ANIM_DELAY, lambda: self._animate_symbol(idx, symbol, step + 1))
        self._animation_ids.append(anim_id)

    # ══════════════════════════════════════════════════════════════════════
    # ОПРЕДЕЛЕНИЕ ЯЧЕЙКИ ПО КЛИКУ
    # ══════════════════════════════════════════════════════════════════════

    def _get_cell_at(self, mx: int, my: int) -> int | None:
        """Определяет ячейку по координатам мыши на передней грани."""
        if self._is_flipping:
            return None
        
        transform = self._get_cube_transform(0)
        size = transform["size"]
        half = size / 2
        cell = size / 3
        z_front = half
        
        # Проверяем каждую ячейку
        for idx in range(9):
            row, col = divmod(idx, 3)
            
            # Центр ячейки на передней грани
            cx_3d = -half + col * cell + cell / 2
            cy_3d = half - row * cell - cell / 2  # row 0 = верх
            
            # Углы ячейки
            half_cell = cell / 2
            corners_3d = [
                (cx_3d - half_cell, cy_3d + half_cell, z_front),  # верх-лево
                (cx_3d + half_cell, cy_3d + half_cell, z_front),  # верх-право
                (cx_3d + half_cell, cy_3d - half_cell, z_front),  # низ-право
                (cx_3d - half_cell, cy_3d - half_cell, z_front),  # низ-лево
            ]
            
            # Проецируем углы
            corners_2d = [self._project_point(x, y, z, transform) for x, y, z in corners_3d]
            
            # Проверяем, находится ли точка внутри четырёхугольника
            if self._point_in_polygon(mx, my, corners_2d):
                return idx
        
        return None

    def _point_in_polygon(self, x: float, y: float, polygon: list[tuple[float, float]]) -> bool:
        """Проверяет, находится ли точка внутри полигона."""
        n = len(polygon)
        inside = False
        
        j = n - 1
        for i in range(n):
            xi, yi = polygon[i]
            xj, yj = polygon[j]
            
            if ((yi > y) != (yj > y)) and (x < (xj - xi) * (y - yi) / (yj - yi) + xi):
                inside = not inside
            j = i
        
        return inside

    # ══════════════════════════════════════════════════════════════════════
    # ОБРАБОТЧИКИ СОБЫТИЙ
    # ══════════════════════════════════════════════════════════════════════

    def _is_over_button(self, x: int, y: int) -> bool:
        """Проверяет, находится ли курсор над кнопкой."""
        if not hasattr(self, '_btn_bounds'):
            return False
        x1, y1, x2, y2 = self._btn_bounds
        return x1 <= x <= x2 and y1 <= y <= y2

    def _on_mouse_move(self, event: tk.Event) -> None:
        # Проверка hover над кнопкой
        over_btn = self._is_over_button(event.x, event.y)
        if over_btn != self._btn_hovered:
            self._btn_hovered = over_btn
            self._draw_button()
            # Меняем курсор
            self.bg_canvas.configure(cursor="hand2" if over_btn else "")
        
        if self.game_over or self._is_flipping:
            return
        cell = self._get_cell_at(event.x, event.y)
        if cell != self._hover_cell:
            self._hover_cell = cell
            self._draw_cube()

    def _on_mouse_leave(self, event: tk.Event) -> None:
        if self._btn_hovered:
            self._btn_hovered = False
            self._draw_button()
            self.bg_canvas.configure(cursor="")
        if self._hover_cell is not None:
            self._hover_cell = None
            self._draw_cube()

    def _on_click(self, event: tk.Event) -> None:
        # Проверка клика по кнопке
        if self._is_over_button(event.x, event.y):
            if self._btn_command:
                self._btn_command()
            return
        
        if self.game_over or self._is_flipping:
            return
        cell = self._get_cell_at(event.x, event.y)
        if cell is not None and not self.board[cell]:
            self.on_player_click(cell)

    def reset(self, animate: bool = True) -> None:
        for anim_id in self._animation_ids:
            self.root.after_cancel(anim_id)
        self._animation_ids.clear()
        
        self.board = [""] * 9
        self.game_over = False
        self._telegram_sent = False
        self._promo_code = None
        self._hover_cell = None
        self._is_flipping = False  # Сбрасываем флаг анимации
        self._flip_angle = 0.0
        self._is_shaking = False
        self._shake_offset_x = 0.0
        self._shake_offset_y = 0.0
        
        # Скрываем оверлеи
        self.bg_canvas.delete("promo_overlay")
        self.bg_canvas.delete("loss_overlay")
        
        # Анимация переворота
        if animate:
            self._is_flipping = True
            self._game_number += 1
            self._flip_direction = 1 if self._game_number % 2 == 1 else -1
            self._animate_flip()
        else:
            self._draw_cube()

        # Сброс кнопки
        self._btn_text = "Начать заново"
        self._btn_color = self.moon_pink
        self._btn_command = self.reset
        self._draw_button()

    def copy_promo(self) -> None:
        if not self._promo_code:
            return
        self.root.clipboard_clear()
        self.root.clipboard_append(self._promo_code)
        self._btn_text = "✨ Скопировано! Нажми для новой игры"
        self._btn_command = self.reset
        self._draw_button()

    def on_player_click(self, idx: int) -> None:
        if self._game_blocked or self.game_over or self.board[idx] or self._is_flipping:
            return

        self._place(idx, "X")
        self._after_move()

        if self.game_over:
            return

        self.root.after(450, self._computer_turn)

    def _computer_turn(self) -> None:
        if self.game_over:
            return
        idx = best_move_for_o(self.board)
        self._place(idx, "O")
        self._after_move()

    def _place(self, idx: int, symbol: str) -> None:
        self.board[idx] = symbol
        self._animate_symbol(idx, symbol)

    def _after_move(self) -> None:
        result = check_winner(self.board)
        if result is None:
            return
        
        self.game_over = True
        self.root.after(self.ANIM_STEPS * self.ANIM_DELAY + 50, self._draw_cube)
        
        if result == "draw":
            self.root.after(350, self._handle_draw)
            return

        if result == "X":
            self.root.after(350, self._handle_player_win)
        else:
            self.root.after(350, self._handle_player_loss)

    def _handle_draw(self) -> None:
        self._btn_text = "Ничья — ещё раз?"
        self._btn_command = self.reset
        self._draw_button()

    def _handle_player_win(self) -> None:
        self._promo_code = str(random.randint(10000, 99999))
        
        self._btn_text = f"🎉 Промокод: {self._promo_code} отправлен в телеграм"
        self._btn_command = self.reset
        self._draw_button()
        
        # Тряска куба при победе
        self._animate_shake()

        if not self._telegram_sent:
            self._telegram_sent = True
            # Отправляем сообщение напрямую пользователю
            if self._telegram_chat_id:
                send_telegram_message(
                    f"🏆 <b>Поздравляем с победой!</b>\n\n"
                    f"🎁 Ваш промокод: <code>{self._promo_code}</code>\n\n"
                    f"Спасибо за игру! 🎮",
                    chat_id=str(self._telegram_chat_id)
                )

    def _handle_player_loss(self) -> None:
        self._btn_text = "😔 Не повезло — сыграть ещё раз?"
        self._btn_command = self.reset
        self._draw_button()

        if not self._telegram_sent:
            self._telegram_sent = True
            # Отправляем сообщение напрямую пользователю
            if self._telegram_chat_id:
                send_telegram_message(
                    f"😔 <b>Не повезло...</b>\n\n"
                    f"Попробуйте ещё раз — удача обязательно улыбнётся! 🍀",
                    chat_id=str(self._telegram_chat_id)
                )

    def _draw_loss_overlay(self) -> None:
        """Рисует оверлей с предложением сыграть ещё раз при проигрыше."""
        self.bg_canvas.delete("loss_overlay")
        
        # Получаем размеры canvas
        canvas_width = self.bg_canvas.winfo_width()
        canvas_height = self.bg_canvas.winfo_height()
        
        if canvas_width <= 1:
            canvas_width = 520
        if canvas_height <= 1:
            canvas_height = 820
        
        cx = canvas_width // 2
        cy = canvas_height // 2
        
        # Размеры оверлея
        box_width = 360
        box_height = 200
        
        x1, y1 = cx - box_width // 2, cy - box_height // 2
        x2, y2 = cx + box_width // 2, cy + box_height // 2
        
        # Внешняя тень
        shadow_offset = 6
        r = 16
        self._draw_rounded_rect(
            x1 + shadow_offset, y1 + shadow_offset,
            x2 + shadow_offset, y2 + shadow_offset,
            r, "#000000", "loss_overlay"
        )
        
        # Основной фон (тёмный с красным оттенком)
        self._draw_rounded_rect(x1, y1, x2, y2, r, "#1F1418", "loss_overlay")
        
        # Внутренняя рамка (красное свечение)
        self._draw_rounded_rect_outline(
            x1 + 3, y1 + 3, x2 - 3, y2 - 3,
            r - 2, self.loss_color, 2, "loss_overlay"
        )
        
        # Шрифты
        try:
            header_font = tkfont.Font(family="Palatino", size=28, weight="bold")
            text_font = tkfont.Font(family="Palatino", size=16)
            btn_font = tkfont.Font(family="Palatino", size=14, weight="bold")
        except Exception:
            header_font = tkfont.Font(family="Arial", size=28, weight="bold")
            text_font = tkfont.Font(family="Arial", size=16)
            btn_font = tkfont.Font(family="Arial", size=14, weight="bold")
        
        # Эмодзи и заголовок
        self.bg_canvas.create_text(
            cx, y1 + 50,
            text="😔 Не повезло...",
            fill=self.loss_color,
            font=header_font,
            anchor="center",
            tags="loss_overlay"
        )
        
        # Предложение
        self.bg_canvas.create_text(
            cx, y1 + 95,
            text="Попробуйте ещё раз!",
            fill=self.text_secondary,
            font=text_font,
            anchor="center",
            tags="loss_overlay"
        )
        
        # Кнопка "Сыграть ещё"
        btn_y = y1 + 155
        btn_width = 180
        btn_height = 45
        
        self._draw_rounded_rect(
            cx - btn_width // 2, btn_y - btn_height // 2,
            cx + btn_width // 2, btn_y + btn_height // 2,
            10, self.moon_pink, "loss_overlay"
        )
        
        self.bg_canvas.create_text(
            cx, btn_y,
            text="🔄 Сыграть ещё",
            fill="#1A1E2E",
            font=btn_font,
            anchor="center",
            tags=("loss_overlay", "retry_btn")
        )
        
        # Сохраняем границы кнопки
        self._retry_btn_bounds = (
            cx - btn_width // 2, btn_y - btn_height // 2,
            cx + btn_width // 2, btn_y + btn_height // 2
        )
        
        # Привязываем обработчик
        self.bg_canvas.tag_bind("retry_btn", "<Button-1>", self._on_retry_click)
        
        # Поднимаем оверлей наверх
        self.bg_canvas.tag_raise("loss_overlay")

    def _on_retry_click(self, event) -> None:
        """Обрабатывает нажатие кнопки 'Сыграть ещё'."""
        self.bg_canvas.delete("loss_overlay")
        self.reset()


def main() -> None:
    root = tk.Tk()
    TicTacToeApp(root)
    root.mainloop()


if __name__ == "__main__":
    main()
