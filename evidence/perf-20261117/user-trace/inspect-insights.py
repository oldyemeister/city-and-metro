"""Read-only event breakdown; times are elapsed milliseconds, not CPU time."""
import collections
import json
from pathlib import Path

source = Path('/Users/jacky/Downloads/Trace-20261117T130822.json')
events = json.loads(source.read_text())['traceEvents']
for name in ('Layout', 'UpdateLayoutTree'):
    groups = collections.defaultdict(list)
    for event in events:
        if (event.get('name') != name or event.get('pid') != 55441
                or event.get('tid') != 2153300):
            continue
        stack = event.get('args', {}).get('beginData', {}).get('stackTrace', [])
        key = ' > '.join(frame.get('functionName', '?') for frame in stack[:3]) or '(no stack)'
        groups[key].append(event.get('dur', 0) / 1000)
    print(name)
    for key, durations in sorted(groups.items(), key=lambda pair: sum(pair[1]), reverse=True):
        print(f'  {key}: count={len(durations)}, total_ms={sum(durations):.3f}, max_ms={max(durations):.3f}')
interactions = collections.defaultdict(list)
for event in events:
    data = event.get('args', {}).get('data', {})
    if event.get('name') == 'EventTiming' and data.get('interactionId'):
        interactions[data['interactionId']].append(data)
print('Recorded interactions (not whole-session field INP):')
for key, rows in interactions.items():
    print(key, sorted({row['type'] for row in rows}), max(row.get('duration', 0) for row in rows))
counts = collections.Counter(event.get('name') for event in events)
print('Network events:', {name: counts[name] for name in ('ResourceSendRequest', 'ResourceReceiveResponse')})
