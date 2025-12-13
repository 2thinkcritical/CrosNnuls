import math
import os
import random
import tkinter as tk
from tkinter import font as tkfont

import requests


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


def send_telegram_message(text: str) -> None:
    token = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
    chat_id = os.getenv("TELEGRAM_CHAT_ID", "").strip()
    if not token or not chat_id:
        return

    try:
        requests.post(
            f"https://api.telegram.org/bot{token}/sendMessage",
            json={"chat_id": chat_id, "text": text},
            timeout=5,
        ).raise_for_status()
    except Exception as exc:  # noqa: BLE001 - best-effort уведомление
        print(f"[warn] Telegram send failed: {exc}")


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
    """
    Лёгкий ИИ — специально ослаблен, чтобы игрок мог выигрывать.
    """
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
    """Линейная интерполяция между двумя цветами."""
    r1, g1, b1 = int(c1[1:3], 16), int(c1[3:5], 16), int(c1[5:7], 16)
    r2, g2, b2 = int(c2[1:3], 16), int(c2[3:5], 16), int(c2[5:7], 16)
    r = int(r1 + (r2 - r1) * t)
    g = int(g1 + (g2 - g1) * t)
    b = int(b1 + (b2 - b1) * t)
    return f"#{r:02x}{g:02x}{b:02x}"


def hex_to_rgb(hex_color: str) -> tuple[int, int, int]:
    return int(hex_color[1:3], 16), int(hex_color[3:5], 16), int(hex_color[5:7], 16)


def rgb_to_hex(r: int, g: int, b: int) -> str:
    return f"#{max(0, min(255, r)):02x}{max(0, min(255, g)):02x}{max(0, min(255, b)):02x}"


