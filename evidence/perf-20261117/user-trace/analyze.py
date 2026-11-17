import json,collections,os
D=json.load(open('/Users/jacky/Downloads/Trace-20261117T130822.json')); E=D['traceEvents']; W=D['metadata']['modifications']['initialBreadcrumb']['window']; lo,hi=W['min'],W['max']
P={}; profiles={}; workers={}; threads={}
for e in E:
 if e['name']=='thread_name': threads[e['pid'],e['tid']]=e['args']['name']
 if e['name']=='TracingSessionIdForWorker':workers[e['tid']]=e['args']['data']['url']
 if e['name']=='Profile':profiles[e['pid'],e.get('id')]=e
 if e['name']=='ProfileChunk':
  k=(e['pid'],e.get('id')); p=P.setdefault(k,{'nodes':{},'pairs':[]});a=e['args']['data'];cp=a.get('cpuProfile',{})
  for n in cp.get('nodes',[]):p['nodes'][n['id']]=n
  p['pairs']+=list(zip(cp.get('samples',[]),a.get('timeDeltas',[])))
print('WINDOW seconds',(hi-lo)/1e6)
for k,p in P.items():
 start=profiles.get(k,{}); tid=start.get('tid');t=start.get('args',{}).get('data',{}).get('startTime',lo);selfs=collections.Counter();inc=collections.Counter(); count=0;outliers=0
 def key(n):
  f=n.get('callFrame',{});return (f.get('functionName',''),f.get('url',''),f.get('lineNumber',-1)+1)
 points=[]
 for nid,dt in p['pairs']:
  t+=dt;points.append((t,nid))
 points.sort()
 for idx,(t,nid) in enumerate(points):
  end=points[idx+1][0] if idx+1<len(points) else t;weight=max(0,min(end,hi)-max(t,lo))
  if not weight:continue
  if weight>2000:outliers+=1
  n=p['nodes'].get(nid,{});selfs[key(n)]+=weight;seen=set()
  while n and n['id'] not in seen:
   seen.add(n['id']);inc[key(n)]+=weight;n=p['nodes'].get(n.get('parent'))
  count+=1
 print('\nPROFILE',k,'tid',tid,workers.get(tid,''),'samples',count,'sum_ms',round(sum(selfs.values())/1000,2),'gaps>2ms',outliers)
 print('SELF',[(a,round(b/1000,1)) for a,b in selfs.most_common(16)])
 print('INCLUSIVE',[(a,round(b/1000,1)) for a,b in inc.most_common(12)])
main=[e for e in E if e['pid']==55441 and e['tid']==2153300 and e.get('ph')=='X' and lo<=e['ts']<=hi]
tasks=[e for e in main if e['name']=='RunTask'];long=[e for e in tasks if e.get('dur',0)>50000]
print('\nMAIN tasks',len(tasks),'total_ms',sum(e.get('dur',0) for e in tasks)/1000,'LONG',len(long))
for e in sorted(long,key=lambda e:e.get('dur',0),reverse=True)[:12]:
 s=e['ts'];end=s+e['dur'];sub=[x for x in main if s<=x['ts']<end and x['name'] in ('FunctionCall','FireAnimationFrame','EventDispatch','UpdateLayoutTree','Layout','MajorGC','MinorGC')];print('LONG',round((s-lo)/1e6,3),round(e['dur']/1000,2),[(x['name'],round(x.get('dur',0)/1000,2),x.get('args')) for x in sub[:8]])
a=collections.Counter()
for e in main:a[e['name']]+=e.get('dur',0)
print('MAIN events summed nested',[(k,round(v/1000,2)) for k,v in a.most_common(25)])
cs=[e for e in E if e['pid']==55441 and e['tid']==2153300 and e['name']=='UpdateCounters' and lo<=e['ts']<=hi];print('COUNTERS',len(cs))
for field in ('jsHeapSizeUsed','documents','nodes','jsEventListeners'):
 vs=[(e['ts'],e['args'].get('data',{}).get(field)) for e in cs if field in e['args'].get('data',{})]
 if vs: print(field,'first,last,min,max',vs[0][1],vs[-1][1],min(v for _,v in vs),max(v for _,v in vs))
