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


def video_row_to_dict(r, liked=False, saved=False):
    return {
        'id': r[0], 'title': r[1], 'description': r[2],
        'video_url': r[3], 'thumbnail_url': r[4], 'views': r[5],
        'created_at': r[6].isoformat() if r[6] else None,
        'sound_name': r[7], 'sound_url': r[8],
        'user': {'id': r[9], 'username': r[10], 'avatar_url': r[11]},
        'likes_count': int(r[12]), 'comments_count': int(r[13]),
        'liked': liked, 'saved': saved
    }


def handler(event: dict, context) -> dict:
    """Работа с видео: лента, поиск, профиль, подписки, сохранения, лайки, комментарии"""
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

    BASE_VIDEO_SELECT = """
        SELECT v.id, v.title, v.description, v.video_url, v.thumbnail_url, v.views, v.created_at,
               v.sound_name, v.sound_url,
               u.id, u.username, u.avatar_url,
               (SELECT COUNT(*) FROM reel_likes l WHERE l.video_id = v.id),
               (SELECT COUNT(*) FROM reel_comments c WHERE c.video_id = v.id)
        FROM reel_videos v
        JOIN reel_users u ON u.id = v.user_id
    """

    def enrich_videos(rows):
        result = []
        for r in rows:
            liked = saved = False
            if user:
                cur.execute("SELECT 1 FROM reel_likes WHERE user_id = %s AND video_id = %s", (user[0], r[0]))
                liked = cur.fetchone() is not None
                cur.execute("SELECT 1 FROM reel_saved WHERE user_id = %s AND video_id = %s", (user[0], r[0]))
                saved = cur.fetchone() is not None
            result.append(video_row_to_dict(r, liked, saved))
        return result

    if method == 'GET':
        action = params.get('action', 'feed')

        if action == 'feed':
            offset = int(params.get('offset', 0))
            limit = int(params.get('limit', 10))
            cur.execute(BASE_VIDEO_SELECT + " ORDER BY v.created_at DESC LIMIT %s OFFSET %s", (limit, offset))
            return {'statusCode': 200, 'headers': headers, 'body': json.dumps({'videos': enrich_videos(cur.fetchall())})}

        elif action == 'following_feed':
            if not user:
                return {'statusCode': 401, 'headers': headers, 'body': json.dumps({'error': 'Не авторизован'})}
            offset = int(params.get('offset', 0))
            limit = int(params.get('limit', 10))
            cur.execute(
                BASE_VIDEO_SELECT + """
                WHERE v.user_id IN (SELECT following_id FROM reel_follows WHERE follower_id = %s)
                ORDER BY v.created_at DESC LIMIT %s OFFSET %s""",
                (user[0], limit, offset)
            )
            return {'statusCode': 200, 'headers': headers, 'body': json.dumps({'videos': enrich_videos(cur.fetchall())})}

        elif action == 'search':
            query = params.get('q', '').strip()
            if not query:
                return {'statusCode': 200, 'headers': headers, 'body': json.dumps({'videos': [], 'users': []})}
            like_q = f'%{query}%'
            cur.execute(
                BASE_VIDEO_SELECT + " WHERE v.title ILIKE %s OR v.description ILIKE %s ORDER BY v.views DESC LIMIT 20",
                (like_q, like_q)
            )
            videos = enrich_videos(cur.fetchall())
            cur.execute(
                "SELECT id, username, avatar_url, bio, followers_count FROM reel_users WHERE username ILIKE %s LIMIT 10",
                (like_q,)
            )
            users = [{'id': r[0], 'username': r[1], 'avatar_url': r[2], 'bio': r[3], 'followers_count': r[4] or 0} for r in cur.fetchall()]
            return {'statusCode': 200, 'headers': headers, 'body': json.dumps({'videos': videos, 'users': users})}

        elif action == 'trending':
            cur.execute(BASE_VIDEO_SELECT + " ORDER BY v.views DESC, v.created_at DESC LIMIT 20")
            return {'statusCode': 200, 'headers': headers, 'body': json.dumps({'videos': enrich_videos(cur.fetchall())})}

        elif action == 'profile':
            profile_user_id = params.get('user_id')
            username = params.get('username')
            if profile_user_id:
                cur.execute("SELECT id, username, email, avatar_url, bio, followers_count, following_count FROM reel_users WHERE id = %s", (profile_user_id,))
            elif username:
                cur.execute("SELECT id, username, email, avatar_url, bio, followers_count, following_count FROM reel_users WHERE username = %s", (username,))
            else:
                return {'statusCode': 400, 'headers': headers, 'body': json.dumps({'error': 'user_id или username обязателен'})}
            row = cur.fetchone()
            if not row:
                return {'statusCode': 404, 'headers': headers, 'body': json.dumps({'error': 'Пользователь не найден'})}
            uid = row[0]
            cur.execute("SELECT COUNT(*) FROM reel_videos WHERE user_id = %s", (uid,))
            videos_count = cur.fetchone()[0]
            cur.execute("SELECT COUNT(*) FROM reel_likes l JOIN reel_videos v ON v.id = l.video_id WHERE v.user_id = %s", (uid,))
            total_likes = cur.fetchone()[0]
            is_following = False
            if user and user[0] != uid:
                cur.execute("SELECT 1 FROM reel_follows WHERE follower_id = %s AND following_id = %s", (user[0], uid))
                is_following = cur.fetchone() is not None
            profile = {
                'id': row[0], 'username': row[1], 'email': row[2],
                'avatar_url': row[3], 'bio': row[4],
                'followers_count': row[5] or 0, 'following_count': row[6] or 0,
                'videos_count': int(videos_count), 'total_likes': int(total_likes),
                'is_following': is_following, 'is_me': user is not None and user[0] == uid
            }
            cur.execute(BASE_VIDEO_SELECT + " WHERE v.user_id = %s ORDER BY v.created_at DESC", (uid,))
            videos = enrich_videos(cur.fetchall())
            return {'statusCode': 200, 'headers': headers, 'body': json.dumps({'profile': profile, 'videos': videos})}

        elif action == 'saved':
            if not user:
                return {'statusCode': 401, 'headers': headers, 'body': json.dumps({'error': 'Не авторизован'})}
            cur.execute(
                BASE_VIDEO_SELECT + """
                JOIN reel_saved sv ON sv.video_id = v.id
                WHERE sv.user_id = %s ORDER BY sv.created_at DESC""",
                (user[0],)
            )
            return {'statusCode': 200, 'headers': headers, 'body': json.dumps({'videos': enrich_videos(cur.fetchall())})}

        elif action == 'comments':
            video_id = params.get('video_id')
            cur.execute(
                """SELECT c.id, c.text, c.created_at, u.id, u.username, u.avatar_url
                   FROM reel_comments c JOIN reel_users u ON u.id = c.user_id
                   WHERE c.video_id = %s ORDER BY c.created_at ASC""",
                (video_id,)
            )
            comments = [{'id': r[0], 'text': r[1], 'created_at': r[2].isoformat() if r[2] else None,
                         'user': {'id': r[3], 'username': r[4], 'avatar_url': r[5]}} for r in cur.fetchall()]
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
            sound_name = body.get('sound_name', '')
            s3 = boto3.client('s3', endpoint_url='https://bucket.poehali.dev',
                              aws_access_key_id=os.environ['AWS_ACCESS_KEY_ID'],
                              aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY'])
            video_bytes = base64.b64decode(video_data)
            filename = f"reels/{secrets.token_hex(16)}.mp4"
            s3.put_object(Bucket='files', Key=filename, Body=video_bytes, ContentType='video/mp4')
            video_url = f"https://cdn.poehali.dev/projects/{os.environ['AWS_ACCESS_KEY_ID']}/bucket/{filename}"
            cur.execute(
                "INSERT INTO reel_videos (user_id, title, description, video_url, sound_name) VALUES (%s,%s,%s,%s,%s) RETURNING id",
                (user[0], title, description, video_url, sound_name)
            )
            video_id = cur.fetchone()[0]
            conn.commit()
            return {'statusCode': 200, 'headers': headers, 'body': json.dumps({'id': video_id, 'video_url': video_url})}

        elif action == 'like':
            if not user:
                return {'statusCode': 401, 'headers': headers, 'body': json.dumps({'error': 'Не авторизован'})}
            video_id = body.get('video_id')
            cur.execute("SELECT id FROM reel_likes WHERE user_id = %s AND video_id = %s", (user[0], video_id))
            if cur.fetchone():
                cur.execute("DELETE FROM reel_likes WHERE user_id = %s AND video_id = %s", (user[0], video_id))
                liked = False
            else:
                cur.execute("INSERT INTO reel_likes (user_id, video_id) VALUES (%s, %s)", (user[0], video_id))
                liked = True
            conn.commit()
            cur.execute("SELECT COUNT(*) FROM reel_likes WHERE video_id = %s", (video_id,))
            return {'statusCode': 200, 'headers': headers, 'body': json.dumps({'liked': liked, 'likes_count': int(cur.fetchone()[0])})}

        elif action == 'save':
            if not user:
                return {'statusCode': 401, 'headers': headers, 'body': json.dumps({'error': 'Не авторизован'})}
            video_id = body.get('video_id')
            cur.execute("SELECT id FROM reel_saved WHERE user_id = %s AND video_id = %s", (user[0], video_id))
            if cur.fetchone():
                cur.execute("DELETE FROM reel_saved WHERE user_id = %s AND video_id = %s", (user[0], video_id))
                saved = False
            else:
                cur.execute("INSERT INTO reel_saved (user_id, video_id) VALUES (%s, %s)", (user[0], video_id))
                saved = True
            conn.commit()
            return {'statusCode': 200, 'headers': headers, 'body': json.dumps({'saved': saved})}

        elif action == 'follow':
            if not user:
                return {'statusCode': 401, 'headers': headers, 'body': json.dumps({'error': 'Не авторизован'})}
            target_id = body.get('user_id')
            if user[0] == target_id:
                return {'statusCode': 400, 'headers': headers, 'body': json.dumps({'error': 'Нельзя подписаться на себя'})}
            cur.execute("SELECT id FROM reel_follows WHERE follower_id = %s AND following_id = %s", (user[0], target_id))
            if cur.fetchone():
                cur.execute("DELETE FROM reel_follows WHERE follower_id = %s AND following_id = %s", (user[0], target_id))
                cur.execute("UPDATE reel_users SET followers_count = GREATEST(0, followers_count - 1) WHERE id = %s", (target_id,))
                cur.execute("UPDATE reel_users SET following_count = GREATEST(0, following_count - 1) WHERE id = %s", (user[0],))
                following = False
            else:
                cur.execute("INSERT INTO reel_follows (follower_id, following_id) VALUES (%s, %s)", (user[0], target_id))
                cur.execute("UPDATE reel_users SET followers_count = followers_count + 1 WHERE id = %s", (target_id,))
                cur.execute("UPDATE reel_users SET following_count = following_count + 1 WHERE id = %s", (user[0],))
                following = True
            conn.commit()
            cur.execute("SELECT followers_count FROM reel_users WHERE id = %s", (target_id,))
            followers_count = cur.fetchone()[0]
            return {'statusCode': 200, 'headers': headers, 'body': json.dumps({'following': following, 'followers_count': followers_count or 0})}

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

        elif action == 'update_profile':
            if not user:
                return {'statusCode': 401, 'headers': headers, 'body': json.dumps({'error': 'Не авторизован'})}
            bio = body.get('bio', '')
            avatar_data = body.get('avatar_data')
            avatar_url = None
            if avatar_data:
                s3 = boto3.client('s3', endpoint_url='https://bucket.poehali.dev',
                                  aws_access_key_id=os.environ['AWS_ACCESS_KEY_ID'],
                                  aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY'])
                img_bytes = base64.b64decode(avatar_data)
                filename = f"avatars/{secrets.token_hex(16)}.jpg"
                s3.put_object(Bucket='files', Key=filename, Body=img_bytes, ContentType='image/jpeg')
                avatar_url = f"https://cdn.poehali.dev/projects/{os.environ['AWS_ACCESS_KEY_ID']}/bucket/{filename}"
                cur.execute("UPDATE reel_users SET bio = %s, avatar_url = %s WHERE id = %s", (bio, avatar_url, user[0]))
            else:
                cur.execute("UPDATE reel_users SET bio = %s WHERE id = %s", (bio, user[0]))
            conn.commit()
            return {'statusCode': 200, 'headers': headers, 'body': json.dumps({'ok': True, 'avatar_url': avatar_url})}

    return {'statusCode': 400, 'headers': headers, 'body': json.dumps({'error': 'Неизвестный запрос'})}
