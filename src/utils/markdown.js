import { marked } from 'marked'
import DOMPurify from 'dompurify'
import '@/assets/hljs-neural-green.css'

// Only import commonly used languages (~80KB vs ~1MB full build)
import hljs from 'highlight.js/lib/core'
import javascript from 'highlight.js/lib/languages/javascript'
import typescript from 'highlight.js/lib/languages/typescript'
import python from 'highlight.js/lib/languages/python'
import java from 'highlight.js/lib/languages/java'
import sql from 'highlight.js/lib/languages/sql'
import bash from 'highlight.js/lib/languages/bash'
import json from 'highlight.js/lib/languages/json'
import xml from 'highlight.js/lib/languages/xml'
import css from 'highlight.js/lib/languages/css'
import markdown from 'highlight.js/lib/languages/markdown'
import yaml from 'highlight.js/lib/languages/yaml'
import cpp from 'highlight.js/lib/languages/cpp'
import go from 'highlight.js/lib/languages/go'
import rust from 'highlight.js/lib/languages/rust'
import php from 'highlight.js/lib/languages/php'

// Register languages
hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('js', javascript)
hljs.registerLanguage('typescript', typescript)
hljs.registerLanguage('ts', typescript)
hljs.registerLanguage('python', python)
hljs.registerLanguage('py', python)
hljs.registerLanguage('java', java)
hljs.registerLanguage('sql', sql)
hljs.registerLanguage('bash', bash)
hljs.registerLanguage('sh', bash)
hljs.registerLanguage('shell', bash)
hljs.registerLanguage('json', json)
hljs.registerLanguage('xml', xml)
hljs.registerLanguage('html', xml)
hljs.registerLanguage('css', css)
hljs.registerLanguage('markdown', markdown)
hljs.registerLanguage('md', markdown)
hljs.registerLanguage('yaml', yaml)
hljs.registerLanguage('yml', yaml)
hljs.registerLanguage('cpp', cpp)
hljs.registerLanguage('c', cpp)
hljs.registerLanguage('go', go)
hljs.registerLanguage('rust', rust)
hljs.registerLanguage('rs', rust)
hljs.registerLanguage('php', php)

// Custom renderer
const renderer = new marked.Renderer()

renderer.code = function ({ text, lang }) {
  const language = lang || 'plaintext'
  let highlighted
  try {
    highlighted = lang && hljs.getLanguage(lang)
      ? hljs.highlight(text, { language }).value
      : hljs.highlightAuto(text).value
  } catch {
    highlighted = escapeHtml(text)
  }
  return `<div class="code-block">
    <div class="code-header">
      <span class="code-lang">${language}</span>
      <button class="copy-btn" onclick="navigator.clipboard.writeText(this.closest('.code-block').querySelector('code').textContent)">复制</button>
    </div>
    <pre><code class="hljs language-${language}">${highlighted}</code></pre>
  </div>`
}

renderer.link = function ({ href, title, text }) {
  const titleAttr = title ? ` title="${title}"` : ''
  return `<a href="${href}"${titleAttr} target="_blank" rel="noopener noreferrer">${text}</a>`
}

renderer.table = function ({ header, rows }) {
  const headerCells = header.map(cell => `<th>${cell.text}</th>`).join('')
  const bodyRows = rows.map(row => {
    const cells = row.map(cell => `<td>${cell.text}</td>`).join('')
    return `<tr>${cells}</tr>`
  }).join('')
  return `<div class="table-wrapper"><table><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table></div>`
}

marked.use({ renderer, breaks: true, gfm: true })

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * Parse markdown to sanitized HTML
 */
export function renderMarkdown(text) {
  if (!text) return ''
  const html = marked.parse(text)
  return DOMPurify.sanitize(html, {
    ADD_TAGS: ['button'],
    ADD_ATTR: ['onclick', 'class']
  })
}
