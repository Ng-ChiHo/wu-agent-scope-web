const URL_REGEX = /(https?:\/\/[^\s<>"')\]]+[^\s<>"')\],.!?:;])/g

export function parseLinks(text) {
  if (!text) return ''
  return text.replace(URL_REGEX, (url) => {
    return `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color:#00ffff;text-decoration:underline;">${url}</a>`
  })
}
