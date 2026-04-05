import json
import os
import base64
import boto3
import psycopg2
import secrets


def get_db():
    return psycopg2.connect(os.environ['DATABASE_URL'])


def get_user_from_token(cur, token):
    if not token:
        return None
    cur.execute(
        """SELECT u.id, u.username, u.avatar_url FROM reel_users u
           JOIN reel_sessions s ON s.user_id = u.id
           WHERE s.token = %s AND s.expires_at > NOW()""",
        (token,)
    )
    return cur.fetchone()


def handler(event: dict, context) -> dict:
    """Работа с видео: получение ленты, загрузка, просмотр, лайки, комментарии"""
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
    method = event.get('httpMethod', 'GET')
    params = event.get('queryStringParameters') or {}
    token = event.get('headers', {}).get('X-Auth-Token') or event.get('headers', {}).get('x-auth-token')

    conn = get_db()
    cur = conn.cursor()
    user = get_user_from_token(cur, token)

    if method == 'GET':
        action = params.get('action', 'feed')

        if action == 'feed':
            offset = int(params.get('offset', 0))
            limit = int(params.get('limit', 10))

            cur.execute(
                """SELECT v.id, v.title, v.description, v.video_url, v.thumbnail_url, v.views, v.created_at,
                          u.id as user_id, u.username, u.avatar_url,
                          (SELECT COUNT(*) FROM reel_likes l WHERE l.video_id = v.id) as likes_count,
                          (SELECT COUNT(*) FROM reel_comments c WHERE c.video_id = v.id) as comments_count
                   FROM reel_videos v
                   JOIN reel_users u ON u.id = v.user_id
                   ORDER BY v.created_at DESC
                   LIMIT %s OFFSET %s""",
                (limit, offset)
            )
            rows = cur.fetchall()
            videos = []
            for r in rows:
                liked = False
                if user:
                    cur.execute("SELECT 1 FROM reel_likes WHERE user_id = %s AND video_id = %s", (user[0], r[0]))
                    liked = cur.fetchone() is not None
                videos.append({
                    'id': r[0], 'title': r[1], 'description': r[2],
                    'video_url': r[3], 'thumbnail_url': r[4], 'views': r[5],
                    'created_at': r[6].isoformat() if r[6] else None,
                    'user': {'id': r[7], 'username': r[8], 'avatar_url': r[9]},
                    'likes_count': int(r[10]), 'comments_count': int(r[11]),
                    'liked': liked
                })
            return {'statusCode': 200, 'headers': headers, 'body': json.dumps({'videos': videos})}

        elif action == 'comments':
            video_id = params.get('video_id')
            cur.execute(
                """SELECT c.id, c.text, c.created_at, u.id, u.username, u.avatar_url
                   FROM reel_comments c JOIN reel_users u ON u.id = c.user_id
                   WHERE c.video_id = %s ORDER BY c.created_at ASC""",
                (video_id,)
            )
            rows = cur.fetchall()
            comments = [{'id': r[0], 'text': r[1], 'created_at': r[2].isoformat() if r[2] else None,
                         'user': {'id': r[3], 'username': r[4], 'avatar_url': r[5]}} for r in rows]
            return {'statusCode': 200, 'headers': headers, 'body': json.dumps({'comments': comments})}

    elif method == 'POST':
        body = json.loads(event.get('body') or '{}')
        action = body.get('action')

        if action == 'upload':
            if not user:
                return {'statusCode': 401, 'headers': headers, 'body': json.dumps({'error': 'Не авторизован'})}

            video_data = body.get('video_data')
            title = body.get('title', '')
            description = body.get('description', '')

            s3 = boto3.client(
                's3',
                endpoint_url='https://bucket.poehali.dev',
                aws_access_key_id=os.environ['AWS_ACCESS_KEY_ID'],
                aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY']
            )

            video_bytes = base64.b64decode(video_data)
            filename = f"reels/{secrets.token_hex(16)}.mp4"
            s3.put_object(Bucket='files', Key=filename, Body=video_bytes, ContentType='video/mp4')
            video_url = f"https://cdn.poehali.dev/projects/{os.environ['AWS_ACCESS_KEY_ID']}/bucket/{filename}"

            cur.execute(
                "INSERT INTO reel_videos (user_id, title, description, video_url) VALUES (%s, %s, %s, %s) RETURNING id",
                (user[0], title, description, video_url)
            )
            video_id = cur.fetchone()[0]
            conn.commit()

            return {'statusCode': 200, 'headers': headers, 'body': json.dumps({'id': video_id, 'video_url': video_url})}

        elif action == 'like':
            if not user:
                return {'statusCode': 401, 'headers': headers, 'body': json.dumps({'error': 'Не авторизован'})}
            video_id = body.get('video_id')
            cur.execute("SELECT id FROM reel_likes WHERE user_id = %s AND video_id = %s", (user[0], video_id))
            existing = cur.fetchone()
            if existing:
                cur.execute("DELETE FROM reel_likes WHERE user_id = %s AND video_id = %s", (user[0], video_id))
                liked = False
            else:
                cur.execute("INSERT INTO reel_likes (user_id, video_id) VALUES (%s, %s)", (user[0], video_id))
                liked = True
            conn.commit()
            cur.execute("SELECT COUNT(*) FROM reel_likes WHERE video_id = %s", (video_id,))
            count = cur.fetchone()[0]
            return {'statusCode': 200, 'headers': headers, 'body': json.dumps({'liked': liked, 'likes_count': int(count)})}

        elif action == 'comment':
            if not user:
                return {'statusCode': 401, 'headers': headers, 'body': json.dumps({'error': 'Не авторизован'})}
            video_id = body.get('video_id')
            text = body.get('text', '').strip()
            if not text:
                return {'statusCode': 400, 'headers': headers, 'body': json.dumps({'error': 'Комментарий пустой'})}
            cur.execute(
                "INSERT INTO reel_comments (user_id, video_id, text) VALUES (%s, %s, %s) RETURNING id, created_at",
                (user[0], video_id, text)
            )
            row = cur.fetchone()
            conn.commit()
            return {'statusCode': 200, 'headers': headers, 'body': json.dumps({
                'id': row[0], 'text': text,
                'created_at': row[1].isoformat() if row[1] else None,
                'user': {'id': user[0], 'username': user[1], 'avatar_url': user[2]}
            })}

        elif action == 'view':
            video_id = body.get('video_id')
            cur.execute("UPDATE reel_videos SET views = views + 1 WHERE id = %s", (video_id,))
            conn.commit()
            return {'statusCode': 200, 'headers': headers, 'body': json.dumps({'ok': True})}

    return {'statusCode': 400, 'headers': headers, 'body': json.dumps({'error': 'Неизвестный запрос'})}
