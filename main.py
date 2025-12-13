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
    except Exception as exc:
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
        # ЭЛЕГАНТНАЯ ПАЛИТРА для 3D-куба
        # ══════════════════════════════════════════════════════════════════
        
        self.bg_main = "#F5F0EC"
        
        # Грани куба
        self.cube_top = "#FFFAF7"          # Верхняя грань (игровое поле)
        self.cube_right = "#E8DED6"         # Правая грань (тень)
        self.cube_left = "#F0E6DE"          # Левая грань (полутень)
        
        self.bg_cell = "#FBF7F4"
        self.bg_cell_hover = "#F5EDE7"
        self.grid_line = "#DDD0C6"
        self.border_accent = "#D4A89A"
        
        # Символы
        self.x_color = "#C67B7B"
        self.x_glow = "#E8B4B4"
        self.o_color = "#9B7E9B"
        self.o_glow = "#C9B3C9"
        
        # Текст
        self.text_primary = "#5D4E4E"
        self.text_secondary = "#7A6B6B"
        self.text_muted = "#9A8B8B"
        self.text_light = "#B8A8A8"
        
        # Статусы
        self.win_color = "#7BAF9B"
        self.win_glow = "#A8D4C0"
        self.win_bg = "#EDF7F3"
        self.loss_color = "#C9A8A8"
        self.loss_bg = "#FAF3F3"
        self.draw_color = "#C4A574"
        self.draw_bg = "#FAF6EF"
        
        # Кнопки
        self.accent = "#C9907E"
        self.accent_hover = "#B87D6B"
        self.accent_light = "#E8C4B8"
        self.btn_secondary = "#EDE5DF"
        self.btn_secondary_hover = "#E3D8D0"
        self.btn_text = "#6B5B5B"
        self.border_light = "#E8DCD4"

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

        self._build_ui()
        self.reset(animate=False)

    def _build_ui(self) -> None:
        # Основной контейнер
        self.container = tk.Frame(self.root, bg=self.bg_main)
        self.container.pack(fill="both", expand=True)

        # ══════════════════════════════════════════════════════════════════
        # Заголовок
        # ══════════════════════════════════════════════════════════════════
        self.header_frame = tk.Frame(self.container, bg=self.bg_main)
        self.header_frame.pack(fill="x", pady=(20, 10))

        try:
            title_font = tkfont.Font(family="Palatino", size=26, weight="normal")
        except Exception:
            try:
                title_font = tkfont.Font(family="Georgia", size=26, weight="normal")
            except Exception:
                title_font = tkfont.Font(family="Times New Roman", size=26, weight="normal")

        self.title_lbl = tk.Label(
            self.header_frame,
            text="Крестики-нолики",
            bg=self.bg_main,
            fg=self.text_primary,
            font=title_font,
        )
        self.title_lbl.pack()

        try:
            subtitle_font = tkfont.Font(family="Palatino", size=11, slant="italic")
        except Exception:
            try:
                subtitle_font = tkfont.Font(family="Georgia", size=11, slant="italic")
            except Exception:
                subtitle_font = tkfont.Font(family="Times New Roman", size=11, slant="italic")

        self.subtitle_lbl = tk.Label(
            self.header_frame,
            text="Выиграй и получи промокод",
            bg=self.bg_main,
            fg=self.text_muted,
            font=subtitle_font,
        )
        self.subtitle_lbl.pack(pady=(4, 0))

        # ══════════════════════════════════════════════════════════════════
        # 3D Canvas для куба
        # ══════════════════════════════════════════════════════════════════
        canvas_width = 460
        canvas_height = 380
        
        self.cube_canvas = tk.Canvas(
            self.container,
            width=canvas_width,
            height=canvas_height,
            bg=self.bg_main,
            highlightthickness=0,
        )
        self.cube_canvas.pack(pady=(10, 10))

        self.cube_canvas.bind("<Motion>", self._on_mouse_move)
        self.cube_canvas.bind("<Leave>", self._on_mouse_leave)
        self.cube_canvas.bind("<Button-1>", self._on_click)

        # ══════════════════════════════════════════════════════════════════
        # Статус-панель
        # ══════════════════════════════════════════════════════════════════
        self.status_outer = tk.Frame(self.container, bg=self.bg_main)
        self.status_outer.pack(fill="x", pady=(0, 10))
        
        self.status_frame = tk.Frame(
            self.status_outer,
            bg="#FFFFFF",
            highlightthickness=1,
            highlightbackground=self.border_light,
        )
        self.status_frame.pack(fill="x", padx=30)

        self.status_inner = tk.Frame(self.status_frame, bg="#FFFFFF")
        self.status_inner.pack(pady=14)

        self.status_indicator = tk.Canvas(
            self.status_inner, width=12, height=12,
            bg="#FFFFFF", highlightthickness=0,
        )
        self.status_indicator.pack(side="left", padx=(0, 10))
        self._status_dot = self.status_indicator.create_oval(1, 1, 11, 11, fill=self.x_color, outline="")

        try:
            status_font = tkfont.Font(family="Palatino", size=14, weight="bold")
        except Exception:
            try:
                status_font = tkfont.Font(family="Georgia", size=14, weight="bold")
            except Exception:
                status_font = tkfont.Font(family="Times New Roman", size=14, weight="bold")

        self.status_lbl = tk.Label(
            self.status_inner, text="Твой ход",
            bg="#FFFFFF", fg=self.text_primary, font=status_font,
        )
        self.status_lbl.pack(side="left")

        self.separator = tk.Frame(self.status_frame, bg=self.border_light, height=1)
        self.separator.pack(fill="x", padx=20, pady=(0, 10))

        try:
            detail_font = tkfont.Font(family="Palatino", size=10)
        except Exception:
            try:
                detail_font = tkfont.Font(family="Georgia", size=10)
            except Exception:
                detail_font = tkfont.Font(family="Times New Roman", size=10)

        self.detail_lbl = tk.Label(
            self.status_frame,
            text="Ты играешь за × · Компьютер за ○",
            bg="#FFFFFF", fg=self.text_muted, font=detail_font,
            wraplength=350, justify="center",
        )
        self.detail_lbl.pack(pady=(0, 14))

        # Кнопки действий
        self.actions = tk.Frame(self.status_frame, bg="#FFFFFF")

        try:
            btn_font = tkfont.Font(family="Palatino", size=10, weight="bold")
        except Exception:
            try:
                btn_font = tkfont.Font(family="Georgia", size=10, weight="bold")
            except Exception:
                btn_font = tkfont.Font(family="Times New Roman", size=10, weight="bold")

        self.copy_btn = tk.Button(
            self.actions, text="Скопировать промокод", font=btn_font,
            fg="#FFFFFF", bg=self.accent, activeforeground="#FFFFFF",
            activebackground=self.accent_hover, bd=0, relief="flat",
            cursor="hand2", command=self.copy_promo,
        )
        self.copy_btn.bind("<Enter>", lambda e: self.copy_btn.configure(bg=self.accent_hover))
        self.copy_btn.bind("<Leave>", lambda e: self.copy_btn.configure(bg=self.accent))

        self.retry_btn = tk.Button(
            self.actions, text="Сыграть ещё раз", font=btn_font,
            fg="#FFFFFF", bg=self.accent, activeforeground="#FFFFFF",
            activebackground=self.accent_hover, bd=0, relief="flat",
            cursor="hand2", command=self.reset,
        )
        self.retry_btn.bind("<Enter>", lambda e: self.retry_btn.configure(bg=self.accent_hover))
        self.retry_btn.bind("<Leave>", lambda e: self.retry_btn.configure(bg=self.accent))

        # ══════════════════════════════════════════════════════════════════
        # Кнопка "Новая игра"
        # ══════════════════════════════════════════════════════════════════
        try:
            restart_font = tkfont.Font(family="Palatino", size=10)
        except Exception:
            try:
                restart_font = tkfont.Font(family="Georgia", size=10)
            except Exception:
                restart_font = tkfont.Font(family="Times New Roman", size=10)

        self.restart_btn = tk.Button(
            self.container, text="Начать заново", font=restart_font,
            fg=self.btn_text, bg=self.btn_secondary,
            activeforeground=self.btn_text, activebackground=self.btn_secondary_hover,
            bd=0, relief="flat", cursor="hand2", command=self.reset,
        )
        self.restart_btn.pack(pady=(5, 15), ipadx=20, ipady=8)
        self.restart_btn.bind("<Enter>", lambda e: self.restart_btn.configure(bg=self.btn_secondary_hover))
        self.restart_btn.bind("<Leave>", lambda e: self.restart_btn.configure(bg=self.btn_secondary))

        # Футер
        try:
            footer_font = tkfont.Font(family="Palatino", size=9, slant="italic")
        except Exception:
            try:
                footer_font = tkfont.Font(family="Georgia", size=9, slant="italic")
            except Exception:
                footer_font = tkfont.Font(family="Times New Roman", size=9, slant="italic")

        self.footer = tk.Label(
            self.container, text="Удачи в игре",
            bg=self.bg_main, fg=self.text_light, font=footer_font,
        )
        self.footer.pack(anchor="center", pady=(0, 10))

    # ══════════════════════════════════════════════════════════════════════
    # 3D КУБА
    # ══════════════════════════════════════════════════════════════════════

    def _get_cube_transform(self, angle: float = 0.0) -> dict:
        """Возвращает параметры трансформации куба."""
        cx = 230
        cy = 200
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

    def _draw_cube(self) -> None:
        """Отрисовка 3D-куба с игровым полем на передней грани."""
        self.cube_canvas.delete("all")
        
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
        
        # Тень под кубом
        shadow_offset = 12
        bottom_verts = [vertices_2d[i] for i in [3, 2, 6, 7]]
        shadow_verts = []
        for px, py in bottom_verts:
            shadow_verts.extend([px + shadow_offset, py + shadow_offset * 0.4])
        self.cube_canvas.create_polygon(
            shadow_verts,
            fill=darken_color(self.bg_main, 0.92),
            outline="",
        )
        
        # Определяем видимость граней по углу переворота
        flip_rad = transform["flip_angle"]
        flip_cos = math.cos(flip_rad)
        flip_sin = math.sin(flip_rad)
        
        # Рисуем грани в порядке от дальних к ближним
        
        # Задняя грань (видна при перевороте)
        if flip_cos < 0:
            back_face = [vertices_2d[i] for i in [4, 5, 6, 7]]
            self.cube_canvas.create_polygon(
                [coord for pt in back_face for coord in pt],
                fill=self.cube_top,
                outline=darken_color(self.cube_top, 0.9),
                width=2,
            )
        
        # Верхняя грань (непрозрачная, с сеткой)
        top_face = [vertices_2d[i] for i in [0, 1, 5, 4]]
        self.cube_canvas.create_polygon(
            [coord for pt in top_face for coord in pt],
            fill="#E0D5CC",  # Более насыщенный непрозрачный цвет
            outline="#C9BDB3",
            width=1,
        )
        # Сетка на верхней грани
        top_grid_color = "#C4B8AE"
        for i in range(1, 3):
            t = i / 3
            p1 = self._project_point(-half + t * size, half, half, transform)
            p2 = self._project_point(-half + t * size, half, -half, transform)
            self.cube_canvas.create_line(p1[0], p1[1], p2[0], p2[1], fill=top_grid_color, width=1)
            p1 = self._project_point(-half, half, half - t * size, transform)
            p2 = self._project_point(half, half, half - t * size, transform)
            self.cube_canvas.create_line(p1[0], p1[1], p2[0], p2[1], fill=top_grid_color, width=1)
        
        # Правая боковая грань (непрозрачная, с сеткой)
        if flip_sin > -0.7:
            right_face = [vertices_2d[i] for i in [1, 2, 6, 5]]
            self.cube_canvas.create_polygon(
                [coord for pt in right_face for coord in pt],
                fill="#D5C9BF",  # Более насыщенный непрозрачный цвет
                outline="#C0B4AA",
                width=1,
            )
            # Сетка на правой грани
            right_grid_color = "#BAA99D"
            for i in range(1, 3):
                t = i / 3
                p1 = self._project_point(half, half - t * size, half, transform)
                p2 = self._project_point(half, half - t * size, -half, transform)
                self.cube_canvas.create_line(p1[0], p1[1], p2[0], p2[1], fill=right_grid_color, width=1)
                p1 = self._project_point(half, half, half - t * size, transform)
                p2 = self._project_point(half, -half, half - t * size, transform)
                self.cube_canvas.create_line(p1[0], p1[1], p2[0], p2[1], fill=right_grid_color, width=1)
        
        
        # Передняя грань (ИГРОВОЕ ПОЛЕ) — рисуем последней
        if flip_cos > 0:
            front_face = [vertices_2d[i] for i in [0, 1, 2, 3]]
            self.cube_canvas.create_polygon(
                [coord for pt in front_face for coord in pt],
                fill=self.cube_top,
                outline=darken_color(self.cube_top, 0.85),
                width=2,
            )
            
            # Рисуем игровое поле на передней грани
            self._draw_board_on_face(transform)

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
            self.cube_canvas.create_line(
                p1[0], p1[1], p2[0], p2[1],
                fill=self.grid_line, width=2,
            )
            
            # Горизонтальные линии (по Y)
            y_offset = -half + i * cell
            p1 = self._project_point(-half, y_offset, z_front, transform)
            p2 = self._project_point(half, y_offset, z_front, transform)
            self.cube_canvas.create_line(
                p1[0], p1[1], p2[0], p2[1],
                fill=self.grid_line, width=2,
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
        """Подсветка ячейки при наведении."""
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
        
        self.cube_canvas.create_polygon(
            points,
            fill=self.bg_cell_hover,
            outline=self.border_accent,
            width=2,
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
            self.cube_canvas.create_line(
                p1[0], p1[1], p2[0], p2[1],
                fill=glow_color, width=self.LINE_WIDTH + offset * 2, capstyle="round",
            )
            
            # Диагональ / (верх-право → низ-лево)
            p3 = self._project_point(cx + s, cy + s, cz, transform)
            p4 = self._project_point(cx - s, cy - s, cz, transform)
            self.cube_canvas.create_line(
                p3[0], p3[1], p4[0], p4[1],
                fill=glow_color, width=self.LINE_WIDTH + offset * 2, capstyle="round",
            )
        
        # Основные линии
        p1 = self._project_point(cx - size, cy + size, cz, transform)
        p2 = self._project_point(cx + size, cy - size, cz, transform)
        self.cube_canvas.create_line(
            p1[0], p1[1], p2[0], p2[1],
            fill=self.x_color, width=self.LINE_WIDTH, capstyle="round",
        )
        
        p3 = self._project_point(cx + size, cy + size, cz, transform)
        p4 = self._project_point(cx - size, cy - size, cz, transform)
        self.cube_canvas.create_line(
            p3[0], p3[1], p4[0], p4[1],
            fill=self.x_color, width=self.LINE_WIDTH, capstyle="round",
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
        self.cube_canvas.create_line(points, fill=color, width=width, smooth=True)

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
            self.cube_canvas.create_line(
                p1[0], p1[1], p2[0], p2[1],
                fill=glow_color, width=self.LINE_WIDTH + offset * 3, capstyle="round",
            )
        
        # Основная линия
        p1 = self._project_point(*start, transform)
        p2 = self._project_point(*end, transform)
        self.cube_canvas.create_line(
            p1[0], p1[1], p2[0], p2[1],
            fill=self.win_color, width=self.LINE_WIDTH + 2, capstyle="round",
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

    def _on_mouse_move(self, event: tk.Event) -> None:
        if self.game_over or self._is_flipping:
            return
        cell = self._get_cell_at(event.x, event.y)
        if cell != self._hover_cell:
            self._hover_cell = cell
            self._draw_cube()

    def _on_mouse_leave(self, event: tk.Event) -> None:
        if self._hover_cell is not None:
            self._hover_cell = None
            self._draw_cube()

    def _on_click(self, event: tk.Event) -> None:
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
        
        # Анимация переворота
        if animate and not self._is_flipping:
            self._is_flipping = True
            self._game_number += 1
            self._flip_direction = 1 if self._game_number % 2 == 1 else -1
            self._animate_flip()
        else:
            self._draw_cube()

        # Сброс UI
        self.status_frame.configure(bg="#FFFFFF", highlightbackground=self.border_light)
        self.status_inner.configure(bg="#FFFFFF")
        self.separator.configure(bg=self.border_light)
        
        self.status_indicator.itemconfig(self._status_dot, fill=self.x_color)
        self.status_indicator.configure(bg="#FFFFFF")
        self.status_lbl.configure(text="Твой ход", fg=self.text_primary, bg="#FFFFFF")
        self.detail_lbl.configure(
            text="Ты играешь за × · Компьютер за ○",
            fg=self.text_muted, bg="#FFFFFF",
        )
        self._hide_promo_btn()

    def _hide_promo_btn(self) -> None:
        self.actions.pack_forget()

    def _show_promo_btn(self) -> None:
        self.retry_btn.pack_forget()
        self.actions.pack(pady=(0, 14))
        self.copy_btn.pack(ipadx=18, ipady=8)

    def _show_retry_btn(self) -> None:
        self.copy_btn.pack_forget()
        self.actions.pack(pady=(0, 14))
        self.retry_btn.pack(ipadx=18, ipady=8)

    def copy_promo(self) -> None:
        if not self._promo_code:
            return
        self.root.clipboard_clear()
        self.root.clipboard_append(self._promo_code)
        self.detail_lbl.configure(text="Промокод скопирован!", fg=self.win_color, bg=self.win_bg)

    def on_player_click(self, idx: int) -> None:
        if self.game_over or self.board[idx] or self._is_flipping:
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
        self.root.after(self.ANIM_STEPS * self.ANIM_DELAY + 50, self._draw_cube)
        
        if result == "draw":
            self._set_status_style(self.draw_bg, self.draw_color)
            self.status_indicator.itemconfig(self._status_dot, fill=self.draw_color)
            self.status_lbl.configure(text="Ничья", fg=self.draw_color, bg=self.draw_bg)
            self.detail_lbl.configure(
                text="Отличная партия! Попробуй ещё раз",
                fg=self.text_secondary, bg=self.draw_bg,
            )
            self.root.after(350, self._show_retry_btn)
            return

        if result == "X":
            self._handle_player_win()
        else:
            self._handle_player_loss()

    def _set_status_style(self, bg_color: str, accent_color: str) -> None:
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
            fg=self.text_primary, bg=self.win_bg,
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
            fg=self.text_secondary, bg=self.loss_bg,
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
