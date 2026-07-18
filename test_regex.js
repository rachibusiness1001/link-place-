function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
const text = 'fairly AI is ai-powered .NET $100';
const anchorText = 'ai';
const anchorRegex = new RegExp('\\b' + escapeRegExp(anchorText) + '\\b', 'i');
console.log(text.match(anchorRegex));
