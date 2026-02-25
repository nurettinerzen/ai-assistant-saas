const TRUSTED_SCRIPT_ORIGINS = [
  'https://static.iyzipay.com',
  'https://sandbox-static.iyzipay.com',
  'https://www.gstatic.com',
];

function isTrustedScriptSrc(src = '') {
  try {
    const url = new URL(src, window.location.origin);
    return TRUSTED_SCRIPT_ORIGINS.some((origin) => url.origin === origin);
  } catch {
    return false;
  }
}

function isSafeInlineScript(content = '') {
  const value = String(content || '');
  if (!value || value.length > 10000) {
    return false;
  }

  // Allow only known checkout bootstrap snippets.
  return /iyzi|iyzipay|checkoutFormContent/i.test(value);
}

export function renderTrustedCheckoutHtml(container, html) {
  if (!container || typeof window === 'undefined') return;

  const template = document.createElement('template');
  template.innerHTML = String(html || '');

  const scripts = [];
  const scriptNodes = template.content.querySelectorAll('script');
  scriptNodes.forEach((script) => {
    const src = script.getAttribute('src');
    const inline = script.textContent || '';
    if (src && isTrustedScriptSrc(src)) {
      scripts.push({ src, async: script.async, defer: script.defer });
    } else if (!src && isSafeInlineScript(inline)) {
      scripts.push({ inline });
    }
    script.remove();
  });

  // Strip inline event handlers and javascript: URLs.
  template.content.querySelectorAll('*').forEach((node) => {
    Array.from(node.attributes || []).forEach((attr) => {
      const name = String(attr.name || '').toLowerCase();
      const value = String(attr.value || '');
      if (name.startsWith('on')) {
        node.removeAttribute(attr.name);
        return;
      }
      if ((name === 'href' || name === 'src') && value.trim().toLowerCase().startsWith('javascript:')) {
        node.removeAttribute(attr.name);
      }
    });
  });

  container.replaceChildren(template.content.cloneNode(true));

  scripts.forEach((scriptDef) => {
    const script = document.createElement('script');
    if (scriptDef.src) {
      script.src = scriptDef.src;
      script.async = Boolean(scriptDef.async);
      script.defer = Boolean(scriptDef.defer);
      document.head.appendChild(script);
    } else if (scriptDef.inline) {
      script.textContent = scriptDef.inline;
      container.appendChild(script);
    }
  });
}
