# Добавление доменов

## 1. Отключение ECH

В консоли на https://dash.cloudflare.com:

```sh
const zone = await fetch('https://dash.cloudflare.com/api/v4/zones?name=example.com').then(r=>r.json())

if (!zone.result?.[0]?.id) throw new Error('no zone')

await fetch(`https://dash.cloudflare.com/api/v4/zones/${zone.result[0].id}/settings/ech`, { 
    method: 'PATCH',
    body: '{"value": "off"}', 
    headers: { 
        'Content-Type': 'application/json',
        'x-cross-site-security': 'dash'
    }
}).then(r=>r.json())
```