class TicTacToeApp:
    CELL_SIZE = 120
    PADDING = 24
    LINE_WIDTH = 6
    SYMBOL_PADDING = 28
    ANIM_STEPS = 18
    ANIM_DELAY = 12

    def __init__(self, root: tk.Tk) -> None:
        self.root = root
        self.root.title("Крестики-нолики")
        
        # Размеры окна
        win_width = 520
        win_height = 860
        
        # Центрируем окно на экране
        screen_width = root.winfo_screenwidth()
        screen_height = root.winfo_screenheight()
        x = (screen_width - win_width) // 2
        y = (screen_height - win_height) // 2
        
        self.root.geometry(f"{win_width}x{win_height}+{x}+{y}")
        self.root.minsize(win_width, win_height)
        self.root.resizable(True, True)

        # ══════════════════════════════════════════════════════════════════
        # ЭЛЕГАНТНАЯ ПАЛИТРА — dusty rose, rose gold, тёплый крем
        # Для женской аудитории 25-40: утончённо, премиально, уютно
        # ══════════════════════════════════════════════════════════════════
        
        # Основные фоны — тёплый крем с розовым оттенком
        self.bg_main = "#F9F5F2"           # Тёплый кремовый
        self.bg_gradient_top = "#FDF8F5"   # Светлее сверху
        self.bg_gradient_bottom = "#F5EBE6" # Теплее снизу
        
        # Карточки и поверхности
        self.bg_card = "#FFFFFF"           # Чистый белый для карточек
        self.bg_card_shadow = "#E8DDD6"    # Тёплая тень
        self.bg_cell = "#FBF7F4"           # Очень светлый крем для ячеек
        self.bg_cell_hover = "#F5EDE7"     # Hover — теплее
        
        # Границы и линии — rose gold
        self.border_light = "#E8DCD4"      # Светлая граница
        self.border_accent = "#D4A89A"     # Rose gold граница
        self.grid_line = "#E5D5CC"         # Сетка — нежный rose gold
        
        # Символ X — глубокий dusty rose
        self.x_color = "#C67B7B"           # Пыльная роза
        self.x_glow = "#E8B4B4"            # Свечение X
        self.x_gradient_light = "#D99A9A"  # Светлый для градиента
        
        # Символ O — благородный mauve/сливовый
        self.o_color = "#9B7E9B"           # Маув
        self.o_glow = "#C9B3C9"            # Свечение O
        self.o_gradient_light = "#B399B3"  # Светлый для градиента
        
        # Текст — тёплые тона
        self.text_primary = "#5D4E4E"      # Тёплый тёмно-коричневый
        self.text_secondary = "#7A6B6B"    # Приглушённый
        self.text_muted = "#9A8B8B"        # Очень мягкий
        self.text_light = "#B8A8A8"        # Для декора
        
        # Статусы
        self.win_color = "#7BAF9B"         # Благородный шалфей для победы
        self.win_glow = "#A8D4C0"          # Свечение победы
        self.win_bg = "#EDF7F3"            # Фон победы
        
        self.loss_color = "#C9A8A8"        # Пепельная роза для проигрыша
        self.loss_bg = "#FAF3F3"           # Фон проигрыша
        
        self.draw_color = "#C4A574"        # Тёплое золото для ничьей
        self.draw_bg = "#FAF6EF"           # Фон ничьей
        
        # Акцентные кнопки — rose gold
        self.accent = "#C9907E"            # Rose gold основной
        self.accent_hover = "#B87D6B"      # Rose gold hover
        self.accent_light = "#E8C4B8"      # Светлый акцент
        
        # Вторичные кнопки
        self.btn_secondary = "#EDE5DF"     # Тёплый светлый
        self.btn_secondary_hover = "#E3D8D0"
        self.btn_text = "#6B5B5B"          # Текст кнопок

        self.root.configure(bg=self.bg_main)

        self.board: list[str] = [""] * 9
        self.game_over = False
        self._telegram_sent = False
        self._promo_code: str | None = None
        self._hover_cell: int | None = None
        self._animation_ids: list[str] = []
        self._pulse_phase: float = 0.0
        self._is_pulsing = False
        self._sparkles: list[dict] = []

        self._build_ui()
        self.reset()

    def _build_ui(self) -> None:
        # ══════════════════════════════════════════════════════════════════
        # Декоративный фоновый Canvas для создания глубины
        # ══════════════════════════════════════════════════════════════════
        self.bg_canvas = tk.Canvas(
            self.root, 
            bg=self.bg_main, 
            highlightthickness=0
        )
        self.bg_canvas.place(x=0, y=0, relwidth=1, relheight=1)
        
        # Рисуем декоративные элементы на фоне
        self._draw_background_decor()
        
        # Обработчик изменения размера окна
        self.root.bind("<Configure>", self._on_window_resize)

        # Основной контейнер
        self.container = tk.Frame(self.root, bg=self.bg_main)
        self.container.place(relx=0.5, rely=0.5, anchor="center")

        # ══════════════════════════════════════════════════════════════════
        # Заголовок — элегантный, с декоративным элементом
        # ══════════════════════════════════════════════════════════════════
        self.header_frame = tk.Frame(self.container, bg=self.bg_main)
        self.header_frame.pack(fill="x", pady=(0, 20))

        # Декоративная линия сверху
        self.decor_line_top = tk.Canvas(
            self.header_frame, width=180, height=20, 
            bg=self.bg_main, highlightthickness=0
        )
        self.decor_line_top.pack(pady=(0, 8))
        self._draw_decorative_line(self.decor_line_top, 180, 10)

        try:
            title_font = tkfont.Font(family="Palatino", size=28, weight="normal")
        except Exception:
            try:
                title_font = tkfont.Font(family="Georgia", size=28, weight="normal")
            except Exception:
                title_font = tkfont.Font(family="Times New Roman", size=28, weight="normal")

        self.title_lbl = tk.Label(
            self.header_frame,
            text="Крестики-нолики",
            bg=self.bg_main,
            fg=self.text_primary,
            font=title_font,
        )
        self.title_lbl.pack()

        try:
            subtitle_font = tkfont.Font(family="Palatino", size=12, slant="italic")
        except Exception:
            try:
                subtitle_font = tkfont.Font(family="Georgia", size=12, slant="italic")
            except Exception:
                subtitle_font = tkfont.Font(family="Times New Roman", size=12, slant="italic")

        self.subtitle_lbl = tk.Label(
            self.header_frame,
            text="Выиграй и получи промокод",
            bg=self.bg_main,
            fg=self.text_muted,
            font=subtitle_font,
        )
        self.subtitle_lbl.pack(pady=(4, 0))

        # ══════════════════════════════════════════════════════════════════
        # Игровое поле — с тенью и изящным обрамлением
        # ══════════════════════════════════════════════════════════════════
        board_size = self.CELL_SIZE * 3 + self.PADDING * 2
        
        # Внешний контейнер для тени
        self.board_outer = tk.Frame(self.container, bg=self.bg_main)
        self.board_outer.pack(pady=(0, 20))
        
        # Canvas для тени
        shadow_offset = 6
        self.shadow_canvas = tk.Canvas(
            self.board_outer,
            width=board_size + 28 + shadow_offset,
            height=board_size + 28 + shadow_offset,
            bg=self.bg_main,
            highlightthickness=0,
        )
        self.shadow_canvas.pack()
        
        # Рисуем мягкую тень
        for i in range(6):
            alpha = 0.08 - i * 0.012
            shadow_color = lerp_color(self.bg_main, self.bg_card_shadow, alpha * 5)
            self.shadow_canvas.create_rectangle(
                shadow_offset - i, shadow_offset - i,
                board_size + 24 + shadow_offset + i, board_size + 24 + shadow_offset + i,
                fill=shadow_color, outline=""
            )
        
        # Основная карточка поля
        self.board_frame = tk.Frame(
            self.shadow_canvas,
            bg=self.bg_card,
        )
        self.shadow_canvas.create_window(
            12, 12, 
            window=self.board_frame, 
            anchor="nw"
        )
        
        # Декоративная рамка
        self.border_canvas = tk.Canvas(
            self.board_frame,
            width=board_size + 4,
            height=board_size + 4,
            bg=self.bg_card,
            highlightthickness=1,
            highlightbackground=self.border_light,
        )
        self.border_canvas.pack(padx=10, pady=10)

        self.canvas = tk.Canvas(
            self.border_canvas,
            width=board_size,
            height=board_size,
            bg=self.bg_card,
            highlightthickness=0,
        )
        self.border_canvas.create_window(2, 2, window=self.canvas, anchor="nw")

        self.canvas.bind("<Motion>", self._on_mouse_move)
        self.canvas.bind("<Leave>", self._on_mouse_leave)
        self.canvas.bind("<Button-1>", self._on_click)

        # ══════════════════════════════════════════════════════════════════
        # Карточка статуса — элегантная, информативная
        # ══════════════════════════════════════════════════════════════════
        self.status_outer = tk.Frame(self.container, bg=self.bg_main)
        self.status_outer.pack(fill="x", pady=(0, 16))
        
        self.status_frame = tk.Frame(
            self.status_outer,
            bg=self.bg_card,
            highlightthickness=1,
            highlightbackground=self.border_light,
        )
        self.status_frame.pack(fill="x", padx=20)

        self.status_inner = tk.Frame(self.status_frame, bg=self.bg_card)
        self.status_inner.pack(pady=16)

        # Иконка хода (декоративная точка)
        self.status_indicator = tk.Canvas(
            self.status_inner,
            width=12,
            height=12,
            bg=self.bg_card,
            highlightthickness=0,
        )
        self.status_indicator.pack(side="left", padx=(0, 10))
        self._status_dot = self.status_indicator.create_oval(1, 1, 11, 11, fill=self.x_color, outline="")

        try:
            status_font = tkfont.Font(family="Palatino", size=15, weight="bold")
        except Exception:
            try:
                status_font = tkfont.Font(family="Georgia", size=15, weight="bold")
            except Exception:
                status_font = tkfont.Font(family="Times New Roman", size=15, weight="bold")

        self.status_lbl = tk.Label(
            self.status_inner,
            text="Твой ход",
            bg=self.bg_card,
            fg=self.text_primary,
            font=status_font,
        )
        self.status_lbl.pack(side="left")

        # Разделитель
        self.separator = tk.Frame(self.status_frame, bg=self.border_light, height=1)
        self.separator.pack(fill="x", padx=20, pady=(0, 12))

        try:
            detail_font = tkfont.Font(family="Palatino", size=11)
        except Exception:
            try:
                detail_font = tkfont.Font(family="Georgia", size=11)
            except Exception:
                detail_font = tkfont.Font(family="Times New Roman", size=11)

        self.detail_lbl = tk.Label(
            self.status_frame,
            text="Ты играешь за × · Компьютер за ○",
            bg=self.bg_card,
            fg=self.text_muted,
            font=detail_font,
            wraplength=380,
            justify="center",
        )
        self.detail_lbl.pack(pady=(0, 16))

        # Кнопки действий (скрыты по умолчанию)
        self.actions = tk.Frame(self.status_frame, bg=self.bg_card)

        try:
            btn_font = tkfont.Font(family="Palatino", size=11, weight="bold")
        except Exception:
            try:
                btn_font = tkfont.Font(family="Georgia", size=11, weight="bold")
            except Exception:
                btn_font = tkfont.Font(family="Times New Roman", size=11, weight="bold")

        self.copy_btn = tk.Button(
            self.actions,
            text="Скопировать промокод",
            font=btn_font,
            fg="#FFFFFF",
            bg=self.accent,
            activeforeground="#FFFFFF",
            activebackground=self.accent_hover,
            bd=0,
            relief="flat",
            cursor="hand2",
            command=self.copy_promo,
        )
        self.copy_btn.bind("<Enter>", lambda e: self.copy_btn.configure(bg=self.accent_hover))
        self.copy_btn.bind("<Leave>", lambda e: self.copy_btn.configure(bg=self.accent))

        self.retry_btn = tk.Button(
            self.actions,
            text="Сыграть ещё раз",
            font=btn_font,
            fg="#FFFFFF",
            bg=self.accent,
            activeforeground="#FFFFFF",
            activebackground=self.accent_hover,
            bd=0,
            relief="flat",
            cursor="hand2",
            command=self.reset,
        )
        self.retry_btn.bind("<Enter>", lambda e: self.retry_btn.configure(bg=self.accent_hover))
        self.retry_btn.bind("<Leave>", lambda e: self.retry_btn.configure(bg=self.accent))

        # ══════════════════════════════════════════════════════════════════
        # Кнопка "Новая игра" — вторичный стиль
        # ══════════════════════════════════════════════════════════════════
        try:
            restart_font = tkfont.Font(family="Palatino", size=11)
        except Exception:
            try:
                restart_font = tkfont.Font(family="Georgia", size=11)
            except Exception:
                restart_font = tkfont.Font(family="Times New Roman", size=11)

        self.restart_btn = tk.Button(
            self.container,
            text="Начать заново",
            font=restart_font,
            fg=self.btn_text,
            bg=self.btn_secondary,
            activeforeground=self.btn_text,
            activebackground=self.btn_secondary_hover,
            bd=0,
            relief="flat",
            cursor="hand2",
            command=self.reset,
        )
        self.restart_btn.pack(pady=(0, 20), ipadx=24, ipady=10)
        self.restart_btn.bind("<Enter>", lambda e: self.restart_btn.configure(bg=self.btn_secondary_hover))
        self.restart_btn.bind("<Leave>", lambda e: self.restart_btn.configure(bg=self.btn_secondary))

        # ══════════════════════════════════════════════════════════════════
        # Футер — минималистичный
        # ══════════════════════════════════════════════════════════════════
        # Декоративная линия
        self.decor_line_bottom = tk.Canvas(
            self.container, width=120, height=16, 
            bg=self.bg_main, highlightthickness=0
        )
        self.decor_line_bottom.pack(pady=(0, 8))
        self._draw_decorative_line(self.decor_line_bottom, 120, 8)

        try:
            footer_font = tkfont.Font(family="Palatino", size=10, slant="italic")
        except Exception:
            try:
                footer_font = tkfont.Font(family="Georgia", size=10, slant="italic")
            except Exception:
                footer_font = tkfont.Font(family="Times New Roman", size=10, slant="italic")

        self.footer = tk.Label(
            self.container,
            text="Удачи в игре",
            bg=self.bg_main,
            fg=self.text_light,
            font=footer_font,
        )
        self.footer.pack(anchor="center")

    def _on_window_resize(self, event: tk.Event) -> None:
        """Перерисовывает фон при изменении размера окна."""
        if event.widget == self.root:
            self._draw_background_decor()

    def _draw_background_decor(self) -> None:
        """Рисует декоративные элементы на фоне."""
        self.bg_canvas.delete("bg_decor")
        
        # Получаем текущие размеры окна
        w = self.root.winfo_width()
        h = self.root.winfo_height()
        
        if w < 10 or h < 10:  # Окно ещё не инициализировано
            w, h = 520, 860
        
        # Мягкий градиент-эффект через круги (масштабируем относительно размера)
        for i in range(3):
            x = int(w * 0.1) + i * int(w * 0.35)
            y = int(h * 0.12) + i * int(h * 0.28)
            r = 150 + i * 50
            color = lerp_color(self.bg_main, self.border_light, 0.15)
            self.bg_canvas.create_oval(
                x - r, y - r, x + r, y + r,
                fill=color, outline="", tags="bg_decor"
            )
        
        # Дополнительные декоративные круги
        positions = [
            (int(w * 0.85), int(h * 0.18), 80),
            (int(w * 0.13), int(h * 0.7), 100),
            (int(w * 0.92), int(h * 0.82), 120)
        ]
        for x, y, r in positions:
            color = lerp_color(self.bg_main, self.accent_light, 0.08)
            self.bg_canvas.create_oval(
                x - r, y - r, x + r, y + r,
                fill=color, outline="", tags="bg_decor"
            )

    def _draw_decorative_line(self, canvas: tk.Canvas, width: int, cy: int) -> None:
        """Рисует декоративную линию с ромбиком."""
        mid = width // 2
        line_len = 50
        
        # Левая линия
        canvas.create_line(
            mid - line_len, cy, mid - 8, cy,
            fill=self.border_light, width=1
        )
        # Правая линия
        canvas.create_line(
            mid + 8, cy, mid + line_len, cy,
            fill=self.border_light, width=1
        )
        # Ромбик в центре
        canvas.create_polygon(
            mid, cy - 4, mid + 4, cy, mid, cy + 4, mid - 4, cy,
            fill=self.border_accent, outline=""
        )

    def _draw_board(self) -> None:
        """Отрисовка игрового поля."""
        self.canvas.delete("all")
        
        p = self.PADDING
        cs = self.CELL_SIZE

        # Фон ячеек
        for row in range(3):
            for col in range(3):
                x1 = p + col * cs + 4
                y1 = p + row * cs + 4
                x2 = p + (col + 1) * cs - 4
                y2 = p + (row + 1) * cs - 4
                
                idx = row * 3 + col
                is_hover = self._hover_cell == idx and not self.board[idx] and not self.game_over
                fill = self.bg_cell_hover if is_hover else self.bg_cell
                
                self._draw_rounded_rect(x1, y1, x2, y2, 8, fill)
                
                # Тонкая рамка для hover
                if is_hover:
                    self._draw_rounded_rect_outline(x1, y1, x2, y2, 8, self.border_accent)

        # Сетка — тонкие элегантные линии
        for i in range(1, 3):
            # Вертикальные
            x = p + i * cs
            self.canvas.create_line(
                x, p + 16, x, p + 3 * cs - 16,
                fill=self.grid_line, width=1
            )
            # Горизонтальные
            y = p + i * cs
            self.canvas.create_line(
                p + 16, y, p + 3 * cs - 16, y,
                fill=self.grid_line, width=1
            )

        # Символы
        for idx, symbol in enumerate(self.board):
            if symbol:
                row, col = divmod(idx, 3)
                cx = p + col * cs + cs // 2
                cy = p + row * cs + cs // 2
                
                if symbol == "X":
                    self._draw_x(cx, cy, 1.0)
                else:
                    self._draw_o(cx, cy, 1.0)

        # Выигрышная линия
        if self.game_over:
            winning = get_winning_line(self.board)
            if winning:
                self._draw_winning_line(winning)

    def _draw_rounded_rect(self, x1: int, y1: int, x2: int, y2: int, r: int, fill: str) -> None:
        """Рисует прямоугольник с закруглёнными углами."""
        self.canvas.create_arc(x1, y1, x1 + 2*r, y1 + 2*r, start=90, extent=90, fill=fill, outline="")
        self.canvas.create_arc(x2 - 2*r, y1, x2, y1 + 2*r, start=0, extent=90, fill=fill, outline="")
        self.canvas.create_arc(x1, y2 - 2*r, x1 + 2*r, y2, start=180, extent=90, fill=fill, outline="")
        self.canvas.create_arc(x2 - 2*r, y2 - 2*r, x2, y2, start=270, extent=90, fill=fill, outline="")
        self.canvas.create_rectangle(x1 + r, y1, x2 - r, y2, fill=fill, outline="")
        self.canvas.create_rectangle(x1, y1 + r, x2, y2 - r, fill=fill, outline="")

    def _draw_rounded_rect_outline(self, x1: int, y1: int, x2: int, y2: int, r: int, color: str) -> None:
        """Рисует контур закруглённого прямоугольника."""
        self.canvas.create_arc(x1, y1, x1 + 2*r, y1 + 2*r, start=90, extent=90, style="arc", outline=color)
        self.canvas.create_arc(x2 - 2*r, y1, x2, y1 + 2*r, start=0, extent=90, style="arc", outline=color)
        self.canvas.create_arc(x1, y2 - 2*r, x1 + 2*r, y2, start=180, extent=90, style="arc", outline=color)
        self.canvas.create_arc(x2 - 2*r, y2 - 2*r, x2, y2, start=270, extent=90, style="arc", outline=color)
        self.canvas.create_line(x1 + r, y1, x2 - r, y1, fill=color)
        self.canvas.create_line(x1 + r, y2, x2 - r, y2, fill=color)
        self.canvas.create_line(x1, y1 + r, x1, y2 - r, fill=color)
        self.canvas.create_line(x2, y1 + r, x2, y2 - r, fill=color)

    def _draw_x(self, cx: int, cy: int, progress: float) -> None:
        """Рисует крестик с мягким градиентным свечением."""
        sp = self.SYMBOL_PADDING
        size = (self.CELL_SIZE // 2 - sp) * progress
        
        # Мягкое многослойное свечение
        for offset in range(5, 0, -1):
            glow_alpha = 0.15 - offset * 0.025
            glow_color = lerp_color(self.bg_cell, self.x_glow, glow_alpha * 2)
            w = self.LINE_WIDTH + offset * 3
            self.canvas.create_line(
                cx - size, cy - size, cx + size, cy + size,
                fill=glow_color, width=w, capstyle="round",
            )
            self.canvas.create_line(
                cx + size, cy - size, cx - size, cy + size,
                fill=glow_color, width=w, capstyle="round",
            )
        
        # Основные линии с лёгким градиентом
        self.canvas.create_line(
            cx - size, cy - size, cx + size, cy + size,
            fill=self.x_color, width=self.LINE_WIDTH, capstyle="round",
        )
        self.canvas.create_line(
            cx + size, cy - size, cx - size, cy + size,
            fill=self.x_color, width=self.LINE_WIDTH, capstyle="round",
        )

    def _draw_o(self, cx: int, cy: int, progress: float) -> None:
        """Рисует нолик с мягким градиентным свечением."""
        sp = self.SYMBOL_PADDING
        radius = (self.CELL_SIZE // 2 - sp) * progress
        
        # Мягкое многослойное свечение
        for offset in range(5, 0, -1):
            glow_alpha = 0.12 - offset * 0.02
            glow_color = lerp_color(self.bg_cell, self.o_glow, glow_alpha * 2)
            w = self.LINE_WIDTH + offset * 3
            self.canvas.create_oval(
                cx - radius, cy - radius, cx + radius, cy + radius,
                outline=glow_color, width=w,
            )
        
        # Основной круг
        self.canvas.create_oval(
            cx - radius, cy - radius, cx + radius, cy + radius,
            outline=self.o_color, width=self.LINE_WIDTH,
        )

    def _draw_winning_line(self, line: tuple[int, int, int]) -> None:
        """Рисует линию победы с эффектом свечения."""
        p = self.PADDING
        cs = self.CELL_SIZE
        
        def cell_center(idx: int) -> tuple[int, int]:
            row, col = divmod(idx, 3)
            return p + col * cs + cs // 2, p + row * cs + cs // 2
        
        x1, y1 = cell_center(line[0])
        x2, y2 = cell_center(line[2])
        
        # Многослойное свечение
        for offset in range(8, 0, -1):
            glow_alpha = 0.25 - offset * 0.028
            glow_color = lerp_color(self.bg_card, self.win_glow, glow_alpha * 2)
            self.canvas.create_line(
                x1, y1, x2, y2,
                fill=glow_color, width=self.LINE_WIDTH + offset * 4, capstyle="round",
            )
        
        # Основная линия
        self.canvas.create_line(
            x1, y1, x2, y2,
            fill=self.win_color, width=self.LINE_WIDTH + 2, capstyle="round",
        )

    def _animate_symbol(self, idx: int, symbol: str, step: int = 0) -> None:
        """Анимация появления символа с плавным easing."""
        if step > self.ANIM_STEPS:
            self._draw_board()
            return
        
        progress = self._ease_out_back(step / self.ANIM_STEPS)
        
        old_val = self.board[idx]
        self.board[idx] = ""
        self._draw_board()
        self.board[idx] = old_val
        
        row, col = divmod(idx, 3)
        p = self.PADDING
        cs = self.CELL_SIZE
        cx = p + col * cs + cs // 2
        cy = p + row * cs + cs // 2
        
        if symbol == "X":
            self._draw_x(cx, cy, progress)
        else:
            self._draw_o(cx, cy, progress)
        
        anim_id = self.root.after(self.ANIM_DELAY, lambda: self._animate_symbol(idx, symbol, step + 1))
        self._animation_ids.append(anim_id)

    def _ease_out_back(self, t: float) -> float:
        """Плавная функция с небольшим overshoot — элегантнее чем elastic."""
        c1 = 1.70158
        c3 = c1 + 1
        return 1 + c3 * pow(t - 1, 3) + c1 * pow(t - 1, 2)

    def _get_cell_at(self, x: int, y: int) -> int | None:
        """Возвращает индекс ячейки по координатам."""
        p = self.PADDING
        cs = self.CELL_SIZE
        
        col = (x - p) // cs
        row = (y - p) // cs
        
        if 0 <= row < 3 and 0 <= col < 3:
            return row * 3 + col
        return None

    def _on_mouse_move(self, event: tk.Event) -> None:
        if self.game_over:
            return
        cell = self._get_cell_at(event.x, event.y)
        if cell != self._hover_cell:
            self._hover_cell = cell
            self._draw_board()

    def _on_mouse_leave(self, event: tk.Event) -> None:
        if self._hover_cell is not None:
            self._hover_cell = None
            self._draw_board()

    def _on_click(self, event: tk.Event) -> None:
        if self.game_over:
            return
        cell = self._get_cell_at(event.x, event.y)
        if cell is not None and not self.board[cell]:
            self.on_player_click(cell)

    def reset(self) -> None:
        for anim_id in self._animation_ids:
            self.root.after_cancel(anim_id)
        self._animation_ids.clear()
        
        self.board = [""] * 9
        self.game_over = False
        self._telegram_sent = False
        self._promo_code = None
        self._hover_cell = None

        self._draw_board()

        # Сброс стилей статус-карточки
        self.status_frame.configure(
            bg=self.bg_card,
            highlightbackground=self.border_light
        )
        self.status_inner.configure(bg=self.bg_card)
        self.separator.configure(bg=self.border_light)
        
        self.status_indicator.itemconfig(self._status_dot, fill=self.x_color)
        self.status_indicator.configure(bg=self.bg_card)
        self.status_lbl.configure(text="Твой ход", fg=self.text_primary, bg=self.bg_card)
        self.detail_lbl.configure(
            text="Ты играешь за × · Компьютер за ○",
            fg=self.text_muted,
            bg=self.bg_card,
        )

        self._hide_promo_btn()

    def _hide_promo_btn(self) -> None:
        self.actions.pack_forget()

    def _show_promo_btn(self) -> None:
        self.retry_btn.pack_forget()
        self.actions.pack(pady=(0, 16))
        self.copy_btn.pack(ipadx=20, ipady=10)

    def _show_retry_btn(self) -> None:
        self.copy_btn.pack_forget()
        self.actions.pack(pady=(0, 16))
        self.retry_btn.pack(ipadx=20, ipady=10)

    def copy_promo(self) -> None:
        if not self._promo_code:
            return
        self.root.clipboard_clear()
        self.root.clipboard_append(self._promo_code)
        self.detail_lbl.configure(
            text="Промокод скопирован!", 
            fg=self.win_color,
            bg=self.win_bg
        )

    def on_player_click(self, idx: int) -> None:
        if self.game_over or self.board[idx]:
            return

        self._place(idx, "X")
        self._after_move()

        if self.game_over:
            return

        self.status_indicator.itemconfig(self._status_dot, fill=self.o_color)
        self.status_lbl.configure(text="Ход компьютера", fg=self.text_secondary)
        self.root.after(450, self._computer_turn)

    def _computer_turn(self) -> None:
        if self.game_over:
            return
        idx = best_move_for_o(self.board)
        self._place(idx, "O")
        self._after_move()
        if not self.game_over:
            self.status_indicator.itemconfig(self._status_dot, fill=self.x_color)
            self.status_lbl.configure(text="Твой ход", fg=self.text_primary)

    def _place(self, idx: int, symbol: str) -> None:
        self.board[idx] = symbol
        self._animate_symbol(idx, symbol)

    def _after_move(self) -> None:
        result = check_winner(self.board)
        if result is None:
            return
        
        self.game_over = True
        
        self.root.after(self.ANIM_STEPS * self.ANIM_DELAY + 50, self._draw_board)
        
        if result == "draw":
            self._set_status_style(self.draw_bg, self.draw_color)
            self.status_indicator.itemconfig(self._status_dot, fill=self.draw_color)
            self.status_lbl.configure(text="Ничья", fg=self.draw_color, bg=self.draw_bg)
            self.detail_lbl.configure(
                text="Отличная партия! Попробуй ещё раз",
                fg=self.text_secondary,
                bg=self.draw_bg,
            )
            self.root.after(350, self._show_retry_btn)
            return

        if result == "X":
            self._handle_player_win()
        else:
            self._handle_player_loss()

    def _set_status_style(self, bg_color: str, accent_color: str) -> None:
        """Меняет стиль статус-карточки."""
        self.status_frame.configure(bg=bg_color)
        self.status_inner.configure(bg=bg_color)
        self.status_indicator.configure(bg=bg_color)
        self.status_lbl.configure(bg=bg_color)
        self.detail_lbl.configure(bg=bg_color)
        self.separator.configure(bg=lerp_color(bg_color, accent_color, 0.3))
        self.actions.configure(bg=bg_color)

    def _handle_player_win(self) -> None:
        self._promo_code = str(random.randint(10000, 99999))
        
        self._set_status_style(self.win_bg, self.win_color)
        self.status_indicator.itemconfig(self._status_dot, fill=self.win_color)
        self.status_lbl.configure(text="Победа!", fg=self.win_color, bg=self.win_bg)
        self.detail_lbl.configure(
            text=f"Твой промокод: {self._promo_code}",
            fg=self.text_primary,
            bg=self.win_bg,
        )
        self.root.after(350, self._show_promo_btn)

        if not self._telegram_sent:
            self._telegram_sent = True
            send_telegram_message(f"Победа! Промокод выдан: {self._promo_code}")

    def _handle_player_loss(self) -> None:
        self._set_status_style(self.loss_bg, self.loss_color)
        self.status_indicator.itemconfig(self._status_dot, fill=self.loss_color)
        self.status_lbl.configure(text="Не повезло", fg=self.loss_color, bg=self.loss_bg)
        self.detail_lbl.configure(
            text="Попробуй ещё раз — удача близко!",
            fg=self.text_secondary,
            bg=self.loss_bg,
        )
        self.root.after(350, self._show_retry_btn)

        if not self._telegram_sent:
            self._telegram_sent = True
            send_telegram_message("Проигрыш")


def main() -> None:
    root = tk.Tk()
    TicTacToeApp(root)
    root.mainloop()


if __name__ == "__main__":
    main()
