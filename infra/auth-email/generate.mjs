import { readFileSync, writeFileSync } from 'node:fs';

const locale = 'pl-PL';
const content = JSON.parse(
  readFileSync(new URL(`./content.${locale}.json`, import.meta.url), 'utf8'),
);
const common = JSON.parse(
  readFileSync(new URL(`./common.${locale}.json`, import.meta.url), 'utf8'),
);
const escape = (s) =>
  s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

for (const [type, c] of Object.entries(content)) {
  const action =
    type === 'reauthentication'
      ? '<p style="margin:28px 0;padding:20px;background:#f8f7f4;border:1px solid #e5e6df;border-radius:8px;text-align:center;font-family:Consolas,monospace;font-size:30px;letter-spacing:8px;color:#314c40;">{{ .Token }}</p>'
      : `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0;width:100%;"><tr><td align="center" bgcolor="#314c40" style="border-radius:8px;background:#314c40;mso-padding-alt:16px 24px;"><a href="{{ .ConfirmationURL }}" style="display:block;padding:16px 24px;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:bold;line-height:24px;color:#ffffff;text-decoration:none;border:1px solid #314c40;border-radius:8px;">${escape(c.button)}</a></td></tr></table><p style="font-size:12px;line-height:20px;color:#65705e;margin:0 0 8px;">${escape(common.fallbackLink)}</p><p style="margin:0 0 28px;font-size:12px;line-height:20px;word-break:break-all;overflow-wrap:anywhere;"><a href="{{ .ConfirmationURL }}" style="color:#314c40;text-decoration:underline;">{{ .ConfirmationURL }}</a></p>`;
  const html = `<!doctype html>
<html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escape(c.subject)}</title></head>
<body style="margin:0;padding:0;background:#f8f7f4;color:#2d332e;font-family:Arial,Helvetica,sans-serif;">
<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${escape(c.text)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#f8f7f4" style="background:#f8f7f4;"><tr><td align="center" style="padding:36px 16px;">
<!--[if mso]><table role="presentation" width="580"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%;">
<tr><td style="padding:0 8px 26px;"><p style="margin:0;font-size:24px;line-height:32px;letter-spacing:-1px;color:#314c40;"><strong>smart</strong><span style="font-weight:normal;">wardrobe</span></p><p style="margin:7px 0 0;font-size:9px;line-height:16px;font-weight:bold;letter-spacing:2px;color:#65705e;">${escape(common.tagline)}</p></td></tr>
<tr><td bgcolor="#ffffff" style="padding:32px 24px;background:#ffffff;border:1px solid #e5e6df;border-radius:14px;">
<p style="margin:0 0 18px;font-size:10px;line-height:18px;font-weight:bold;letter-spacing:1.5px;color:#65705e;">${escape(c.eyebrow)}</p>
<h1 style="margin:0 0 22px;font-family:Georgia,'Times New Roman',serif;font-size:32px;line-height:40px;font-weight:normal;letter-spacing:-0.6px;color:#314c40;">${escape(c.title)}</h1>
<p style="margin:0;font-size:16px;line-height:27px;color:#2d332e;">${escape(c.text)}</p>
${action}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding-top:20px;border-top:1px solid #e5e6df;"><p style="margin:0;font-size:12px;line-height:21px;color:#65705e;">${escape(c.security)}</p></td></tr></table>
</td></tr>
<tr><td style="padding:24px 8px 0;"><p style="margin:0 0 8px;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:24px;font-style:italic;color:#65705e;">${escape(common.motto)}</p><p style="margin:0;font-size:11px;line-height:19px;color:#65705e;">${escape(common.footer)}<br>${escape(common.automatic)}</p></td></tr>
</table><!--[if mso]></td></tr></table><![endif]-->
</td></tr></table></body></html>\n`;

  writeFileSync(new URL(`./templates/${locale}/${type}.html`, import.meta.url), html);
  writeFileSync(
    new URL(`./templates/${locale}/${type}.txt`, import.meta.url),
    `${c.subject}\n\n${c.title}\n\n${c.text}\n\n${type === 'reauthentication' ? `${common.code}: {{ .Token }}` : c.button + ': {{ .ConfirmationURL }}'}\n\n${c.security}\n\nSmart Wardrobe\n`,
  );
}
