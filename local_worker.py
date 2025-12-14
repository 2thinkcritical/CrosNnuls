#!/usr/bin/env python3
"""
Локальный сервер для тестирования Telegram-интеграции.
Заменяет Cloudflare Worker для локальной разработки.

Запуск:
  python3 local_worker.py

Требуется:
  - Установить BOT_TOKEN ниже или через переменную окружения
"""

import json
import urllib.request
import urllib.parse
from http.server import HTTPServer, BaseHTTPRequestHandler
import os

# ═══════════════════════════════════════════════════════════════
# КОНФИГУРАЦИЯ - УКАЖИТЕ ВАШ ТОКЕН БОТА
# ═══════════════════════════════════════════════════════════════

BOT_TOKEN = os.environ.get('BOT_TOKEN', '8214596279:AAEg9uH6V13PuEAS7RPKqyH3ZqHggJ0RvT0')  # Или вставьте токен сюда напрямую

PORT = 8081  # Порт для локального Worker
FRONTEND_PORT = 8080  # Порт фронтенда

# ═══════════════════════════════════════════════════════════════

class WorkerHandler(BaseHTTPRequestHandler):
    
    def send_cors_headers(self):
        self.send_header('Access-Control-Allow-Origin', f'http://localhost:{FRONTEND_PORT}')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
    
    def do_OPTIONS(self):
        """Обработка preflight запросов"""
        self.send_response(200)
        self.send_cors_headers()
        self.end_headers()
    
    def do_POST(self):
        """POST /send - отправка сообщения в Telegram"""
        if self.path == '/send':
            self.handle_send()
        else:
            self.send_error(404)
    
    def do_GET(self):
        """GET /check - проверка подписки пользователя"""
        if self.path.startswith('/check'):
            self.handle_check()
        else:
            self.send_error(404)
    
    def handle_send(self):
        """Отправляет сообщение в Telegram"""
        if not BOT_TOKEN:
            self.json_response({'error': 'BOT_TOKEN не настроен!'}, 500)
            return
        
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            data = json.loads(body)
            
            chat_id = data.get('chat_id')
            text = data.get('text')
            
            if not chat_id or not text:
                self.json_response({'error': 'Missing chat_id or text'}, 400)
                return
            
            # Отправляем в Telegram
            result = telegram_request('sendMessage', {
                'chat_id': chat_id,
                'text': text,
                'parse_mode': 'HTML'
            })
            
            self.json_response(result)
            print(f'✅ Сообщение отправлено в chat_id={chat_id}')
            
        except Exception as e:
            self.json_response({'error': str(e)}, 500)
            print(f'❌ Ошибка отправки: {e}')
    
    def handle_check(self):
        """Проверяет, подписался ли пользователь на бота"""
        if not BOT_TOKEN:
            self.json_response({'error': 'BOT_TOKEN не настроен!', 'chat_id': None}, 500)
            return
        
        try:
            # Парсим username из query string
            query = urllib.parse.urlparse(self.path).query
            params = urllib.parse.parse_qs(query)
            username = params.get('username', [None])[0]
            
            if not username:
                self.json_response({'error': 'Missing username', 'chat_id': None}, 400)
                return
            
            # Получаем обновления от бота
            result = telegram_request('getUpdates', {
                'timeout': 1,
                'allowed_updates': ["message"]
            })
            
            if not result.get('ok'):
                self.json_response({'chat_id': None})
                return
            
            # Ищем /start с нужным username
            for update in reversed(result.get('result', [])):
                message = update.get('message', {})
                text = message.get('text', '')
                
                if text.startswith('/start'):
                    parts = text.split()
                    if len(parts) > 1 and parts[1].lower() == username.lower():
                        # Строгая проверка: ник отправителя должен совпадать с введенным
                        sender_username = message.get('from', {}).get('username', '')
                        
                        if not sender_username or sender_username.lower() != username.lower():
                            print(f'❌ Несовпадение ников! Введено: {username}, Telegram: {sender_username}')
                            self.json_response({
                                'error': 'username_mismatch',
                                'expected': username,
                                'actual': sender_username
                            }, 400)
                            
                            # Подтверждаем обновление, чтобы не зацикливаться
                            telegram_request('getUpdates', {
                                'offset': update['update_id'] + 1
                            })
                            return

                        chat_id = message.get('chat', {}).get('id')
                        
                        if chat_id:
                            # Подтверждаем обновление
                            telegram_request('getUpdates', {
                                'offset': update['update_id'] + 1
                            })
                            
                            self.json_response({'chat_id': chat_id})
                            print(f'✅ Пользователь @{username} найден, chat_id={chat_id}')
                            return
            
            self.json_response({'chat_id': None})
            print(f'⏳ Ожидание подписки @{username}...')
            
        except Exception as e:
            self.json_response({'error': str(e), 'chat_id': None}, 500)
            print(f'❌ Ошибка проверки: {e}')
    
    def json_response(self, data, status=200):
        """Отправляет JSON ответ"""
        self.send_response(status)
        self.send_cors_headers()
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())
    
    def log_message(self, format, *args):
        """Тихий лог (только важные сообщения через print)"""
        pass


def telegram_request(method, params):
    """Делает запрос к Telegram API"""
    url = f'https://api.telegram.org/bot{BOT_TOKEN}/{method}'
    
    data = json.dumps(params).encode('utf-8')
    req = urllib.request.Request(
        url,
        data=data,
        headers={'Content-Type': 'application/json'}
    )
    
    with urllib.request.urlopen(req, timeout=10) as response:
        return json.loads(response.read())


def main():
    if not BOT_TOKEN:
        print('=' * 60)
        print('⚠️  BOT_TOKEN не настроен!')
        print()
        print('Способ 1: Экспортировать переменную окружения:')
        print('  export BOT_TOKEN="ваш_токен_от_BotFather"')
        print('  python3 local_worker.py')
        print()
        print('Способ 2: Вписать токен прямо в файл local_worker.py')
        print('  Найдите строку BOT_TOKEN = ... и вставьте токен')
        print('=' * 60)
        return
    
    print('=' * 60)
    print('🚀 Локальный Telegram Worker запущен!')
    print(f'   URL: http://localhost:{PORT}')
    print()
    print('📝 Не забудьте обновить game.js:')
    print(f"   CONFIG.WORKER_URL: 'http://localhost:{PORT}'")
    print('=' * 60)
    
    server = HTTPServer(('localhost', PORT), WorkerHandler)
    
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\n👋 Сервер остановлен')
        server.shutdown()


if __name__ == '__main__':
    main()

