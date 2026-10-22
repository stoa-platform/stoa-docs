// Keep compiled MDX and server-rendered HTML consistent for client navigation.
export default function directoryLinks() {
  function normalize(value) {
    const match = value.match(/^(https:\/\/docs\.gostoa\.dev)?(\/(?:fr\/)?(?:docs|blog)(?:\/[^?#]*)?)([?#].*)?$/);
    if (!match || /\.[^/]+$/.test(match[2])) return value;
    return (match[1] || '') + match[2].replace(/\/$/, '') + '/' + (match[3] || '');
  }
  function visit(node) {
    if (!node || typeof node !== 'object') return;
    if ((node.type === 'link' || node.type === 'definition') && typeof node.url === 'string') {
      node.url = normalize(node.url);
    }
    if (node.type === 'mdxJsxAttribute' && ['href', 'to'].includes(node.name) && typeof node.value === 'string') {
      node.value = normalize(node.value);
    }
    for (const child of [...(node.children || []), ...(Array.isArray(node.attributes) ? node.attributes : [])]) visit(child);
  }
  return visit;
}
