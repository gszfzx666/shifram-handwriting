# -*- coding: utf-8 -*-
"""拿到 GitHub PAT 后，一键完成：识别账号 -> 创建仓库 -> 推送 -> 清除明文 token。

用法：
    python tools/push_to_github.py <你的PAT>

PAT 需要 repo 权限（Classic token 勾选 repo；Fine-grained token 给 Contents=read/write、
Metadata=read、Administration=write 或仓库创建权限）。
"""
import os, sys, json, subprocess, urllib.request, urllib.error

REPO_NAME = 'shifram-handwriting'   # 仓库名（英文，避免 URL 编码问题）
DESC = '拾帧工具 - 本地手写文稿生成器（Canvas 渲染 / 无联网 / 无水印）'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def api(method, path, token, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request('https://api.github.com' + path, data=data, method=method,
        headers={
            'Authorization': 'Bearer ' + token,
            'User-Agent': 'shifram-push',
            'Accept': 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'Content-Type': 'application/json',
        })
    try:
        with urllib.request.urlopen(req, timeout=40) as r:
            raw = r.read()
            return r.status, (json.loads(raw) if raw else {})
    except urllib.error.HTTPError as e:
        raw = e.read().decode(errors='ignore')
        try: msg = json.loads(raw).get('message', raw)
        except Exception: msg = raw
        return e.code, {'message': msg}

def run(cmd, check=True):
    print('>', ' '.join(cmd[:3]) + (' ...' if len(cmd) > 3 else ''))
    r = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True, encoding='utf-8', errors='ignore')
    if r.stdout.strip(): print(r.stdout.strip()[-800:])
    if check and r.returncode != 0:
        print('!! 失败:', r.stderr.strip()[-800:])
        sys.exit(r.returncode)
    return r

def main():
    if len(sys.argv) < 2:
        print('用法: python tools/push_to_github.py <你的PAT>')
        sys.exit(1)
    token = sys.argv[1].strip()

    print('[1/5] 验证 PAT 并识别账号…')
    code, user = api('GET', '/user', token)
    if code != 200:
        print('PAT 无效：', code, user.get('message'))
        sys.exit(1)
    login = user.get('login')
    print('  账号:', login)

    print('[2/5] 创建仓库（已存在则跳过）…')
    code, repo = api('GET', '/repos/%s/%s' % (login, REPO_NAME), token)
    if code == 200:
        print('  仓库已存在:', repo.get('html_url'))
        clone_url = repo.get('clone_url')
    elif code == 404:
        code, repo = api('POST', '/user/repos', token,
                         {'name': REPO_NAME, 'description': DESC, 'private': False, 'auto_init': False})
        if code not in (200, 201):
            print('  创建失败:', code, repo.get('message'))
            sys.exit(1)
        print('  已创建:', repo.get('html_url'))
        clone_url = repo.get('clone_url')
    else:
        print('  查询仓库失败:', code, repo.get('message'))
        sys.exit(1)

    print('[3/5] 配置 remote（临时用 token 推送）…')
    auth_url = clone_url.replace('https://', 'https://%s:%s@' % (login, token))
    run(['git', 'remote', 'remove', 'origin'], check=False)
    run(['git', 'remote', 'add', 'origin', auth_url])

    print('[4/5] 推送代码…')
    run(['git', 'branch', '-M', 'main'])
    run(['git', 'push', '-u', 'origin', 'main'])

    print('[5/5] 清除 remote 中的明文 token…')
    run(['git', 'remote', 'set-url', 'origin', clone_url])

    print('\n完成！仓库地址:', repo.get('html_url'))
    print('注意：PAT 只用于本次推送，未写入仓库任何文件。')

if __name__ == '__main__':
    main()
