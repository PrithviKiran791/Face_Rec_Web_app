import argparse
import getpass
import os
from pathlib import Path

import redis


def build_redis_client(host, port, password):
    client = redis.Redis(host=host, port=port, password=password, decode_responses=False)
    client.ping()
    return client


def push_logs(redis_client, file_path, redis_key, clear_existing=False):
    source = Path(file_path)
    if not source.exists():
        raise FileNotFoundError(f'File not found: {source}')

    logs = [line.strip() for line in source.read_text(encoding='utf-8').splitlines() if line.strip()]
    if not logs:
        raise ValueError('No log lines found in the source file.')

    if clear_existing:
        redis_client.delete(redis_key)

    redis_client.lpush(redis_key, *logs)
    return len(logs)


def main():
    parser = argparse.ArgumentParser(description='Upload simulated attendance logs to Redis.')
    parser.add_argument('--file', default='simulated_logs.txt', help='Path to simulated logs text file.')
    parser.add_argument('--key', default='attendance_logs', help='Redis list key for attendance logs.')
    parser.add_argument('--host', default=os.getenv('REDIS_HOST'), help='Redis host. If omitted, uses REDIS_HOST environment variable.')
    parser.add_argument('--port', type=int, default=int(os.getenv('REDIS_PORT', '6379')), help='Redis port. If omitted, uses REDIS_PORT or 6379.')
    parser.add_argument('--password', default=os.getenv('REDIS_PASSWORD'), help='Redis password. If omitted, uses REDIS_PASSWORD or secure prompt.')
    parser.add_argument('--clear-existing', action='store_true', help='Delete existing logs in key before upload.')
    args = parser.parse_args()

    if not args.host:
        print('Missing Redis host. Provide --host or set REDIS_HOST.')
        raise SystemExit(1)

    if args.password is None:
        args.password = getpass.getpass('Enter Redis password: ')

    try:
        redis_client = build_redis_client(args.host, args.port, args.password)
        count = push_logs(
            redis_client=redis_client,
            file_path=args.file,
            redis_key=args.key,
            clear_existing=args.clear_existing
        )
        print(f'Successfully pushed {count} logs to key: {args.key}')
    except Exception as exc:
        print(f'Failed to upload simulated logs: {exc}')
        raise SystemExit(1)


if __name__ == '__main__':
    main()
