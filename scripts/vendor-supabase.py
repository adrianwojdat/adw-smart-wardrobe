from pathlib import Path
from urllib.request import urlopen
import hashlib,json
sha='189adda99d1b56da55fc5a6ee3f849354aaea92a'
paths=['volumes/db/'+n+'.sql' for n in ['realtime','webhooks','roles','jwt','_supabase','logs','pooler']]+['volumes/api/envoy/'+n for n in ['envoy.yaml','cds.yaml','lds.template.yaml','docker-entrypoint.sh']]+['volumes/pooler/pooler.exs','volumes/functions/main/index.ts','volumes/functions/main/memory-pressure.ts','volumes/functions/hello/index.ts']
checks={}
for p in paths:
 data=urlopen(f'https://raw.githubusercontent.com/supabase/supabase/{sha}/docker/{p}').read()
 target=Path('infra/supabase')/p;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(data)
 checks[p]=hashlib.sha256(data).hexdigest()
Path('infra/supabase/provenance.json').write_text(json.dumps({'release':'0.8.4','commit':sha,'source':'https://github.com/supabase/supabase/tree/'+sha+'/docker','sha256':checks},indent=2)+'\n')
print('Vendored',len(paths),'official Supabase configuration files')
