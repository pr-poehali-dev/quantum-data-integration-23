import json
import os
import hashlib
import secrets
import psycopg2


def get_db():
    return psycopg2.connect(os.environ['DATABASE_URL'])


def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


def handler(event: dict, context) -> dict:
    """Аутентификация пользователей: регистрация и вход"""
    if event.get('httpMethod') == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-User-Id, X-Auth-Token, X-Session-Id',
                'Access-Control-Max-Age': '86400'
            },
            'body': ''
        }

    headers = {'Access-Control-Allow-Origin': '*'}
    body = json.loads(event.get('body') or '{}')
    action = body.get('action')

    conn = get_db()
    cur = conn.cursor()

    if action == 'register':
        username = body.get('username', '').strip()
        email = body.get('email', '').strip()
        password = body.get('password', '')

        if not username or not email or not password:
            return {'statusCode': 400, 'headers': headers, 'body': json.dumps({'error': 'Заполните все поля'})}

        cur.execute("SELECT id FROM reel_users WHERE email = %s OR username = %s", (email, username))
        if cur.fetchone():
            return {'statusCode': 400, 'headers': headers, 'body': json.dumps({'error': 'Пользователь уже существует'})}

        password_hash = hash_password(password)
        cur.execute(
            "INSERT INTO reel_users (username, email, password_hash) VALUES (%s, %s, %s) RETURNING id, username, email",
            (username, email, password_hash)
        )
        user = cur.fetchone()

        token = secrets.token_hex(32)
        cur.execute(
            "INSERT INTO reel_sessions (user_id, token) VALUES (%s, %s)",
            (user[0], token)
        )
        conn.commit()

        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'token': token,
                'user': {'id': user[0], 'username': user[1], 'email': user[2]}
            })
        }

    elif action == 'login':
        email = body.get('email', '').strip()
        password = body.get('password', '')

        password_hash = hash_password(password)
        cur.execute(
            "SELECT id, username, email, avatar_url FROM reel_users WHERE email = %s AND password_hash = %s",
            (email, password_hash)
        )
        user = cur.fetchone()
        if not user:
            return {'statusCode': 401, 'headers': headers, 'body': json.dumps({'error': 'Неверный email или пароль'})}

        token = secrets.token_hex(32)
        cur.execute(
            "INSERT INTO reel_sessions (user_id, token) VALUES (%s, %s)",
            (user[0], token)
        )
        conn.commit()

        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'token': token,
                'user': {'id': user[0], 'username': user[1], 'email': user[2], 'avatar_url': user[3]}
            })
        }

    elif action == 'me':
        token = event.get('headers', {}).get('X-Auth-Token') or event.get('headers', {}).get('x-auth-token')
        if not token:
            return {'statusCode': 401, 'headers': headers, 'body': json.dumps({'error': 'Не авторизован'})}

        cur.execute(
            """SELECT u.id, u.username, u.email, u.avatar_url, u.bio
               FROM reel_users u
               JOIN reel_sessions s ON s.user_id = u.id
               WHERE s.token = %s AND s.expires_at > NOW()""",
            (token,)
        )
        user = cur.fetchone()
        if not user:
            return {'statusCode': 401, 'headers': headers, 'body': json.dumps({'error': 'Сессия истекла'})}

        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({'user': {'id': user[0], 'username': user[1], 'email': user[2], 'avatar_url': user[3], 'bio': user[4]}})
        }

    elif action == 'logout':
        token = event.get('headers', {}).get('X-Auth-Token') or event.get('headers', {}).get('x-auth-token')
        if token:
            cur.execute("UPDATE reel_sessions SET expires_at = NOW() WHERE token = %s", (token,))
            conn.commit()
        return {'statusCode': 200, 'headers': headers, 'body': json.dumps({'ok': True})}

    return {'statusCode': 400, 'headers': headers, 'body': json.dumps({'error': 'Неизвестное действие'})}
